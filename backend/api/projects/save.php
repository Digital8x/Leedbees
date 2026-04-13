<?php
// backend/api/projects/save.php
// Create or update project (name + optional location)

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';

Response::setCorsHeaders();
$user = Auth::requireAuth(['Admin', 'Manager']);

if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT'], true)) Response::error('Method not allowed', 405);

$body     = json_decode(file_get_contents('php://input'), true);
$name     = trim($body['name']     ?? '');
$location = trim($body['location'] ?? '');
$id       = (int)($body['id']      ?? 0);

if ($name === '') Response::error('Project name is required.');

$pdo = Database::getConnection();

if ($id > 0) {
    $pdo->prepare("UPDATE projects SET name = ?, location = ? WHERE id = ?")
        ->execute([$name, $location ?: null, $id]);
    Response::success('Project updated.', ['id' => $id, 'name' => $name, 'location' => $location]);
}

$stmt = $pdo->prepare("INSERT INTO projects (name, location) VALUES (?, ?) ON DUPLICATE KEY UPDATE location = VALUES(location)");
$stmt->execute([$name, $location ?: null]);
$newId = (int)$pdo->lastInsertId();

Response::success('Project saved.', ['id' => $newId, 'name' => $name, 'location' => $location]);
