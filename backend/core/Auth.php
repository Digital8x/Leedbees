<?php
// backend/core/Auth.php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/vendor/autoload.php';
require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/utils/Response.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class Auth
{
    private static string $secret;
    private static int $expiry;

    private static function init(): void
    {
        self::$secret = $_ENV['JWT_SECRET'] ?? 'Lead8X_Default_Secret_Change_Me';
        self::$expiry = (int)($_ENV['JWT_EXPIRY'] ?? 28800);
    }

    // --- Generate JWT token ---
    public static function generateToken(array $payload): string
    {
        self::init();
        $now = time();
        $data = array_merge($payload, [
            'iat' => $now,
            'exp' => $now + self::$expiry,
        ]);
        return JWT::encode($data, self::$secret, 'HS256');
    }

    // --- Decode & validate JWT ---
    public static function decodeToken(string $token): ?array
    {
        self::init();
        try {
            $decoded = JWT::decode($token, new Key(self::$secret, 'HS256'));
            return (array) $decoded;
        } catch (\Throwable $e) {
            return null;
        }
    }

    // --- Extract token from Authorization header ---
    public static function getBearerToken(): ?string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? apache_request_headers()['Authorization']
            ?? null;

        if ($auth && preg_match('/Bearer\s+(.*)$/i', $auth, $matches)) {
            return $matches[1];
        }
        return null;
    }

    // --- Require valid JWT → return payload or die ---
    public static function requireAuth(array $allowedRoles = []): array
    {
        $token = self::getBearerToken();
        if (!$token) {
            Response::unauthorized('Authentication required.');
        }

        $payload = self::decodeToken($token);
        if (!$payload) {
            Response::unauthorized('Invalid or expired token.');
        }

        if (!empty($allowedRoles) && !in_array($payload['role'], $allowedRoles, true)) {
            Response::forbidden('You do not have permission to access this resource.');
        }

        return $payload;
    }

    // --- Hash password ---
    public static function hashPassword(string $plain): string
    {
        return password_hash($plain, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    // --- Verify password ---
    public static function verifyPassword(string $plain, string $hash): bool
    {
        return password_verify($plain, $hash);
    }

    // --- Log activity ---
    public static function logActivity(PDO $pdo, ?int $userId, ?string $userName, string $action, string $description = ''): void
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        $stmt = $pdo->prepare(
            "INSERT INTO activity_log (user_id, user_name, action, description, ip_address)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([$userId, $userName, $action, $description, $ip]);
    }
}
