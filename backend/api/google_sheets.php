<?php
// backend/api/webhooks/google_sheets.php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/core/WebhookProcessor.php';
require_once dirname(__DIR__) . '/utils/Encryption.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    exit('Method Not Allowed');
}

$rawPayload = file_get_contents('php://input');
$data = json_decode($rawPayload, true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
    http_response_code(400);
    exit('Invalid JSON');
}

// 1. Initial Logging
$pdo = Database::getConnection();
$processor = new WebhookProcessor($pdo);
$logId = $processor->logPayload('google_sheets', $data, $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? 'Token Auth');

// 2. Authenticate using Security Token
$providedToken = $_SERVER['HTTP_AUTHORIZATION'] ?? $data['security_token'] ?? '';
unset($data['security_token']); // Remove token from internal data log

// Check if any source matches this token
$stmt = $pdo->prepare("SELECT * FROM webhook_sources WHERE platform = 'google' AND is_active = 1");
$stmt->execute();
$sources = $stmt->fetchAll();

$matchedSource = null;
foreach ($sources as $source) {
    if ($source['verify_token'] === $providedToken) {
        $matchedSource = $source;
        break;
    }
}

if (!$matchedSource) {
    $processor->updateLogStatus($logId, 'failed', null, "Invalid Security Token");
    http_response_code(401);
    exit('Unauthorized: Invalid security token');
}

// 3. Process the lead
try {
    // 3. Smart Mapping
    // We try to find common headers in the flat JSON from Sheets
    $normalized = [
        'name'    => '',
        'phone'   => '',
        'email'   => '',
        'project' => $data['Project'] ?? $data['project'] ?? 'Google Sheet Import',
        'source'  => 'Google Sheets'
    ];

    foreach ($data as $key => $value) {
        $cleanKey = strtolower(trim((string)$key));
        $val = trim((string)$value);
        if (empty($val)) continue;

        // Name Mapping
        if (in_array($cleanKey, ['full name', 'name', 'customer name', 'lead name', 'client'])) {
            $normalized['name'] = $val;
        }
        // Phone Mapping
        elseif (in_array($cleanKey, ['phone', 'mobile', 'contact', 'phone number', 'number', 'mobile number'])) {
            $normalized['phone'] = $val;
        }
        // Email Mapping
        elseif (in_array($cleanKey, ['email', 'email id', 'email address'])) {
            $normalized['email'] = $val;
        }
        // Additional Info
        elseif ($cleanKey === 'campaign') {
            $normalized['campaign'] = $val;
        }
    }

    if (empty($normalized['phone'])) {
        throw new Exception("Missing required field: Phone");
    }

    $processor->processLead($logId, $normalized, 'Google Sheets');
    echo "OK";

} catch (Throwable $e) {
    $processor->updateLogStatus($logId, 'failed');
    error_log("Google Sheets Webhook Error: " . $e->getMessage());
    http_response_code(500);
    exit("Internal Server Error: " . $e->getMessage());
}
