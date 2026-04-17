<?php
// migrate_privacy.php - Update database for PII compliance
require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = Database::getConnection();
    
    echo "<h1>Privacy Compliance Migration</h1>";
    
    // Check if columns exist
    $stmt = $pdo->query("SHOW COLUMNS FROM leads LIKE 'user_consent'");
    if (!$stmt->fetch()) {
        echo "Adding 'user_consent' and 'retention_date' columns...<br>";
        $pdo->exec("ALTER TABLE leads ADD COLUMN user_consent TINYINT(1) DEFAULT 0");
        $pdo->exec("ALTER TABLE leads ADD COLUMN retention_date DATETIME NULL");
        $pdo->exec("ALTER TABLE leads ADD INDEX idx_consent (user_consent)");
        $pdo->exec("ALTER TABLE leads ADD INDEX idx_retention (retention_date)");
        echo "✅ Privacy columns added successfully.<br>";
    } else {
        echo "ℹ️ Privacy columns already exist. Skipping.<br>";
    }

    echo "<b>Migration Complete!</b> You can now delete this file.";

} catch (Throwable $e) {
    echo "❌ Migration Error: " . $e->getMessage();
}
