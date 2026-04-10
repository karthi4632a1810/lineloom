<?php

declare(strict_types=1);

/**
 * Lists INFORMATION_SCHEMA columns for OP/IP tables — enable only on trusted machines.
 */
require_once __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'schema.php';

header('Content-Type: text/plain; charset=utf-8');

$local = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($local, ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    echo 'Forbidden (localhost only).';
    exit;
}

try {
    $config = op_ip_load_config();
    if (empty($config['discover_enabled'])) {
        http_response_code(403);
        echo 'Set discover_enabled to true in config.php to use this tool.';
        exit;
    }
    $pdo = op_ip_connect($config);
    $q = $config['queries'];
    $tables = [
        op_ip_parse_qualified($q['patient_master'] ?? ''),
        op_ip_parse_qualified($q['op_reg'] ?? ''),
        op_ip_parse_qualified($q['ip_reg'] ?? ''),
    ];
    foreach ($tables as $pair) {
        if ($pair[0] === '' || $pair[1] === '') {
            continue;
        }
        [$schema, $name] = $pair;
        echo "=== {$schema}.{$name} ===\n";
        $rows = op_ip_fetch_columns($pdo, $schema, $name);
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $cn = $row['COLUMN_NAME'] ?? '';
            $dt = $row['DATA_TYPE'] ?? '';
            $ml = $row['CHARACTER_MAXIMUM_LENGTH'] ?? '';
            echo "{$cn}\t{$dt}\t" . (string) $ml . "\n";
        }
        echo "\n";
    }
} catch (Throwable $e) {
    http_response_code(500);
    error_log('discover_schema: ' . $e->getMessage());
    echo 'Error. Check logs.';
}
