<?php
// check_data.php - Internal utility script

// CLI-only guard to prevent web access
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("Access Forbidden: CLI execution only.");
}

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = Database::getConnection();
    
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM leads");
    $total = $stmt->fetchColumn();
    echo "Total Leads: " . $total . "\n";

    $stmt = $pdo->query("SELECT id, created_at, status, project, city FROM leads ORDER BY id DESC LIMIT 5");
    $samples = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Sample Leads:\n";
    print_r($samples);

} catch (Exception $e) {
    // Log sensitive error details to server logs
    error_log("CheckData Utility Error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
    
    // Generic message for the console/output
    echo "An internal database error occurred. Check server logs for details.\n";
}
