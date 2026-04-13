<?php
// fix-password.php — run once then DELETE this file!
// Access: https://www.digital8x.site/fix-password.php

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

try {
    $pdo = new PDO(
        "mysql:host={$_ENV['DB_HOST']};dbname={$_ENV['DB_NAME']};charset=utf8mb4",
        $_ENV['DB_USER'],
        $_ENV['DB_PASS'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Generate fresh hash on the server — no copy-paste corruption!
    $newHash = password_hash('Admin@Lead8X', PASSWORD_BCRYPT, ['cost' => 12]);

    // Update the admin user
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE email = 'admin@digital8x.site'");
    $stmt->execute([$newHash]);

    $affected = $stmt->rowCount();

    // Verify it works
    $user = $pdo->query("SELECT password_hash FROM users WHERE email = 'admin@digital8x.site' LIMIT 1")->fetch();
    $verified = password_verify('Admin@Lead8X', $user['password_hash'] ?? '');

    echo "<h2>Fix Password Script</h2>";
    echo "<p>Rows updated: <strong>{$affected}</strong></p>";
    echo "<p>Verify 'Admin\@Lead8X' matches new hash: <strong>" . ($verified ? '✅ YES — login will work!' : '❌ NO — something is wrong') . "</strong></p>";
    echo "<p style='color:red'><strong>IMPORTANT: Delete this file immediately after seeing ✅ YES above!</strong></p>";

} catch (Throwable $e) {
    echo "<p style='color:red'>Error: " . htmlspecialchars($e->getMessage()) . "</p>";
}
