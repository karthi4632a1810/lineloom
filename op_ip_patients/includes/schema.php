<?php

declare(strict_types=1);

/**
 * @return array{0: string, 1: string} [schema, tableName]
 */
function op_ip_parse_qualified(string $qualified): array
{
    $q = trim($qualified);
    if (preg_match('/\[([^\]]+)\]\s*\.\s*\[([^\]]+)\]/', $q, $m)) {
        return [$m[1], $m[2]];
    }
    if (preg_match('/\[([^\]]+)\]\s*$/', $q, $m)) {
        return ['dbo', $m[1]];
    }
    return ['dbo', $q];
}

/**
 * @return list<array<string, mixed>>
 */
function op_ip_fetch_columns(PDO $pdo, string $schema, string $tableName): array
{
    $sql = 'SELECT ORDINAL_POSITION, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, '
        . 'CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE '
        . 'FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? '
        . 'ORDER BY ORDINAL_POSITION';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$schema, $tableName]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $out = [];
    foreach ($rows as $row) {
        $out[] = is_array($row) ? $row : [];
    }
    return $out;
}
