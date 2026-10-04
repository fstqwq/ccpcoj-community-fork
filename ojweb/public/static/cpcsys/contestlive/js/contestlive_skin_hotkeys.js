/**
 * 投屏页：固定快捷键换肤（所有单页投屏均加载本文件）
 * [ 下一套皮肤（写入 localStorage 临时覆盖 contestlive_skin_hotkey）
 * ] 恢复为已保存设定（清除换肤临时覆盖后按 URL ?skin= / 控制台 live_display / 本机旧版 LS 解析），并调用本页 ContestlivePageLayoutResetters[page]：将快捷键改动的布局恢复默认且写回 localStorage（如 live_timer 的 H/S/字号/M/T、live_ac 顶栏与时间模式等）
 * G 从服务器拉取当前 live_display 并应用（与控制台保存后无需整页刷新一致；会清除校徽墙布局 `,` 临时键）
 * 依赖：contestlive_skin_common.js、csg.ajax（global_head）
 */
(function () {
    var w = window;
    var L = w.ContestliveSkinLib;
    if (!L) {
        return;
    }
    var sc = document.getElementById('contestlive-skin-boot');
    var page = (sc && sc.getAttribute('data-contestlive-page')) || 'live';

    var SKIN_LABEL_CN = { default: '默认', dark_stage: '暗色', light_macaron: '明亮' };

    function isTypingTarget(el) {
        if (!el || !el.tagName) {
            return false;
        }
        var t = el.tagName;
        if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') {
            return true;
        }
        if (el.isContentEditable) {
            return true;
        }
        return false;
    }

    function flashPullToast(skin) {
        var prev = document.querySelector('.contestlive-skin-sync-toast');
        if (prev && prev.parentNode) {
            prev.parentNode.removeChild(prev);
        }
        var n = document.createElement('div');
        n.className = 'contestlive-skin-sync-toast';
        n.setAttribute('role', 'status');
        if (skin) {
            n.innerHTML =
                '<span class="cn-text d-block">已与服务器同步外观（' +
                (SKIN_LABEL_CN[skin] || skin) +
                '）</span><span class="en-text d-block small">Appearance synced from server.</span>';
        } else {
            n.innerHTML =
                '<span class="cn-text d-block">未能从服务器拉取外观配置</span><span class="en-text d-block small">Could not load display config from server.</span>';
        }
        document.body.appendChild(n);
        setTimeout(function () {
            if (n.parentNode) {
                n.parentNode.removeChild(n);
            }
        }, 2600);
    }

    document.addEventListener(
        'keydown',
        function (ev) {
            if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey) {
                return;
            }
            if (isTypingTarget(ev.target)) {
                return;
            }
            var k = ev.key;
            if (k === 'g' || k === 'G') {
                if (typeof L.pullLiveDisplayConfigFromServerThenApply !== 'function') {
                    return;
                }
                ev.preventDefault();
                ev.stopPropagation();
                L.pullLiveDisplayConfigFromServerThenApply()
                    .then(function (res) {
                        flashPullToast(res && res.skin ? res.skin : null);
                    })
                    .catch(function () {
                        flashPullToast(null);
                    });
                return;
            }
            var openBracket = k === '[' || ev.code === 'BracketLeft';
            var closeBracket = k === ']' || ev.code === 'BracketRight';
            if (!openBracket && !closeBracket) {
                return;
            }
            ev.preventDefault();
            if (openBracket) {
                L.cycleSkinHotkey(page);
            } else {
                L.resetSkinHotkey(page);
                try {
                    var R = w.ContestlivePageLayoutResetters;
                    if (R && typeof R[page] === 'function') {
                        R[page]();
                    }
                } catch (eR) {
                    /* ignore */
                }
                try {
                    var de = document.documentElement;
                    if (
                        de &&
                        de.classList &&
                        de.classList.contains('contestlive-spa-html') &&
                        typeof w.ContestliveSpaViewportScaleReset === 'function'
                    ) {
                        w.ContestliveSpaViewportScaleReset();
                    }
                } catch (eSc) {
                    /* ignore */
                }
                try {
                    if (typeof w.ContestlivePageOpacityReset === 'function') {
                        w.ContestlivePageOpacityReset();
                    }
                } catch (ePo) {
                    /* ignore */
                }
            }
        },
        true
    );
})();
