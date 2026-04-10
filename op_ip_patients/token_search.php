<?php

declare(strict_types=1);

/**
 * Create-token style HIS search in PHP (for users without direct SQL Server access).
 * Uses DB credentials from config.php and searches OP/IP by reg no, name, and date range.
 */
require_once __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'html.php';

/**
 * @return array{0:string,1:string}
 */
function op_ip_choose_lookup(array $tables, array $idCols, array $nameCols, array $tableHints): array
{
    $best = ['', '', ''];
    $bestScore = -1;
    foreach ($tables as $full => $cols) {
        if (!is_array($cols) || $cols === []) {
            continue;
        }
        $id = '';
        foreach ($idCols as $c) {
            if (in_array($c, $cols, true)) {
                $id = $c;
                break;
            }
        }
        $name = '';
        foreach ($nameCols as $c) {
            if (in_array($c, $cols, true)) {
                $name = $c;
                break;
            }
        }
        if ($id === '' || $name === '') {
            continue;
        }
        $score = 0;
        if ($id === $idCols[0]) {
            $score += 5;
        }
        if ($name === $nameCols[0]) {
            $score += 5;
        }
        foreach ($tableHints as $hint) {
            if (stripos($full, $hint) !== false) {
                $score += 6;
                break;
            }
        }
        if ($score > $bestScore) {
            $bestScore = $score;
            $best = [$full, $id, $name];
        }
    }
    return $best;
}

/**
 * @return array{dept:array{table:string,id:string,name:string}|null,user:array{table:string,id:string,name:string}|null}
 */
function op_ip_detect_fk_lookups(PDO $pdo): array
{
    $sql = 'SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS '
        . "WHERE COLUMN_NAME IN ('iDept_id','DepartmentID','iDeptId','cDept_Name','cDeptName','DepartmentName','cName',"
        . "'iUser_id','UserID','iUserId','iEmp_id','EmployeeID','cUser_Name','cUserName','UserName','cEmp_Name','cEmployee_Name')";
    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    $tables = [];
    foreach ($rows as $r) {
        if (!is_array($r)) {
            continue;
        }
        $schema = (string) ($r['TABLE_SCHEMA'] ?? '');
        $table = (string) ($r['TABLE_NAME'] ?? '');
        $col = (string) ($r['COLUMN_NAME'] ?? '');
        if ($schema === '' || $table === '' || $col === '') {
            continue;
        }
        $full = '[' . str_replace(']', ']]', $schema) . '].[' . str_replace(']', ']]', $table) . ']';
        $tables[$full] ??= [];
        $tables[$full][] = $col;
    }

    [$deptTable, $deptId, $deptName] = op_ip_choose_lookup(
        $tables,
        ['iDept_id', 'DepartmentID', 'iDeptId'],
        ['cDept_Name', 'cDeptName', 'DepartmentName', 'cName'],
        ['Mast_Dept', 'Department', 'Dept']
    );
    [$userTable, $userId, $userName] = op_ip_choose_lookup(
        $tables,
        ['iUser_id', 'UserID', 'iUserId', 'iEmp_id', 'EmployeeID'],
        ['cUser_Name', 'cUserName', 'UserName', 'cEmp_Name', 'cEmployee_Name', 'cName'],
        ['Mast_User', 'User', 'Mast_Employee', 'Staff']
    );

    return [
        'dept' => $deptTable !== '' ? ['table' => $deptTable, 'id' => $deptId, 'name' => $deptName] : null,
        'user' => $userTable !== '' ? ['table' => $userTable, 'id' => $userId, 'name' => $userName] : null,
    ];
}

$errorMessage = null;
$rows = [];
$searched = false;

$g = static function (string $k): string {
    return isset($_GET[$k]) ? trim((string) $_GET[$k]) : '';
};

$name = $g('name');
$regNo = $g('reg_no');
$from = $g('date_from');
$to = $g('date_to');

try {
    $config = op_ip_load_config();
    $pdo = op_ip_connect($config);
    $lookups = op_ip_detect_fk_lookups($pdo);

    $userNameOp = 'CAST(NULL AS VARCHAR(200))';
    $userNameIp = 'CAST(NULL AS VARCHAR(200))';
    if ($lookups['user'] !== null) {
        $ut = $lookups['user']['table'];
        $uid = '[' . str_replace(']', ']]', $lookups['user']['id']) . ']';
        $unm = '[' . str_replace(']', ']]', $lookups['user']['name']) . ']';
        $userNameOp = "(SELECT TOP 1 CAST(u.$unm AS VARCHAR(200)) FROM $ut u WHERE CAST(u.$uid AS VARCHAR(100)) = CAST(pm.iUser_id AS VARCHAR(100)))";
        $userNameIp = $userNameOp;
    }

    $deptNameOp = 'CAST(NULL AS VARCHAR(200))';
    $deptNameIp = 'CAST(NULL AS VARCHAR(200))';
    if ($lookups['dept'] !== null) {
        $dt = $lookups['dept']['table'];
        $did = '[' . str_replace(']', ']]', $lookups['dept']['id']) . ']';
        $dnm = '[' . str_replace(']', ']]', $lookups['dept']['name']) . ']';
        $deptNameOp = "(SELECT TOP 1 CAST(d.$dnm AS VARCHAR(200)) FROM $dt d WHERE CAST(d.$did AS VARCHAR(100)) = CAST(op.iDept_id AS VARCHAR(100)))";
        $deptNameIp = "(SELECT TOP 1 CAST(d.$dnm AS VARCHAR(200)) FROM $dt d WHERE CAST(d.$did AS VARCHAR(100)) = CAST(ip.iDept_id AS VARCHAR(100)))";
    }

    if ($name !== '' || $regNo !== '' || $from !== '' || $to !== '') {
        $searched = true;
        $opWhere = [];
        $ipWhere = [];
        $opParams = [];
        $ipParams = [];

        if ($name !== '') {
            $opWhere[] = 'pm.cPat_Name LIKE ?';
            $ipWhere[] = 'pm.cPat_Name LIKE ?';
            $opParams[] = '%' . $name . '%';
            $ipParams[] = '%' . $name . '%';
        }
        if ($regNo !== '') {
            $opWhere[] = '(CAST(op.iOP_Reg_No AS VARCHAR(100)) LIKE ? OR CAST(pm.iReg_No AS VARCHAR(100)) LIKE ?)';
            $ipWhere[] = '(CAST(ip.iIP_Reg_No AS VARCHAR(100)) LIKE ? OR CAST(pm.iReg_No AS VARCHAR(100)) LIKE ?)';
            $opParams[] = '%' . $regNo . '%';
            $opParams[] = '%' . $regNo . '%';
            $ipParams[] = '%' . $regNo . '%';
            $ipParams[] = '%' . $regNo . '%';
        }
        if ($from !== '') {
            $opWhere[] = 'op.dOP_dt >= ?';
            $ipWhere[] = 'ip.dIP_dt >= ?';
            $opParams[] = $from . ' 00:00:00';
            $ipParams[] = $from . ' 00:00:00';
        }
        if ($to !== '') {
            $opWhere[] = 'op.dOP_dt <= ?';
            $ipWhere[] = 'ip.dIP_dt <= ?';
            $opParams[] = $to . ' 23:59:59';
            $ipParams[] = $to . ' 23:59:59';
        }

        $opSql = 'SELECT TOP 100 '
            . "CAST(op.iOP_Reg_No AS VARCHAR(100)) AS reg_no, op.dOP_dt AS admission, CAST(NULL AS VARCHAR(50)) AS ip_active, "
            . "CAST(pm.iReg_No AS VARCHAR(100)) AS iReg_No, CAST(pm.cPat_Name AS VARCHAR(200)) AS cPat_Name, pm.dDob AS dDob, "
            . "CAST(pm.cSex AS VARCHAR(20)) AS cSex, CAST(pm.iUser_id AS VARCHAR(100)) AS iUser_id, $userNameOp AS user_name, "
            . "CAST(op.iDept_id AS VARCHAR(100)) AS dept_id, $deptNameOp AS dept_name, 'OP' AS visit_type "
            . 'FROM [dbo].[Mast_OP_Admission] op INNER JOIN [dbo].[Mast_Patient] pm ON op.iPat_id = pm.iPat_id '
            . ($opWhere === [] ? '' : ('WHERE ' . implode(' AND ', $opWhere))) . ' ';

        $ipSql = 'SELECT TOP 100 '
            . "CAST(ip.iIP_Reg_No AS VARCHAR(100)) AS reg_no, ip.dIP_dt AS admission, CAST(ip.bStatus AS VARCHAR(50)) AS ip_active, "
            . "CAST(pm.iReg_No AS VARCHAR(100)) AS iReg_No, CAST(pm.cPat_Name AS VARCHAR(200)) AS cPat_Name, pm.dDob AS dDob, "
            . "CAST(pm.cSex AS VARCHAR(20)) AS cSex, CAST(pm.iUser_id AS VARCHAR(100)) AS iUser_id, $userNameIp AS user_name, "
            . "CAST(ip.iDept_id AS VARCHAR(100)) AS dept_id, $deptNameIp AS dept_name, 'IP' AS visit_type "
            . 'FROM [dbo].[Mast_IP_Admission] ip INNER JOIN [dbo].[Mast_Patient] pm ON ip.iPat_id = pm.iPat_id '
            . ($ipWhere === [] ? '' : ('WHERE ' . implode(' AND ', $ipWhere))) . ' ';

        $finalSql = 'SELECT TOP 200 * FROM ('
            . $opSql . ' UNION ALL ' . $ipSql
            . ') z ORDER BY admission DESC';
        $params = array_merge($opParams, $ipParams);
        $stmt = $pdo->prepare($finalSql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
} catch (Throwable $e) {
    error_log('token_search.php: ' . $e->getMessage());
    $errorMessage = op_ip_startup_error_message($e);
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Token Search (PHP)</title>
  <link rel="stylesheet" href="assets/style.css" />
</head>
<body>
  <div class="wrap">
    <h1>Create token search (PHP)</h1>
    <?php if ($errorMessage !== null) : ?>
      <div class="banner error"><?php echo op_ip_h($errorMessage); ?></div>
    <?php endif; ?>
    <form class="banner" method="get" action="">
      <div class="filters">
        <label>Patient name
          <input type="text" name="name" value="<?php echo op_ip_h($name); ?>" placeholder="Contains" />
        </label>
        <label>IP / OP reg no / iReg_No
          <input type="text" name="reg_no" value="<?php echo op_ip_h($regNo); ?>" placeholder="IP07004303 or 6028045" />
        </label>
        <label>Admission from
          <input type="date" name="date_from" value="<?php echo op_ip_h($from); ?>" />
        </label>
        <label>Admission to
          <input type="date" name="date_to" value="<?php echo op_ip_h($to); ?>" />
        </label>
        <div class="row-span actions">
          <button type="submit">Search</button>
          <a class="btn secondary" href="token_search.php">Reset</a>
          <a class="btn secondary" href="index.php">Back</a>
        </div>
      </div>
    </form>

    <section class="panel">
      <h2>Results</h2>
      <?php if (!$searched) : ?>
        <p class="empty">Enter filters and click Search.</p>
      <?php elseif ($rows === []) : ?>
        <p class="empty">No rows found.</p>
      <?php else : ?>
        <p class="meta">Rows: <?php echo count($rows); ?></p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>IP / OP Reg No</th>
                <th>Admission</th>
                <th>IP Active</th>
                <th>iReg_No</th>
                <th>cPat_Name</th>
                <th>dDob</th>
                <th>cSex</th>
                <th>iUser_id</th>
                <th>User Name</th>
                <th>Dept ID</th>
                <th>Dept Name</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($rows as $r) : ?>
                <tr>
                  <td><?php echo op_ip_h((string) ($r['visit_type'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['reg_no'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['admission'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['ip_active'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['iReg_No'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['cPat_Name'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['dDob'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['cSex'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['iUser_id'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['user_name'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['dept_id'] ?? '')); ?></td>
                  <td><?php echo op_ip_h((string) ($r['dept_name'] ?? '')); ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </section>
  </div>
</body>
</html>
