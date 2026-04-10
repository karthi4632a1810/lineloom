<?php

declare(strict_types=1);

/**
 * HTML view of INFORMATION_SCHEMA.COLUMNS for configured OP/IP/patient tables.
 * Same guards as discover_schema.php (localhost + discover_enabled).
 */
require_once __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'schema.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'html.php';

$local = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($local, ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Forbidden (localhost only).';
    exit;
}

$tableKey = isset($_GET['table']) ? strtolower((string) $_GET['table']) : 'all';
if (!in_array($tableKey, ['all', 'ip', 'op', 'patient'], true)) {
    $tableKey = 'all';
}

$errorMessage = null;
$sections = [];

try {
    $config = op_ip_load_config();
    if (empty($config['discover_enabled'])) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Set discover_enabled to true in config.php to use this tool.';
        exit;
    }
    $pdo = op_ip_connect($config);
    $q = $config['queries'];

    $map = [
        'patient' => ['label' => 'Patient master', 'qualified' => $q['patient_master'] ?? ''],
        'op' => ['label' => 'OP admission', 'qualified' => $q['op_reg'] ?? ''],
        'ip' => ['label' => 'IP admission (Mast_IP_Admission)', 'qualified' => $q['ip_reg'] ?? ''],
    ];

    $keysToShow = $tableKey === 'all' ? ['patient', 'op', 'ip'] : [$tableKey];
    foreach ($keysToShow as $key) {
        if (!isset($map[$key])) {
            continue;
        }
        $pair = op_ip_parse_qualified($map[$key]['qualified']);
        if ($pair[0] === '' || $pair[1] === '') {
            continue;
        }
        [$schema, $name] = $pair;
        $sections[] = [
            'title' => $map[$key]['label'],
            'fullName' => $schema . '.' . $name,
            'rows' => op_ip_fetch_columns($pdo, $schema, $name),
        ];
    }
    $pdo = null;
} catch (Throwable $e) {
    error_log('table_columns: ' . $e->getMessage());
    $errorMessage = 'Could not load column metadata. Check database connection and config.';
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Table columns (INFORMATION_SCHEMA)</title>
  <link rel="stylesheet" href="assets/style.css" />
  <style>
    .col-meta { font-size: 13px; margin: 8px 0 16px; }
    .col-meta a { margin-right: 12px; }
    .col-table-wrap { overflow-x: auto; margin-bottom: 28px; }
    .col-table { border-collapse: collapse; width: 100%; font-size: 13px; }
    .col-table th, .col-table td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    .col-table th { background: #f8fafc; }
    .col-table code { font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>SQL Server column list</h1>
    <p class="col-meta">
      Filter:
      <a href="?table=all">All tables</a>
      <a href="?table=patient">Patient only</a>
      <a href="?table=op">OP only</a>
      <a href="?table=ip">IP only</a>
      · <a href="index.php">Back to OP/IP list</a>
    </p>
    <?php if ($errorMessage !== null) : ?>
      <div class="banner error"><?php echo op_ip_h($errorMessage); ?></div>
    <?php endif; ?>

    <?php foreach ($sections as $section) : ?>
      <section class="panel">
        <h2><?php echo op_ip_h($section['title']); ?></h2>
        <p class="meta"><code><?php echo op_ip_h($section['fullName']); ?></code> — <?php echo count($section['rows']); ?> columns</p>
        <?php if ($section['rows'] === []) : ?>
          <p class="empty">No columns returned.</p>
        <?php else : ?>
          <div class="col-table-wrap">
            <table class="col-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>COLUMN_NAME</th>
                  <th>DATA_TYPE</th>
                  <th>IS_NULLABLE</th>
                  <th>CHAR_MAX_LEN</th>
                  <th>NUMERIC_PRECISION</th>
                  <th>NUMERIC_SCALE</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($section['rows'] as $row) : ?>
                  <tr>
                    <td><?php echo op_ip_h((string) ($row['ORDINAL_POSITION'] ?? '')); ?></td>
                    <td><code><?php echo op_ip_h((string) ($row['COLUMN_NAME'] ?? '')); ?></code></td>
                    <td><?php echo op_ip_h((string) ($row['DATA_TYPE'] ?? '')); ?></td>
                    <td><?php echo op_ip_h((string) ($row['IS_NULLABLE'] ?? '')); ?></td>
                    <td><?php echo op_ip_h((string) ($row['CHARACTER_MAXIMUM_LENGTH'] ?? '')); ?></td>
                    <td><?php echo op_ip_h((string) ($row['NUMERIC_PRECISION'] ?? '')); ?></td>
                    <td><?php echo op_ip_h((string) ($row['NUMERIC_SCALE'] ?? '')); ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php endif; ?>
      </section>
    <?php endforeach; ?>

    <p class="hint">
      Plain-text version: <code>discover_schema.php</code> (same <code>discover_enabled</code> flag).
    </p>
  </div>
</body>
</html>
