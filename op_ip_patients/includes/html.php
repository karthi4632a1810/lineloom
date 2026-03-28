<?php

declare(strict_types=1);

function op_ip_h(?string $value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * @param array<string, string> $headers
 * @param list<array<string, mixed>> $rows
 */
function op_ip_render_table(string $title, array $headers, array $rows, int $total, int $page, int $pageSize, string $pageParam): void
{
    $pages = max(1, $pageSize > 0 ? (int) ceil($total / $pageSize) : 1);
    echo '<section class="panel"><h2>' . op_ip_h($title) . '</h2>';
    echo '<p class="meta">Total: ' . (int) $total . ' · Page ' . (int) $page . ' of ' . $pages . '</p>';
    if ($rows === []) {
        echo '<p class="empty">No rows match the current filters.</p></section>';
        return;
    }
    echo '<div class="table-wrap"><table><thead><tr>';
    foreach ($headers as $alias => $label) {
        echo '<th>' . op_ip_h($label) . '</th>';
    }
    echo '</tr></thead><tbody>';
    op_ip_render_rows($headers, $rows);
    echo '</tbody></table></div>';
    echo op_ip_pagination_links($pageParam, $page, $pages);
    echo '</section>';
}

/**
 * @param array<string, string> $headers
 * @param list<array<string, mixed>> $rows
 */
function op_ip_render_rows(array $headers, array $rows): void
{
    foreach ($rows as $row) {
        echo '<tr>';
        foreach ($headers as $alias => $_label) {
            $cell = $row[$alias] ?? '';
            if ($cell instanceof DateTimeInterface) {
                $cell = $cell->format('Y-m-d H:i:s');
            }
            echo '<td>' . op_ip_h((string) $cell) . '</td>';
        }
        echo '</tr>';
    }
}

function op_ip_pagination_links(string $param, int $current, int $last): string
{
    if ($last <= 1) {
        return '';
    }
    $qs = $_GET;
    $out = '<nav class="pager" aria-label="Pagination"><span>Pages:</span> ';
    for ($p = 1; $p <= min($last, 50); $p++) {
        $qs[$param] = (string) $p;
        $q = http_build_query($qs);
        $cls = $p === $current ? ' class="current"' : '';
        $out .= '<a' . $cls . ' href="?' . op_ip_h($q) . '">' . $p . '</a> ';
    }
    if ($last > 50) {
        $out .= '<span>…</span>';
    }
    $out .= '</nav>';
    return $out;
}
