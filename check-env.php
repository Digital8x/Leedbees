<?php
// check-env.php
declare(strict_types=1);

require_once __DIR__ . '/backend/config/database.php';

header('Content-Type: text/plain');

echo "--- Leadbees Environment Diagnostic ---\n\n";

$envFile = __DIR__ . '/.env';
echo "Checking for .env file at: $envFile\n";
if (file_exists($envFile)) {
    echo "✅ .env file EXISTS.\n";
    echo "File size: " . filesize($envFile) . " bytes\n";
} else {
    echo "❌ .env file MISSING.\n";
    $altEnv = __DIR__ . '/env';
    if (file_exists($altEnv)) {
        echo "⚠️  Found 'env' file WITHOUT the dot. You must rename it to '.env'\n";
    }
}

echo "\n--- Variable Check ---\n";
$vars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET', 'JWT_EXPIRY'];

foreach ($vars as $var) {
    if (isset($_ENV[$var]) && !empty($_ENV[$var])) {
        echo "✅ $var is SET.\n";
    } else {
        echo "❌ $var is MISSING.\n";
    }
}

echo "\n--- PHP Superglobals ---\n";
echo "REMOTE_ADDR: " . ($_SERVER['REMOTE_ADDR'] ?? 'not set') . "\n";
echo "HTTPS: " . ($_SERVER['HTTPS'] ?? 'off') . "\n";
echo "HTTP_X_FORWARDED_PROTO: " . ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? 'not set') . "\n";

echo "\n\nDIAGNOSTIC COMPLETE. If any 'MISSING' or '.env file MISSING' errors appear, please fix your file naming or server config.\n";
