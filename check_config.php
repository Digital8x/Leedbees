<?php
// check_config.php - Diagnostic to check stored tokens
require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = Database::getConnection();
    echo "<h1>Stored Webhook Sources</h1>";
    
    $stmt = $pdo->query("SELECT id, platform, source_name, verify_token, is_active FROM webhook_sources");
    $sources = $stmt->fetchAll();

    if (empty($sources)) {
        echo "❌ <b style='color:red'>No Webhook Sources found in database!</b> Go to Webhook Settings and create a new Google source.";
    } else {
        echo "<table border='1' cellpadding='10'>";
        echo "<tr><th>ID</th><th>Platform</th><th>Name</th><th>Token in DB</th><th>Status</th></tr>";
        foreach ($sources as $s) {
            $status = $s['is_active'] ? "✅ Active" : "❌ Inactive";
            echo "<tr>";
            echo "<td>{$s['id']}</td>";
            echo "<td>{$s['platform']}</td>";
            echo "<td>{$s['source_name']}</td>";
            echo "<td><code>" . ($s['verify_token'] ?: '[EMPTY]') . "</code></td>";
            echo "<td>$status</td>";
            echo "</tr>";
        }
        echo "</table>";
    }

} catch (Throwable $e) {
    echo "Diagnostic Error: " . $e->getMessage();
}
