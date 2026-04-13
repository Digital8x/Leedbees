<?php
// backend/api/auth/login.php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';

Response::setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$body = json_decode(file_get_contents('php://input'), true);
$email    = trim($body['email'] ?? '');
$password = trim($body['password'] ?? '');

if (empty($email) || empty($password)) {
    Response::error('Email and password are required.');
}

$pdo = Database::getConnection();

$stmt = $pdo->prepare("SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !Auth::verifyPassword($password, $user['password_hash'])) {
    Response::error('Invalid email or password.', 401);
}

if (!(bool)$user['is_active']) {
    Response::error('Your account has been deactivated. Contact admin.', 403);
}

// Update last login
$pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?")->execute([$user['id']]);

// Generate token
$token = Auth::generateToken([
    'id'   => $user['id'],
    'name' => $user['name'],
    'email'=> $user['email'],
    'role' => $user['role'],
]);

// Log activity
Auth::logActivity($pdo, (int)$user['id'], $user['name'], 'Login', "User logged in from " . ($_SERVER['REMOTE_ADDR'] ?? ''));

Response::success('Login successful.', [
    'token' => $token,
    'user'  => [
        'id'    => $user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role'],
    ],
]);
