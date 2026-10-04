<?php

/**
 * 题目多语言题面（四表分工）：
 * - problem_locale：每语言元数据（sort_order、显示名、use_pdf、locale_visible）
 * - problem_md：每语言 Markdown / `__LATEX__` LaTeX **源码**（编辑与题包 interchange）
 * - problem_locale_html：每语言 Pandoc **物化 HTML**（做题 GET 只读本表 + problem 主表副本，不在 GET 再编译）
 * - problem：主表；首选语言题面 HTML 与 `problem_locale_html` 首选行由同一写路径保持同步
 *
 * PDF 仅存放在评测数据根：{OjPath.testdata}/{problem_id}/pdf_desc/{locale_key}.pdf
 */

/**
 * 将 problem_md 片段（MD 源码）编译为 HTML 行（保存 / 导入 / 运维回填；与 `ParseMarkdown` 一致）。
 *
 * @param array<string,mixed> $mdRow 须含 description、input、output、hint、source、author
 * @return array{description:string,input:string,output:string,hint:string,source:string,author:string}
 */
function problem_locale_md_row_to_html_row(array $mdRow): array
{
    return [
        'description' => ParseMarkdown((string) ($mdRow['description'] ?? '')),
        'input'       => ParseMarkdown((string) ($mdRow['input'] ?? '')),
        'output'      => ParseMarkdown((string) ($mdRow['output'] ?? '')),
        'hint'        => ParseMarkdown((string) ($mdRow['hint'] ?? '')),
        'source'      => ParseMarkdown((string) ($mdRow['source'] ?? '')),
        'author'      => ParseMarkdown((string) ($mdRow['author'] ?? '')),
    ];
}

/**
 * 写入或更新 `problem_locale_html` 整行。
 */
function problem_locale_html_upsert(int $problem_id, string $locale_key, array $htmlRow): void
{
    if ($problem_id <= 0 || trim($locale_key) === '') {
        return;
    }
    $pk = ['problem_id' => $problem_id, 'locale_key' => $locale_key];
    $ex = db('problem_locale_html')->where($pk)->find();
    if (is_array($ex)) {
        db('problem_locale_html')->where($pk)->update($htmlRow);
    } else {
        db('problem_locale_html')->insert(array_merge($pk, $htmlRow));
    }
}

function problem_locale_pdf_desc_subdir(): string
{
    return 'pdf_desc';
}

function problem_locale_pdf_desc_dir(int $problem_id): ?string
{
    if ($problem_id <= 0) {
        return null;
    }
    $root = rtrim((string) (config('OjPath.testdata') ?? ''), '/');
    if ($root === '') {
        return null;
    }
    return $root . '/' . $problem_id . '/' . problem_locale_pdf_desc_subdir();
}

function problem_locale_pdf_disk_path(int $problem_id, string $stem): ?string
{
    $dir = problem_locale_pdf_desc_dir($problem_id);
    if ($dir === null) {
        return null;
    }
    return $dir . '/' . $stem . '.pdf';
}

function problem_locale_normalize_lang_stem(string $lang): string
{
    $lang = trim($lang);
    if ($lang === '' || strcasecmp($lang, 'main') === 0) {
        return 'main';
    }
    return $lang;
}

/**
 * 做题端 / URL：空或 main 时解析为当前题 sort_order 最小的一条语言键
 */
function problem_locale_default_key(int $problem_id): string
{
    if ($problem_id <= 0) {
        return 'main';
    }
    $r = db('problem_locale')->where('problem_id', $problem_id)->order('sort_order asc, locale_key asc')->find();
    if (!is_array($r) || empty($r['locale_key'])) {
        return 'main';
    }
    return (string) $r['locale_key'];
}

/**
 * 列表/导出 JOIN：每题 sort_order 最小的一条 problem_md（MySQL 8+ ROW_NUMBER）
 *
 * @return string 子查询 SQL（不含外层别名，供 join([$sql => 'pmd'], ...)）
 */
function problem_md_join_default_subquery_sql(): string
{
    return '(SELECT _x.`problem_id`, _x.`description`, _x.`input`, _x.`output`, _x.`hint`, _x.`source`, _x.`author` FROM (
        SELECT pm.`problem_id`, pm.`description`, pm.`input`, pm.`output`, pm.`hint`, pm.`source`, pm.`author`,
          ROW_NUMBER() OVER (PARTITION BY pm.`problem_id` ORDER BY pl.`sort_order` ASC, pl.`locale_key` ASC) AS `_rn`
        FROM `problem_md` pm
        INNER JOIN `problem_locale` pl ON pm.`problem_id` = pl.`problem_id` AND pm.`locale_key` = pl.`locale_key`
    ) _x WHERE _x.`_rn` = 1)';
}

/**
 * 题目编辑页：用首选语言的 MD 覆盖 problem 行上用于初始展示的题面字段
 *
 * @param array<string,mixed> $problem
 * @return array<string,mixed>
 */
function problem_locale_overlay_problem_with_default_md(array $problem): array
{
    $pid = intval($problem['problem_id'] ?? 0);
    if ($pid <= 0) {
        return $problem;
    }
    $loc = db('problem_locale')->where('problem_id', $pid)->order('sort_order asc, locale_key asc')->find();
    if (!is_array($loc) || empty($loc['locale_key'])) {
        return $problem;
    }
    $k = (string) $loc['locale_key'];
    $md = db('problem_md')->where(['problem_id' => $pid, 'locale_key' => $k])->find();
    if (!is_array($md)) {
        return $problem;
    }
    return array_replace($problem, $md);
}

/**
 * 管理端题目列表：用首选语言在 problem_md 中的 source、author（Markdown 原文）覆盖行内同名字段。
 *
 * 三表分工简述：
 * - problem：题目主表（题号、标题、评测与展示等）；首选语言题面 HTML 与 `problem_locale_html` 同步写入。
 * - problem_locale：各语言元数据（排序、标签名、PDF 开关、可见性），不存题面正文。
 * - problem_md：各语言 Markdown/LaTeX **源码**（含 source、author），与编辑页表单一致；列表/快捷编辑展示「可编辑原文」时应以此为准。
 * - problem_locale_html：各语言 Pandoc **物化 HTML**；做题端 GET 只读本表（首选缺行时回退主表）。
 *
 * @param array<int,array<string,mixed>> $rows 含 problem_id 的行（就地修改）
 */
function problem_list_overlay_rows_default_md_source_author(array &$rows): void
{
    if ($rows === []) {
        return;
    }
    $idList = [];
    foreach ($rows as $r) {
        $pid = intval($r['problem_id'] ?? 0);
        if ($pid > 0) {
            $idList[$pid] = true;
        }
    }
    $ids = array_keys($idList);
    if ($ids === []) {
        return;
    }
    $locAll = db('problem_locale')
        ->where('problem_id', 'in', $ids)
        ->order('problem_id asc, sort_order asc, locale_key asc')
        ->field('problem_id,locale_key')
        ->select();
    if (!is_array($locAll)) {
        $locAll = [];
    }
    $defaultKey = [];
    foreach ($locAll as $lr) {
        $pid = intval($lr['problem_id'] ?? 0);
        if ($pid <= 0) {
            continue;
        }
        if (!isset($defaultKey[$pid])) {
            $defaultKey[$pid] = (string) ($lr['locale_key'] ?? '');
        }
    }
    $mdAll = db('problem_md')
        ->where('problem_id', 'in', $ids)
        ->field('problem_id,locale_key,source,author')
        ->select();
    if (!is_array($mdAll)) {
        $mdAll = [];
    }
    $mdMap = [];
    foreach ($mdAll as $m) {
        $pid = intval($m['problem_id'] ?? 0);
        $k = (string) ($m['locale_key'] ?? '');
        if ($pid > 0 && $k !== '') {
            $mdMap[$pid . "\x1e" . $k] = $m;
        }
    }
    foreach ($rows as &$row) {
        $pid = intval($row['problem_id'] ?? 0);
        if ($pid <= 0) {
            continue;
        }
        $k = $defaultKey[$pid] ?? '';
        if ($k === '') {
            continue;
        }
        $mk = $pid . "\x1e" . $k;
        if (!isset($mdMap[$mk])) {
            continue;
        }
        $m = $mdMap[$mk];
        if (array_key_exists('source', $m)) {
            $row['source'] = $m['source'] !== null ? (string) $m['source'] : '';
        }
        if (array_key_exists('author', $m)) {
            $row['author'] = $m['author'] !== null ? (string) $m['author'] : '';
        }
    }
    unset($row);
}

function problem_locale_resolve_lang_to_pdf_stem(int $problem_id, string $lang): string
{
    $l = trim($lang);
    if ($l === '' || strcasecmp($l, 'main') === 0) {
        return problem_locale_default_key($problem_id);
    }
    if (!problem_locale_pdf_stem_valid($l)) {
        return problem_locale_default_key($problem_id);
    }
    return $l;
}

/**
 * 语言键 / pdf_desc 文件名主干合法性（与 backtask `stem_valid`、题包规范 **[11 · locale_key](11.题包与比赛包ZIP格式.md#locale-fields)** 一致：`[A-Za-z0-9_-]{1,64}`，且不得以 `.` 开头）。
 */
function problem_locale_pdf_stem_valid(string $stem): bool
{
    if ($stem === '' || strlen($stem) > 64) {
        return false;
    }
    if (isset($stem[0]) && $stem[0] === '.') {
        return false;
    }
    return (bool) preg_match('/^[A-Za-z0-9_-]+$/', $stem);
}

/**
 * @return string|null 错误信息；null 合法
 */
function problem_locale_key_validate(string $key): ?string
{
    $key = trim($key);
    if ($key === '') {
        return '语言键不能为空';
    }
    if (!problem_locale_pdf_stem_valid($key)) {
        return '语言键须为 1～64 位英文字母、数字、下划线或连字符（不得以 . 开头）';
    }
    return null;
}

function problem_locale_row_visible_to_user(array $lr): bool
{
    return intval($lr['locale_visible'] ?? 1) !== 0;
}

function problem_locale_is_pdf_magic(string $path): bool
{
    if (!is_file($path) || !is_readable($path)) {
        return false;
    }
    $h = @fopen($path, 'rb');
    if (!$h) {
        return false;
    }
    $sig = fread($h, 5);
    fclose($h);
    return $sig === '%PDF-';
}

function problem_locale_save_uploaded_pdf(string $tmpPath, int $problem_id, string $stem): ?string
{
    if (!problem_locale_pdf_stem_valid($stem)) {
        return '无效的 locale_key';
    }
    $dir = problem_locale_pdf_desc_dir($problem_id);
    if ($dir === null) {
        return '题目 ID 无效或评测数据根未配置';
    }
    if (!MakeDirs($dir)) {
        return '无法创建 pdf_desc 目录';
    }
    $dest = $dir . '/' . $stem . '.pdf';
    if (!problem_locale_is_pdf_magic($tmpPath)) {
        return '文件不是有效的 PDF';
    }
    if (!@rename($tmpPath, $dest)) {
        if (!@copy($tmpPath, $dest)) {
            return '保存 PDF 失败';
        }
        @unlink($tmpPath);
    }
    return null;
}

function problem_locale_delete_pdf(int $problem_id, string $stem): void
{
    $p = problem_locale_pdf_disk_path($problem_id, $stem);
    if ($p !== null && is_file($p)) {
        @unlink($p);
    }
}

function problem_locale_delete_all_pdfs(int $problem_id): void
{
    $dir = problem_locale_pdf_desc_dir($problem_id);
    if ($dir === null || !is_dir($dir)) {
        return;
    }
    foreach (scandir($dir) ?: [] as $f) {
        if ($f === '.' || $f === '..') {
            continue;
        }
        if (preg_match('/^(.+)\.pdf$/i', $f, $m) && problem_locale_pdf_stem_valid($m[1])) {
            @unlink($dir . '/' . $f);
        }
    }
}

function problem_locale_copy_pdf_desc_between_problems(int $srcProblemId, int $dstProblemId): void
{
    if ($srcProblemId <= 0 || $dstProblemId <= 0 || $srcProblemId === $dstProblemId) {
        return;
    }
    $src = problem_locale_pdf_desc_dir($srcProblemId);
    $dst = problem_locale_pdf_desc_dir($dstProblemId);
    if ($src === null || $dst === null || !is_dir($src)) {
        return;
    }
    if (!MakeDirs($dst)) {
        return;
    }
    foreach (scandir($src) ?: [] as $f) {
        if ($f === '.' || $f === '..') {
            continue;
        }
        if (!preg_match('/^(.+)\.pdf$/i', $f, $m)) {
            continue;
        }
        if (!problem_locale_pdf_stem_valid($m[1])) {
            continue;
        }
        @copy($src . '/' . $f, $dst . '/' . $f);
    }
}

/**
 * @param array<int,array<string,mixed>> $rows POST 解析后的语言行（顺序即 sort_order）
 * @return string|null 错误信息
 */
function problem_locales_persist_full(int $problem_id, array $rows): ?string
{
    if ($problem_id <= 0) {
        return '题目 ID 无效';
    }
    $n = count($rows);
    if ($n < 1 || $n > 10) {
        return '须至少 1 种、至多 10 种语言<br/><span class="en-text">Between 1 and 10 locales required</span>';
    }
    $seen = [];
    foreach ($rows as $r) {
        if (!is_array($r)) {
            return '多语言数据格式错误';
        }
        $k = trim((string) ($r['locale_key'] ?? ''));
        $err = problem_locale_key_validate($k);
        if ($err !== null) {
            return $err;
        }
        $low = strtolower($k);
        if (isset($seen[$low])) {
            return '语言键重复: ' . $k;
        }
        $seen[$low] = true;
        $lbl = trim((string) ($r['locale_label'] ?? ''));
        if ($lbl === '') {
            return '每种语言须填写显示名<br/><span class="en-text">Display name required for each locale</span>';
        }
    }

    foreach ($rows as $r) {
        $pk = isset($r['prev_locale_key']) ? trim((string) $r['prev_locale_key']) : '';
        $nk = trim((string) ($r['locale_key'] ?? ''));
        if ($pk === '') {
            continue;
        }
        $err = problem_locale_key_validate($pk);
        if ($err !== null) {
            return $err;
        }
        if ($pk === $nk) {
            continue;
        }
        $op = problem_locale_pdf_disk_path($problem_id, $pk);
        $np = problem_locale_pdf_disk_path($problem_id, $nk);
        if ($op !== null && $np !== null && is_file($op) && !is_file($np)) {
            if (!@rename($op, $np)) {
                return '重命名 PDF 文件失败';
            }
        }
        $exMd = db('problem_md')->where(['problem_id' => $problem_id, 'locale_key' => $pk])->find();
        if (is_array($exMd)) {
            db('problem_md')->where(['problem_id' => $problem_id, 'locale_key' => $pk])->update(['locale_key' => $nk]);
        }
        $exHtml = db('problem_locale_html')->where(['problem_id' => $problem_id, 'locale_key' => $pk])->find();
        if (is_array($exHtml)) {
            db('problem_locale_html')->where(['problem_id' => $problem_id, 'locale_key' => $pk])->update(['locale_key' => $nk]);
        }
        $exL = db('problem_locale')->where(['problem_id' => $problem_id, 'locale_key' => $pk])->find();
        if (is_array($exL)) {
            db('problem_locale')->where(['problem_id' => $problem_id, 'locale_key' => $pk])->update(['locale_key' => $nk]);
        }
    }

    $finalKeys = [];
    foreach ($rows as $r) {
        $finalKeys[] = trim((string) ($r['locale_key'] ?? ''));
    }
    $oldLoc = db('problem_locale')->where('problem_id', $problem_id)->select();
    if (!is_array($oldLoc)) {
        $oldLoc = [];
    }
    foreach ($oldLoc as $or) {
        $ok = (string) ($or['locale_key'] ?? '');
        if ($ok !== '' && !in_array($ok, $finalKeys, true)) {
            problem_locale_delete_pdf($problem_id, $ok);
            db('problem_md')->where(['problem_id' => $problem_id, 'locale_key' => $ok])->delete();
            db('problem_locale_html')->where(['problem_id' => $problem_id, 'locale_key' => $ok])->delete();
            db('problem_locale')->where(['problem_id' => $problem_id, 'locale_key' => $ok])->delete();
        }
    }

    foreach ($rows as $idx => $r) {
        $k = trim((string) ($r['locale_key'] ?? ''));
        $sortOrder = $idx + 1;
        $mdUpd = [
            'description' => (string) ($r['description'] ?? ''),
            'input'       => (string) ($r['input'] ?? ''),
            'output'      => (string) ($r['output'] ?? ''),
            'hint'        => (string) ($r['hint'] ?? ''),
            'source'      => $r['source'] ?? null,
            'author'      => $r['author'] ?? null,
        ];
        $locUpd = [
            'sort_order'     => $sortOrder,
            'locale_label'   => mb_substr(trim((string) ($r['locale_label'] ?? '')), 0, 128),
            'use_pdf'        => !empty($r['use_pdf']) ? 1 : 0,
            'locale_visible' => problem_locale_visible_from_post_row($r),
        ];
        $exM = db('problem_md')->where(['problem_id' => $problem_id, 'locale_key' => $k])->find();
        if (is_array($exM)) {
            db('problem_md')->where(['problem_id' => $problem_id, 'locale_key' => $k])->update($mdUpd);
        } else {
            db('problem_md')->insert(array_merge([
                'problem_id' => $problem_id,
                'locale_key' => $k,
            ], $mdUpd));
        }
        $exL = db('problem_locale')->where(['problem_id' => $problem_id, 'locale_key' => $k])->find();
        if (is_array($exL)) {
            db('problem_locale')->where(['problem_id' => $problem_id, 'locale_key' => $k])->update($locUpd);
        } else {
            db('problem_locale')->insert(array_merge([
                'problem_id' => $problem_id,
                'locale_key' => $k,
            ], $locUpd));
        }

        $htmlRow = problem_locale_md_row_to_html_row($mdUpd);
        problem_locale_html_upsert($problem_id, $k, $htmlRow);
    }

    return null;
}

/**
 * @param array<string,mixed> $r
 */
function problem_locale_visible_from_post_row(array $r): int
{
    if (array_key_exists('locale_visible', $r)) {
        $v = $r['locale_visible'];
        if (is_bool($v)) {
            return $v ? 1 : 0;
        }
        return intval($v) ? 1 : 0;
    }
    return 1;
}

function problem_locale_pdf_serve_allowed(int $problem_id, string $lang): ?string
{
    $stem = problem_locale_resolve_lang_to_pdf_stem($problem_id, $lang);
    if (!problem_locale_pdf_stem_valid($stem)) {
        return 'bad_lang';
    }
    $path = problem_locale_pdf_disk_path($problem_id, $stem);
    if ($path === null || !is_file($path)) {
        return 'missing';
    }
    $r = db('problem_locale')->where(['problem_id' => $problem_id, 'locale_key' => $stem])->find();
    if (!is_array($r) || empty($r['use_pdf']) || !problem_locale_row_visible_to_user($r)) {
        return 'off';
    }
    return null;
}

function problem_locale_pill_abbr(string $key, string $label): string
{
    $label = trim($label);
    if ($key === 'main') {
        return '主';
    }
    if ($label !== '') {
        if (function_exists('mb_substr')) {
            return mb_substr($label, 0, 1, 'UTF-8');
        }
        $c = substr($label, 0, 1);
        return $c !== '' ? $c : '?';
    }
    $tail = preg_replace('/^lang_/i', '', $key);
    if ($tail !== '' && $tail !== $key) {
        if (function_exists('mb_strlen') && function_exists('mb_substr')) {
            $len = mb_strlen($tail, 'UTF-8');
            if ($len <= 2) {
                return $tail;
            }
            return mb_substr($tail, -2, 2, 'UTF-8');
        }
        return strlen($tail) <= 2 ? $tail : substr($tail, -2);
    }
    if (function_exists('mb_substr')) {
        $one = mb_substr($key, 0, 1, 'UTF-8');
        return $one !== '' ? $one : '?';
    }
    $c = substr($key, 0, 1);
    return $c !== '' ? $c : '?';
}

/**
 * 组装做题端题面展示状态：语言条、PDF 链、当前语言下的题面 HTML 字段（**不**调用 ParseMarkdown / Pandoc）。
 * 题面 HTML 来自 `problem_locale_html`；若该行缺失且当前为首选语言，回退读 `problem` 主表（迁移过渡期）。
 *
 * @param array<string,mixed> $problem problem 表行（须含已物化的 description/input/output/hint/source/author）
 * @param array<string,mixed>|null $problem_md 已废弃；调用方传 **`null`**，保留形参仅为避免批量改签名。
 * @param array<string,mixed>|null $preload 可选；若提供则**不再**为本题查 `problem_locale` / `problem_locale_html`：
 *   - `loc_rows`：本题 `problem_locale` 行（与 DB `sort_order asc, locale_key asc` 一致）
 *   - `html_by_locale`：`locale_key` => `problem_locale_html` 行（缺键视为无物化）
 *   - `default_key`：可选；非空则作为首选语言键（须与 `contest2print` 等批量场景一致），否则回退 `problem_locale_default_key`
 * @param string|null $html_page_route_base 非空时，`available[].url_html` 使用该绝对路径前缀（如 `/cpcsys/contest/problem`）；默认 `null` 仍为相对 `problem?`（仅适用于 `contest/problem` 页）
 * @return array{problem:array,desc_display_mode:string,pdf_url:?string,available_locales:array<int,array<string,mixed>>,current_locale_key:string,show_lang_bar:bool}
 */
function problem_locale_view_state(
    array $problem,
    ?array $problem_md,
    string $lang,
    string $pdf_route_base,
    array $pdf_query = [],
    array $html_page_query = [],
    ?array $preload = null,
    ?string $html_page_route_base = null
): array {
    unset($problem_md);
    $pid = intval($problem['problem_id'] ?? 0);
    /** @var array<string,array<string,mixed>>|null $htmlByLocale null 表示按语言现查 `problem_locale_html` */
    $htmlByLocale = null;
    if ($preload !== null && is_array($preload)) {
        $lr = $preload['loc_rows'] ?? null;
        if (is_array($lr)) {
            $locRows = $lr;
        } else {
            $locRows = [];
        }
        $htmlByLocale = [];
        $htmlRaw = $preload['html_by_locale'] ?? [];
        if (is_array($htmlRaw)) {
            foreach ($htmlRaw as $hk => $hv) {
                if (is_array($hv)) {
                    $htmlByLocale[(string) $hk] = $hv;
                }
            }
        }
        $dkPre = trim((string) ($preload['default_key'] ?? ''));
        if ($dkPre !== '') {
            $defaultKey = $dkPre;
        } else {
            $defaultKey = 'main';
            foreach ($locRows as $lr0) {
                if (problem_locale_row_visible_to_user($lr0)) {
                    $defaultKey = (string) $lr0['locale_key'];
                    break;
                }
            }
            if ($defaultKey === 'main' && $pid > 0) {
                $defaultKey = problem_locale_default_key($pid);
            }
        }
    } else {
        $locRows = db('problem_locale')->where('problem_id', $pid)->order('sort_order asc, locale_key asc')->select();
        if (!is_array($locRows)) {
            $locRows = [];
        }
        $defaultKey = problem_locale_default_key($pid);
    }
    $langRaw = trim($lang);
    if ($langRaw === '' || strcasecmp($langRaw, 'main') === 0) {
        $langRaw = $defaultKey;
    }

    $available = [];
    foreach ($locRows as $lr) {
        if (!problem_locale_row_visible_to_user($lr)) {
            continue;
        }
        $k = (string) $lr['locale_key'];
        $rawLb = trim((string) ($lr['locale_label'] ?? ''));
        $selectLabel = $rawLb !== '' ? $rawLb : '（未填写显示名 / No label）';
        $pp = problem_locale_pdf_disk_path($pid, $k);
        $available[] = [
            'key'          => $k,
            'label'        => $selectLabel,
            'label_en'     => $selectLabel,
            'select_label' => $selectLabel,
            'use_pdf'      => !empty($lr['use_pdf']) ? 1 : 0,
            'has_pdf'      => $pp !== null && is_file($pp),
            'pill_abbr'    => problem_locale_pill_abbr($k, $rawLb),
        ];
    }

    // 旧库无 `problem_locale` 行：仍产出一条「逻辑首选」语言元数据，与已迁移题在 `available_locales` / `problem_ajax` 的 `problem_locales` 形状一致（单行且不触发语言条）。
    if ($available === [] && $pid > 0 && $locRows === []) {
        $dk = (string) $defaultKey;
        if ($dk === '') {
            $dk = 'main';
        }
        $selectLabel = '默认 / Default';
        $pp = problem_locale_pdf_disk_path($pid, $dk);
        $available[] = [
            'key'          => $dk,
            'label'        => $selectLabel,
            'label_en'     => $selectLabel,
            'select_label' => $selectLabel,
            'use_pdf'      => 0,
            'has_pdf'      => $pp !== null && is_file($pp),
            'pill_abbr'    => problem_locale_pill_abbr($dk, ''),
        ];
    }

    $pidParam = $pdf_query['pid'] ?? ($problem['problem_id'] ?? $pid);
    $basePath = strtok($pdf_route_base, '?');
    foreach ($available as &$a) {
        $q = array_merge($pdf_query, [
            'pid'  => $pidParam,
            'lang' => $a['key'],
        ]);
        $a['url_pdf'] = $basePath . '?' . http_build_query($q);
    }
    unset($a);

    if (!empty($html_page_query)) {
        $htmlQPrefix = 'problem?';
        if ($html_page_route_base !== null && trim($html_page_route_base) !== '') {
            $htmlQPrefix = rtrim($html_page_route_base, '/') . '?';
        }
        foreach ($available as &$a) {
            $a['url_html'] = $htmlQPrefix . http_build_query(array_merge($html_page_query, ['lang' => $a['key']]));
        }
        unset($a);
    }

    $showLangBar = count($available) > 1;

    $outProblem = $problem;
    $descMode = 'text';
    $pdfUrl = null;
    $currentLocaleKey = $defaultKey;

    $row = null;
    foreach ($locRows as $lr) {
        if (strcasecmp((string) $lr['locale_key'], $langRaw) === 0) {
            $row = $lr;
            break;
        }
    }
    if ($row === null || !problem_locale_row_visible_to_user($row)) {
        $row = null;
        foreach ($locRows as $lr) {
            if (strcasecmp((string) $lr['locale_key'], $defaultKey) === 0) {
                $row = $lr;
                break;
            }
        }
        $langRaw = $defaultKey;
    }
    if ($row !== null) {
        $currentLocaleKey = (string) $row['locale_key'];
        $ek = $currentLocaleKey;
        if ($htmlByLocale !== null) {
            $html = $htmlByLocale[$ek] ?? [];
            $html = is_array($html) ? $html : [];
        } else {
            $html = db('problem_locale_html')->where(['problem_id' => $pid, 'locale_key' => $ek])->find();
            $html = is_array($html) ? $html : [];
        }
        $up = !empty($row['use_pdf']) ? 1 : 0;
        $lp = problem_locale_pdf_disk_path($pid, $ek);
        $hasP = $lp !== null && is_file($lp);
        if ($up && $hasP) {
            $descMode = 'pdf';
            foreach ($available as $av) {
                if ($av['key'] === $ek) {
                    $pdfUrl = $av['url_pdf'];
                    break;
                }
            }
        } else {
            // 只读 problem_locale_html；缺行且为首选语言时回退 problem 主表（旧库迁移前可能仅有主表 HTML）。
            if (is_array($html) && array_key_exists('problem_id', $html)) {
                $outProblem['description'] = (string) ($html['description'] ?? '');
                $outProblem['input'] = (string) ($html['input'] ?? '');
                $outProblem['output'] = (string) ($html['output'] ?? '');
                $outProblem['hint'] = (string) ($html['hint'] ?? '');
                $outProblem['source'] = (string) ($html['source'] ?? '');
                $outProblem['author'] = (string) ($html['author'] ?? '');
            } elseif (strcasecmp($ek, $defaultKey) === 0) {
                $outProblem['description'] = (string) ($problem['description'] ?? '');
                $outProblem['input'] = (string) ($problem['input'] ?? '');
                $outProblem['output'] = (string) ($problem['output'] ?? '');
                $outProblem['hint'] = (string) ($problem['hint'] ?? '');
                $outProblem['source'] = (string) ($problem['source'] ?? '');
                $outProblem['author'] = (string) ($problem['author'] ?? '');
            } else {
                $outProblem['description'] = '';
                $outProblem['input'] = '';
                $outProblem['output'] = '';
                $outProblem['hint'] = '';
                $outProblem['source'] = '';
                $outProblem['author'] = '';
            }
        }
    }

    return [
        'problem'            => $outProblem,
        'desc_display_mode'  => $descMode,
        'pdf_url'            => $pdfUrl,
        'available_locales'  => $available,
        'current_locale_key' => $currentLocaleKey,
        'show_lang_bar'      => $showLangBar,
    ];
}

/**
 * 组装 `problem_ajax` 等 JSON 接口：在 `problem` 主表行上叠加请求语言下的物化题面字段，并附上当前用户可见的语言列表。
 * 语言解析与 `problem_locale_view_state` 一致（空或 main → 首选；不可见或不存在 → 回退首选可见行）。
 *
 * @param array<string,mixed> $problem `problem` 表行
 * @param string              $lang    GET `lang`（可为空）
 * @param string              $pdf_route_base 如 `/csgoj/problemset/problem_pdf`
 * @param array<string,mixed> $pdf_query      须含展示页用的 `pid` 等，与做题页 `problem_pdf` 一致
 * @return array<string,mixed> 主表字段 + `problem_locales`（`locale_key` / `locale_label`）+ `current_locale_key` + `desc_display_mode` + `problem_pdf_embed_url`
 */
function problem_locale_ajax_enriched_problem(array $problem, string $lang, string $pdf_route_base, array $pdf_query = []): array
{
    $vs = problem_locale_view_state($problem, null, $lang, $pdf_route_base, $pdf_query, $pdf_query);
    $locales = [];
    foreach ($vs['available_locales'] as $a) {
        $locales[] = [
            'locale_key'   => (string) ($a['key'] ?? ''),
            'locale_label' => (string) ($a['select_label'] ?? $a['label'] ?? ''),
        ];
    }
    $out = $vs['problem'];
    $out['problem_locales']       = $locales;
    $out['current_locale_key']    = (string) $vs['current_locale_key'];
    $out['desc_display_mode']     = (string) $vs['desc_display_mode'];
    $out['problem_pdf_embed_url'] = $vs['pdf_url'];
    return $out;
}

/**
 * 练习集模块下「题面 PDF」路由与查询串：`/{module}/problemset/problem_pdf?pid=`
 *（与 `Problemset::problem` / `problem_ajax` 一致；module 来自当前请求）。
 *
 * @return array{route_base:string,query:array<string,int>}
 */
function problem_locale_problemset_pdf_context(string $moduleLower, int $problemId): array
{
    $m = trim(strtolower($moduleLower));
    if ($m === '') {
        $m = 'csgoj';
    }
    return [
        'route_base' => '/' . $m . '/problemset/problem_pdf',
        'query'      => ['pid' => $problemId],
    ];
}

/**
 * 考试端 `Exam::problem_ajax` 拉取的 OJ 题面 PDF 与做题站同源（外链与 `question_edit` 等一致）。
 */
function problem_locale_exam_oj_problem_pdf_base(): string
{
    return '/csgoj/problemset/problem_pdf';
}
