<?php
// get_errors.php - Temporary diagnostic 
require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = Database::getConnection();
    $stmt = $pdo->query("SELECT platform, status, error_message, raw_payload FROM webhook_log ORDER BY id DESC LIMIT 5");
    $errors = $stmt->fetchAll();

    echo "<h1>Latest Webhook Errors</h1>";
    foreach ($errors as $e) {
        echo "<hr>";
        echo "<b>Platform:</b> {$e['platform']}<br>";
        echo "<b>Status:</b> {$e['status']}<br>";
        echo "<b>Error:</b> <span style='color:red'>{$e['error_message']}</span><br>";
        echo "<b>Payload (Snippet):</b> " . substr($e['raw_payload'], 0, 100) . "...<br>";
    }

} catch (Throwable $e) {
    echo "Diagnostic Error: " . $e->getMessage();
}
