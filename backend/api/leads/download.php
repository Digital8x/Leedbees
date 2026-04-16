<?php
// backend/api/leads/download.php
// Supports: all leads, project-wise, selection-wise (by IDs), batch

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';
require_once dirname(__DIR__, 2) . '/core/RateLimiter.php';
require_once dirname(__DIR__, 2) . '/core/ExcelHandler.php';
require_once dirname(__DIR__, 2) . '/core/DuplicateDetector.php';

Response::setCorsHeaders();

$user = Auth::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$pdo      = Database::getConnection();

// --- IP-based Rate limit (Abuse Protection) ---
$ip = RateLimiter::getIp();
$rateLimit = RateLimiter::check($pdo, $ip, 'lead_export', 5, 60); // 5 exports per minute
if (!$rateLimit['allowed']) {
    $resetTime = date('i:s', strtotime($rateLimit['reset_at']));
    Response::tooManyRequests("Export quota exceeded. Please wait a moment before trying again.");
}

$where    = "WHERE l.deleted_at IS NULL";
$bindings = [];

// Role: callers only see their own leads
if (in_array($user['role'], ['Caller', 'Relationship Manager'], true)) {
    $where .= ' AND l.assigned_to = ?';
    $bindings[] = $user['id'];
}

// selection-wise (comma-separated IDs)
$exportIds = Validator::sanitizeString($_GET['export_ids'] ?? null);
if ($exportIds !== '') {
    $ids  = array_filter(array_map('intval', explode(',', $exportIds)), fn($id) => $id > 0);
    if (!empty($ids)) {
        $ph    = implode(',', array_fill(0, count($ids), '?'));
        $where .= " AND l.id IN ({$ph})";
        $bindings = array_merge($bindings, $ids);
    }
}

// Project filter
$project = Validator::sanitizeString($_GET['project'] ?? null);
if ($project) { $where .= ' AND l.project = ?'; $bindings[] = $project; }

// Status filter
$status = Validator::sanitizeString($_GET['status'] ?? null);
if ($status) { $where .= ' AND l.status = ?'; $bindings[] = $status; }

// Batch filter
$batchId = Validator::sanitizeString($_GET['batch_id'] ?? null);
if ($batchId) { $where .= ' AND l.first_batch_id = ?'; $bindings[] = $batchId; }

// NRI filter
$isNriRaw = $_GET['is_nri'] ?? null;
if ($isNriRaw !== null) { 
    $isNri = (int)Validator::sanitizeString($isNriRaw);
    $where .= ' AND l.is_nri = ?'; 
    $bindings[] = $isNri; 
}

$sql = "SELECT l.id, l.name, l.phone, l.email, l.project, l.status, l.country,
               l.ip_address, l.device, l.refer_url, l.remark, l.entry_id,
               l.is_nri, l.created_at,
               u.name AS assigned_to_name
        FROM leads l
        LEFT JOIN users u ON l.assigned_to = u.id
        {$where}
        ORDER BY l.created_at DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($bindings);
$leads = $stmt->fetchAll();

if (empty($leads)) {
    Response::error('No leads found for the selected criteria.');
}

$fileName = ExcelHandler::generateLeadsExcel($leads, 'Leads_' . date('Y_m_d'));

$detector = new DuplicateDetector($pdo);
foreach ($leads as $lead) {
    $detector->logTimeline((int)$lead['id'], 'Downloaded',
        "Downloaded by {$user['name']}", (int)$user['id'], $user['name']);
}

Auth::logActivity($pdo, (int)$user['id'], $user['name'], 'Download',
    count($leads) . ' leads downloaded.');

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="Leads_' . date('Y_m_d_His') . '.xlsx"');
header('Content-Length: ' . filesize($fileName));
header('Cache-Control: no-cache, no-store, must-revalidate');
readfile($fileName);
@unlink($fileName);
exit;
