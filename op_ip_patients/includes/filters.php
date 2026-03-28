<?php

declare(strict_types=1);

/**
 * Parses GET parameters into normalized filter arrays for OP and IP queries.
 *
 * @return array{view:string, patient_name:string, patient_id:string, gender:string, op_from:string, op_to:string, ip_from:string, ip_to:string, dept:string, ward:string, sort_op:string, sort_ip:string, page_op:int, page_ip:int, page_size:int}
 */
function op_ip_parse_filters(array $config, array $get): array
{
    $maxSize = (int) ($config['pagination']['max_page_size'] ?? 100);
    $defaultSize = (int) ($config['pagination']['default_page_size'] ?? 25);
    if ($maxSize < 1) {
        $maxSize = 100;
    }
    if ($defaultSize < 1) {
        $defaultSize = 25;
    }
    $view = $get['view'] ?? 'both';
    if (!in_array($view, ['both', 'op', 'ip'], true)) {
        $view = 'both';
    }
    $pageSize = isset($get['page_size']) ? (int) $get['page_size'] : $defaultSize;
    if ($pageSize < 1) {
        $pageSize = $defaultSize;
    }
    if ($pageSize > $maxSize) {
        $pageSize = $maxSize;
    }
    $pageOp = max(1, (int) ($get['page_op'] ?? 1));
    $pageIp = max(1, (int) ($get['page_ip'] ?? 1));
    $sortOp = $get['sort_op'] ?? 'reg_date_desc';
    $sortIp = $get['sort_ip'] ?? 'adm_date_desc';
    return [
        'view' => $view,
        'patient_name' => trim((string) ($get['patient_name'] ?? '')),
        'patient_id' => trim((string) ($get['patient_id'] ?? '')),
        'gender' => trim((string) ($get['gender'] ?? '')),
        'op_from' => trim((string) ($get['op_from'] ?? '')),
        'op_to' => trim((string) ($get['op_to'] ?? '')),
        'ip_from' => trim((string) ($get['ip_from'] ?? '')),
        'ip_to' => trim((string) ($get['ip_to'] ?? '')),
        'dept' => trim((string) ($get['dept'] ?? '')),
        'ward' => trim((string) ($get['ward'] ?? '')),
        'sort_op' => $sortOp,
        'sort_ip' => $sortIp,
        'page_op' => $pageOp,
        'page_ip' => $pageIp,
        'page_size' => $pageSize,
    ];
}
