<?php

declare(strict_types=1);

/**
 * Builds SELECT fragments with stable aliases (c0, c1, …) for display headers.
 *
 * @param array<string, string> $columns
 * @return array{0: list<string>, 1: array<string, string>}
 */
function op_ip_select_parts(array $columns, string $prefix): array
{
    $parts = [];
    $headers = [];
    $i = 0;
    foreach ($columns as $label => $expr) {
        $alias = $prefix . $i;
        $parts[] = trim($expr) . ' AS [' . $alias . ']';
        $headers[$alias] = $label;
        $i++;
    }
    return [$parts, $headers];
}

function op_ip_whitelist_sort(string $key, array $whitelist, string $fallback): string
{
    return isset($whitelist[$key]) ? $whitelist[$key] : $fallback;
}

/**
 * @param list<string> $selectParts
 * @param list<mixed> $whereParams
 * @return array{headers:array<string, string>, total:int, rows:list<array<string, mixed>>}
 */
function op_ip_paged_join_query(
    PDO $conn,
    string $fromSql,
    array $selectParts,
    array $headers,
    string $whereSql,
    array $whereParams,
    string $sortKey,
    int $page,
    int $pageSize
): array {
    $countSql = "SELECT COUNT(*) AS cnt FROM $fromSql WHERE $whereSql";
    $total = op_ip_scalar_int($conn, $countSql, $whereParams);
    $offset = max(0, ($page - 1) * $pageSize);
    $safeSize = max(1, $pageSize);
    // OFFSET/FETCH literals — legacy SQL Server ODBC driver does not accept bound params here
    $selectSql = 'SELECT ' . implode(', ', $selectParts)
        . " FROM $fromSql WHERE $whereSql ORDER BY $sortKey"
        . " OFFSET $offset ROWS FETCH NEXT $safeSize ROWS ONLY";
    $rows = op_ip_fetch_all($conn, $selectSql, $whereParams);
    return ['headers' => $headers, 'total' => $total, 'rows' => $rows];
}

/**
 * @return array{headers:array<string, string>, total:int, rows:list<array<string, mixed>>}
 */
function op_ip_run_op_query(PDO $conn, array $config, array $filters): array
{
    $q = $config['queries'];
    $opCols = $config['op_columns'] ?? [];
    if (!is_array($opCols) || $opCols === []) {
        throw new RuntimeException('config op_columns must be a non-empty array.');
    }
    [$selectParts, $headers] = op_ip_select_parts($opCols, 'c');
    $sortKey = op_ip_whitelist_sort($filters['sort_op'], $config['op_sort_whitelist'] ?? [], 'op.RegistrationDate DESC');
    $where = ['1 = 1'];
    $params = [];
    op_ip_append_common_filters($q, $filters, $where, $params);
    op_ip_append_date_range($q['op_date_column'] ?? 'op.RegistrationDate', $filters['op_from'], $filters['op_to'], $where, $params);
    if ($filters['dept'] !== '') {
        $where[] = ($q['op_dept_column'] ?? 'op.DepartmentID') . ' = ?';
        $params[] = $filters['dept'];
    }
    $fromSql = $q['op_reg'] . ' op INNER JOIN ' . $q['patient_master'] . ' pm ON ' . $q['op_join_condition'];
    return op_ip_paged_join_query(
        $conn,
        $fromSql,
        $selectParts,
        $headers,
        implode(' AND ', $where),
        $params,
        $sortKey,
        $filters['page_op'],
        $filters['page_size']
    );
}

/**
 * @return array{headers:array<string, string>, total:int, rows:list<array<string, mixed>>}
 */
function op_ip_run_ip_query(PDO $conn, array $config, array $filters): array
{
    $q = $config['queries'];
    $ipCols = $config['ip_columns'] ?? [];
    if (!is_array($ipCols) || $ipCols === []) {
        throw new RuntimeException('config ip_columns must be a non-empty array.');
    }
    [$selectParts, $headers] = op_ip_select_parts($ipCols, 'd');
    $sortKey = op_ip_whitelist_sort($filters['sort_ip'], $config['ip_sort_whitelist'] ?? [], 'ip.AdmissionDate DESC');
    $where = ['1 = 1'];
    $params = [];
    op_ip_append_common_filters($q, $filters, $where, $params);
    op_ip_append_date_range($q['ip_date_column'] ?? 'ip.AdmissionDate', $filters['ip_from'], $filters['ip_to'], $where, $params);
    if ($filters['ward'] !== '') {
        $where[] = ($q['ip_ward_column'] ?? 'ip.WardID') . ' = ?';
        $params[] = $filters['ward'];
    }
    $fromSql = $q['ip_reg'] . ' ip INNER JOIN ' . $q['patient_master'] . ' pm ON ' . $q['ip_join_condition'];
    return op_ip_paged_join_query(
        $conn,
        $fromSql,
        $selectParts,
        $headers,
        implode(' AND ', $where),
        $params,
        $sortKey,
        $filters['page_ip'],
        $filters['page_size']
    );
}

/**
 * @param list<string> $where
 * @param list<mixed> $params
 */
function op_ip_append_common_filters(array $q, array $filters, array &$where, array &$params): void
{
    if ($filters['patient_name'] !== '') {
        $where[] = ($q['patient_name_column'] ?? 'pm.PatName') . ' LIKE ?';
        $params[] = '%' . $filters['patient_name'] . '%';
    }
    if ($filters['patient_id'] !== '') {
        $where[] = ($q['patient_id_column'] ?? 'pm.PatientID') . ' = ?';
        $params[] = $filters['patient_id'];
    }
    if ($filters['gender'] !== '' && ($q['gender_column'] ?? '') !== '') {
        $where[] = $q['gender_column'] . ' = ?';
        $params[] = $filters['gender'];
    }
}

/**
 * @param list<string> $where
 * @param list<mixed> $params
 */
function op_ip_append_date_range(string $col, string $from, string $to, array &$where, array &$params): void
{
    if ($from !== '') {
        $where[] = $col . ' >= ?';
        $params[] = $from . ' 00:00:00';
    }
    if ($to !== '') {
        $where[] = $col . ' <= ?';
        $params[] = $to . ' 23:59:59';
    }
}

/**
 * @param list<mixed> $params
 */
function op_ip_scalar_int(PDO $conn, string $sql, array $params): int
{
    $row = null;
    try {
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        op_ip_query_throw($e);
    }
    if (!is_array($row) || !isset($row['cnt'])) {
        return 0;
    }
    return (int) $row['cnt'];
}

/**
 * @param list<mixed> $params
 * @return list<array<string, mixed>>
 */
function op_ip_fetch_all(PDO $conn, string $sql, array $params): array
{
    $rows = [];
    try {
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        op_ip_query_throw($e);
    }
    $out = [];
    foreach ($rows as $row) {
        $out[] = is_array($row) ? $row : [];
    }
    return $out;
}

function op_ip_query_throw(PDOException $e): void
{
    error_log('op_ip_patients query error: ' . $e->getMessage());
    throw new RuntimeException('Query failed. Verify table and column names in config.php.');
}
