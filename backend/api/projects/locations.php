<?php
// backend/api/projects/locations.php
// GET: list locations for a project
// POST: add a location to a project
// DELETE: remove a location

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';
require_once dirname(__DIR__, 2) . '/utils/Validator.php';

Response::setCorsHeaders();
$user = Auth::requireAuth(['Admin', 'Manager']);

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $projectName = Validator::sanitizeString($_GET['project_name'] ?? null, 150);
    if (empty($projectName)) Response::error('project_name is required', 400);

    $stmt = $pdo->prepare(
        "SELECT id, project_name, location, created_at
         FROM project_locations
         WHERE project_name = ?
         ORDER BY location ASC"
    );
    $stmt->execute([$projectName]);
    Response::success('OK', ['locations' => $stmt->fetchAll()]);
}

elseif ($method === 'POST') {
    $body        = json_decode(file_get_contents('php://input'), true);
    $projectName = Validator::sanitizeString($body['project_name'] ?? null, 150);
    $location    = Validator::sanitizeString($body['location'] ?? null, 150);

    if (empty($projectName) || empty($location)) {
        Response::error('project_name and location are required', 400);
    }

    $stmt = $pdo->prepare(
        "INSERT IGNORE INTO project_locations (project_name, location) VALUES (?, ?)"
    );
    $stmt->execute([$projectName, $location]);
    $newId = (int)$pdo->lastInsertId();

    Response::success('Location added.', ['id' => $newId, 'project_name' => $projectName, 'location' => $location]);
}

elseif ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) Response::error('Valid id required', 400);

    $stmt = $pdo->prepare("DELETE FROM project_locations WHERE id = ?");
    $stmt->execute([$id]);
    Response::success('Location deleted.');
}

else {
    Response::error('Method not allowed', 405);
}
