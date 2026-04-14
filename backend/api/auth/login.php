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

$body     = json_decode(file_get_contents('php://input'), true);
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if (empty($email) || empty($password)) {
    Response::error('Email and password are required.');
}

$pdo = Database::getConnection();

// ── 1. Rate-limit check ────────────────────────────────────────────────────
$lockMessage = Auth::checkRateLimit($pdo, $email);
if ($lockMessage !== null) {
    Response::error($lockMessage, 429);
}

// ── 2. Fetch user ──────────────────────────────────────────────────────────
$stmt = $pdo->prepare(
    'SELECT id, name, email, password_hash, role, is_active, email_verified_at
       FROM users WHERE email = ? LIMIT 1'
);
$stmt->execute([$email]);
$user = $stmt->fetch();

// ── 3. Verify credentials ──────────────────────────────────────────────────
if (!$user || !Auth::verifyPassword($password, $user['password_hash'])) {
    // Record the failure (operates safely even if $user is false)
    if ($user) {
        Auth::recordFailedAttempt($pdo, $email);
    }
    // Use a vague message to avoid disclosing whether the email exists
    Response::error('Invalid email or password.', 401);
}

// ── 4. Account active? ─────────────────────────────────────────────────────
if (!(bool)$user['is_active']) {
    Response::error('Your account has been deactivated. Contact admin.', 403);
}

// ── 5. Email verified? ─────────────────────────────────────────────────────
if ($user['email_verified_at'] === null) {
    Response::error('Please verify your email address before logging in.', 403);
}

// ── 6. Successful login: reset rate limit ──────────────────────────────────
Auth::resetLoginAttempts($pdo, $email);

// ── 7. Opportunistic hash upgrade (bcrypt → argon2id) ─────────────────────
if (Auth::needsRehash($user['password_hash'])) {
    $newHash = Auth::hashPassword($password);
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        ->execute([$newHash, $user['id']]);
}

// ── 8. Update last login timestamp ────────────────────────────────────────
$pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')
    ->execute([$user['id']]);

// ── 9. Issue JWT ───────────────────────────────────────────────────────────
$token = Auth::generateToken([
    'id'    => $user['id'],
    'name'  => $user['name'],
    'email' => $user['email'],
    'role'  => $user['role'],
]);

// ── 10. Log activity ───────────────────────────────────────────────────────
Auth::logActivity($pdo, (int)$user['id'], $user['name'], 'Login',
    'User logged in from ' . ($_SERVER['REMOTE_ADDR'] ?? ''));

Response::success('Login successful.', [
    'token' => $token,
    'user'  => [
        'id'    => $user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role'],
    ],
]);
