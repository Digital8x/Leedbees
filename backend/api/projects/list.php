<?php
// backend/api/projects/list.php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';

Response::setCorsHeaders();
$user = Auth::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') Response::error('Method not allowed', 405);

$pdo = Database::getConnection();

// Mode: 'active_leads' returns distinct project names that have active (non-deleted) leads
// This ensures the filter only shows projects that actually have current leads
$mode = $_GET['mode'] ?? 'active_leads';

if ($mode === 'master') {
    // Legacy: fetch from projects master table
    $projects = $pdo->query("SELECT id, name, location, created_at FROM projects ORDER BY name")->fetchAll();
    Response::success('OK', ['projects' => $projects]);
} else {
    // Default: only show project names that have at least one active (non-deleted) lead
    $stmt = $pdo->query(
        "SELECT DISTINCT project AS name
         FROM leads
         WHERE project IS NOT NULL
           AND project != ''
           AND deleted_at IS NULL
         ORDER BY project ASC"
    );
    $rows = $stmt->fetchAll();
    // Return as objects with id=name for backward compat with the filter dropdown
    $projects = array_map(fn($r) => ['id' => $r['name'], 'name' => $r['name']], $rows);
    Response::success('OK', ['projects' => $projects]);
}
