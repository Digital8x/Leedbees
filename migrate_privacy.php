<?php
/**
 * migrate_privacy.php - Update database for PII compliance (Refined V3)
 * SECURITY: Only runnable from CLI.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('ERROR: This script must be run from the command line (CLI) for security reasons.');
}

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = Database::getConnection();
    
    fwrite(STDOUT, "--- Privacy Compliance Migration (V3) ---\n");
    
    // Check if the renamed column exists already
    $stmt = $pdo->query("SHOW COLUMNS FROM leads LIKE 'has_user_consent'");
    $columnExists = $stmt->fetch();

    if (!$columnExists) {
        fwrite(STDOUT, "Applying atomic privacy schema updates to 'leads' table...\n");
        
        // Use a single ALTER statement for atomicity within the engine
        $sql = "ALTER TABLE leads 
                ADD COLUMN has_user_consent TINYINT(1) DEFAULT 0 COMMENT '0=no consent; 1=consent given',
                ADD COLUMN retention_date    DATETIME NULL DEFAULT NULL COMMENT 'Purge date',
                ADD INDEX idx_consent (has_user_consent),
                ADD INDEX idx_retention (retention_date)";
        
        $pdo->exec($sql);
        fwrite(STDOUT, "✅ Privacy columns and indexes added successfully.\n");
    } else {
        fwrite(STDOUT, "ℹ️ Privacy columns ('has_user_consent') already exist. Skipping.\n");
    }

    fwrite(STDOUT, "--- Migration Complete ---\n");

} catch (Throwable $e) {
    // Log the full error to server-side logs, don't leak to console/web
    error_log("Migration Failed (migrate_privacy.php): " . $e->getMessage() . "\n" . $e->getTraceAsString());
    fwrite(STDERR, "❌ ERROR: Migration failed. Check server error logs for details.\n");
    exit(1);
}
