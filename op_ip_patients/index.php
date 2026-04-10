<?php

declare(strict_types=1);

/**
 * OP / IP patient list — SQL Server via PDO (pdo_sqlsrv or pdo_odbc).
 */
require_once __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'filters.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'query.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'html.php';

$errorMessage = null;
$opError = null;
$ipError = null;
$ipSourceError = null;
$opResult = null;
$ipResult = null;
$ipSourceResult = null;
$filters = [
    'view' => 'both',
    'page_op' => 1,
    'page_ip' => 1,
    'page_ip_source' => 1,
    'page_size' => 25,
];

try {
    $config = op_ip_load_config();
    $filters = op_ip_parse_filters($config, $_GET);
    $conn = op_ip_connect($config);
    $view = $filters['view'];
    if ($view === 'both' || $view === 'op') {
        try {
            $opResult = op_ip_run_op_query($conn, $config, $filters);
        } catch (Throwable $e) {
            error_log('op_ip_patients OP: ' . $e->getMessage());
            $opError = 'Outpatient query failed. Check column names in config.php.';
        }
    }
    if ($view === 'both' || $view === 'ip') {
        try {
            $ipResult = op_ip_run_ip_query($conn, $config, $filters);
        } catch (Throwable $e) {
            error_log('op_ip_patients IP: ' . $e->getMessage());
            $ipError = 'Inpatient query failed. Check column names in config.php.';
        }
        try {
            $ipSourceResult = op_ip_run_ip_source_query($conn, $config, $filters);
        } catch (Throwable $e) {
            error_log('op_ip_patients IP source: ' . $e->getMessage());
            $ipSourceError = 'IP source table query failed. Check table and filters in config.php.';
        }
    }
    $conn = null;
} catch (Throwable $e) {
    error_log('op_ip_patients: ' . $e->getMessage());
    $errorMessage = op_ip_startup_error_message($e);
}

$g = static function (string $key, string $default = ''): string {
    return isset($_GET[$key]) ? (string) $_GET[$key] : $default;
};

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OP / IP patients</title>
  <link rel="stylesheet" href="assets/style.css" />
</head>
<body>
  <div class="wrap">
    <h1>Outpatient &amp; Inpatient patients</h1>
    <?php if ($errorMessage !== null) : ?>
      <div class="banner error"><?php echo op_ip_h($errorMessage); ?></div>
    <?php endif; ?>
    <?php if ($opError !== null) : ?>
      <div class="banner error"><?php echo op_ip_h($opError); ?></div>
    <?php endif; ?>
    <?php if ($ipError !== null) : ?>
      <div class="banner error"><?php echo op_ip_h($ipError); ?></div>
    <?php endif; ?>
    <?php if ($ipSourceError !== null) : ?>
      <div class="banner error"><?php echo op_ip_h($ipSourceError); ?></div>
    <?php endif; ?>

    <form class="banner" method="get" action="">
      <div class="filters">
        <label>View
          <select name="view">
            <option value="both"<?php echo $g('view', 'both') === 'both' ? ' selected' : ''; ?>>OP + IP</option>
            <option value="op"<?php echo $g('view') === 'op' ? ' selected' : ''; ?>>OP only</option>
            <option value="ip"<?php echo $g('view') === 'ip' ? ' selected' : ''; ?>>IP only</option>
          </select>
        </label>
        <label>Patient name (contains)
          <input type="text" name="patient_name" value="<?php echo op_ip_h($g('patient_name')); ?>" placeholder="Name" />
        </label>
        <label>Patient ID (exact)
          <input type="text" name="patient_id" value="<?php echo op_ip_h($g('patient_id')); ?>" />
        </label>
        <label>Gender
          <input type="text" name="gender" value="<?php echo op_ip_h($g('gender')); ?>" placeholder="M / F" />
        </label>
        <label>OP from
          <input type="date" name="op_from" value="<?php echo op_ip_h($g('op_from')); ?>" />
        </label>
        <label>OP to
          <input type="date" name="op_to" value="<?php echo op_ip_h($g('op_to')); ?>" />
        </label>
        <label>IP from
          <input type="date" name="ip_from" value="<?php echo op_ip_h($g('ip_from')); ?>" />
        </label>
        <label>IP to
          <input type="date" name="ip_to" value="<?php echo op_ip_h($g('ip_to')); ?>" />
        </label>
        <label>Dept ID (OP)
          <input type="text" name="dept" value="<?php echo op_ip_h($g('dept')); ?>" />
        </label>
        <label>Ward ID (IP)
          <input type="text" name="ward" value="<?php echo op_ip_h($g('ward')); ?>" />
        </label>
        <label>Sort OP
          <select name="sort_op">
            <?php
            $so = $g('sort_op', 'reg_date_desc');
            $opSorts = [
                'reg_date_desc' => 'Reg date (newest)',
                'reg_date_asc' => 'Reg date (oldest)',
                'name_asc' => 'Name A–Z',
                'name_desc' => 'Name Z–A',
            ];
            foreach ($opSorts as $k => $label) {
                echo '<option value="' . op_ip_h($k) . '"' . ($so === $k ? ' selected' : '') . '>' . op_ip_h($label) . '</option>';
            }
            ?>
          </select>
        </label>
        <label>Sort IP
          <select name="sort_ip">
            <?php
            $si = $g('sort_ip', 'adm_date_desc');
            $ipSorts = [
                'adm_date_desc' => 'Admission (newest)',
                'adm_date_asc' => 'Admission (oldest)',
                'name_asc' => 'Name A–Z',
                'name_desc' => 'Name Z–A',
            ];
            foreach ($ipSorts as $k => $label) {
                echo '<option value="' . op_ip_h($k) . '"' . ($si === $k ? ' selected' : '') . '>' . op_ip_h($label) . '</option>';
            }
            ?>
          </select>
        </label>
        <label>Rows per page
          <input type="number" name="page_size" min="1" max="100" value="<?php echo op_ip_h($g('page_size', '25')); ?>" />
        </label>
        <div class="row-span actions">
          <button type="submit">Apply filters</button>
          <a class="btn secondary" href="<?php echo op_ip_h($_SERVER['PHP_SELF'] ?? 'index.php'); ?>">Reset</a>
        </div>
      </div>
    </form>

    <?php
    if ($opResult !== null) {
        op_ip_render_table(
            'Outpatient (OP)',
            $opResult['headers'],
            $opResult['rows'],
            $opResult['total'],
            $filters['page_op'],
            $filters['page_size'],
            'page_op'
        );
    }
    if ($ipResult !== null) {
        op_ip_render_table(
            'Inpatient (IP)',
            $ipResult['headers'],
            $ipResult['rows'],
            $ipResult['total'],
            $filters['page_ip'],
            $filters['page_size'],
            'page_ip'
        );
    }
    if ($ipSourceResult !== null) {
        op_ip_render_table(
            'Mast_IP_Admission (source table)',
            $ipSourceResult['headers'],
            $ipSourceResult['rows'],
            $ipSourceResult['total'],
            $filters['page_ip_source'],
            $filters['page_size'],
            'page_ip_source'
        );
    }
    ?>

    <p class="hint">
      Database settings: optional <code>.env</code> (see <code>ENV.example</code>) or <code>config.php</code>.
      PHP needs <strong>PDO</strong> with either
      <code>pdo_sqlsrv</code> (Microsoft PHP drivers) or <code>pdo_odbc</code> + <strong>ODBC Driver 17/18 for SQL Server</strong>
      (enable <code>extension=odbc</code> and <code>extension=pdo_odbc</code> in <code>php.ini</code>). If queries fail, fix column names
      in config or run <code>discover_schema.php</code> / <code><a href="table_columns.php">table_columns.php</a></code> on localhost.
      For PHP-only create-token style search, open <code><a href="token_search.php">token_search.php</a></code>.
    </p>
  </div>
</body>
</html>
