/**
 * 提交页 #source：Tab / Shift+Tab 缩进；拖入文本文件填入（类型与大小校验）。
 * Tab 修改优先 document.execCommand('insertText')，便于 Ctrl+Z / Ctrl+Y（或 Ctrl+Shift+Z）。
 */
(function () {
    'use strict';

    var STEP = '    ';
    var STEP_LEN = STEP.length;
    /** 与 submit_pro_form 中 source maxlength 校验一致 */
    var SOURCE_MAX_CHARS = 65536;

    var TEXT_EXT =
        /\.(txt|md|c|cc|cpp|cxx|h|hpp|hxx|hh|java|py|pyw|go|rs|js|mjs|cjs|ts|tsx|jsx|css|scss|less|html|htm|xhtml|xml|json|yml|yaml|sh|bash|zsh|bat|cmd|ps1|vb|cs|fs|fsx|clj|scala|kt|kts|swift|pl|pm|lua|sql|tex|pas|pp|zig|nim|ml|mli|hs|lhs|rb|php|phps|ini|toml|cfg|conf|properties|gradle|sbt|mk|cmake|proto|vue|svelte|asm|s|i|r)$/i;

    function knownPlainTextBasename(name) {
        var base = (name || '').split(/[/\\]/).pop() || '';
        if (/^(dockerfile|makefile|gemfile|jenkinsfile|vagrantfile|cmakelists\.txt)$/i.test(base)) return true;
        if (/^(\.gitignore|\.dockerignore|\.editorconfig)$/i.test(base)) return true;
        return false;
    }

    function isTabKey(e) {
        return e.key === 'Tab' || e.code === 'Tab' || e.keyCode === 9;
    }

    function lineStart(str, index) {
        var i = str.lastIndexOf('\n', index - 1);
        return i < 0 ? 0 : i + 1;
    }

    function lineContentEnd(str, pos) {
        if (pos < 0) pos = 0;
        if (pos >= str.length) return str.length;
        var nl = str.indexOf('\n', pos);
        return nl < 0 ? str.length : nl;
    }

    function selectionHasNewline(str, a, b) {
        var lo = Math.min(a, b);
        var hi = Math.max(a, b);
        return str.slice(lo, hi).indexOf('\n') >= 0;
    }

    function outdentLineStart(line) {
        if (!line.length) return line;
        if (line.charCodeAt(0) === 9) return line.slice(1);
        var n = 0;
        while (n < STEP_LEN && n < line.length && line.charCodeAt(n) === 32) n++;
        return line.slice(n);
    }

    function replaceRangeUndoable(ta, from, to, newText) {
        ta.focus();
        ta.setSelectionRange(from, to);
        try {
            if (document.execCommand('insertText', false, newText)) {
                return;
            }
        } catch (err) {
            /* ignore */
        }
        var str = ta.value;
        ta.value = str.slice(0, from) + newText + str.slice(to);
        var caret = from + newText.length;
        ta.setSelectionRange(caret, caret);
    }

    function errDrop(msg, msgEn) {
        if (typeof alerty !== 'undefined' && alerty.error) {
            alerty.error({ message: msg, message_en: msgEn });
        }
    }

    /** 浏览器报告的 MIME + 扩展名：仅允许当作文本读入的类型 */
    function isTextLikeFile(file) {
        var t = (file.type || '').toLowerCase().trim();
        if (t.indexOf('text/') === 0) return true;
        if (
            t === 'application/json' ||
            t === 'application/xml' ||
            t === 'application/xhtml+xml' ||
            t === 'application/javascript' ||
            t === 'application/ecmascript' ||
            t === 'application/sql' ||
            t === 'application/x-sh' ||
            t === 'application/x-csh' ||
            t === 'application/x-httpd-php' ||
            t === 'application/x-php' ||
            t === 'application/x-java-source' ||
            t === 'application/x-python-code' ||
            t === 'application/x-ruby' ||
            t === 'application/x-lua' ||
            t === 'application/x-perl'
        ) {
            return true;
        }
        if (t.indexOf('image/') === 0 || t.indexOf('audio/') === 0 || t.indexOf('video/') === 0) return false;
        if (t === 'application/pdf' || t === 'application/zip' || t === 'application/x-zip-compressed') return false;
        if (t === '' || t === 'application/octet-stream') {
            return knownPlainTextBasename(file.name) || TEXT_EXT.test(file.name || '');
        }
        if (t.indexOf('application/') === 0) return false;
        return false;
    }

    function bindFileDrop(ta) {
        var zone = ta.closest('.mb-3');
        if (!zone) zone = ta;

        function hasFilesInTransfer(dt) {
            if (!dt || !dt.types || !dt.types.length) return false;
            for (var i = 0; i < dt.types.length; i++) {
                if (dt.types[i] === 'Files') return true;
            }
            return false;
        }

        function onDragOver(e) {
            if (!hasFilesInTransfer(e.dataTransfer)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }

        function onDrop(e) {
            if (!e.dataTransfer || !e.dataTransfer.files) return;
            e.preventDefault();
            e.stopPropagation();
            var files = e.dataTransfer.files;
            if (!files.length) return;
            if (files.length > 1) {
                errDrop('一次仅支持拖入一个文件', 'Only one file per drop');
                return;
            }
            var file = files[0];
            if (!isTextLikeFile(file)) {
                errDrop('仅支持文本类源码文件（如 .c / .cpp / .py / .txt 等）', 'Only plain-text source files (e.g. .c, .cpp, .py, .txt)');
                return;
            }
            if (file.size > SOURCE_MAX_CHARS) {
                errDrop(
                    '文件过大（≤ ' + SOURCE_MAX_CHARS + ' 字节），与提交页代码长度上限一致',
                    'File too large (max ' + SOURCE_MAX_CHARS + ' bytes), same limit as submit page'
                );
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                var text = reader.result;
                if (typeof text !== 'string') {
                    errDrop('无法读取为文本', 'Could not read as text');
                    return;
                }
                if (text.indexOf('\u0000') !== -1) {
                    errDrop('文件内容不是可显示的文本', 'File is not displayable text');
                    return;
                }
                if (text.length > SOURCE_MAX_CHARS) {
                    errDrop(
                        '文本长度超过上限（≤ ' + SOURCE_MAX_CHARS + ' 字符）',
                        'Text exceeds max length (' + SOURCE_MAX_CHARS + ' characters)'
                    );
                    return;
                }
                ta.focus();
                ta.value = text;
                ta.setSelectionRange(text.length, text.length);
            };
            reader.onerror = function () {
                errDrop('读取文件失败', 'Failed to read file');
            };
            reader.readAsText(file, 'UTF-8');
        }

        zone.addEventListener('dragover', onDragOver);
        zone.addEventListener('drop', onDrop);
    }

    function bind() {
        var ta = document.getElementById('source');
        if (!ta || ta.getAttribute('data-source-bound') === '1') return;
        ta.setAttribute('data-source-bound', '1');

        ta.addEventListener(
            'keydown',
            function (e) {
                if (!isTabKey(e) || e.ctrlKey || e.altKey || e.metaKey) return;
                e.preventDefault();
                e.stopPropagation();

                var str = ta.value;
                var start = ta.selectionStart;
                var end = ta.selectionEnd;
                var outdent = e.shiftKey === true;
                var a = Math.min(start, end);
                var b = Math.max(start, end);

                if (!selectionHasNewline(str, start, end)) {
                    var ls = lineStart(str, a);
                    var le = lineContentEnd(str, a);
                    var line = str.slice(ls, le);
                    if (outdent) {
                        var nl = outdentLineStart(line);
                        if (nl === line) return;
                        var delta = line.length - nl.length;
                        replaceRangeUndoable(ta, ls, le, nl);
                        ta.setSelectionRange(
                            Math.max(ls, start - delta),
                            Math.max(Math.max(ls, start - delta), end - delta)
                        );
                        return;
                    }
                    replaceRangeUndoable(ta, start, end, STEP);
                    return;
                }

                var from = lineStart(str, a);
                var blockEnd = b;
                if (blockEnd > 0 && str.charCodeAt(blockEnd - 1) !== 10) {
                    while (blockEnd < str.length && str.charCodeAt(blockEnd) !== 10) blockEnd++;
                }
                var block = str.slice(from, blockEnd);
                var lines = block.split('\n');
                var endsWithNl = block.length > 0 && str.charCodeAt(blockEnd - 1) === 10;
                var nextLines = lines.map(function (ln, i) {
                    if (outdent) return outdentLineStart(ln);
                    if (ln === '' && i === lines.length - 1 && endsWithNl) return '';
                    return STEP + ln;
                });
                var replacement = nextLines.join('\n');
                replaceRangeUndoable(ta, from, blockEnd, replacement);
                ta.setSelectionRange(from, from + replacement.length);
            },
            true
        );

        bindFileDrop(ta);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
