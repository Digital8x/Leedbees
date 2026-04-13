<?php
// backend/api/leads/upload.php
// Step 1 of 2: Parse file, return preview. Actual save is done by upload-confirm.php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/utils/Response.php';
require_once dirname(__DIR__, 2) . '/core/Auth.php';
require_once dirname(__DIR__, 2) . '/core/ExcelHandler.php';

Response::setCorsHeaders();

$user = Auth::requireAuth(['Admin', 'Manager']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

if (empty($_FILES['file'])) {
    Response::error('No file uploaded.');
}

$file    = $_FILES['file'];
$allowed = ['xlsx', 'xls', 'csv'];
$ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($ext, $allowed, true)) {
    Response::error('Only Excel (.xlsx, .xls) and CSV files are allowed.');
}
if ($file['error'] !== UPLOAD_ERR_OK) {
    Response::error('File upload error: ' . $file['error']);
}

$tmpPath = sys_get_temp_dir() . '/lead8x_upload_' . uniqid() . '.' . $ext;
if (!move_uploaded_file($file['tmp_name'], $tmpPath)) {
    Response::error('Failed to process uploaded file.');
}

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

// Detect unique hidden_field / refer_url values from file
$hiddenValues = [];
$referDetected = false;
foreach ($rows as $row) {
    $hf = trim((string)($row['hidden_field'] ?? $row['project'] ?? ''));
    if ($hf !== '') $hiddenValues[$hf] = true;
    if (!empty($row['refer_url'])) $referDetected = true;
}

// Get existing project names for dropdown
$pdo      = Database::getConnection();
$projects = $pdo->query("SELECT name FROM projects ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);

// Cache full rows to temp file for the confirm step
$parseId  = uniqid('parse_', true);
$cacheDir = sys_get_temp_dir() . '/lead8x_cache/';
@mkdir($cacheDir, 0700, true);
file_put_contents($cacheDir . $parseId . '.json', json_encode([
    'rows'      => $rows,
    'user_id'   => $user['id'],
    'user_name' => $user['name'],
]));

Response::success('Preview ready.', [
    'parse_id'       => $parseId,
    'total_rows'     => count($rows),
    'preview'        => array_slice($rows, 0, 20),
    'hidden_values'  => array_keys($hiddenValues),
    'refer_detected' => $referDetected,
    'projects'       => $projects,
]);
