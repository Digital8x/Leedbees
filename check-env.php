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

echo "\n--- Database Connection Test ---\n";
try {
    require_once __DIR__ . '/backend/config/database.php';
    $pdo = Database::getConnection();
    echo "✅ Database connection SUCCESSFUL.\n";
    
    echo "\n--- RateLimiter Functional Test ---\n";
    require_once __DIR__ . '/backend/core/RateLimiter.php';
    $testIp = '1.2.3.4';
    $rl = RateLimiter::check($pdo, $testIp, 'test_diagnostic', 100, 60);
    if ($rl['allowed']) {
        echo "✅ RateLimiter logic is WORKING correctly.\n";
    } else {
        echo "⚠️  RateLimiter blocked the diagnostic check (unexpected).\n";
    }

    echo "\n--- Auth & JWT Library Test ---\n";
    require_once __DIR__ . '/backend/core/Auth.php';
    $testToken = Auth::generateToken(['test' => true]);
    if ($testToken) {
        echo "✅ JWT Generation is WORKING.\n";
        $decoded = Auth::decodeToken($testToken);
        if ($decoded && $decoded['test'] === true) {
            echo "✅ JWT Decoding is WORKING.\n";
        } else {
            echo "❌ JWT Decoding FAILED.\n";
        }
    }
} catch (\Throwable $e) {
    echo "❌ FUNCTIONAL TEST FAILED: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . " Line: " . $e->getLine() . "\n";
    echo "Stack Trace: " . $e->getTraceAsString() . "\n";
}

echo "\n--- PHP Superglobals ---\n";
echo "REMOTE_ADDR: " . ($_SERVER['REMOTE_ADDR'] ?? 'not set') . "\n";
echo "HTTPS: " . ($_SERVER['HTTPS'] ?? 'off') . "\n";
echo "HTTP_X_FORWARDED_PROTO: " . ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? 'not set') . "\n";

echo "\n\nDIAGNOSTIC COMPLETE. If any 'MISSING' or '.env file MISSING' errors appear, please fix your file naming or server config.\n";
