<?php
// backend/api/leads/download.php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';
require_once dirname(__DIR__, 2) . '/core/ExcelHandler.php';
require_once dirname(__DIR__, 2) . '/core/DuplicateDetector.php';

Response::setCorsHeaders();

$user = Auth::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$pdo = Database::getConnection();

// Build query based on role
$where    = "WHERE 1=1";
$bindings = [];

if (in_array($user['role'], ['Caller', 'Relationship Manager'], true)) {
    $where   .= ' AND l.assigned_to = ?';
    $bindings[] = $user['id'];
}

$batchId = trim($_GET['batch_id'] ?? '');
if ($batchId) {
    $where .= ' AND l.first_batch_id = ?';
    $bindings[] = $batchId;
}

$status = trim($_GET['status'] ?? '');
if ($status) {
    $where .= ' AND l.status = ?';
    $bindings[] = $status;
}

$sql = "SELECT l.*, u.name AS assigned_to_name, la.assigned_at
        FROM leads l
        LEFT JOIN users u ON l.assigned_to = u.id
        LEFT JOIN (
            SELECT lead_id, MAX(assigned_at) AS assigned_at FROM lead_assignments GROUP BY lead_id
        ) la ON la.lead_id = l.id
        {$where}
        ORDER BY l.created_at DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($bindings);
$leads = $stmt->fetchAll();

if (empty($leads)) {
    Response::error('No leads found for the selected criteria.');
}

// Generate Excel
$fileName = ExcelHandler::generateLeadsExcel($leads, 'Leads_' . date('Y_m_d'));

// Log timeline for downloaded leads
$detector = new DuplicateDetector($pdo);
foreach ($leads as $lead) {
    $detector->logTimeline((int)$lead['id'], 'Downloaded', "Downloaded by {$user['name']}", (int)$user['id'], $user['name']);
}

Auth::logActivity($pdo, (int)$user['id'], $user['name'], 'Download', count($leads) . ' leads downloaded.');

// Stream file
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="Leads_' . date('Y_m_d_His') . '.xlsx"');
header('Content-Length: ' . filesize($fileName));
header('Cache-Control: no-cache, no-store, must-revalidate');
readfile($fileName);
@unlink($fileName);
exit;
