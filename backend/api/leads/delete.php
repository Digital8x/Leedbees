<?php
// backend/api/leads/delete.php
// Modes: soft (move to trash), purge (hard-delete from trash), project-wise

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';

require_once dirname(__DIR__, 2) . '/utils/Validator.php';

Response::setCorsHeaders();

$user = Auth::requireAuth(['Admin', 'Manager']);

if (!in_array($_SERVER['REQUEST_METHOD'], ['DELETE', 'POST'], true)) {
    Response::error('Method not allowed', 405);
}

$body    = json_decode(file_get_contents('php://input'), true);
$mode    = Validator::sanitizeString($body['mode'] ?? 'single', 20);
$ids     = array_filter(array_map('intval', (array)($body['ids'] ?? [])), fn($id) => $id > 0);
$project = Validator::sanitizeString($body['project'] ?? null, 100) ?: '';

$pdo = Database::getConnection();

// --- PROJECT-WISE SOFT DELETE ---
if ($mode === 'project') {
    if ($project === '') Response::error('Project name required.');
    $stmt = $pdo->prepare("UPDATE leads SET deleted_at = NOW() WHERE project = ? AND deleted_at IS NULL");
    $stmt->execute([$project]);
    $count = $stmt->rowCount();
    Auth::logActivity($pdo, (int)$user['id'], $user['name'], 'Lead Delete',
        "Project-wise delete: {$count} leads from '{$project}'.");
    Response::success("{$count} leads deleted from project '{$project}'.", ['deleted' => $count]);
}

// --- PURGE ALL FROM TRASH (hard delete all soft-deleted) ---
if ($mode === 'purge_all') {
    $stmt = $pdo->prepare("DELETE FROM leads WHERE deleted_at IS NOT NULL");
    $stmt->execute();
    $count = $stmt->rowCount();
    Auth::logActivity($pdo, (int)$user['id'], $user['name'], 'Lead Purge',
        "Permanently purged {$count} leads from trash.");
    Response::success("{$count} leads permanently deleted.", ['deleted' => $count]);
}

// --- VALIDATE IDs ---
if (empty($ids) || !is_array($ids)) Response::error('ids array is required.');
$ids = array_values(array_filter(array_map('intval', $ids), fn($id) => $id > 0));
if (empty($ids)) Response::error('No valid lead IDs provided.');

// Limit to 1000
if (count($ids) > 1000) $ids = array_slice($ids, 0, 1000);

$placeholders = implode(',', array_fill(0, count($ids), '?'));

// --- PURGE (hard delete from trash) ---
if ($mode === 'purge') {
    $stmt = $pdo->prepare("DELETE FROM leads WHERE id IN ({$placeholders}) AND deleted_at IS NOT NULL");
    $stmt->execute(array_values($ids));
    $count = $stmt->rowCount();
    Auth::logActivity($pdo, (int)$user['id'], $user['name'], 'Lead Purge',
        "Permanently purged {$count} lead(s) from trash.");
    Response::success("{$count} lead(s) permanently deleted.", ['deleted' => $count]);
}

// --- SOFT DELETE (single / bulk) ---
$stmt = $pdo->prepare("UPDATE leads SET deleted_at = NOW() WHERE id IN ({$placeholders}) AND deleted_at IS NULL");
$stmt->execute(array_values($ids));
$count = $stmt->rowCount();
Auth::logActivity($pdo, (int)$user['id'], $user['name'], 'Lead Delete',
    "{$count} lead(s) moved to trash.");
Response::success("{$count} lead(s) moved to trash.", ['deleted' => $count]);
