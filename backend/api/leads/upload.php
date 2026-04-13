<?php
// backend/api/leads/upload.php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';
require_once dirname(__DIR__, 2) . '/core/ExcelHandler.php';
require_once dirname(__DIR__, 2) . '/core/DuplicateDetector.php';

Response::setCorsHeaders();

$user = Auth::requireAuth(['Admin', 'Manager']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

// --- Validate file ---
if (empty($_FILES['file'])) {
    Response::error('No file uploaded.');
}

$file     = $_FILES['file'];
$allowed  = ['xlsx', 'xls', 'csv'];
$ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($ext, $allowed, true)) {
    Response::error('Only Excel (.xlsx, .xls) and CSV files are allowed.');
}

if ($file['error'] !== UPLOAD_ERR_OK) {
    Response::error('File upload error: ' . $file['error']);
}

// --- Move to temp ---
$tmpPath = sys_get_temp_dir() . '/lead8x_upload_' . uniqid() . '.' . $ext;
if (!move_uploaded_file($file['tmp_name'], $tmpPath)) {
    Response::error('Failed to process uploaded file.');
}

// --- Parse ---
try {
    $rows = ExcelHandler::parseUpload($tmpPath);
} catch (\Throwable $e) {
    @unlink($tmpPath);
    Response::error('Could not read file: ' . $e->getMessage());
}
@unlink($tmpPath);

if (empty($rows)) {
    Response::error('No valid rows found in the uploaded file.');
}

// --- Generate batch ID ---
$sourceName = trim($_POST['source'] ?? 'UPLOAD');
$campaign   = trim($_POST['campaign'] ?? '');
$batchId    = DuplicateDetector::generateBatchId($sourceName);

// --- Process rows ---
$pdo      = Database::getConnection();
$detector = new DuplicateDetector($pdo);

$stats = ['new' => 0, 'duplicate' => 0, 'skipped' => 0, 'total' => count($rows)];

$pdo->beginTransaction();
try {
    foreach ($rows as $row) {
        // Inject source/campaign from POST if not in Excel
        if (empty($row['source']))   $row['source']   = $sourceName;
        if (empty($row['campaign'])) $row['campaign']  = $campaign;

        $result = $detector->processLead($row, $batchId, (int)$user['id']);
        $stats[$result['action']]++;
    }
    $pdo->commit();
} catch (\Throwable $e) {
    $pdo->rollBack();
    Response::error('Processing failed: ' . $e->getMessage(), 500);
}

// Activity log
Auth::logActivity(
    $pdo, (int)$user['id'], $user['name'],
    'Lead Upload',
    "Batch {$batchId}: {$stats['new']} new, {$stats['duplicate']} duplicates, {$stats['skipped']} skipped from {$stats['total']} rows."
);

Response::success('Upload complete.', [
    'batch_id'   => $batchId,
    'total'      => $stats['total'],
    'new'        => $stats['new'],
    'duplicates' => $stats['duplicate'],
    'skipped'    => $stats['skipped'],
]);
