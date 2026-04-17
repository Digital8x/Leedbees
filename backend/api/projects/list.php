<?php
// backend/api/projects/list.php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';
require_once dirname(__DIR__, 2) . '/utils/Validator.php';

Response::setCorsHeaders();
$user = Auth::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') Response::error('Method not allowed', 405);

$pdo  = Database::getConnection();
$mode = $_GET['mode'] ?? 'active_leads';

// ── MASTER MODE: all projects from master table ───────────────────────────────
if ($mode === 'master') {
    $projects = $pdo->query("SELECT id, name, location, created_at FROM projects ORDER BY name")->fetchAll();
    Response::success('OK', ['projects' => $projects]);
}

// ── BY_LOCATION MODE: projects from active leads that belong to a given location ─
elseif ($mode === 'by_location') {
    $location = Validator::sanitizeString($_GET['location'] ?? null, 150);

    if (empty($location)) {
        // No location given — fall through to active_leads (all valid project names)
        $stmt = $pdo->query(
            "SELECT DISTINCT l.project AS name
             FROM leads l
             WHERE l.project IS NOT NULL
               AND l.project != ''
               AND l.deleted_at IS NULL
             ORDER BY l.project ASC"
        );
    } else {
        // Return only projects mapped to this location AND that have active leads
        $stmt = $pdo->prepare(
            "SELECT DISTINCT l.project AS name
             FROM leads l
             INNER JOIN project_locations pl ON pl.project_name = l.project
             WHERE pl.location = ?
               AND l.project   IS NOT NULL
               AND l.project   != ''
               AND l.deleted_at IS NULL
             ORDER BY l.project ASC"
        );
        $stmt->execute([$location]);
    }

    $rows     = $stmt->fetchAll();
    $projects = array_map(fn($r) => ['id' => $r['name'], 'name' => $r['name']], $rows);
    Response::success('OK', ['projects' => $projects]);
}

// ── DEFAULT MODE: distinct project names from active leads (no ghost projects) ─
else {
    /**
     * Returns distinct project names from non-deleted leads only.
     * id === name intentionally: stable React key, no dependency on master table.
     */
    $stmt = $pdo->query(
        "SELECT DISTINCT project AS name
         FROM leads
         WHERE project IS NOT NULL
           AND project != ''
           AND deleted_at IS NULL
         ORDER BY project ASC"
    );
    $rows     = $stmt->fetchAll();
    $projects = array_map(fn($r) => ['id' => $r['name'], 'name' => $r['name']], $rows);
    Response::success('OK', ['projects' => $projects]);
}
