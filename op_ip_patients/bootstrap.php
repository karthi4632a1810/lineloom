<?php

declare(strict_types=1);

/**
 * Reads `.env` (KEY=VALUE) into the process so getenv() works for PHP built-in server / CLI.
 */
function op_ip_load_env_into_runtime(): void
{
    $path = __DIR__ . DIRECTORY_SEPARATOR . '.env';
    if (!is_readable($path)) {
        return;
    }
    $raw = @file_get_contents($path);
    if ($raw === false) {
        return;
    }
    $lines = preg_split("/\r\n|\n|\r/", $raw) ?: [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        $eq = strpos($line, '=');
        if ($eq === false) {
            continue;
        }
        $key = trim(substr($line, 0, $eq));
        $value = trim(substr($line, $eq + 1));
        if ($key === '') {
            continue;
        }
        $len = strlen($value);
        if ($len >= 2) {
            $q0 = $value[0];
            $q1 = $value[$len - 1];
            if (($q0 === '"' && $q1 === '"') || ($q0 === "'" && $q1 === "'")) {
                $value = substr($value, 1, -1);
            }
        }
        if (getenv($key) !== false) {
            continue;
        }
        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
    }
}

op_ip_load_env_into_runtime();

/**
 * Loads configuration for OP/IP patient viewer.
 */
function op_ip_load_config(): array
{
    $path = __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
    if (!is_file($path)) {
        throw new RuntimeException(
            'Missing config.php. Copy config.example.php to config.php and set database credentials.'
        );
    }
    /** @var array $config */
    $config = require $path;
    if (!is_array($config)) {
        throw new RuntimeException('config.php must return an array.');
    }
    return $config;
}

function op_ip_startup_error_message(Throwable $e): string
{
    $m = $e->getMessage();
    if (str_contains($m, 'Missing config.php')) {
        return $m;
    }
    if (str_contains($m, 'password are required') || str_contains($m, 'password is empty')) {
        return $m;
    }
    if (str_contains($m, 'No SQL Server PDO driver')) {
        return $m;
    }
    return $m;
}
