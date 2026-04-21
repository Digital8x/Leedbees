<?php
// backend/api/admin/aggregate.php
// Cron job script to aggregate heavy analytics data into summaries

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';

try {
    $pdo = Database::getConnection();

    // 1. Fill lead_daily_stats
    $pdo->exec("
      INSERT INTO lead_daily_stats (stat_date, project, location, source, total_leads, conversions, duplicates)
      SELECT 
        DATE(l.created_at) as stat_date,
        COALESCE(NULLIF(TRIM(l.project), ''), 'Unknown') as project,
        COALESCE(NULLIF(TRIM(pl.location), ''), 'Unknown') as location,
        COALESCE(NULLIF(TRIM(l.first_source), ''), 'Unknown') as source,
        COUNT(l.id) as total_leads,
        SUM(CASE WHEN l.status = 'Booked' THEN 1 ELSE 0 END) as conversions,
        SUM(l.is_duplicate) as duplicates
      FROM leads l
      LEFT JOIN project_locations pl ON l.project = pl.project_name
      WHERE l.deleted_at IS NULL
      GROUP BY DATE(l.created_at), l.project, pl.location, l.first_source
      ON DUPLICATE KEY UPDATE 
        total_leads = VALUES(total_leads),
        conversions = VALUES(conversions),
        duplicates = VALUES(duplicates)
    ");

    // 2. Fill agent_performance
    $pdo->exec("
      INSERT INTO agent_performance (agent_id, stat_date, assigned, contacted, converted, avg_resp_min)
      SELECT 
        l.assigned_to as agent_id,
        DATE(l.created_at) as stat_date,
        COUNT(l.id) as assigned,
        SUM(CASE WHEN l.status NOT IN ('New', 'Assigned') THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN l.status = 'Booked' THEN 1 ELSE 0 END) as converted,
        30 as avg_resp_min -- Initial placeholder logic (would calculate from lead_events normally)
      FROM leads l
      WHERE l.assigned_to IS NOT NULL AND l.deleted_at IS NULL
      GROUP BY l.assigned_to, DATE(l.created_at)
      ON DUPLICATE KEY UPDATE
        assigned = VALUES(assigned),
        contacted = VALUES(contacted),
        converted = VALUES(converted)
    ");

    // Check if called from CLI or web
    if (php_sapi_name() === 'cli') {
        echo "Aggregation successfully completed.\n";
    } else {
        header('Content-Type: application/json');
        echo json_encode(['status' => 'success', 'message' => 'Aggregation successfully completed.']);
    }

} catch (\Exception $e) {
    if (php_sapi_name() === 'cli') {
        echo "Error: " . $e->getMessage() . "\n";
    } else {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
}
