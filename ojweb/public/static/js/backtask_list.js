/**
 * 后台任务列表：结果列规范化与渲染。
 *
 * DB 字段 backtask.result 为 JSON 字符串。业务字段照旧；可选 bt_display。
 *
 * bt_display：
 *   kind: "download" | "error" | "import_summary" | "noop"
 *   lines?: [{ cn, en }]   // 多条会在展示时合并为一行双语（中文段 · 中文段 / 英文同理），避免多行堆叠
 *
 * 展示规则：结果列一律左对齐；每条记录通常仅一行——「中文主文案 + 同行小号英文（en-text）」。
 */
(function (global) {
    'use strict';

    var ERROR_I18N = {
        'empty problem_ids': { cn: '题目 ID 为空', en: 'Empty problem_ids' },
        'no problems found': { cn: '未找到题目', en: 'No problems found' },
        'invalid contest_id': { cn: '比赛 ID 无效', en: 'Invalid contest_id' },
        'contest not found': { cn: '比赛不存在', en: 'Contest not found' },
        'contest type not exportable': { cn: '该比赛类型不可导出', en: 'Contest type not exportable' },
        'no problems in contest': { cn: '比赛中无题目', en: 'No problems in contest' },
        'import file not found': { cn: '导入文件不存在', en: 'Import file not found' },
        'missing import_temp_base': { cn: '缺少临时目录配置', en: 'Missing import_temp_base' },
        'missing testdata_dir or public_attach_root': { cn: '缺少路径配置', en: 'Missing path params' },
        'missing path params': { cn: '缺少路径参数', en: 'Missing path params' },
        'not a valid zip file': { cn: '不是有效的 ZIP', en: 'Not a valid ZIP file' },
    };

    function _linesFromError(msg) {
        msg = String(msg || '');
        var m = ERROR_I18N[msg];
        if (m) return [m];
        return [{ cn: msg, en: msg }];
    }

    function _safeInt(x) {
        var n = parseInt(x, 10);
        return isNaN(n) ? 0 : n;
    }

    /**
     * 题目导入 result：newCount/boundCount 优先；旧任务无字段时从 addedList 推断（:bind: 为合并至已有题）。
     */
    function _deriveProblemImportCounts(r) {
        var list = r.addedList || [];
        var total = list.length;
        var boundFromList = 0;
        var i;
        for (i = 0; i < list.length; i++) {
            if (String(list[i]).indexOf(':bind:') >= 0) {
                boundFromList++;
            }
        }
        var hasServer =
            typeof r.newCount === 'number' &&
            typeof r.boundCount === 'number' &&
            !isNaN(r.newCount) &&
            !isNaN(r.boundCount);
        if (hasServer) {
            return { newC: _safeInt(r.newCount), boundC: _safeInt(r.boundCount), total: total };
        }
        return { newC: total - boundFromList, boundC: boundFromList, total: total };
    }

    function _titleNewProblems(n) {
        return '新增 ' + n + ' 题 · New: ' + n + (n === 1 ? ' problem' : ' problems');
    }

    function _titleMergedProblems(n) {
        return (
            '与题库已有题目合并 ' +
            n +
            ' 题（未再建新题） · Merged with ' +
            n +
            ' existing problem' +
            (n === 1 ? '' : 's') +
            ' (no new problem created)'
        );
    }

    /**
     * 题目导入失败/告警条目的悬浮说明（title 单行双语）。
     * partial：已有题目成功写入，但仍存在需处理的项（如附件、数据等）。
     */
    function _titleImportIssues(n, partial) {
        if (n <= 0) {
            return '';
        }
        if (partial) {
            return (
                '题目已导入，另有 ' +
                    n +
                    ' 项未完全就绪，请在任务详情中查看 · ' +
                    'Imported with ' +
                    n +
                    ' unfinished step(s) — see task details'
            );
        }
        return (
            '有 ' +
                n +
                ' 题未能完成导入，请在任务详情中查看 · ' +
                n +
                ' problem(s) failed to import — see task details'
        );
    }

    /** 返回 HTML 片段（无外层包裹） */
    function _buildProblemImportStatSpans(newC, boundC) {
        var parts = [];
        if (newC > 0) {
            parts.push(
                '<span class="bt-import-stat text-success" title="' +
                    DomSantize(_titleNewProblems(newC)) +
                    '"><i class="bi bi-plus-lg bt-import-stat-ico" aria-hidden="true"></i>' +
                    '<span class="bt-import-stat-num">' +
                    DomSantize(String(newC)) +
                    '</span></span>'
            );
        }
        if (boundC > 0) {
            parts.push(
                '<span class="bt-import-stat text-primary" title="' +
                    DomSantize(_titleMergedProblems(boundC)) +
                    '"><i class="bi bi-link-45deg bt-import-stat-ico" aria-hidden="true"></i>' +
                    '<span class="bt-import-stat-num">' +
                    DomSantize(String(boundC)) +
                    '</span></span>'
            );
        }
        return parts.join('');
    }

    /**
     * 将多段 {cn,en} 压成单行双语（段间用 · 分隔）
     */
    function _mergeLineObjects(lines) {
        if (!lines || !lines.length) return { cn: '', en: '' };
        var cnParts = [];
        var enParts = [];
        for (var i = 0; i < lines.length; i++) {
            var lc = (lines[i].cn != null ? String(lines[i].cn) : '').trim();
            var le = (lines[i].en != null ? String(lines[i].en) : '').trim();
            if (lc) cnParts.push(lc);
            if (le) enParts.push(le);
        }
        return {
            cn: cnParts.join(' · '),
            en: enParts.join(' · '),
        };
    }

    /** 单行双语：中文加粗 + 同行小号英文 */
    function _renderCompactBilingual(cn, en) {
        cn = String(cn || '');
        en = String(en || '');
        if (!cn && !en) return '';
        if (!en || en === cn) {
            return '<span class="bt-res-compact"><span class="bt-res-compact-cn">' +
                DomSantize(cn || en) + '</span></span>';
        }
        return '<span class="bt-res-compact">' +
            '<span class="bt-res-compact-cn">' + DomSantize(cn) + '</span>' +
            '<span class="bt-res-compact-en en-text">' + DomSantize(en) + '</span>' +
            '</span>';
    }

    /**
     * @param {string} taskType
     * @param {object} r parsed JSON
     * @returns {{ kind: string, lines?: Array, added?: number, failed?: number, filename?: string, download?: string }}
     */
    function normalizeBacktaskResult(taskType, r) {
        if (!r || typeof r !== 'object') return { kind: 'noop' };

        var disp = r.bt_display;
        if (disp && typeof disp === 'object' && disp.kind) {
            var out = {
                kind: String(disp.kind),
                lines: Array.isArray(disp.lines) ? disp.lines : undefined,
                added: typeof disp.added === 'number' ? disp.added : undefined,
                failed: typeof disp.failed === 'number' ? disp.failed : undefined,
            };
            if (r.filename) out.filename = r.filename;
            if (out.kind === 'error' && (!out.lines || !out.lines.length) && r.error) {
                out.lines = _linesFromError(r.error);
            }
            return out;
        }

        if (r.error) {
            return { kind: 'error', lines: _linesFromError(r.error) };
        }

        if (taskType === 'problem_export' && r.filename) {
            var c = _safeInt(r.count);
            return {
                kind: 'download',
                filename: r.filename,
                lines: [
                    { cn: '题目包', en: 'Package' },
                    { cn: c + ' 题', en: (c === 1 ? '1' : String(c)) },
                ],
            };
        }

        if (taskType === 'contest_export' && r.filename) {
            return {
                kind: 'download',
                filename: r.filename,
                lines: [
                    { cn: '比赛包', en: 'Contest' },
                    { cn: 'ZIP', en: 'ZIP' },
                ],
            };
        }

        if (taskType === 'problem_import') {
            var ok = (r.addedList && r.addedList.length) ? r.addedList.length : 0;
            var bad = (r.failedList && r.failedList.length) ? r.failedList.length : 0;
            if (ok > 0 || bad > 0 || (typeof r.extracted_count === 'number' && r.extracted_count >= 0)) {
                var pic = _deriveProblemImportCounts(r);
                return {
                    kind: 'import_summary',
                    added: ok,
                    failed: bad,
                    newCount: pic.newC,
                    boundCount: pic.boundC,
                };
            }
        }

        if (taskType === 'contest_import') {
            if (
                (r.new_contest_id !== undefined && r.new_contest_id !== null) ||
                r.problemsImported != null
            ) {
                var outCi = {
                    kind: 'import_summary',
                    contestImport: true,
                    newContestId: r.new_contest_id,
                    problemsImported: _safeInt(r.problemsImported),
                    solutionsImported: _safeInt(r.solutionsImported),
                };
                if (r.problemsNewCount !== undefined && r.problemsNewCount !== null) {
                    outCi.problemsNewCount = _safeInt(r.problemsNewCount);
                }
                if (r.problemsBoundCount !== undefined && r.problemsBoundCount !== null) {
                    outCi.problemsBoundCount = _safeInt(r.problemsBoundCount);
                }
                return outCi;
            }
        }

        return { kind: 'noop' };
    }

    function buildDownloadUrl(module, taskType, filename) {
        if (taskType === 'problem_export') {
            return '/' + module + '/problemexport/downloaddata?item=problemexport&filename=' + encodeURIComponent(filename);
        }
        if (taskType === 'contest_export') {
            return '/' + module + '/contest/contest_pkg_downloaddata?filename=' + encodeURIComponent(filename);
        }
        return '';
    }

    function renderBacktaskResultHtml(taskType, resultJson, row, module) {
        if (!resultJson) {
            if (parseInt(row.status, 10) < 20) return '<span class="text-muted">-</span>';
            return '';
        }
        var r;
        try {
            r = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
        } catch (e) {
            return '<span class="text-muted">-</span>';
        }

        var norm = normalizeBacktaskResult(taskType, r);

        if (norm.kind === 'download' && norm.filename) {
            var url = buildDownloadUrl(module, taskType, norm.filename);
            if (!url) return '';
            var lines = norm.lines || [{ cn: '下载', en: 'Download' }];
            var merged = _mergeLineObjects(lines);
            if (!merged.cn) merged = { cn: '下载', en: 'Download' };
            var label = _renderCompactBilingual(merged.cn, merged.en);
            return '<a href="' + url + '" class="bt-res-download btn btn-sm btn-outline-success" title="下载 Download">' +
                '<i class="bi bi-download bt-res-download-ico" aria-hidden="true"></i>' +
                '<span class="bt-res-download-text">' + label + '</span></a>';
        }

        if (norm.kind === 'error' && norm.lines && norm.lines.length) {
            var em = _mergeLineObjects(norm.lines);
            var errLabel = _renderCompactBilingual(em.cn, em.en);
            return '<span class="bt-res-error" title="' + DomSantize((r.error || em.cn || '')) + '">' +
                '<i class="bi bi-exclamation-triangle bt-res-error-ico" aria-hidden="true"></i>' +
                '<span class="bt-res-error-text">' + errLabel + '</span></span>';
        }

        if (norm.kind === 'import_summary') {
            if (norm.contestImport) {
                var pid2 = norm.problemsImported;
                var sid2 = norm.solutionsImported;
                var cid2 = norm.newContestId != null ? norm.newContestId : '?';
                var pnC = norm.problemsNewCount;
                var pbC = norm.problemsBoundCount;
                var hasBreakdown =
                    pnC !== undefined &&
                    pnC !== null &&
                    pbC !== undefined &&
                    pbC !== null;
                var innerContest2;
                if (hasBreakdown) {
                    var pNew2 = _safeInt(pnC);
                    var pBound2 = _safeInt(pbC);
                    var statC = _buildProblemImportStatSpans(pNew2, pBound2);
                    innerContest2 =
                        '<span class="bt-res-compact">' +
                        '<span class="bt-res-compact-cn d-inline-flex align-items-center flex-wrap gap-1">' +
                        '#' +
                        DomSantize(String(cid2)) +
                        ' · ' +
                        (statC || '<span>' + DomSantize(String(pid2)) + '题</span>') +
                        ' · ' +
                        DomSantize(String(sid2)) +
                        '交</span>' +
                        '<span class="bt-res-compact-en en-text">' +
                        '#' +
                        DomSantize(String(cid2)) +
                        ', ' +
                        DomSantize(String(pNew2)) +
                        ' new, ' +
                        DomSantize(String(pBound2)) +
                        ' merged, ' +
                        DomSantize(String(sid2)) +
                        ' sol.</span></span>';
                } else {
                    innerContest2 =
                        '<span class="bt-res-compact">' +
                        _renderCompactBilingual(
                            '#' + cid2 + ' · ' + pid2 + '题 · ' + sid2 + '交',
                            '#' + cid2 + ', ' + pid2 + 'p, ' + sid2 + ' sol.'
                        ) +
                        '</span>';
                }
                return (
                    '<span class="bt-res-ok">' +
                    '<i class="bi bi-check-circle bt-res-ok-ico" aria-hidden="true"></i>' +
                    '<span class="bt-res-ok-text">' +
                    innerContest2 +
                    '</span></span>'
                );
            }
            var okn = typeof norm.added === 'number' ? norm.added : 0;
            var badn = typeof norm.failed === 'number' ? norm.failed : 0;
            var newC = typeof norm.newCount === 'number' ? norm.newCount : 0;
            var boundC = typeof norm.boundCount === 'number' ? norm.boundCount : 0;
            var stats = _buildProblemImportStatSpans(newC, boundC);
            var failHtml = '';
            if (badn > 0) {
                var partialOk = okn > 0;
                failHtml =
                    '<span class="bt-import-stat text-danger" title="' +
                    DomSantize(_titleImportIssues(badn, partialOk)) +
                    '"><i class="bi bi-exclamation-circle bt-import-stat-ico" aria-hidden="true"></i>' +
                    '<span class="bt-import-stat-num">' +
                    DomSantize(String(badn)) +
                    '</span></span>';
            }
            if (stats || failHtml) {
                var sep =
                    stats && failHtml
                        ? '<span class="bt-import-sep" aria-hidden="true"></span>'
                        : '';
                return (
                    '<span class="bt-res-ok bt-res-ok--import">' +
                    '<i class="bi bi-check-circle bt-res-ok-ico" aria-hidden="true"></i>' +
                    '<span class="bt-res-ok-text">' +
                    '<span class="bt-import-metrics">' +
                    stats +
                    sep +
                    failHtml +
                    '</span></span></span>'
                );
            }
            var cnI = '+' + okn + (badn ? '，失败 ' + badn : '');
            var enI = '+' + okn + (badn ? ', ' + badn + ' failed' : '');
            return (
                '<span class="bt-res-ok">' +
                '<i class="bi bi-check-circle bt-res-ok-ico" aria-hidden="true"></i>' +
                '<span class="bt-res-ok-text">' +
                _renderCompactBilingual(cnI, enI) +
                '</span></span>'
            );
        }

        return '';
    }

    global.CsgBacktaskList = global.CsgBacktaskList || {};
    global.CsgBacktaskList.normalizeBacktaskResult = normalizeBacktaskResult;
    global.CsgBacktaskList.renderBacktaskResultHtml = renderBacktaskResultHtml;
})(typeof window !== 'undefined' ? window : this);
