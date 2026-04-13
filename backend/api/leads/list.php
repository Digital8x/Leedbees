<?php
// backend/api/leads/list.php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';

Response::setCorsHeaders();

$user = Auth::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$pdo = Database::getConnection();

// --- Query Params ---
$page     = max(1, (int)($_GET['page'] ?? 1));
$limit    = min(200, max(10, (int)($_GET['limit'] ?? 50)));
$offset   = ($page - 1) * $limit;
$search   = trim($_GET['search'] ?? '');
$status   = trim($_GET['status'] ?? '');
$batchId  = trim($_GET['batch_id'] ?? '');
$isDup    = isset($_GET['is_duplicate']) ? (int)$_GET['is_duplicate'] : null;
$assignee  = trim($_GET['assigned_to'] ?? '');

// --- Role-based filtering ---
// Callers & RMs only see their own leads
$roleFilter = '';
$bindings   = [];

if (in_array($user['role'], ['Caller', 'Relationship Manager'], true)) {
    $roleFilter = ' AND l.assigned_to = ?';
    $bindings[] = $user['id'];
}

// --- WHERE clauses ---
$where = "WHERE 1=1{$roleFilter}";

if ($search !== '') {
    $where .= ' AND (l.phone LIKE ? OR l.name LIKE ? OR l.email LIKE ?)';
    $bindings[] = "%{$search}%";
    $bindings[] = "%{$search}%";
    $bindings[] = "%{$search}%";
}
if ($status !== '') {
    $where .= ' AND l.status = ?';
    $bindings[] = $status;
}
if ($batchId !== '') {
    $where .= ' AND l.first_batch_id = ?';
    $bindings[] = $batchId;
}
if ($isDup !== null) {
    $where .= ' AND l.is_duplicate = ?';
    $bindings[] = $isDup;
}
if ($assignee !== '') {
    $where .= ' AND l.assigned_to = ?';
    $bindings[] = $assignee;
}

// --- Count ---
$countStmt = $pdo->prepare("SELECT COUNT(*) FROM leads l {$where}");
$countStmt->execute($bindings);
$total = (int)$countStmt->fetchColumn();

// --- Data ---
$sql = "
    SELECT l.*, u.name AS assigned_to_name,
           la.assigned_at
    FROM leads l
    LEFT JOIN users u ON l.assigned_to = u.id
    LEFT JOIN (
        SELECT lead_id, MAX(assigned_at) AS assigned_at
        FROM lead_assignments GROUP BY lead_id
    ) la ON la.lead_id = l.id
    {$where}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
";
$bindings[] = $limit;
$bindings[] = $offset;

$stmt = $pdo->prepare($sql);
$stmt->execute($bindings);
$leads = $stmt->fetchAll();

Response::success('OK', [
    'leads'       => $leads,
    'total'       => $total,
    'page'        => $page,
    'limit'       => $limit,
    'total_pages' => (int)ceil($total / $limit),
]);
