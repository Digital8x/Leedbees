<?php
// fix_db.php - One-time script to add the error_message column
require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = Database::getConnection();
    
    // 1. Add error_message column to webhook_log
    echo "Updating webhook_log table...<br>";
    try {
        $pdo->exec("ALTER TABLE webhook_log ADD COLUMN error_message TEXT NULL AFTER lead_id");
        echo "✅ Column 'error_message' added successfully.<br>";
    } catch (PDOException $e) {
        if (str_contains($e->getMessage(), 'Duplicate column')) {
            echo "ℹ️ Column 'error_message' already exists. Skipping.<br>";
        } else {
            throw $e;
        }
    }

    echo "<b>Database update complete!</b> You can now delete this file and try your sync again.";

} catch (Throwable $e) {
    echo "❌ Error: " . $e->getMessage();
}
