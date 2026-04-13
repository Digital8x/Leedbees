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

$pdo      = Database::getConnection();
$projects = $pdo->query("SELECT id, name, location, created_at FROM projects ORDER BY name")->fetchAll();

Response::success('OK', ['projects' => $projects]);
