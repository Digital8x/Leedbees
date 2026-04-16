<?php
// backend/api/leads/list.php — v3

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/utils/Validator.php';

Response::setCorsHeaders();

$user = Auth::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$pdo = Database::getConnection();

// --- Query Params ---
$page        = max(1, Validator::asInt($_GET['page'] ?? 1, 1));
$limit       = Validator::asInt($_GET['limit'] ?? 50, 50);
$limit       = min(1000, max(10, $limit));
$offset      = ($page - 1) * $limit;
$search      = Validator::sanitizeString($_GET['search'] ?? null);
$status      = Validator::sanitizeString($_GET['status'] ?? null);
$batchId     = Validator::sanitizeString($_GET['batch_id'] ?? null);
$isDup       = isset($_GET['is_duplicate']) ? (int)$_GET['is_duplicate'] : null;
$isNri       = isset($_GET['is_nri'])       ? (int)$_GET['is_nri']       : null;
$assignee    = Validator::asInt($_GET['assigned_to'] ?? null, -1);
if ($assignee === -1) $assignee = null;
$project     = Validator::sanitizeString($_GET['project'] ?? null);
$device      = Validator::sanitizeString($_GET['device'] ?? null);
$dateFrom    = Validator::sanitizeString($_GET['date_from'] ?? null);
$dateTo      = Validator::sanitizeString($_GET['date_to'] ?? null);
$showDeleted = ($_GET['show_deleted'] ?? '') === '1';

// Sort
$allowedSorts = ['name' => 'l.name', 'assigned' => 'u.name', 'date' => 'l.created_at', 'id' => 'l.id'];
$sortBy  = $allowedSorts[$_GET['sort_by'] ?? 'date'] ?? 'l.created_at';
$sortDir = strtoupper($_GET['sort_dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

// Role-based filtering
$roleFilter = '';
$bindings   = [];

$isCallerRole = in_array($user['role'], ['Caller', 'Relationship Manager'], true);
$isAssigneeFiltered = ($assignee !== null);

if ($isCallerRole && !$isAssigneeFiltered) {
    $roleFilter  = ' AND l.assigned_to = ?';
    $bindings[]  = $user['id'];
}

// Callers cannot see Not Interested leads
if ($isCallerRole) {
    $roleFilter .= " AND l.status != 'Not Interested'";
}

// WHERE
$where = "WHERE 1=1{$roleFilter}";

// Deleted / active
if (!$showDeleted) {
    $where .= ' AND l.deleted_at IS NULL';
} else {
    $where .= ' AND l.deleted_at IS NOT NULL';
}

if ($search !== '') {
    $where .= ' AND (l.phone LIKE ? OR l.name LIKE ? OR l.email LIKE ? OR l.id LIKE ?)';
    $bindings[] = "%{$search}%"; $bindings[] = "%{$search}%";
    $bindings[] = "%{$search}%"; $bindings[] = "%{$search}%";
}
if ($status !== '') { $where .= ' AND l.status = ?'; $bindings[] = $status; }
if ($batchId !== '') { $where .= ' AND l.first_batch_id = ?'; $bindings[] = $batchId; }
if ($isDup !== null) { $where .= ' AND l.is_duplicate = ?'; $bindings[] = $isDup; }
if ($isNri !== null) { $where .= ' AND l.is_nri = ?'; $bindings[] = $isNri; }
if ($assignee !== null) { $where .= ' AND l.assigned_to = ?'; $bindings[] = $assignee; }
if ($project !== '') { $where .= ' AND l.project = ?'; $bindings[] = $project; }
if ($device !== '') { $where .= ' AND l.device LIKE ?'; $bindings[] = "%{$device}%"; }
if ($dateFrom !== '') { $where .= ' AND DATE(l.created_at) >= ?'; $bindings[] = $dateFrom; }
if ($dateTo !== '') { $where .= ' AND DATE(l.created_at) <= ?'; $bindings[] = $dateTo; }

// Count
$countStmt = $pdo->prepare("SELECT COUNT(*) FROM leads l LEFT JOIN users u ON l.assigned_to = u.id {$where}");
$countStmt->execute($bindings);
$total = (int)$countStmt->fetchColumn();

// Data
$sql = "
    SELECT l.id, l.entry_id, l.name, l.phone, l.email, l.project, l.status,
           l.country, l.ip_address, l.device, l.refer_url, l.remark,
           l.is_nri, l.is_duplicate, l.first_batch_id,
           l.created_at, l.updated_at, l.deleted_at,
           l.assigned_to, u.name AS assigned_to_name,
           la.assigned_at
    FROM leads l
    LEFT JOIN users u ON l.assigned_to = u.id
    LEFT JOIN (
        SELECT lead_id, MAX(assigned_at) AS assigned_at
        FROM lead_assignments GROUP BY lead_id
    ) la ON la.lead_id = l.id
    {$where}
    ORDER BY {$sortBy} {$sortDir}
    LIMIT {$limit} OFFSET {$offset}
";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($bindings);
    $leads = $stmt->fetchAll();
} catch (\PDOException $e) {
    Response::error('Database error: ' . $e->getMessage(), 500);
}

// Callers: strip project name
if ($isCallerRole) {
    $leads = array_map(function($l) {
        unset($l['project']);
        return $l;
    }, (array)$leads);
}

Response::success('OK', [
    'leads'       => $leads ?: [],
    'total'       => $total,
    'page'        => $page,
    'limit'       => $limit,
    'total_pages' => (int)ceil($total / $limit),
]);
