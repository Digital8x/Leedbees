<?php
// backend/api/leads/delete.php
// Single, bulk, and project-wise soft-delete of leads

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';

Response::setCorsHeaders();

$user = Auth::requireAuth(['Admin', 'Manager']);

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$body    = json_decode(file_get_contents('php://input'), true);
$mode    = trim($body['mode'] ?? 'single'); // single | bulk | project
$ids     = $body['ids'] ?? [];              // for single/bulk
$project = trim($body['project'] ?? '');   // for project-wise delete

$pdo = Database::getConnection();

if ($mode === 'project') {
    if ($project === '') Response::error('project name required for project-wise delete.');
    $stmt = $pdo->prepare("UPDATE leads SET deleted_at = NOW() WHERE project = ? AND deleted_at IS NULL");
    $stmt->execute([$project]);
    $count = $stmt->rowCount();

    Auth::logActivity($pdo, (int)$user['id'], $user['name'], 'Lead Delete',
        "Project-wise delete: {$count} leads from project '{$project}'.");

    Response::success("{$count} leads deleted from project '{$project}'.", ['deleted' => $count]);
}

if (empty($ids) || !is_array($ids)) {
    Response::error('ids array is required.');
}

// Sanitize IDs
$ids = array_map('intval', $ids);
$ids = array_filter($ids, fn($id) => $id > 0);
if (empty($ids)) Response::error('No valid lead IDs provided.');

$placeholders = implode(',', array_fill(0, count($ids), '?'));
$stmt = $pdo->prepare("UPDATE leads SET deleted_at = NOW() WHERE id IN ({$placeholders}) AND deleted_at IS NULL");
$stmt->execute(array_values($ids));
$count = $stmt->rowCount();

Auth::logActivity($pdo, (int)$user['id'], $user['name'], 'Lead Delete',
    "{$count} lead(s) soft-deleted. IDs: " . implode(', ', $ids));

Response::success("{$count} lead(s) deleted.", ['deleted' => $count]);
