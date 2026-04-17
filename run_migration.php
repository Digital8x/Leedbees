<?php
require_once __DIR__ . '/backend/config/database.php';
try {
    $pdo = Database::getConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $sqlFile = __DIR__ . '/database/migrations/20260417_webhook_integration.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("Migration file not found: $sqlFile");
    }

    $sql = file_get_contents($sqlFile);
    
    echo "Starting migration...\n";
    $pdo->beginTransaction();
    $pdo->exec($sql);
    $pdo->commit();
    
    echo "Migration successful!\n";
    
    // Only unlink on success
    if (file_exists(__FILE__)) {
        unlink(__FILE__);
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Migration Failed: " . $e->getMessage());
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
