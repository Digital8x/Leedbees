<?php
// backend/api/admin/stats.php — v3
// Supports optional ?location=X to scope all stats to a single location's projects.

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';
require_once dirname(__DIR__, 2) . '/utils/Validator.php';

Response::setCorsHeaders();
$user = Auth::requireAuth(['Admin', 'Manager']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') Response::error('Method not allowed', 405);

$pdo = Database::getConnection();

// Optional location filter
$locationFilter = Validator::sanitizeString($_GET['location'] ?? null, 150);

// Base condition: active (non-deleted) leads only
$active = "deleted_at IS NULL";

// If a location is selected, build an extra condition that restricts to projects of that location
$locationCond = '';
$locationBindings = [];

if (!empty($locationFilter)) {
    // Match leads by location via project_locations mapping OR direct city column
    $locationCond       = " AND (project IN (SELECT project_name FROM project_locations WHERE TRIM(location) = ?) OR TRIM(city) = ?)";
    $locationBindings   = [trim($locationFilter), trim($locationFilter)];
}

// ── Overview counts ───────────────────────────────────────────────────────────
$baseWhere    = "WHERE $active" . $locationCond;
$baseBindings = $locationBindings;

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM leads $baseWhere");
$countStmt->execute($baseBindings);
$totalLeads = (int)$countStmt->fetchColumn();

$dupStmt = $pdo->prepare("SELECT COUNT(*) FROM leads $baseWhere AND is_duplicate = 1");
$dupStmt->execute($baseBindings);
$duplicateLeads = (int)$dupStmt->fetchColumn();

$assignStmt = $pdo->prepare("SELECT COUNT(*) FROM leads $baseWhere AND assigned_to IS NOT NULL");
$assignStmt->execute($baseBindings);
$assignedLeads = (int)$assignStmt->fetchColumn();

$totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE is_active = 1")->fetchColumn();

// ── Status breakdown ──────────────────────────────────────────────────────────
$stStmt = $pdo->prepare(
    "SELECT status, COUNT(*) AS count
     FROM leads
     $baseWhere
     GROUP BY status
     ORDER BY count DESC"
);
$stStmt->execute($baseBindings);
$statusRows = $stStmt->fetchAll();

// ── Per-user stats ────────────────────────────────────────────────────────────
// Join condition scopes to location if needed
$userJoinCond = "l.assigned_to = u.id AND l.deleted_at IS NULL";
if ($locationFilter) {
    $userJoinCond .= " AND (l.project IN (SELECT project_name FROM project_locations WHERE TRIM(location) = ?) OR TRIM(l.city) = ?)";
}
$userBindings = $locationFilter ? [trim($locationFilter), trim($locationFilter)] : [];

$userStmt = $pdo->prepare(
    "SELECT u.id, u.name, u.role,
            SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) AS total_leads,
            SUM(CASE WHEN l.status = 'Interested' THEN 1 ELSE 0 END) AS interested,
            SUM(CASE WHEN l.status = 'Booked' THEN 1 ELSE 0 END) AS booked
     FROM users u
     LEFT JOIN leads l ON $userJoinCond
     WHERE u.is_active = 1
     GROUP BY u.id, u.name, u.role
     ORDER BY total_leads DESC"
);
$userStmt->execute($userBindings);
$userStats = $userStmt->fetchAll();

// ── Recent batches ────────────────────────────────────────────────────────────
$batchStmt = $pdo->prepare(
    "SELECT first_batch_id AS batch_id, first_source AS source,
            COUNT(*) AS total,
            SUM(is_duplicate) AS duplicates,
            MIN(created_at) AS uploaded_at
     FROM leads
     $baseWhere
       AND first_batch_id IS NOT NULL
     GROUP BY first_batch_id, first_source
     ORDER BY uploaded_at DESC
     LIMIT 10"
);
$batchStmt->execute($baseBindings);
$batches = $batchStmt->fetchAll();

// ── Location breakdown (always global — pie chart context) ────────────────────
// Uses project_locations to aggregate by named location (not raw city column)
$locationRows = $pdo->query(
    "SELECT pl.location, COUNT(l.id) AS count
     FROM project_locations pl
     INNER JOIN leads l ON l.project = pl.project_name AND l.deleted_at IS NULL
     GROUP BY pl.location
     ORDER BY count DESC
     LIMIT 15"
)->fetchAll();

Response::success('OK', [
    'overview' => [
        'total_leads'      => $totalLeads,
        'duplicate_leads'  => $duplicateLeads,
        'assigned_leads'   => $assignedLeads,
        'unassigned_leads' => $totalLeads - $assignedLeads,
        'total_users'      => $totalUsers,
    ],
    'status_breakdown'   => $statusRows,
    'user_stats'         => $userStats,
    'recent_batches'     => $batches,
    'location_breakdown' => $locationRows,
]);
