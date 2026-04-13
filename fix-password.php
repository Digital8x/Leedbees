<?php
// fix-password.php — run once then DELETE this file!
// No Composer/autoloader needed. Works on PHP 7.4+

// --- Manually read .env ---
$env = [];
foreach (file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
    [$k, $v] = explode('=', $line, 2);
    $env[trim($k)] = trim($v);
}

try {
    $pdo = new PDO(
        "mysql:host={$env['DB_HOST']};dbname={$env['DB_NAME']};charset=utf8mb4",
        $env['DB_USER'],
        $env['DB_PASS'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $newHash = password_hash('Admin@Lead8X', PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE email = 'admin@digital8x.site'");
    $stmt->execute([$newHash]);
    $affected = $stmt->rowCount();

    $user = $pdo->query("SELECT password_hash FROM users WHERE email = 'admin@digital8x.site' LIMIT 1")->fetch();
    $ok = password_verify('Admin@Lead8X', $user['password_hash'] ?? '');

    echo "<h2>Fix Password</h2>";
    echo "<p>PHP version: " . phpversion() . "</p>";
    echo "<p>Rows updated: <strong>{$affected}</strong></p>";
    echo "<p>Verify: <strong>" . ($ok ? '✅ YES — login will work!' : '❌ NO') . "</strong></p>";
    echo "<p style='color:red'><strong>DELETE this file from cPanel now!</strong></p>";

} catch (Throwable $e) {
    echo "<p style='color:red'>Error: " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<p>PHP version on server: " . phpversion() . "</p>";
}
