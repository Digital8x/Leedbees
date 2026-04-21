<?php
// backend/api/dashboard_v2.php
// Highly optimized endpoints for the V2 Command Center

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

$locationFilter = Validator::sanitizeString($_GET['location'] ?? null, 150);

$active = "deleted_at IS NULL";
$locCond = '';
$locBind = [];

if ($locationFilter) {
    $locCond = " AND (project IN (SELECT project_name FROM project_locations WHERE TRIM(location) = ?) OR TRIM(city) = ?)";
    $locBind = [$locationFilter, $locationFilter];
}

$whereStr = "WHERE $active $locCond";

// Pre-fetch fast stats
try {
    // Basic Counts
    $stmtCounts = $pdo->prepare("SELECT 
        COUNT(*) as total_overall,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as total_today,
        SUM(CASE WHEN assigned_to IS NOT NULL THEN 1 ELSE 0 END) as assigned_overall,
        SUM(CASE WHEN assigned_to IS NULL THEN 1 ELSE 0 END) as unassigned_overall,
        SUM(CASE WHEN DATE(created_at) = CURDATE() AND assigned_to IS NOT NULL THEN 1 ELSE 0 END) as assigned_today,
        SUM(CASE WHEN DATE(created_at) = CURDATE() AND assigned_to IS NULL THEN 1 ELSE 0 END) as unassigned_today,
        SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as duplicates_overall,
        SUM(CASE WHEN DATE(created_at) = CURDATE() AND is_duplicate = 1 THEN 1 ELSE 0 END) as duplicates_today,
        SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END) as fresh_overall,
        SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'New' THEN 1 ELSE 0 END) as fresh_today
    FROM leads $whereStr");
    $stmtCounts->execute($locBind);
    $counts = $stmtCounts->fetch(PDO::FETCH_ASSOC);

    // Active Users
    $activeUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE is_active = 1")->fetchColumn();

    // Alerts
    $alerts = [];
    if ($counts['unassigned_overall'] > 50) {
        $alerts[] = ['type' => 'warning', 'message' => "High volume of unassigned leads: {$counts['unassigned_overall']} pending."];
    }
    if ($counts['duplicates_today'] > 50) {
        $alerts[] = ['type' => 'danger', 'message' => "Sudden spike in duplicates today: {$counts['duplicates_today']} detected."];
    }
    
    // Check webhook logs for recent failures
    $errStmt = $pdo->prepare("SELECT COUNT(*) FROM webhook_logs WHERE status != 'success' AND DATE(created_at) = CURDATE()");
    $errStmt->execute();
    if ((int)$errStmt->fetchColumn() > 10) {
        $alerts[] = ['type' => 'danger', 'message' => "Webhook failures detected! Check Webhook Logs immediately."];
    }

    // Live Activity Stream
    $actStmt = $pdo->prepare("
        SELECT actor_name as actor, event_type as action, description as info, created_at as time 
        FROM lead_timeline 
        ORDER BY created_at DESC LIMIT 15
    ");
    $actStmt->execute();
    $rawActivities = $actStmt->fetchAll(PDO::FETCH_ASSOC);
    
    $activities = array_map(function($a) {
        return [
            'actor'  => $a['actor'] ?: 'System',
            'action' => $a['action'],
            'time'   => (new DateTime($a['time']))->format('H:i A'),
            'source' => mb_substr($a['info'], 0, 40)
        ];
    }, $rawActivities);

    // Light Charts
    // Source
    $srcStmt = $pdo->prepare("SELECT COALESCE(NULLIF(TRIM(first_source),''), 'Unknown') as source, COUNT(*) as count FROM leads $whereStr GROUP BY source ORDER BY count DESC LIMIT 8");
    $srcStmt->execute($locBind);
    $chartsSource = $srcStmt->fetchAll(PDO::FETCH_ASSOC);

    // Device
    $devStmt = $pdo->prepare("SELECT COALESCE(NULLIF(TRIM(device),''), 'Unknown') as device, COUNT(*) as count FROM leads $whereStr GROUP BY device ORDER BY count DESC LIMIT 5");
    $devStmt->execute($locBind);
    $chartsDevice = $devStmt->fetchAll(PDO::FETCH_ASSOC);

    // Location (only if no location selected)
    $chartsLocation = [];
    if (!$locationFilter) {
        $locStmt = $pdo->query("SELECT pl.location, COUNT(l.id) AS count FROM project_locations pl INNER JOIN leads l ON l.project = pl.project_name AND l.deleted_at IS NULL GROUP BY pl.location ORDER BY count DESC LIMIT 8");
        $chartsLocation = $locStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Standardize Response
    $kpis = [
        'overall' => [
            'total_leads' => (int)$counts['total_overall'],
            'assigned_leads' => (int)$counts['assigned_overall'],
            'unassigned_leads' => (int)$counts['unassigned_overall'],
            'duplicates' => (int)$counts['duplicates_overall'],
            'fresh_leads' => (int)$counts['fresh_overall'],
        ],
        'today' => [
            'total_leads' => (int)$counts['total_today'],
            'assigned_leads' => (int)$counts['assigned_today'],
            'unassigned_leads' => (int)$counts['unassigned_today'],
            'duplicates' => (int)$counts['duplicates_today'],
            'fresh_leads' => (int)$counts['fresh_today'],
        ]
    ];

    Response::success('OK', [
        'kpis' => $kpis,
        'active_users' => $activeUsers,
        'alerts' => $alerts,
        'activities' => $activities,
        'charts' => [
            'source' => $chartsSource,
            'device' => $chartsDevice,
            'location' => $chartsLocation
        ]
    ]);

} catch (\Exception $e) {
    error_log('DashboardV2 Error: ' . $e->getMessage());
    Response::error('Failed to load command center stats.', 500);
}
