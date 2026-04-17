<?php
// backend/api/webhooks/google.php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/config/webhook_config.php';
require_once dirname(__DIR__, 2) . '/core/WebhookProcessor.php';
require_once __DIR__ . '/verify.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawPayload = file_get_contents('php://input');
    $signature = $_SERVER['HTTP_X_GOOGLE_SIGNATURE'] ?? '';

    // 1. Verify Signature
    if (!WebhookVerifier::verifyGoogle($rawPayload, $signature, GOOGLE_WEBHOOK_SECRET)) {
        http_response_code(401);
        exit('Unauthorized');
    }

    // 2. JSON Validation
    $data = json_decode($rawPayload, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        exit('Invalid JSON');
    }

    $pdo = Database::getConnection();
    $processor = new WebhookProcessor($pdo);
    $logId = $processor->logPayload('google', $data, $signature);

    try {
        // 3. Normalized Mapping
        $normalized = [
            'platform_lead_id' => $data['lead_id'] ?? null,
            'campaign_id'      => $data['campaign_id'] ?? null,
            'ad_id'            => $data['adgroup_id'] ?? null,
            'form_id'          => $data['form_id'] ?? null,
            'name'             => trim(($data['given_name'] ?? '') . ' ' . ($data['family_name'] ?? '')),
            'email'            => $data['email'] ?? '',
            'phone'            => $data['phone_number'] ?? '',
            'project'          => 'Google Ads'
        ];

        // 4. Refined Name/Phone Extraction from user_column_data
        if (isset($data['user_column_data']) && is_array($data['user_column_data'])) {
            foreach ($data['user_column_data'] as $col) {
                $colName  = strtolower($col['column_name'] ?? '');
                $colValue = trim((string)($col['string_value'] ?? ''));
                
                if (empty($colValue)) continue;

                // Match specific fields only
                if (in_array($colName, ['phone_number', 'phone', 'mobile'])) {
                    $normalized['phone'] = $colValue;
                }
                elseif (in_array($colName, ['full_name', 'name', 'user_name'])) {
                    // Only overwrite if it's better than what we have
                    if (strlen($colValue) > strlen($normalized['name'])) {
                        $normalized['name'] = $colValue;
                    }
                }
                elseif ($colName === 'email') {
                    $normalized['email'] = $colValue;
                }
            }
        }

        $processor->processLead($logId, $normalized, 'Google Ads');
        echo "OK";
    } catch (Throwable $e) {
        error_log("Google Webhook Error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
        http_response_code(500);
        exit("Internal Server Error");
    }
}
