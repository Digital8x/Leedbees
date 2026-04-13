<?php
// backend/api/users/update.php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';

Response::setCorsHeaders();
$authUser = Auth::requireAuth(['Admin']);

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') Response::error('Method not allowed', 405);

$body       = json_decode(file_get_contents('php://input'), true);
$targetId   = (int)($body['id']       ?? 0);
$name       = trim($body['name']      ?? '');
$email      = trim($body['email']     ?? '');
$role       = trim($body['role']      ?? '');
$password   = trim($body['password']  ?? '');
$isActive   = isset($body['is_active']) ? (int)(bool)$body['is_active'] : null;
$validRoles = ['Admin','Caller','Relationship Manager','Manager'];

if (!$targetId) Response::error('User ID is required.');

$pdo = Database::getConnection();
$existing = $pdo->prepare("SELECT id, name FROM users WHERE id = ? LIMIT 1");
$existing->execute([$targetId]);
if (!$existing->fetch()) Response::notFound('User not found.');

$updates = [];
$vals    = [];

if ($name)  { $updates[] = 'name = ?';  $vals[] = $name; }
if ($email) {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) Response::error('Invalid email.');
    $updates[] = 'email = ?';
    $vals[]    = $email;
}
if ($role && in_array($role, $validRoles, true)) {
    $updates[] = 'role = ?'; $vals[] = $role;
}
if ($password && strlen($password) >= 6) {
    $updates[] = 'password_hash = ?'; $vals[] = Auth::hashPassword($password);
}
if ($isActive !== null) {
    $updates[] = 'is_active = ?'; $vals[] = $isActive;
}

if (empty($updates)) Response::error('No valid fields to update.');

$vals[] = $targetId;
$pdo->prepare("UPDATE users SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = ?")->execute($vals);

Auth::logActivity($pdo, (int)$authUser['id'], $authUser['name'], 'Update User', "Updated user ID {$targetId}");
Response::success('User updated successfully.');
