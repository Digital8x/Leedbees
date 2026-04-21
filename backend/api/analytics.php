<?php
// backend/api/analytics.php
// Highly optimized endpoints for the V2 Analytics War Room using aggregated data

declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';
require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/utils/Response.php';
require_once dirname(__DIR__) . '/core/Auth.php';
require_once dirname(__DIR__) . '/utils/Validator.php';

Response::setCorsHeaders();
$user = Auth::requireAuth(['Admin', 'Manager']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') Response::error('Method not allowed', 405);

$pdo = Database::getConnection();

// --- FILTERS ---
$dateRange = Validator::sanitizeString($_GET['dateRange'] ?? '30d');
$location = Validator::sanitizeString($_GET['location'] ?? null);
$agent = Validator::sanitizeString($_GET['agent'] ?? null);

// Allowlist dateRange to prevent unfiltered data on unexpected input
$allowedRanges = ['7d', '30d', '90d', 'all'];
if (!in_array($dateRange, $allowedRanges, true)) {
    $dateRange = '30d';
}

$dateCond = '1=1';
$dateBind = [];
if ($dateRange === '7d') {
    $dateCond = 'stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
} elseif ($dateRange === '30d') {
    $dateCond = 'stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
} elseif ($dateRange === '90d') {
    $dateCond = 'stat_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)';
}
// 'all' intentionally leaves $dateCond = '1=1' (no date restriction)

$locCond = $location ? " AND location = ?" : "";
$locBind = $location ? [$location] : [];

$agentCond = $agent ? " AND agent_id = ?" : "";
$agentBind = $agent ? [$agent] : [];

try {
    // Attempt triggering aggregation asynchronously so we have fresh data for the day
    AnalyticsHelpers::triggerAsyncAggregation();
} catch (\Exception $e) {}

try {
    // 1. SECTION A: PERFORMANCE DASHBOARD
    $perfStmt = $pdo->prepare("SELECT SUM(total_leads) as total, SUM(conversions) as converted FROM lead_daily_stats WHERE $dateCond $locCond");
    $perfStmt->execute(array_merge($dateBind, $locBind));
    $perf = $perfStmt->fetch(PDO::FETCH_ASSOC);
    $totalLeads = (int)$perf['total'];
    $convertedLeads = (int)$perf['converted'];
    $conversionRate = $totalLeads > 0 ? round(($convertedLeads / $totalLeads) * 100, 1) : 0;

    // 2. SECTION B: SOURCE ROI
    $srcStmt = $pdo->prepare("SELECT source, SUM(total_leads) as leads, SUM(conversions) as converted FROM lead_daily_stats WHERE $dateCond $locCond GROUP BY source ORDER BY leads DESC LIMIT 10");
    $srcStmt->execute(array_merge($dateBind, $locBind));
    $sourceROI = $srcStmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. SECTION C: AGENT INTELLIGENCE
    $agtStmt = $pdo->prepare("SELECT u.name, SUM(a.assigned) as assigned, SUM(a.converted) as converted, ROUND(AVG(a.avg_resp_min)) as avgResponseMins FROM agent_performance a JOIN users u ON a.agent_id = u.id WHERE $dateCond $agentCond GROUP BY a.agent_id ORDER BY converted DESC");
    $agtStmt->execute(array_merge($dateBind, $agentBind));
    $agents = $agtStmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. SECTION D: FUNNEL (Using Waterfall logic on live leads or stats)
    // To respect filters, we query leads table for precise funnel
    $fCond = str_replace('stat_date', 'DATE(created_at)', $dateCond);
    $fLocCond = $location ? " AND project IN (SELECT project_name FROM project_locations WHERE location = ?) " : "";
    
    $funnelStmt = $pdo->prepare("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status != 'New' THEN 1 ELSE 0 END) as contacted,
            SUM(CASE WHEN status IN ('Interested', 'Follow Up', 'Site Visit', 'Booked') THEN 1 ELSE 0 END) as qualified,
            SUM(CASE WHEN status IN ('Site Visit', 'Booked') THEN 1 ELSE 0 END) as visit,
            SUM(CASE WHEN status = 'Booked' THEN 1 ELSE 0 END) as closed
        FROM leads WHERE $fCond $fLocCond AND deleted_at IS NULL
    ");
    $funnelStmt->execute(array_merge($dateBind, $locBind));
    $fRow = $funnelStmt->fetch(PDO::FETCH_ASSOC);

    $t = max(1, (int)$fRow['total']);
    $funnel = [
        ['name' => 'New', 'count' => (int)$fRow['total'], 'dropPercentage' => round(100 - ((int)$fRow['contacted'] / $t) * 100)],
        ['name' => 'Contacted', 'count' => (int)$fRow['contacted'], 'dropPercentage' => $fRow['contacted'] > 0 ? round(100 - ((int)$fRow['qualified'] / $fRow['contacted']) * 100) : 0],
        ['name' => 'Qualified', 'count' => (int)$fRow['qualified'], 'dropPercentage' => $fRow['qualified'] > 0 ? round(100 - ((int)$fRow['visit'] / $fRow['qualified']) * 100) : 0],
        ['name' => 'Visit', 'count' => (int)$fRow['visit'], 'dropPercentage' => $fRow['visit'] > 0 ? round(100 - ((int)$fRow['closed'] / $fRow['visit']) * 100) : 0],
        ['name' => 'Closed', 'count' => (int)$fRow['closed'], 'dropPercentage' => 0]
    ];

    // 5. SECTION E: TIME ANALYTICS
    $time = [
        'avgResponseMins' => 30, // Mocked for now (would calculate from lead_events)
        'avgConversionDays' => 14
    ];

    // 6. SECTION G: DATA QUALITY
    // Get duplicates and total from same source (leads table, same filters as funnel) for consistency
    $dupLeadsStmt = $pdo->prepare("SELECT COUNT(*) as tot, SUM(is_duplicate) as dup FROM leads WHERE $fCond $fLocCond AND deleted_at IS NULL");
    $dupLeadsStmt->execute(array_merge($dateBind, $locBind));
    $dupLeadsRow = $dupLeadsStmt->fetch(PDO::FETCH_ASSOC);

    // Invalid (Not Interested / Wrong Number) — same table, same filters
    $invStmt = $pdo->prepare("SELECT COUNT(*) FROM leads WHERE $fCond $fLocCond AND status IN ('Not Interested', 'Wrong Number') AND deleted_at IS NULL");
    $invStmt->execute(array_merge($dateBind, $locBind));
    $invalidCount = (int)$invStmt->fetchColumn();

    $totLeads = max(1, (int)$dupLeadsRow['tot']);
    $dq = [
        'duplicatePercentage' => round(((int)$dupLeadsRow['dup'] / $totLeads) * 100, 1),
        'invalidPercentage'   => round(($invalidCount / $totLeads) * 100, 1)
    ];

    Response::success('OK', [
        'performance' => [
            'totalLeads' => $totalLeads,
            'convertedLeads' => $convertedLeads,
            'conversionRate' => $conversionRate
        ],
        'sourceROI' => $sourceROI,
        'agents' => $agents,
        'funnel' => $funnel,
        'time' => $time,
        'dataQuality' => $dq
    ]);

} catch (\Exception $e) {
    error_log('Analytics Error: ' . $e->getMessage());
    Response::error('Failed to load analytics.', 500);
}

class AnalyticsHelpers {
    public static function triggerAsyncAggregation() {
        // Non-blocking trigger to run aggregate.php via cli or basic hit
        // To be safe and compliant with diverse servers, we'll just omit auto-trigger if not available,
        // relying on the manual cron job or the user running it.
        // It's safest not to block.
    }
}
