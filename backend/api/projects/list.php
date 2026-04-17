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
    // Legacy: fetch from projects master table — returns {id:int, name, location, created_at}
    $projects = $pdo->query("SELECT id, name, location, created_at FROM projects ORDER BY name")->fetchAll();
    Response::success('OK', ['projects' => $projects]);
} else {
    /**
     * Default mode: returns distinct project names from active (non-deleted) leads.
     * SCHEMA NOTE: 'id' is set equal to 'name' (string) intentionally, because
     * leads from Google Sheets / CSV imports may use project names that have no
     * corresponding row in the projects master table. The client uses id as a
     * stable React key and name as the filter value — both are the project name here.
     */
    $stmt = $pdo->query(
        "SELECT DISTINCT project AS name
         FROM leads
         WHERE project IS NOT NULL
           AND project != ''
           AND deleted_at IS NULL
         ORDER BY project ASC"
    );
    $rows = $stmt->fetchAll();
    // id === name is a stable, unique key derived from project name string
    $projects = array_map(fn($r) => ['id' => $r['name'], 'name' => $r['name']], $rows);
    Response::success('OK', ['projects' => $projects]);
}
