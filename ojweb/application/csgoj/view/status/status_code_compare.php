<div class="container-fluid py-3">
    <!-- 工具栏（Monaco only） -->
    <div id="settings" class="d-flex align-items-center flex-wrap gap-3 mb-3 p-3 bg-light rounded border">
        <div class="d-flex align-items-center gap-2 flex-wrap w-100">
            <div class="d-flex align-items-center gap-2 flex-wrap">
                <label class="mb-0 fw-semibold">代码对比<span class="en-text">Code Compare</span></label>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="btnPrevDiff" title="上一个差异 / Previous diff" disabled>
                    <i class="bi bi-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="btnNextDiff" title="下一个差异 / Next diff" disabled>
                    <i class="bi bi-arrow-down"></i>
                </button>
                <span class="toolbar-divider mx-2 d-none d-md-inline-block"></span>
                <div class="form-check form-check-inline mb-0">
                    <input type="checkbox" class="form-check-input" id="optSideBySide" checked>
                    <label class="form-check-label" for="optSideBySide">左右<span class="en-text">Side-by-side</span></label>
                </div>
                <div class="form-check form-check-inline mb-0">
                    <input type="checkbox" class="form-check-input" id="optIgnoreWhitespace" checked>
                    <label class="form-check-label" for="optIgnoreWhitespace">忽略空白<span class="en-text">Ignore whitespace</span></label>
                </div>
                <div class="form-check form-check-inline mb-0">
                    <input type="checkbox" class="form-check-input" id="optWordWrap">
                    <label class="form-check-label" for="optWordWrap">自动换行<span class="en-text">Word wrap</span></label>
                </div>
                <div class="form-check form-check-inline mb-0">
                    <input type="checkbox" class="form-check-input" id="optThemeDark">
                    <label class="form-check-label" for="optThemeDark">暗色<span class="en-text">Dark</span></label>
                </div>
                <span class="toolbar-hint ms-2">VSCode-like Diff（Monaco）</span>
            </div>

            <div class="ms-auto d-flex align-items-center gap-2">
                <span class="text-primary fw-semibold">
                    <span id="diff_num" class="text-danger fw-bold">-</span>
                    <span class="ms-1">处差异<span class="en-text">Differences</span></span>
                </span>
            </div>
        </div>
    </div>

    <div class="alert alert-danger" id="monaco_error" style="display:none;">
        <div class="fw-semibold">代码对比加载失败</div>
        <div class="small text-muted mt-1">Monaco 加载失败（可能是外网/CDN 被阻断）。请检查网络或 CDN 可用性。</div>
        <div class="small text-muted mt-1"><span class="en-text">Monaco failed to load. Please check network/CDN availability.</span></div>
    </div>

    <!-- 处理中提示 -->
    <div class="alert alert-info position-fixed top-50 start-50 translate-middle" id="comparing_label" style="z-index: 1050; display: none;">
        <div class="d-flex align-items-center gap-2">
            <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <span class="bilingual-inline">处理中...<span class="en-text">Processing...</span></span>
        </div>
    </div>

    <!-- 两侧提交信息（保留：不影响 Monaco diff） -->
    <?php $OJ_LANG = config('CsgojConfig.OJ_LANGUAGE'); ?>
    <div class="row g-2 mb-3" id="submission_info">
        <div class="col-lg-6">
            <div class="border border-danger rounded p-2 bg-white">
                <div class="fw-semibold text-danger bilingual-inline">
                    新提交
                    {if isset($code[0]) && isset($code[0]['solution_id'])} #{$code[0]['solution_id']}{else /} #-{/if}
                    <span class="en-text">New Submission{if isset($code[0]) && isset($code[0]['solution_id'])} #{$code[0]['solution_id']}{else /} #-{/if}</span>
                </div>
                <div class="small d-flex flex-wrap align-items-center gap-3 mt-1">
                    <span class="text-muted bilingual-inline">作者<span class="en-text">Author</span>:</span>
                    {if isset($code[0]) && isset($code[0]['user_id'])}
                    <a href="{$userInfoUrl}{$code[0]['user_id']}" target="_blank" class="text-decoration-underline">
                        <i class="bi bi-person-fill me-1"></i>{$code[0]['user_id']}
                    </a>
                    {else /}
                    <span>-</span>
                    {/if}
                    <span class="text-muted bilingual-inline">题目<span class="en-text">Problem</span>:</span>
                    {if isset($code[0]) && isset($code[0]['problem_id'])}
                    <a href="__OJ__/problemset/problem?pid={$code[0]['problem_id']}" target="_blank" class="text-decoration-underline">
                        <i class="bi bi-file-code me-1"></i>{$code[0]['problem_id']}
                    </a>
                    {else /}
                    <span>-</span>
                    {/if}
                    <span class="text-muted bilingual-inline">语言<span class="en-text">Lang</span>:</span>
                    {if isset($code[0]) && isset($code[0]['language']) && isset($OJ_LANG[$code[0]['language']])}
                    <span>{$OJ_LANG[$code[0]['language']]}</span>
                    {else /}
                    <span>-</span>
                    {/if}
                </div>
            </div>
        </div>
        <div class="col-lg-6">
            <div class="border border-primary rounded p-2 bg-white">
                <div class="fw-semibold text-primary bilingual-inline">
                    之前提交
                    {if isset($code[1]) && isset($code[1]['solution_id'])} #{$code[1]['solution_id']}{else /} #-{/if}
                    <span class="en-text">Previous Submission{if isset($code[1]) && isset($code[1]['solution_id'])} #{$code[1]['solution_id']}{else /} #-{/if}</span>
                </div>
                <div class="small d-flex flex-wrap align-items-center gap-3 mt-1">
                    <span class="text-muted bilingual-inline">作者<span class="en-text">Author</span>:</span>
                    {if isset($code[1]) && isset($code[1]['user_id'])}
                    <a href="{$userInfoUrl}{$code[1]['user_id']}" target="_blank" class="text-decoration-underline">
                        <i class="bi bi-person-fill me-1"></i>{$code[1]['user_id']}
                    </a>
                    {else /}
                    <span>-</span>
                    {/if}
                    <span class="text-muted bilingual-inline">题目<span class="en-text">Problem</span>:</span>
                    {if isset($code[1]) && isset($code[1]['problem_id'])}
                    <a href="__OJ__/problemset/problem?pid={$code[1]['problem_id']}" target="_blank" class="text-decoration-underline">
                        <i class="bi bi-file-code me-1"></i>{$code[1]['problem_id']}
                    </a>
                    {else /}
                    <span>-</span>
                    {/if}
                    <span class="text-muted bilingual-inline">语言<span class="en-text">Lang</span>:</span>
                    {if isset($code[1]) && isset($code[1]['language']) && isset($OJ_LANG[$code[1]['language']])}
                    <span>{$OJ_LANG[$code[1]['language']]}</span>
                    {else /}
                    <span>-</span>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <!-- Monaco Diff -->
    <div class="code-compare-v2 mb-3" id="code_compare_v2">
        <div class="monaco-container" id="monaco_diff_container"></div>
    </div>

    <!-- 隐藏源码（Monaco model source） -->
    <div style="display:none;">
        {for start="0" end="2"}
        <pre id="code_compare_hidden_{$i}">{if isset($code[$i]) && isset($code[$i]['source'])}{$code[$i]['source']}{/if}</pre>
        {/for}
    </div>
</div>

<script type="text/javascript">
    var code_compare_hidden_0 = $('#code_compare_hidden_0');
    var code_compare_hidden_1 = $('#code_compare_hidden_1');
    var diff_num = $('#diff_num');
    var comparing_label = $('#comparing_label');

    function toMonacoLang(name) {
        name = String(name || '').toLowerCase();
        if (name.includes('c++') || name.includes('cpp')) return 'cpp';
        if (name === 'c' || name.includes(' c ')) return 'c';
        if (name.includes('java')) return 'java';
        if (name.includes('python')) return 'python';
        if (name.includes('go')) return 'go';
        if (name.includes('javascript') || name.includes('js')) return 'javascript';
        return 'plaintext';
    }

    function loadMonaco(cb) {
        // Monaco-only: no fallback. If blocked, show error.
        var loaderUrl = 'https://fastly.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
        var s = document.createElement('script');
        s.src = loaderUrl;
        s.async = true;
        s.onload = function() {
            window.require.config({ paths: { 'vs': 'https://fastly.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
            window.require(['vs/editor/editor.main'], function() { cb(null); });
        };
        s.onerror = function() { cb(new Error('monaco loader failed')); };
        document.head.appendChild(s);
    }

    $(document).ready(function() {
        comparing_label.show();

        loadMonaco(function(err) {
            if (err || !window.monaco || !window.monaco.editor) {
                comparing_label.hide();
                $('#monaco_error').show();
                $('#code_compare_v2').hide();
                return;
            }

            var monaco = window.monaco;
            var settingsKey = 'code_compare_v2_settings';
            var settings = { sideBySide: true, ignoreWhitespace: true, wordWrap: false, dark: false };
            try {
                var raw = localStorage.getItem(settingsKey);
                if (raw) settings = Object.assign(settings, JSON.parse(raw));
            } catch (e) {}

            $('#optSideBySide').prop('checked', !!settings.sideBySide);
            $('#optIgnoreWhitespace').prop('checked', !!settings.ignoreWhitespace);
            $('#optWordWrap').prop('checked', !!settings.wordWrap);
            $('#optThemeDark').prop('checked', !!settings.dark);

            function persist() {
                try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch (e) {}
            }

            monaco.editor.setTheme(settings.dark ? 'vs-dark' : 'vs');

            // Language mapping (from backend sl.language -> config OJ_LANGUAGE)
            var OJ_LANG = <?php echo json_encode(config('CsgojConfig.OJ_LANGUAGE'), JSON_UNESCAPED_UNICODE); ?>;
            var lang0 = (OJ_LANG && typeof OJ_LANG[<?php echo isset($code[0]['language']) ? intval($code[0]['language']) : -1; ?>] !== 'undefined')
                ? OJ_LANG[<?php echo isset($code[0]['language']) ? intval($code[0]['language']) : -1; ?>] : '';
            var lang1 = (OJ_LANG && typeof OJ_LANG[<?php echo isset($code[1]['language']) ? intval($code[1]['language']) : -1; ?>] !== 'undefined')
                ? OJ_LANG[<?php echo isset($code[1]['language']) ? intval($code[1]['language']) : -1; ?>] : '';

            // 与上方标题一致：左侧=新提交(code[0])，右侧=之前提交(code[1])。Monaco 的 original=左，modified=右
            var originalText = code_compare_hidden_0.text();
            var modifiedText = code_compare_hidden_1.text();

            var originalModel = monaco.editor.createModel(originalText, toMonacoLang(lang0));
            var modifiedModel = monaco.editor.createModel(modifiedText, toMonacoLang(lang1));

            var container = document.getElementById('monaco_diff_container');
            if (!container) {
                comparing_label.hide();
                $('#monaco_error').show();
                return;
            }

            var diffEditor = monaco.editor.createDiffEditor(container, {
                readOnly: true,
                renderSideBySide: !!settings.sideBySide,
                ignoreTrimWhitespace: !!settings.ignoreWhitespace,
                wordWrap: settings.wordWrap ? 'on' : 'off',
                automaticLayout: true,
                renderOverviewRuler: true,
                enableSplitViewResizing: true,
                minimap: { enabled: false },
            });
            diffEditor.setModel({ original: originalModel, modified: modifiedModel });

            // Monaco 某些构建/版本不存在 monaco.editor.createDiffNavigator，这里不依赖它，手写跳转逻辑
            var lineChanges = [];
            var changeIdx = -1;

            function rebuildChanges() {
                try {
                    lineChanges = diffEditor.getLineChanges() || [];
                } catch (e) {
                    lineChanges = [];
                }
                changeIdx = lineChanges.length ? 0 : -1;
                $('#btnPrevDiff').prop('disabled', lineChanges.length === 0);
                $('#btnNextDiff').prop('disabled', lineChanges.length === 0);
            }

            function gotoChange(idx) {
                if (!lineChanges || lineChanges.length === 0) return;
                idx = Math.max(0, Math.min(lineChanges.length - 1, idx));
                changeIdx = idx;
                var c = lineChanges[changeIdx] || {};
                var line = c.modifiedStartLineNumber || c.modifiedEndLineNumber || 1;
                try {
                    var ed = diffEditor.getModifiedEditor();
                    ed.revealLineInCenter(line);
                    ed.setPosition({ lineNumber: line, column: 1 });
                    ed.focus();
                } catch (e) {}
            }

            $('#btnPrevDiff').off('click').on('click', function(){ gotoChange(changeIdx - 1); });
            $('#btnNextDiff').off('click').on('click', function(){ gotoChange(changeIdx + 1); });

            function refreshCount() {
                try {
                    var changes = diffEditor.getLineChanges() || [];
                    diff_num.text(changes.length);
                } catch (e) {
                    diff_num.text('-');
                }
            }
            refreshCount();
            rebuildChanges();
            setTimeout(function(){ refreshCount(); rebuildChanges(); }, 200);

            function applyOpts() {
                settings.sideBySide = $('#optSideBySide').prop('checked');
                settings.ignoreWhitespace = $('#optIgnoreWhitespace').prop('checked');
                settings.wordWrap = $('#optWordWrap').prop('checked');
                settings.dark = $('#optThemeDark').prop('checked');
                persist();
                monaco.editor.setTheme(settings.dark ? 'vs-dark' : 'vs');
                diffEditor.updateOptions({
                    renderSideBySide: !!settings.sideBySide,
                    ignoreTrimWhitespace: !!settings.ignoreWhitespace,
                    wordWrap: settings.wordWrap ? 'on' : 'off',
                });
                setTimeout(function(){ refreshCount(); rebuildChanges(); }, 80);
            }
            $('#optSideBySide,#optIgnoreWhitespace,#optWordWrap,#optThemeDark').off('change').on('change', applyOpts);

            comparing_label.hide();
        });
    });
</script>

{css href="__STATIC__/csgoj/status/status_code_compare_v2.css" /}
<style type="text/css">
    #settings {
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: blur(10px);
        background-color: rgba(248, 249, 250, 0.95) !important;
    }
    #comparing_label {
        min-width: 200px;
        text-align: center;
    }
</style>


