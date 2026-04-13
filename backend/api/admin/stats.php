<?php
// backend/api/admin/stats.php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';

Response::setCorsHeaders();
$user = Auth::requireAuth(['Admin', 'Manager']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') Response::error('Method not allowed', 405);

$pdo = Database::getConnection();

// --- Dashboard stats ---
$totalLeads      = (int)$pdo->query("SELECT COUNT(*) FROM leads")->fetchColumn();
$duplicateLeads  = (int)$pdo->query("SELECT COUNT(*) FROM leads WHERE is_duplicate = 1")->fetchColumn();
$assignedLeads   = (int)$pdo->query("SELECT COUNT(*) FROM leads WHERE assigned_to IS NOT NULL")->fetchColumn();
$totalUsers      = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE is_active = 1")->fetchColumn();

// Status breakdown
$statusRows = $pdo->query(
    "SELECT status, COUNT(*) AS count FROM leads GROUP BY status ORDER BY count DESC"
)->fetchAll();

// Per-user lead counts
$userStats = $pdo->query(
    "SELECT u.id, u.name, u.role,
            SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) AS total_leads,
            SUM(CASE WHEN l.status = 'Interested' THEN 1 ELSE 0 END) AS interested,
            SUM(CASE WHEN l.status = 'Booked' THEN 1 ELSE 0 END) AS booked
     FROM users u
     LEFT JOIN leads l ON l.assigned_to = u.id
     WHERE u.is_active = 1
     GROUP BY u.id, u.name, u.role
     ORDER BY total_leads DESC"
)->fetchAll();

// Recent batches
$batches = $pdo->query(
    "SELECT first_batch_id AS batch_id, first_source AS source,
            COUNT(*) AS total,
            SUM(is_duplicate) AS duplicates,
            MIN(created_at) AS uploaded_at
     FROM leads
     WHERE first_batch_id IS NOT NULL
     GROUP BY first_batch_id, first_source
     ORDER BY uploaded_at DESC
     LIMIT 10"
)->fetchAll();

Response::success('OK', [
    'overview' => [
        'total_leads'     => $totalLeads,
        'duplicate_leads' => $duplicateLeads,
        'assigned_leads'  => $assignedLeads,
        'unassigned_leads'=> $totalLeads - $assignedLeads,
        'total_users'     => $totalUsers,
    ],
    'status_breakdown' => $statusRows,
    'user_stats'       => $userStats,
    'recent_batches'   => $batches,
]);
