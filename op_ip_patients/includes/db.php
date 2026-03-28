<?php

declare(strict_types=1);

/**
 * SQL Server via PDO: tries pdo_sqlsrv first, then pdo_odbc with each configured driver.
 * The legacy "SQL Server" (DBNETLIB) driver does not support TLS/SSL, so encryption is
 * disabled for it automatically. Modern drivers (17/18) use encryption with TrustServerCertificate.
 */
function op_ip_connect(array $config): PDO
{
    $server = $config['server'] ?? '';
    $database = $config['database'] ?? '';
    $user = $config['username'] ?? '';
    $pass = $config['password'] ?? '';
    if ($server === '' || $database === '' || $user === '') {
        throw new RuntimeException('Database server, name, and username are required in config.php.');
    }
    if ($pass === '') {
        throw new RuntimeException(
            'SQL password is empty. Set password in config.php or OP_IP_DB_PASS env variable.'
        );
    }

    $last = null;
    if (extension_loaded('pdo_sqlsrv')) {
        try {
            return op_ip_pdo_new(
                'sqlsrv:Server=' . $server . ';Database=' . $database
                . ';Encrypt=1;TrustServerCertificate=1',
                $user,
                $pass
            );
        } catch (PDOException $e) {
            $last = $e;
            error_log('op_ip_patients pdo_sqlsrv: ' . $e->getMessage());
        }
    }

    if (!extension_loaded('pdo_odbc')) {
        throw new RuntimeException(
            'No SQL Server PDO driver loaded. Enable extension=pdo_odbc and extension=odbc in C:\\xampp\\php\\php.ini, then restart php -S.'
        );
    }

    $installed = op_ip_installed_odbc_drivers();
    $wanted = $config['odbc_drivers_try'] ?? [
        'SQL Server',
        'SQL Server Native Client 11.0',
        'ODBC Driver 17 for SQL Server',
        'ODBC Driver 18 for SQL Server',
    ];

    $tried = [];
    foreach ($wanted as $driver) {
        if (!in_array($driver, $installed, true)) {
            continue;
        }
        $dsn = op_ip_build_odbc_dsn($driver, $server, $database);
        $tried[] = $driver;
        try {
            return op_ip_pdo_new($dsn, $user, $pass);
        } catch (PDOException $e) {
            $last = $e;
            error_log('op_ip_patients pdo_odbc (' . $driver . '): ' . $e->getMessage());
        }
    }

    $triedStr = $tried === [] ? 'none (no matching driver installed)' : '"' . implode('", "', $tried) . '"';
    $installedStr = $installed === [] ? 'none found' : '"' . implode('", "', $installed) . '"';
    $lastMsg = $last !== null ? $last->getMessage() : 'No PDO ODBC driver matched.';
    throw new RuntimeException(
        'SQL Server connection failed. '
        . 'Tried: ' . $triedStr . '. '
        . 'Installed ODBC drivers: ' . $installedStr . '. '
        . 'Last error: ' . $lastMsg
    );
}

/**
 * Returns ODBC drivers installed on Windows by reading the registry via `reg query`.
 * Falls back to an empty array on non-Windows or permission error.
 *
 * @return list<string>
 */
function op_ip_installed_odbc_drivers(): array
{
    $out = [];
    $raw = @shell_exec('reg query "HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Drivers" 2>nul');
    if ($raw === null || $raw === '') {
        return $out;
    }
    foreach (preg_split('/\r\n|\n|\r/', $raw) ?: [] as $line) {
        if (preg_match('/^\s+(.+?)\s+REG_SZ\s+Installed/i', $line, $m)) {
            $out[] = trim($m[1]);
        }
    }
    return $out;
}

/**
 * Builds the PDO ODBC DSN, omitting Encrypt/TrustServerCertificate for drivers
 * that don't support those attributes (legacy DBNETLIB-based "SQL Server" driver).
 */
function op_ip_build_odbc_dsn(string $driver, string $server, string $database): string
{
    $base = 'odbc:Driver={' . $driver . '};Server=' . $server . ';Database=' . $database;
    $isLegacy = ($driver === 'SQL Server');
    if ($isLegacy) {
        return $base;
    }
    return $base . ';Encrypt=yes;TrustServerCertificate=yes';
}

function op_ip_pdo_new(string $dsn, string $user, string $pass): PDO
{
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
}

function op_ip_bool_option(mixed $v): bool
{
    if (is_bool($v)) {
        return $v;
    }
    if (is_string($v)) {
        return strcasecmp($v, 'true') === 0 || $v === '1' || strcasecmp($v, 'yes') === 0;
    }
    return (bool) $v;
}
