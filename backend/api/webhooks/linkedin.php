<?php
// backend/api/webhooks/linkedin.php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/config/webhook_config.php';
require_once dirname(__DIR__, 2) . '/core/WebhookProcessor.php';
require_once __DIR__ . '/verify.php';

// 1. Guard against non-POST methods
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    exit('Method Not Allowed');
}

$rawPayload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_LI_SIGNATURE_256'] ?? '';

// 2. Verify Signature
if (!WebhookVerifier::verifyLinkedIn($rawPayload, $signature, LINKEDIN_WEBHOOK_SECRET)) {
    http_response_code(401);
    exit('Unauthorized');
}

// 3. JSON Validation
$data = json_decode($rawPayload, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    exit('Invalid JSON');
}

$pdo = Database::getConnection();
$processor = new WebhookProcessor($pdo);
$logId = $processor->logPayload('linkedin', $data, $signature);

try {
    // 4. LinkedIn Lead Gen data mapping
    $normalized = [
        'platform_lead_id' => $data['id'] ?? null,
        'form_id'          => $data['form_id'] ?? null,
        'name'             => trim(($data['firstName'] ?? '') . ' ' . ($data['lastName'] ?? '')),
        'email'            => $data['email'] ?? '',
        'phone'            => $data['phone'] ?? '',
        'project'          => 'LinkedIn Ads'
    ];

    $processor->processLead($logId, $normalized, 'LinkedIn Ads');
    echo "OK";
} catch (Throwable $e) {
    error_log("LinkedIn Webhook Error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
    http_response_code(500);
    exit('Internal Server Error');
}
