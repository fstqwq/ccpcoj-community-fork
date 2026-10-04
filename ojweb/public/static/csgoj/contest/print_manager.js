/**
 * print_code_show_ajax 对 source 做了 htmlentities；renderCode 需纯文本，故先解码。
 */
function decodeHtmlEntitiesForPrintCode(str) {
    if (str == null || str === '') {
        return '';
    }
    var ta = document.createElement('textarea');
    ta.innerHTML = String(str);
    return ta.value;
}

function escapeHtmlForPrintModal(s) {
    if (s == null || s === '') {
        return '';
    }
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function composePrintCodeFullText(data) {
    var auth = data.auth != null ? String(data.auth) : '';
    var sourceText = decodeHtmlEntitiesForPrintCode(data.source != null ? String(data.source) : '');
    return auth + sourceText;
}

function setPrintModalEllipsisLine(elId, value, titleBilingualIntro) {
    var el = document.getElementById(elId);
    if (!el) {
        return;
    }
    var raw = value != null && String(value).trim() !== '' ? String(value).trim() : '—';
    el.textContent = raw;
    var tip = titleBilingualIntro + (raw === '—' ? '' : ('\n' + raw));
    if (typeof DomSantize === 'function') {
        el.setAttribute('title', DomSantize(tip));
    } else {
        el.setAttribute('title', tip);
    }
}

function setPrintMetaDdText(id, value) {
    var el = document.getElementById(id);
    if (!el) {
        return;
    }
    el.textContent = value != null && String(value).trim() !== '' ? String(value).trim() : '—';
}

function fillPrintCodeViewerMeta(row) {
    row = row || {};
    var dt =
        typeof CsgFormatNaiveAppTimeForLocalDisplay === 'function'
            ? CsgFormatNaiveAppTimeForLocalDisplay(row.in_date, { withTzLabel: true })
            : { date: '-', time: '-', line: '-', tzLabel: '', ok: false };
    var tzBadgeHtml =
        dt.tzLabel && typeof CsgTzLabelBadgeHtml === 'function'
            ? CsgTzLabelBadgeHtml(dt.tzLabel, { inline: true })
            : '';
    var teamId = row.team_id != null ? String(row.team_id) : '-';
    var printId = row.print_id != null ? String(row.print_id) : '-';

    var dLine = document.getElementById('print_meta_in_date_line_compact');
    var tLine = document.getElementById('print_meta_in_time_line_compact');
    if (dLine) {
        dLine.textContent = dt.date;
    }
    if (tLine) {
        tLine.textContent = dt.time;
    }
    var tzCompact = document.getElementById('print_meta_in_tz_inline_compact');
    if (tzCompact) {
        tzCompact.innerHTML = tzBadgeHtml;
    }
    var dateDd = document.getElementById('print_meta_date_dd');
    var timeDd = document.getElementById('print_meta_time_dd');
    if (dateDd) {
        dateDd.textContent = dt.date;
    }
    if (timeDd) {
        timeDd.textContent = dt.time;
    }
    var tzDd = document.getElementById('print_meta_in_tz_inline_dd');
    if (tzDd) {
        tzDd.innerHTML = tzBadgeHtml;
    }

    var n = row.code_length;
    var lenInner = n != null && n !== ''
        ? ('<span>' + escapeHtmlForPrintModal(String(n)) + ' 字符</span><span class="en-text">' + escapeHtmlForPrintModal(String(n)) + ' chars</span>')
        : ('<span>—</span><span class="en-text">—</span>');
    var lc = document.getElementById('print_meta_code_len_compact');
    var ld = document.getElementById('print_meta_code_len_dd');
    if (lc) {
        lc.innerHTML = lenInner;
    }
    if (ld) {
        ld.innerHTML = lenInner;
    }

    var teamHead = document.getElementById('print_meta_team_id_header');
    if (teamHead) {
        teamHead.textContent = teamId;
        var tidTip = '队伍ID\nTeam ID';
        if (teamId !== '-') {
            tidTip += '\n' + teamId;
        }
        teamHead.setAttribute('title', typeof DomSantize === 'function' ? DomSantize(tidTip) : tidTip);
    }
    setPrintModalEllipsisLine('print_meta_team_name_line', row.name, '队名\nTeam name');
    setPrintModalEllipsisLine('print_meta_member_line', row.tmember, '选手\nMembers');
    setPrintModalEllipsisLine('print_meta_coach_line', row.coach, '教练\nCoach');

    setPrintMetaDdText('print_meta_team_name_dd', row.name);
    setPrintMetaDdText('print_meta_member_dd', row.tmember);
    setPrintMetaDdText('print_meta_coach_dd', row.coach);
    setPrintMetaDdText('print_meta_room_dd', row.room);
    setPrintMetaDdText('print_meta_team_id_dd', teamId);
    setPrintMetaDdText('print_meta_print_id_dd', printId);
}

function gatherCodeFromPrintCodeViewer() {
    var container = document.getElementById('print_code_viewer_content');
    if (!container) {
        return '';
    }
    var codes = container.querySelectorAll('code');
    if (!codes || codes.length === 0) {
        return '';
    }
    var lines = [];
    for (var i = 0; i < codes.length; i++) {
        lines.push(codes[i].textContent || '');
    }
    return lines.join('\n');
}

function fallbackPrintCodeAlertyModal(data) {
    var fullCode = composePrintCodeFullText(data);
    var html;
    if (typeof renderCode === 'function') {
        var nodes = renderCode(fullCode, {
            enableHighlight: true,
            enableLineNumber: true,
            language: data.lang || null
        });
        html = nodes[0].outerHTML;
    } else {
        var showcodePre = document.createElement('pre');
        var codeEl = document.createElement('code');
        codeEl.textContent = fullCode;
        showcodePre.appendChild(codeEl);
        if (typeof hljs !== 'undefined' && hljs.highlightElement) {
            hljs.highlightElement(codeEl);
        }
        html = showcodePre.outerHTML;
    }
    alerty.modal({
        title: '打印请求代码<span class="en-text">Print Request Code</span>',
        message: html,
        okText: '确定',
        width: 'xl',
        allowBackdropClose: true
    });
}

/**
 * 与 contest/status 代码查看器一致：Bootstrap modal-xl + 窗口滚动 + header position:sticky（见 code_show.css）
 */
function openPrintCodePreviewModal(data, row) {
    var modalEl = document.getElementById('print_code_show_modal');
    if (!modalEl || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
        fallbackPrintCodeAlertyModal(data);
        return;
    }
    print_code_modal_last_row = row || null;

    var fullCode = composePrintCodeFullText(data);

    var titleEl = document.getElementById('print_code_show_modal_title');
    if (titleEl) {
        var pid = escapeHtmlForPrintModal(row && row.print_id);
        titleEl.innerHTML = '打印请求 <span class="text-primary fw-bold">#' + pid + '</span><span class="en-text">Print Request <span class="text-primary fw-bold">#' + pid + '</span></span>';
    }

    fillPrintCodeViewerMeta(row);
    syncPrintCodeModalActionButtons(row);

    var contentRoot = document.getElementById('print_code_viewer_content');
    if (contentRoot) {
        contentRoot.innerHTML = '';
        if (typeof renderCode === 'function') {
            var nodes = renderCode(fullCode, {
                enableHighlight: true,
                enableLineNumber: true,
                language: data.lang ? String(data.lang) : null
            });
            contentRoot.appendChild(nodes[0]);
        } else {
            var pre = document.createElement('pre');
            var codeEl = document.createElement('code');
            codeEl.textContent = fullCode;
            pre.appendChild(codeEl);
            contentRoot.appendChild(pre);
            if (typeof hljs !== 'undefined' && hljs.highlightElement) {
                hljs.highlightElement(codeEl);
            }
        }
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

async function onPrintCodeCopyBtnClick() {
    var text = gatherCodeFromPrintCodeViewer();
    if (!text || !String(text).trim()) {
        return;
    }
    var ok = typeof ClipboardWrite === 'function' ? await ClipboardWrite(text) : false;
    var copyBtn = document.getElementById('print_code_copy_btn');
    if (ok && copyBtn) {
        var orig = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="bi bi-check"></i>';
        copyBtn.classList.add('btn-copied');
        setTimeout(function () {
            copyBtn.innerHTML = orig;
            copyBtn.classList.remove('btn-copied');
        }, 500);
    } else if (!ok) {
        alerty.error('复制失败，请手动选择代码复制', 'Copy failed, please manually select and copy the code');
    }
}

function onPrintCodeDownloadBtnClick() {
    var text = gatherCodeFromPrintCodeViewer();
    if (!text || !String(text).trim()) {
        return;
    }
    var row = print_code_modal_last_row || {};
    var pid = row.print_id != null ? String(row.print_id) : 'unknown';
    var tid = row.team_id != null ? String(row.team_id).replace(/[^\w\-]+/g, '_') : 'team';
    var now = new Date();
    var stamp = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
    var filename = 'print_' + pid + '_' + tid + '_' + stamp + '.txt';
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** 打印控件（Lodop + 页面脚本）是否已可调用 */
function isPrintSystemReady() {
    return typeof PrintCode === 'function' && typeof LODOP !== 'undefined' && !!LODOP;
}

function printStatusLodopCfg() {
    return window.PRINT_STATUS_CONFIG || {};
}

function isLodopManualEligiblePath() {
    var c = printStatusLodopCfg();
    return (
        c.lodop_manual_eligible === true ||
        c.lodop_manual_eligible === 1 ||
        String(c.lodop_manual_eligible).toLowerCase() === 'true'
    );
}

var PRINT_UI_TITLE_PRINT_OK = '打印本请求\nPrint this request';
var PRINT_UI_TITLE_PRINT_BLOCKED =
    '打印环境未就绪。请按页面顶部说明完成安装或设置后刷新本页，再试。\nPrint environment is not ready. Follow the instructions at the top, then refresh and try again.';
var PRINT_UI_TITLE_MANUAL_NEED_LOAD =
    '请先点击工具栏中的打印环境按钮，完成加载后再试。\nClick the print-environment button in the toolbar and wait for it to finish, then try again.';
var PRINT_UI_TITLE_TABLE_PRINT_OK = '双击打印代码\nDouble-click to print';

/** 赛管/系统管理员：按需点工具栏图标后再加载打印模块（与专职 printer 整页加载区分） */
function isLodopManualNeedToolbarLoad() {
    return isLodopManualEligiblePath() && !window.__csgLodopScriptsInjected;
}

function getPrintBlockedTitleForCurrentLodopState() {
    if (isLodopManualNeedToolbarLoad()) {
        return PRINT_UI_TITLE_MANUAL_NEED_LOAD;
    }
    return PRINT_UI_TITLE_PRINT_BLOCKED;
}

/** 禁用按钮不触发悬停：提示文案绑在 host 上，与 global.js / Bootstrap Tooltip 配合 */
function csgApplyPrintTooltipHost(hostEl, targetBtn, titleText) {
    var t = titleText != null ? String(titleText) : '';
    if (targetBtn && targetBtn.removeAttribute) {
        targetBtn.removeAttribute('title');
    }
    if (hostEl && typeof CsgSetTitleAndTooltip === 'function') {
        CsgSetTitleAndTooltip(hostEl, t);
    } else if (hostEl) {
        hostEl.setAttribute('title', t);
    } else if (targetBtn) {
        targetBtn.setAttribute('title', t);
    }
}

function getPrintNotReadyAlertyPayload() {
    if (isLodopManualNeedToolbarLoad()) {
        return {
            message: '请先点击工具栏中的打印环境按钮，完成加载后再试。',
            message_en: 'Click the print-environment button in the toolbar and wait for it to finish, then try again.'
        };
    }
    return {
        message: '打印环境尚未就绪。请按页面顶部说明完成安装或设置后刷新本页，再试。',
        message_en: 'Print environment is not ready. Follow the instructions at the top, then refresh and try again.'
    };
}

function installLodopObjectDomIfMissing() {
    if (document.getElementById('LODOP_OB')) {
        return;
    }
    var wrap = document.getElementById('lodop_manual_host');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'lodop_manual_host';
        wrap.setAttribute('aria-hidden', 'true');
        document.body.appendChild(wrap);
    }
    wrap.innerHTML =
        '<object id="LODOP_OB" classid="clsid:2105C259-1E0C-4534-8141-A753534CB4CA" width="0" height="0">' +
        '<embed id="LODOP_EM" type="application/x-print-lodop" width="0" height="0"></embed></object>';
}

function setPrintLodopLoadBtnTitle(btn, titleText) {
    if (!btn || titleText == null) {
        return;
    }
    var t = String(titleText);
    var host = document.getElementById('print_lodop_load_btn_tooltip_host');
    btn.removeAttribute('title');
    btn.setAttribute('aria-label', t.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim());
    csgApplyPrintTooltipHost(host, btn, t);
}

function appendScriptOnce(src, attrName, onload, onerror) {
    var existing = document.querySelector('script[' + attrName + ']');
    if (existing) {
        if (typeof onload === 'function') {
            onload();
        }
        return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.setAttribute(attrName, '1');
    s.onload = function() {
        if (typeof onload === 'function') {
            onload();
        }
    };
    s.onerror = function() {
        if (typeof onerror === 'function') {
            onerror();
        }
    };
    document.head.appendChild(s);
}

function finalizeManualLodopButton(btn, ok) {
    if (!btn) {
        return;
    }
    btn.removeAttribute('disabled');
    if (ok) {
        btn.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i>';
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-outline-success');
        setPrintLodopLoadBtnTitle(btn, '打印环境已就绪，可正常打印。\nPrint environment is ready.');
        btn.setAttribute('disabled', 'disabled');
    } else {
        btn.innerHTML = '<i class="bi bi-plugin" aria-hidden="true"></i>';
        btn.classList.remove('btn-outline-success');
        btn.classList.add('btn-outline-primary');
        setPrintLodopLoadBtnTitle(
            btn,
            '加载打印环境并检测是否可打印\nLoad print environment and check if printing is available'
        );
    }
}

function runManualLodopReadyPoll(btn) {
    var tries = 0;
    var maxTries = 50;
    var iv = setInterval(function() {
        tries += 1;
        syncTableDoPrintLodopState();
        if (isPrintSystemReady() || tries >= maxTries) {
            clearInterval(iv);
            var ok = isPrintSystemReady();
            finalizeManualLodopButton(btn, ok);
            if (!ok) {
                alerty.error({
                    message: '打印环境未就绪。请按页顶说明完成安装或设置后，再次点击工具栏中的打印环境按钮。',
                    message_en:
                        'Print environment is not ready. Follow the instructions at the top, then click the print-environment button in the toolbar again.'
                });
            } else {
                alerty.success({
                    message: '打印环境已就绪，可以打印。',
                    message_en: 'Print environment is ready. You can print now.'
                });
            }
        }
    }, 300);
}

function initPrintLodopManualLoadButton() {
    var btn = document.getElementById('print_lodop_load_btn');
    if (!btn || btn.getAttribute('data-csg-lodop-init')) {
        return;
    }
    btn.setAttribute('data-csg-lodop-init', '1');
    btn.addEventListener('click', function() {
        var cfg = printStatusLodopCfg();
        var funcsUrl = cfg.lodop_funcs_js_url;
        var ctrlUrl = cfg.lodop_print_control_js_url;
        if (!funcsUrl || !ctrlUrl) {
            alerty.error({
                message: '页面状态异常，请刷新后重试。',
                message_en: 'Something went wrong with this page. Please refresh and try again.'
            });
            return;
        }
        btn.setAttribute('disabled', 'disabled');
        btn.innerHTML =
            '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        setPrintLodopLoadBtnTitle(btn, '正在加载打印环境…\nLoading print environment…');
        installLodopObjectDomIfMissing();
        appendScriptOnce(
            funcsUrl,
            'data-csg-lodop-funcs',
            function() {
                appendScriptOnce(
                    '/static/csgoj/contest/csg_print_job_queue.js',
                    'data-csg-print-job-queue',
                    function() {
                appendScriptOnce(
                    ctrlUrl,
                    'data-csg-lodop-print-control',
                    function() {
                        window.__csgLodopScriptsInjected = true;
                        syncTableDoPrintLodopState();
                        runManualLodopReadyPoll(btn);
                    },
                    function() {
                        finalizeManualLodopButton(btn, false);
                        alerty.error({
                            message: '加载失败，请检查网络后重试。',
                            message_en: 'Failed to load. Check your network and try again.'
                        });
                    }
                );
                    },
                    function() {
                        finalizeManualLodopButton(btn, false);
                        alerty.error({
                            message: '加载失败，请检查网络后重试。',
                            message_en: 'Failed to load. Check your network and try again.'
                        });
                    }
                );
            },
            function() {
                finalizeManualLodopButton(btn, false);
                alerty.error({
                    message: '加载失败，请检查网络后重试。',
                    message_en: 'Failed to load. Check your network and try again.'
                });
            }
        );
    });
}

function syncPrintCodeModalActionButtons(row) {
    row = row || {};
    var canPrint = row.flg_can_print == 1;
    var canDeny = row.flg_can_deny == 1;
    var printReady = isPrintSystemReady();
    var printBtn = document.getElementById('print_code_modal_print_btn');
    var printTipHost = document.getElementById('print_code_modal_print_tooltip_host');
    var denyBtn = document.getElementById('print_code_modal_deny_btn');
    if (printBtn) {
        if (canPrint) {
            printBtn.classList.remove('d-none');
            if (printTipHost) {
                printTipHost.classList.remove('d-none');
            }
            if (printReady) {
                printBtn.removeAttribute('disabled');
                printBtn.classList.remove('print-action-unavailable');
                csgApplyPrintTooltipHost(printTipHost, printBtn, PRINT_UI_TITLE_PRINT_OK);
            } else {
                printBtn.setAttribute('disabled', 'disabled');
                printBtn.classList.add('print-action-unavailable');
                csgApplyPrintTooltipHost(printTipHost, printBtn, getPrintBlockedTitleForCurrentLodopState());
            }
        } else {
            printBtn.classList.add('d-none');
            if (printTipHost) {
                printTipHost.classList.add('d-none');
            }
            printBtn.setAttribute('disabled', 'disabled');
            printBtn.classList.remove('print-action-unavailable');
            csgApplyPrintTooltipHost(printTipHost, printBtn, PRINT_UI_TITLE_PRINT_OK);
        }
    }
    if (denyBtn) {
        if (canDeny) {
            denyBtn.classList.remove('d-none');
            denyBtn.removeAttribute('disabled');
        } else {
            denyBtn.classList.add('d-none');
            denyBtn.setAttribute('disabled', 'disabled');
        }
    }
}

/** 拒绝当前打印请求：print_deny_ajax，成功后提示并刷新表格 */
function executePrintDenyForRow(row) {
    if (!row || row.flg_can_deny != 1) {
        return;
    }
    if (typeof $ === 'undefined' || !$table || !$table.length) {
        return;
    }
    var $info = $('#print_status_page_information');
    if (!$info.length) {
        return;
    }
    var printId = row.print_id;
    $.get(
        'print_deny_ajax',
        {
            print_id: printId,
            cid: $info.attr('cid')
        },
        function (ret) {
            if (ret.code == 1) {
                alerty.success({
                    message: '打印请求 ' + printId + ' 已拒绝',
                    message_en: 'Print request ' + printId + ' has been denied'
                });
                $table.bootstrapTable('refresh');
                var modalEl = document.getElementById('print_code_show_modal');
                if (modalEl && typeof bootstrap !== 'undefined') {
                    var mi = bootstrap.Modal.getInstance(modalEl);
                    if (mi) {
                        mi.hide();
                    }
                }
            } else {
                alerty.error(ret.msg);
            }
        }
    );
}

function onPrintCodeModalPrintBtnClick() {
    var row = print_code_modal_last_row;
    if (!row || row.flg_can_print != 1) {
        return;
    }
    if (!isPrintSystemReady()) {
        alerty.error(getPrintNotReadyAlertyPayload());
        return;
    }
    StartSinglePrint(row.print_id, row);
}

function onPrintCodeModalDenyBtnClick() {
    executePrintDenyForRow(print_code_modal_last_row);
}

function initPrintCodeShowModal() {
    var modalEl = document.getElementById('print_code_show_modal');
    if (modalEl && !modalEl.getAttribute('data-print-lodop-resync')) {
        modalEl.setAttribute('data-print-lodop-resync', '1');
        modalEl.addEventListener('shown.bs.modal', function () {
            if (print_code_modal_last_row) {
                syncPrintCodeModalActionButtons(print_code_modal_last_row);
                setTimeout(function () {
                    if (print_code_modal_last_row) {
                        syncPrintCodeModalActionButtons(print_code_modal_last_row);
                    }
                }, 700);
                setTimeout(function () {
                    if (print_code_modal_last_row) {
                        syncPrintCodeModalActionButtons(print_code_modal_last_row);
                    }
                }, 2000);
            }
        });
    }
    var printAct = document.getElementById('print_code_modal_print_btn');
    if (printAct && !printAct.getAttribute('data-print-code-init')) {
        printAct.setAttribute('data-print-code-init', '1');
        printAct.addEventListener('click', onPrintCodeModalPrintBtnClick);
    }
    var denyAct = document.getElementById('print_code_modal_deny_btn');
    if (denyAct && !denyAct.getAttribute('data-print-code-init')) {
        denyAct.setAttribute('data-print-code-init', '1');
        denyAct.addEventListener('click', onPrintCodeModalDenyBtnClick);
    }
    var copyBtn = document.getElementById('print_code_copy_btn');
    if (copyBtn && !copyBtn.getAttribute('data-print-code-init')) {
        copyBtn.setAttribute('data-print-code-init', '1');
        copyBtn.addEventListener('click', onPrintCodeCopyBtnClick);
    }
    var dlBtn = document.getElementById('print_code_download_btn');
    if (dlBtn && !dlBtn.getAttribute('data-print-code-init')) {
        dlBtn.setAttribute('data-print-code-init', '1');
        dlBtn.addEventListener('click', onPrintCodeDownloadBtnClick);
    }
}

// 打印状态formatter
function FormatterPrintStatus(value, row, index, field) {
    const statusMap = {
        0: { 
            icon: 'bi bi-clock', 
            class: 'btn-info', 
            enText: 'Waiting',
            title: '等待打印，点击查看代码 (Waiting for Print, Click to View Code)'
        },
        1: { 
            icon: 'bi bi-check-circle', 
            class: 'btn-success', 
            enText: 'Printed',
            title: '已打印，点击查看代码 (Printed, Click to View Code)'
        },
        2: { 
            icon: 'bi bi-x-circle', 
            class: 'btn-danger', 
            enText: 'Denied',
            title: '已拒绝，点击查看代码 (Denied, Click to View Code)'
        }
    };
    
    const status = statusMap[value] || { 
        icon: 'bi bi-question-circle', 
        class: 'btn-secondary', 
        enText: 'Unknown',
        title: '未知状态 (Unknown Status)'
    };
    
    return `<span class="btn btn-sm ${status.class} print-status" print_id="${row.print_id}" title="${status.title}">
        <i class="${status.icon} "></i><span class="en-text">${status.enText}</span>
    </span>`;
}
function syncTableDoPrintLodopState() {
    if (typeof $ === 'undefined' || !$table || !$table.length) {
        return;
    }
    var ok = isPrintSystemReady();
    $table.find('.do_print').each(function () {
        var $el = $(this);
        var el = $el[0];
        if (ok) {
            $el.removeClass('print-action-unavailable');
            if (typeof CsgSetTitleAndTooltip === 'function') {
                CsgSetTitleAndTooltip(el, PRINT_UI_TITLE_TABLE_PRINT_OK);
            } else {
                $el.attr('title', PRINT_UI_TITLE_TABLE_PRINT_OK);
            }
        } else {
            $el.addClass('print-action-unavailable');
            var tb = getPrintBlockedTitleForCurrentLodopState();
            if (typeof CsgSetTitleAndTooltip === 'function') {
                CsgSetTitleAndTooltip(el, tb);
            } else {
                $el.attr('title', tb);
            }
        }
    });
    var modalShown = document.getElementById('print_code_show_modal');
    if (modalShown && modalShown.classList.contains('show') && print_code_modal_last_row) {
        syncPrintCodeModalActionButtons(print_code_modal_last_row);
    }
}

// 打印操作按钮formatter
function FormatterPrintAction(value, row, index, field) {
    if (row.flg_can_print) {
        return (
            '<span class="btn btn-success btn-sm do_print" data-csg-tooltip-preline="true" title="' +
            PRINT_UI_TITLE_TABLE_PRINT_OK.replace(/"/g, '&quot;').replace(/\n/g, '&#10;') +
            '"><i class="bi bi-printer "></i><span class="en-text">Print</span></span>'
        );
    }
    return '-';
}

// 拒绝操作按钮formatter
function FormatterPrintDenyAction(value, row, index, field) {
    if (row.flg_can_deny) {
        return `<span class="btn btn-danger btn-sm do_deny" title="双击拒绝打印请求 (Double-click to Deny Print Request)">
            <i class="bi bi-x-circle "></i><span class="en-text">Deny</span>
        </span>`;
    }
    return '-';
}

/** 学校列：与队伍生成 / 影像名单一致，复用 util.js 的 csg.hashTagBadgeHtml 多色 tag */
function FormatterPrintStatusSchool(value, row, index, field) {
    if (typeof csg === 'undefined' || !csg.hashTagBadgeHtml) {
        var s = value != null ? String(value).trim() : '';
        return s ? escapeHtmlForPrintModal(s) : '—';
    }
    var s = value != null ? String(value).trim() : '';
    var inner = !s
        ? csg.hashTagBadgeHtml('', '', {})
        : csg.hashTagBadgeHtml(s, s, { allowWrap: true, maxWidth: '12rem' });
    return '<div class="teamgen-hash-cell teamgen-hash-cell--start">' + inner + '</div>';
}

// 打印状态选项映射（与 FormatterPrintStatus 保持一致）
const printStatusOptions = {
    0: { 
        text: '等待打印',
        textEn: 'Waiting'
    },
    1: { 
        text: '已打印',
        textEn: 'Printed'
    },
    2: { 
        text: '已拒绝',
        textEn: 'Denied'
    }
};

// 初始化打印状态选择框选项
function initPrintStatusSelect() {
    const select = document.querySelector('select[name="print_status"]');
    if (!select) return;
    
    // 保留 "All" 选项，清除其他选项
    const allOption = select.querySelector('option[value="-1"]');
    if (allOption) {
        select.innerHTML = '';
        select.appendChild(allOption);
    }
    
    // 添加三种状态的选项（select option 不支持 HTML，使用纯文本显示）
    Object.keys(printStatusOptions).forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        const status = printStatusOptions[value];
        // 使用中英文格式：中文 (English)
        option.textContent = `${status.text} (${status.textEn})`;
        select.appendChild(option);
    });
}

function isAutoPrintEnabled() {
    var switchEl = document.getElementById('auto_print_box');
    return !!(switchEl && switchEl.checked);
}

/** 关闭自动打印：停止倒计时并释放单工位 */
function stopAutoPrint() {
    clearTimeout(auto_print_timout_id);
    auto_print_timout_id = undefined;
    auto_print_awaiting_table_refresh = false;
    auto_print_confirmed_idle = false;
    releaseAutoPrintSlot('stop');
    if (auto_print_interval_span) {
        auto_print_time = getAutoPrintIdlePollSec();
        auto_print_interval = auto_print_time;
        auto_print_interval_span.text(auto_print_time);
    }
}

// 初始化自动打印开关
function initAutoPrintSwitch() {
    const switchEl = document.getElementById('auto_print_box');
    if (!switchEl) return;
    
    // 初始化 csg-switch
    if (window.csgSwitch) {
        window.csgSwitch.initSwitch(switchEl, {
            onChange: function(checked) {
                handleAutoPrintToggle(checked);
            }
        });
    }
}

// 初始化颜色模式开关
function initPrintColorModeSwitch() {
    const switchEl = document.getElementById('print_color_mode_box');
    if (!switchEl) return;
    
    // 初始化 csg-switch（使用 localStorage 自动保存状态）
    if (window.csgSwitch) {
        window.csgSwitch.initSwitch(switchEl, {
            onChange: function(checked) {
                // 状态变化时保存到 localStorage
                try {
                    localStorage.setItem('print_color_mode', checked ? 'true' : 'false');
                } catch(e) {
                    // 忽略 localStorage 错误
                }
            }
        });
    }
}

// 处理自动打印开关切换
function handleAutoPrintToggle(checked) {
    const switchEl = document.getElementById('auto_print_box');
    
    if (checked) {
        alerty.confirm({
            message: '自动打印将会发送页面内所有等待的打印任务，并自动刷新列表接收新任务，该状态下Room将禁止修改。<br/><strong>请确认Room已设置好并已执行Filter，且任务按打印状态列升序（默认），即表头有朝上的小三角。</strong>',
            message_en: 'Auto print will send all Waiting print tasks on the page and automatically refresh the list to receive new tasks. Room will be disabled in this state.<br/><strong>Please confirm that Room is set up and Filter has been executed, and tasks are sorted in ascending order by Print Status column (default), i.e., there is an upward arrow in the table header.</strong>',
            callback: function(){
                room_ids.attr('readonly', 'readonly');
                DoAutoPrint();
            },
            callbackCancel: function(){
                alerty.message("已取消", "Cancelled");
                // 关闭开关
                if (window.csgSwitch && switchEl) {
                    const switchId = switchEl.dataset.csgId;
                    if (switchId) {
                        const switchInstance = window.csgSwitch.switches.get(switchId);
                        if (switchInstance) {
                            switchEl.checked = false;
                            window.csgSwitch.updateSwitchState(switchEl, switchInstance.config);
                        }
                    }
                }
            }
        });
    } else {
        room_ids.removeAttr('readonly');
        stopAutoPrint();
    }
}



var $table;
var print_status_page_information;
var team_id;
var auto_print_interval;
var auto_print_time;
var auto_print_timout_id;
var auto_print_interval_span;

/** 【闲时等待时长】与 csg_print_job_queue.js → CSG_AUTO_PRINT_IDLE_POLL_SEC 一致（秒） */
function getAutoPrintIdlePollSec() {
    if (typeof CSG_AUTO_PRINT_IDLE_POLL_SEC === 'number' && !isNaN(CSG_AUTO_PRINT_IDLE_POLL_SEC)) {
        return CSG_AUTO_PRINT_IDLE_POLL_SEC;
    }
    return 10;
}

function getAutoPrintBusyPollSec() {
    if (typeof CSG_AUTO_PRINT_BUSY_POLL_SEC === 'number' && !isNaN(CSG_AUTO_PRINT_BUSY_POLL_SEC)) {
        return CSG_AUTO_PRINT_BUSY_POLL_SEC;
    }
    return 5;
}
/** 自动打印单工位：整段「拉码→Lodop→print_do_ajax」完成前不再开下一单 */
var auto_print_busy = false;
var auto_print_inflight_print_id = null;
/** 极少数路径仍整表 refresh 后由 post-body 释放单工位（自动成功默认改本地行 + immediateRelease） */
var auto_print_awaiting_table_refresh = false;
/**
 * 自动模式「确认闲时」：仅在一次整表 refresh 的 post-body 里，当前筛选下仍无 Waiting 时为 true。
 * 本页本地打空（updateRow）不能代表全局闲（其它页/新提交未知），故不能据此切 20s。
 */
var auto_print_confirmed_idle = false;
var team_map = {}; // 队伍信息映射（只在页面加载时初始化一次）
var team_data_loaded = false; // 标记队伍数据是否已加载
var print_code_modal_last_row = null; // 打印代码弹窗：当前行（下载文件名等）

/**
 * contest_data_ajax 可能返回 team 的 list 行格式；仅做 team 段 list→dict，避免依赖 rank_tool.js。
 * 字段顺序与 contest_data 约定一致。
 */
function printStatusConvertTeamListToDict(data) {
    if (!data || !data.team || !Array.isArray(data.team) || data.team.length === 0) {
        return;
    }
    var first = data.team[0];
    if (!Array.isArray(first)) {
        return;
    }
    data.team = data.team.map(function (item) {
        return {
            contest_id: item[0],
            team_id: item[1],
            name: item[2],
            name_en: item[3],
            coach: item[4],
            tmember: item[5],
            school: item[6],
            region: item[7],
            tkind: item[8],
            room: item[9],
            privilege: item[10],
            team_global_code: item[11],
            group_ids: Array.isArray(item[12]) ? item[12] : []
        };
    });
}

// 加载队伍数据（只在页面加载时调用一次，返回 Promise）
function loadTeamData() {
    const config = window.PRINT_STATUS_CONFIG || {};
    if (config.disable_team_preload) {
        team_data_loaded = true;
        return Promise.resolve();
    }
    // 如果已经加载过，直接返回 resolved Promise
    if (team_data_loaded) {
        return Promise.resolve();
    }
    
    const contestDataUrl = config.contest_data_url || '';
    const cid = config.cid || '';
    
    if (!contestDataUrl || !cid) {
        console.warn('Contest data URL or CID not configured, team info will not be available');
        team_data_loaded = true; // 标记为已加载（避免重复请求）
        return Promise.resolve();
    }
    
    // 返回 Promise
    return new Promise((resolve, reject) => {
        // 请求队伍数据
        $.get(contestDataUrl + '?info_need[]=team&cid=' + cid, function(ret) {
            if (ret.code === 1 && ret.data && ret.data.team) {
                // 转换数据格式（不依赖 rank_tool.js）
                const teamData = { team: ret.data.team };
                printStatusConvertTeamListToDict(teamData);
                
                // 构建 team_map
                team_map = {};
                if (Array.isArray(teamData.team)) {
                    teamData.team.forEach(team => {
                        if (team.team_id) {
                            team_map[team.team_id] = team;
                        }
                    });
                }
                team_data_loaded = true;
                resolve();
            } else {
                console.warn('Failed to load team data:', ret.msg || 'Unknown error');
                team_data_loaded = true; // 标记为已加载（避免重复请求）
                resolve(); // 即使失败也 resolve，让表格可以初始化
            }
        }).fail(function(xhr, status, error) {
            console.warn('Failed to load team data:', error);
            team_data_loaded = true; // 标记为已加载（避免重复请求）
            resolve(); // 即使失败也 resolve，让表格可以初始化
        });
    });
}

// 手动初始化表格函数
function initPrintStatusTable() {
    $table = $('#print_status_table');
    // 如果已经初始化，直接返回
    if ($table.data('bootstrap.table')) {
        return;
    }
    // 手动初始化表格
    $table.bootstrapTable();
}

// 合并队伍信息到数据行
function mergeTeamInfo(rows) {
    if (!rows || !Array.isArray(rows)) {
        return rows;
    }
    return rows.map(row => {
        const teamInfo = team_map[row.team_id];
        
        if (teamInfo) {
            row.school = row.school || teamInfo.school || '';
            row.name = row.name || teamInfo.name || '';
            row.tmember = row.tmember != null && String(row.tmember).trim() !== ''
                ? String(row.tmember).trim()
                : (teamInfo.tmember != null ? String(teamInfo.tmember).trim() : '');
            row.coach = row.coach != null && String(row.coach).trim() !== ''
                ? String(row.coach).trim()
                : (teamInfo.coach != null ? String(teamInfo.coach).trim() : '');
        }
        return row;
    });
}

// queryParams：参考 /csgoj/status 的 oj_status.js 写法——只把“非空且非默认值”的筛选写入 params。
//
// 注意（重要）：
//   1) 不能直接复用 makeQueryParams 工厂的内层 `each(.print_status_filter)`，
//      它把空字符串也写入 params（`'' != null && '' != '-1'` 为真），导致 URL 永远出现
//      `team_id=&room_ids=&group_ids=` 这种垃圾键，PHP 端也得多走一遍空判断分支。
//   2) 直接按 name 显式列出筛选项，与 oj_status.js 同一思路：值为空 / `-1` / `0`(僅 similar) 时
//      不写入 params；这样首屏 URL 是干净的 `?cid=xxx&sort=...&offset=0&limit=50`，
//      和后续筛选状态的 URL 互不交叉，方便定位“真的有人改了筛选”这一类问题。
window.queryParams = function(params) {
    const filterNames = ['team_id', 'room_ids', 'group_ids', 'print_status'];
    filterNames.forEach(name => {
        // 只取属于 print_status 工具栏的筛选控件，避免误匹配到侧栏登录框等同名字段
        const $el = $(`.print_status_filter[name="${name}"]`).first();
        if ($el.length === 0) {
            return;
        }
        let val = $el.val();
        if (val == null) {
            return;
        }
        val = String(val).trim();
        if (val === '' || val === '-1') {
            return;
        }
        params[name] = val;
    });
    // 职能账号锁定 group 时（disabled select 不会被 jQuery 序列化），从隐藏域回退读
    if (!('group_ids' in params)) {
        const lockedGroup = $('#print_group_ids_hidden').val();
        if (lockedGroup && String(lockedGroup).trim() !== '') {
            params.group_ids = String(lockedGroup).trim();
        }
    }
    return params;
};

// 自定义 responseHandler：在数据返回后合并 team 信息
window.printStatusResponseHandler = function(res) {
    // print_status_ajax 返回格式: {total: xxx, rows: [...], order: 'xxx'}
    // 合并队伍信息到 rows
    
    if (res && res.rows && Array.isArray(res.rows)) {
        res.rows = mergeTeamInfo(res.rows);
    }
    
    return res;
};

/**
 * 非专职打印员（print_manager）：环境说明条首次关闭后不再展示（仅 print_status 页逻辑，与 Lodop 无关）。
 * 专职打印员每次进入仍展示，便于对照安装说明。
 */
function initPrintStatusEnvAlertDismiss() {
    var cfg = window.PRINT_STATUS_CONFIG || {};
    var lodopAutoload =
        cfg.lodop_autoload === true ||
        cfg.lodop_autoload === 1 ||
        (typeof cfg.lodop_autoload === 'string' && cfg.lodop_autoload.toLowerCase() === 'true');
    var el = document.getElementById('print_status_env_alert');
    if (!el) {
        return;
    }
    if (lodopAutoload) {
        return;
    }
    var cid = String(cfg.cid != null ? cfg.cid : '');
    var key = 'csg_print_status_env_tip_dismissed_' + cid;
    try {
        if (localStorage.getItem(key) === '1') {
            el.remove();
            return;
        }
    } catch (e) {
        /* 隐私模式等无法读 storage 时仍展示提示，仅无法记住关闭 */
    }
    el.addEventListener('closed.bs.alert', function onEnvAlertClosed() {
        el.removeEventListener('closed.bs.alert', onEnvAlertClosed);
        try {
            localStorage.setItem(key, '1');
        } catch (e2) {
            /* ignore */
        }
    });
}

// 先初始化打印状态选择框，确保选项已经生成
$(function(){
    initPrintStatusEnvAlertDismiss();
    initPrintLodopManualLoadButton();
    initPrintCodeShowModal();

    // 初始化打印状态选择框（必须在工具栏初始化之前）
    initPrintStatusSelect();
    
    // 先加载队伍数据，完成后再初始化表格
    loadTeamData().then(function() {
        // 队伍数据加载完成后，初始化表格
        initPrintStatusTable();
        
        // 使用 setTimeout 确保 DOM 更新完成后再初始化工具栏
        setTimeout(function() {
            // 与 /csgoj/status 一致：筛选/刷新/清空/F5 仅走 initBootstrapTableToolbar，禁止页面再绑一套（否则每次 refresh 发两遍 Ajax）
            initBootstrapTableToolbar({
                tableId: 'print_status_table',
                prefix: 'print_status',
                searchInputId: null,
                enableAnchorSync: true,
                customHandlers: {
                    refresh: function() {
                        $table.bootstrapTable('refresh');
                    },
                    clear: function() {
                        const prefix = 'print_status';
                        $('.print_status_filter').each(function() {
                            const $elem = $(this);
                            const name = $elem.attr('name');
                            if (!name || $elem.prop('disabled')) {
                                return;
                            }
                            $elem.data('initializing-from-anchor', true);
                            if ($elem.is('input')) {
                                $elem.val('');
                            } else if ($elem[0]) {
                                $elem[0].value = '-1';
                                $elem[0].dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                            } else {
                                $elem.val('-1').trigger('change');
                            }
                            const anchorKey = `${prefix}_${name}`;
                            const anchorVal = csg.GetAnchor(anchorKey);
                            if (anchorVal !== null && anchorVal !== '') {
                                csg.SetAnchor(null, anchorKey);
                            }
                            const legacyVal = csg.GetAnchor(name);
                            if (legacyVal !== null && legacyVal !== '') {
                                csg.SetAnchor(null, name);
                            }
                            setTimeout(function() {
                                $elem.removeData('initializing-from-anchor');
                            }, 100);
                        });
                        $table.bootstrapTable('refresh', { pageNumber: 1 });
                    }
                }
            });
        }, 0);
        
        // 初始化自动打印开关
        initAutoPrintSwitch();
        
        // 初始化颜色模式开关
        initPrintColorModeSwitch();
        
        //table related
        print_status_page_information = $('#print_status_page_information');
        team_id = print_status_page_information.attr('team_id');

        // 【闲时等待时长】见 csg_print_job_queue.js → CSG_AUTO_PRINT_IDLE_POLL_SEC；连打/未确认闲见 CSG_AUTO_PRINT_BUSY_POLL_SEC
        auto_print_interval = getAutoPrintIdlePollSec();
        auto_print_time = auto_print_interval;
        auto_print_interval_span = $('#auto_print_interval_span');
        room_ids = $('#room_ids');

        // 检查是否已经开启自动打印（须在 interval 初始化之后）
        const switchEl = document.getElementById('auto_print_box');
        if (switchEl && switchEl.checked) {
            room_ids.attr('readonly', 'readonly');
            DoAutoPrint();
        }

        // 表格点击事件处理
        $table.on('click-cell.bs.table', function(e, field, val, row, td){
            var tdContent = td.children();
            if(field == 'print_status') {
                if(row.flg_showcode == 1) {
                    $.get(
                        print_status_page_information.attr('show_code_url'),
                        {
                            'print_id': row.print_id,
                            'cid': print_status_page_information.attr('cid')
                        },
                        function(ret){
                            if(ret.code == 1)
                            {
                                openPrintCodePreviewModal(ret.data, row);
                            }
                            else
                            {
                                alerty.error(ret.msg);
                                return false;
                            }
                        }
                    );
                }
            }
        });
        $table.on('dbl-click-cell.bs.table', function(e, field, val, row, td) {
            if(field == 'print_id') {
                // 双击 print_id 列预览打印
                if(row.flg_can_print == 1) {
                    PreviewPrint(row['print_id'], row);
                }
            }
            else if(field == 'do_print') {
                if(row.flg_can_print == 1) {
                    if (!isPrintSystemReady()) {
                        alerty.error(getPrintNotReadyAlertyPayload());
                        return;
                    }
                    StartSinglePrint(row['print_id'], row);
                }
            }
            else if(field == 'do_deny') {
                if(row.flg_can_deny == 1) {
                    executePrintDenyForRow(row);
                }
            }
        });
        $table.on('post-body.bs.table', function(){
            syncTableDoPrintLodopState();
            const switchEl = document.getElementById('auto_print_box');
            if (switchEl && switchEl.checked) {
                if (auto_print_awaiting_table_refresh) {
                    auto_print_awaiting_table_refresh = false;
                    releaseAutoPrintSlot('post-body-after-pipeline');
                }
                // 仅以 refresh 后的服务端数据判断是否闲时（含分页其它页、新提交）
                auto_print_confirmed_idle =
                    !hasWaitingPrintOnPage() && !auto_print_busy;
                DoAutoPrint();
            } else if (auto_print_awaiting_table_refresh) {
                auto_print_awaiting_table_refresh = false;
                releaseAutoPrintSlot('post-body-manual-off');
            }
        });
        setTimeout(syncTableDoPrintLodopState, 600);
        setTimeout(syncTableDoPrintLodopState, 2200);
        $(window).on('load', syncTableDoPrintLodopState);
    });
});

// F5 刷新：由 general_formatter.js 中 bootstraptable_refresh_local 统一处理，勿在此重复绑定

// ============================================================================
// ============================================================================
// 打印/预览执行模块（调用 print_control.js 中的函数）
// ============================================================================
// ============================================================================

// 执行打印或预览的公共函数（复用逻辑）
function ExecutePrintOrPreview(print_id, row, preview, isAutoPipeline) {
    // 从表格获取行数据（如果未提供）
    if (!row) {
        const rows = $table.bootstrapTable('getData');
        row = rows.find(r => r.print_id == print_id);
    }
    
    // 如果还是找不到行数据，使用基本信息
    if (!row) {
        row = { print_id: print_id, team_id: '', room: '', code_length: '' };
    }

    if (!isPrintSystemReady()) {
        alerty.error(getPrintNotReadyAlertyPayload());
        if (isAutoPipeline) {
            finishAutoPrintPipeline(print_id, 'lodop-not-ready', { immediateRelease: true });
        }
        return;
    }

    // 收集队伍信息
    const teamInfo = team_map[row.team_id] || {};
    const printInfo = {
        print_id: print_id,
        team_id: row.team_id || '',
        room: row.room || '',
        school: row.school || teamInfo.school || '',
        name: row.name || teamInfo.name || '',
        code_length: row.code_length || ''
    };
    
    // 获取代码内容并执行打印或预览
    $.get(
        'print_code_plain_content_ajax',
        {
            'print_id': print_id,
            'cid': print_status_page_information.attr('cid')
        },
        function(ret){
            if(ret.code == 1)
            {
                // 合并所有打印信息到数据中（完整的数据处理）
                var printData = {
                    print_id: ret.data.print_id || print_id,
                    contest_id:
                        ret.data.contest_id != null
                            ? ret.data.contest_id
                            : print_status_page_information.attr('cid'),
                    team_id: ret.data.team_id || printInfo.team_id,
                    source: ret.data.source || '',
                    lang: ret.data.lang || '',
                    contest_title: ret.data.contest_title || '',
                    school: printInfo.school || '',
                    name: printInfo.name || '',
                    room: printInfo.room || '',
                    in_date: ret.data.in_date
                };
                
                if (typeof PrintCode !== 'function') {
                    alerty.error(getPrintNotReadyAlertyPayload());
                    if (!preview && isAutoPipeline) {
                        finishAutoPrintPipeline(print_id, 'no-PrintCode', { immediateRelease: true });
                    }
                    return;
                }
                if (preview) {
                    PrintCode(printData, null, true);
                } else {
                    PrintCode(printData, function(printError, printResult) {
                        UpdatePrintStatus(print_id, printInfo, printError, printResult, !!isAutoPipeline);
                    });
                }
            }
            else
            {
                // 获取代码内容失败
                if (preview) {
                    alerty.error({
                        message: '获取代码内容失败',
                        message_en: 'Failed to get code content'
                    });
                } else if (isAutoPipeline) {
                    ShowPrintResultAlert(printInfo, {
                        getCodeError: ret.msg || '获取代码内容失败'
                    }, null, null, { refreshTable: false });
                    finishAutoPrintPipeline(print_id, 'get-code-fail', { immediateRelease: true });
                } else {
                    ShowPrintResultAlert(printInfo, {
                        getCodeError: ret.msg || '获取代码内容失败'
                    }, null, null);
                }
            }
        }
    ).fail(function(xhr, status, error) {
        // 网络错误
        if (preview) {
            alerty.error({
                message: '网络错误：' + (xhr.responseJSON?.msg || xhr.statusText || '未知错误'),
                message_en: 'Network error: ' + (xhr.responseJSON?.msg || xhr.statusText || 'Unknown error')
            });
        } else if (isAutoPipeline) {
            ShowPrintResultAlert(printInfo, {
                getCodeError: xhr.responseJSON?.msg || xhr.statusText || '网络错误'
            }, null, null, { refreshTable: false });
            finishAutoPrintPipeline(print_id, 'get-code-network', { immediateRelease: true });
        } else {
            ShowPrintResultAlert(printInfo, {
                getCodeError: xhr.responseJSON?.msg || xhr.statusText || '网络错误'
            }, null, null);
        }
    });
}

// 预览打印内容（复用真实打印逻辑）
function PreviewPrint(print_id, row)
{
    ExecutePrintOrPreview(print_id, row, true);
}

// 开始单个打印任务（isAuto：自动模式流水线，须在 print_do_ajax 后再开下一单）
function StartSinglePrint(print_id, row, isAuto)
{
    ExecutePrintOrPreview(print_id, row, false, !!isAuto);
}

function AutoPrint()
{
    if (!isAutoPrintEnabled()) {
        return;
    }
    auto_print_time--;
    if (auto_print_time <= 0) {
        $table.bootstrapTable('refresh');
    } else {
        auto_print_timout_id = setTimeout(function () {
            AutoPrint();
        }, 1000);
    }
    if (auto_print_interval_span) {
        auto_print_interval_span.text(auto_print_time);
    }
}

function releaseAutoPrintSlot(reason) {
    auto_print_busy = false;
    auto_print_inflight_print_id = null;
}

/** 自动连打：print_do 成功后只更新当前页该行，避免每单整表 refresh */
function applyPrintStatusRowLocal(print_id, printStatus) {
    if (typeof $ === 'undefined' || !$table || !$table.length) {
        return false;
    }
    var rows = $table.bootstrapTable('getData') || [];
    var idx = -1;
    for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].print_id) === String(print_id)) {
            idx = i;
            break;
        }
    }
    if (idx < 0) {
        return false;
    }
    var row = $.extend({}, rows[idx]);
    row.print_status = printStatus;
    if (Number(printStatus) === 1) {
        row.flg_can_deny = 0;
    }
    $table.bootstrapTable('updateRow', { index: idx, row: row, replace: true });
    syncTableDoPrintLodopState();
    return true;
}

/** 从当前表数据取第一条 Waiting（print_status=0），排除正在流水线中的 print_id */
function findFirstWaitingPrintRow() {
    if (typeof $ === 'undefined' || !$table || !$table.length) {
        return null;
    }
    var rows = $table.bootstrapTable('getData') || [];
    var inflight = auto_print_inflight_print_id;
    var candidates = rows.filter(function (r) {
        if (Number(r.print_status) !== 0 || Number(r.flg_can_print) !== 1) {
            return false;
        }
        if (inflight != null && String(r.print_id) === String(inflight)) {
            return false;
        }
        return true;
    });
    if (candidates.length === 0) {
        return null;
    }
    candidates.sort(function (a, b) {
        var d = Number(a.print_status) - Number(b.print_status);
        if (d !== 0) {
            return d;
        }
        return Number(a.print_id) - Number(b.print_id);
    });
    return { print_id: candidates[0].print_id, row: candidates[0] };
}

function hasWaitingPrintOnPage() {
    return !!findFirstWaitingPrintRow();
}

/** 自动模式尝试开一单；已 busy 或无可打行则返回 false */
function tryStartAutoPrint() {
    if (!isAutoPrintEnabled()) {
        return false;
    }
    if (auto_print_busy) {
        return false;
    }
    var task = findFirstWaitingPrintRow();
    if (!task) {
        return false;
    }
    if (!isPrintSystemReady()) {
        syncTableDoPrintLodopState();
        return false;
    }
    auto_print_busy = true;
    auto_print_inflight_print_id = task.print_id;
    StartSinglePrint(task.print_id, task.row, true);
    return true;
}

/**
 * 一单流水线结束（含 print_do_ajax）。
 * 自动成功：本地 updateRow 后 immediateRelease 开下一单；整表 refresh 仅倒计时/失败兜底。
 * opts.immediateRelease：立刻释放单工位并 DoAutoPrint。
 */
function finishAutoPrintPipeline(print_id, reason, opts) {
    if (
        auto_print_inflight_print_id != null &&
        String(auto_print_inflight_print_id) !== String(print_id)
    ) {
        return;
    }
    if (opts && opts.immediateRelease) {
        releaseAutoPrintSlot(reason || 'pipeline-immediate');
        if (isAutoPrintEnabled()) {
            DoAutoPrint();
        }
        return;
    }
    auto_print_awaiting_table_refresh = true;
    if (isAutoPrintEnabled()) {
        auto_print_time = getAutoPrintBusyPollSec();
        if (auto_print_interval_span) {
            auto_print_interval_span.text(auto_print_time);
        }
    }
}

/**
 * 自动模式调度：尝试开一单；拉表倒计时（非【打印间隔】）：
 * - CSG_AUTO_PRINT_BUSY_POLL_SEC：正在打、本页仍有 Waiting、或未 refresh 确认闲；
 * - CSG_AUTO_PRINT_IDLE_POLL_SEC：仅 auto_print_confirmed_idle（【闲时等待时长】）。
 */
function DoAutoPrint()
{
    if (!isAutoPrintEnabled()) {
        return;
    }
    clearTimeout(auto_print_timout_id);
    var started = tryStartAutoPrint();
    var hasPending = hasWaitingPrintOnPage();
    var busyPollSec = getAutoPrintBusyPollSec();
    var idlePollSec = getAutoPrintIdlePollSec();
    if (started || hasPending || auto_print_busy) {
        auto_print_confirmed_idle = false;
        auto_print_time = busyPollSec;
    } else if (auto_print_confirmed_idle) {
        auto_print_time = idlePollSec;
    } else {
        auto_print_time = busyPollSec;
    }
    AutoPrint();
}

function UpdatePrintStatus(print_id, printInfo, printError, printResult, isAutoPipeline)
{
    $.get(
        'print_do_ajax',
        {
            'print_id': print_id,
            'cid': print_status_page_information.attr('cid')
        },
        function(ret){
            if (isAutoPipeline) {
                if (ret.code == 1) {
                    var rowUpdated = applyPrintStatusRowLocal(print_id, 1);
                    ShowPrintResultAlert(printInfo, null, printError, ret, {
                        refreshTable: !rowUpdated
                    });
                    finishAutoPrintPipeline(print_id, 'status-ok', { immediateRelease: true });
                } else {
                    ShowPrintResultAlert(printInfo, {
                        updateStatusError: ret.msg || '更新打印状态失败'
                    }, printError, null, { refreshTable: true });
                    finishAutoPrintPipeline(print_id, 'status-fail', { immediateRelease: true });
                }
            } else if (ret.code == 1) {
                ShowPrintResultAlert(printInfo, null, printError, ret);
            } else {
                ShowPrintResultAlert(printInfo, {
                    updateStatusError: ret.msg || '更新打印状态失败'
                }, printError, null);
            }
        }
    ).fail(function(xhr, status, error) {
        var failOpts = isAutoPipeline ? { refreshTable: true } : undefined;
        ShowPrintResultAlert(printInfo, {
            updateStatusError: xhr.responseJSON?.msg || xhr.statusText || '网络错误'
        }, printError, null, failOpts);
        if (isAutoPipeline) {
            finishAutoPrintPipeline(print_id, 'status-network', { immediateRelease: true });
        }
    });
}

// 显示统一的打印结果消息（opts.refreshTable：默认 true；自动连打成功且本地已 updateRow 时为 false）
function ShowPrintResultAlert(printInfo, errors, printError, updateStatusResult, opts) {
    opts = opts || {};
    var refreshTable = opts.refreshTable !== false;
    // 构建详细信息
    const details = [];
    if (printInfo.team_id) details.push(`队伍ID: ${printInfo.team_id}`);
    if (printInfo.room) details.push(`房间: ${printInfo.room}`);
    if (printInfo.school) details.push(`学校: ${printInfo.school}`);
    if (printInfo.name) details.push(`队名: ${printInfo.name}`);
    if (printInfo.print_id) details.push(`打印ID: ${printInfo.print_id}`);
    if (printInfo.code_length) details.push(`代码长度: ${printInfo.code_length}`);
    
    const detailsEn = [];
    
    // 检查是否有任何错误
    const hasError = printError || (errors && Object.keys(errors).length > 0);
    
    if (hasError) {
        // 有错误，使用 alerty.alert
        let errorMessages = [];
        let errorMessagesEn = [];
        
        if (printError) {
            errorMessages.push(`发送到打印机失败: ${printError.message || printError}`);
            errorMessagesEn.push(`Failed to send to printer: ${printError.message || printError}`);
        }
        
        if (errors) {
            if (errors.getCodeError) {
                errorMessages.push(`获取代码内容失败: ${errors.getCodeError}`);
                errorMessagesEn.push(`Failed to get code content: ${errors.getCodeError}`);
            }
            if (errors.updateStatusError) {
                errorMessages.push(`更新打印状态失败: ${errors.updateStatusError}`);
                errorMessagesEn.push(`Failed to update print status: ${errors.updateStatusError}`);
            }
        }
        
        alerty.alert({
            title: '打印失败<span class="en-text">Print Failed</span>',
            message: details.join('，') + '<br/><br/>' + errorMessages.join('<br/>'),
            message_en: detailsEn.join(', ') + '<br/><br/>' + errorMessagesEn.join('<br/>'),
            width: '600px'
        });
    } else {
        // 成功，使用 alerty.success
        alerty.success({
            message: `打印任务已完成<br/>${details.join('\n')}`,
            message_en: `Print job completed<br/>${detailsEn.join(', ')}`
        });
    }
    
    if (refreshTable && $table && $table.length) {
        $table.bootstrapTable('refresh');
    }
}

