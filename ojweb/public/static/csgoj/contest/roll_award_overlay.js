/**
 * 滚榜「队伍获奖」全屏 overlay：仅负责挂载 DOM、与榜单同皮肤、渐显/渐隐。
 * 内容与布局由 rank_roll.js 填充 #award-* 节点（全屏 overlay，勿用 modal-content / modal-overlay）。
 *
 * 依赖：rank_tool.js（RankToolEscapeHtml；校徽预处理与 `LoadAwardSchoolLogo` 同源的 `RankTool*` API）
 *
 * 详情区信息对齐：`RollAwardOverlay.configure({ infoAlign: 'center' | 'start' })`（默认 `center`），
 * 同步到根节点 `data-roa-info-align`，样式见 `roll_award_overlay.css`（`start` 为历史左对齐信息）。
 */
(function (global) {
    'use strict';

    var OVERLAY_ID = 'csg-roll-award-overlay';

    var state = {
        root: null,
        fadeInMs: 720,
        fadeOutMs: 540,
        /** @type {'center'|'start'} */
        infoAlign: 'center',
        onBackdrop: null,
        getMountParent: null,
        hideTimer: null,
        backdropBound: false
    };

    function clearHideTimer() {
        if (state.hideTimer) {
            clearTimeout(state.hideTimer);
            state.hideTimer = null;
        }
    }

    function resolveMountParent() {
        if (typeof state.getMountParent === 'function') {
            try {
                var p = state.getMountParent();
                if (p && p.nodeType === 1) return p;
            } catch (e) {
                /* ignore */
            }
        }
        var fs =
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement;
        if (fs && fs !== document.documentElement) return fs;
        var rc = document.getElementById('rank-container');
        if (rc) return rc;
        return document.body;
    }

    function attachToMountParent(root) {
        if (!root) return;
        var parent = resolveMountParent();
        if (!parent) return;
        if (root.parentNode !== parent) {
            parent.appendChild(root);
        }
    }

    function syncRankSkin(root) {
        var rs = root.closest('.rank-system');
        var sk = rs && rs.getAttribute('data-rank-skin');
        root.setAttribute('data-rank-skin', sk || 'default');
    }

    function normalizeInfoAlign(v) {
        if (v === 'start' || v === 'center') {
            return v;
        }
        return 'center';
    }

    function syncInfoAlign(root) {
        if (!root) {
            return;
        }
        root.setAttribute('data-roa-info-align', normalizeInfoAlign(state.infoAlign));
    }

    function buildInnerHtml() {
        return (
            '<div class="csg-roa__veil" data-csg-roa-veil="1" aria-hidden="true"></div>' +
            '<div class="csg-roa__stage">' +
            '  <div class="csg-roa__scale">' +
            '    <div class="award-main-content">' +
            '        <div class="award-photo-column">' +
            '          <div class="award-photo-section">' +
            '            <div class="award-photo-frame">' +
            '              <div class="award-photo-wrapper">' +
            '                <img id="award-team-photo" src="" alt="" style="display:none">' +
            '                <div id="award-photo-placeholder" class="award-photo-placeholder"></div>' +
            '              </div>' +
            '            </div>' +
            '          </div>' +
            '        </div>' +
            '        <div class="award-right-column">' +
            '        <div class="award-details-section">' +
            '          <div class="award-details-card">' +
            '            <div class="award-school-badge-layer" aria-hidden="true">' +
            '              <div id="award-school-logo" class="award-school-logo-bg" data-school=""></div>' +
            '              <div class="award-school-badge-veil"></div>' +
            '            </div>' +
            '            <div class="award-details-card__surface">' +
            '            <div class="award-info-section award-info-section--fixed">' +
            '              <div class="award-roa-block award-roa-block--school">' +
            '                <div id="award-lbl-school" class="award-roa-label"></div>' +
            '                <div class="award-school-line">' +
            '                  <div id="award-school" class="award-school-text"></div>' +
            '                </div>' +
            '              </div>' +
            '              <div class="award-roa-block">' +
            '                <div id="award-lbl-team" class="award-roa-label"></div>' +
            '                <div id="award-team-name" class="award-roa-value-slot"></div>' +
            '              </div>' +
            '              <div class="award-roa-block" id="award-team-en-row">' +
            '                <div id="award-lbl-team-en" class="award-roa-label"></div>' +
            '                <div id="award-team-en" class="award-roa-value-slot"></div>' +
            '              </div>' +
            '              <div class="award-roa-block" id="award-members-row">' +
            '                <div id="award-lbl-members" class="award-roa-label"></div>' +
            '                <div id="award-members" class="award-roa-value-slot"></div>' +
            '              </div>' +
            '              <div class="award-roa-block" id="award-coach-row">' +
            '                <div id="award-lbl-coach" class="award-roa-label"></div>' +
            '                <div id="award-coach" class="award-roa-value-slot"></div>' +
            '              </div>' +
            '            </div>' +
            '            <div class="award-group-panel" id="award-group-panel" hidden>' +
            '              <div id="award-lbl-groups" class="award-roa-label award-roa-label--groups"></div>' +
            '              <div id="award-group-scrollport" class="award-group-scrollport">' +
            '                <div id="award-group-rotator" class="award-group-rotator"></div>' +
            '              </div>' +
            '            </div>' +
            '            </div>' +
            '          </div>' +
            '        </div>' +
            '          <div class="award-stats-container award-stats-dock award-stats-under-photo">' +
            '            <div class="award-stats-triple">' +
            '              <div class="award-stat-cell">' +
            '                <div class="award-stat-label-col">' +
            '                  <span id="award-lbl-rank-cn" class="award-stat-lbl-cn"></span>' +
            '                  <span id="award-lbl-rank-en" class="award-stat-lbl-en"></span>' +
            '                </div>' +
            '                <div id="award-rank" class="award-stat-value-big">-</div>' +
            '              </div>' +
            '              <div class="award-stat-cell">' +
            '                <div class="award-stat-label-col">' +
            '                  <span id="award-lbl-solved-cn" class="award-stat-lbl-cn"></span>' +
            '                  <span id="award-lbl-solved-en" class="award-stat-lbl-en"></span>' +
            '                </div>' +
            '                <div id="award-solved" class="award-stat-value-big">-</div>' +
            '              </div>' +
            '              <div id="award-fb-stat-cell" class="award-stat-cell award-stat-cell--fb">' +
            '                <div class="award-stat-label-col">' +
            '                  <span id="award-lbl-fb-cn" class="award-stat-lbl-cn"></span>' +
            '                  <span id="award-lbl-fb-en" class="award-stat-lbl-en"></span>' +
            '                </div>' +
            '                <div id="award-first-blood" class="award-stat-value-big award-stat-value-fb"></div>' +
            '              </div>' +
            '            </div>' +
            '          </div>' +
            '        </div>' +
            '        </div>' +
            '    </div>' +
            '  </div>' +
            '</div>'
        );
    }

    function ensureTemplate() {
        if (state.root && document.documentElement.contains(state.root)) {
            attachToMountParent(state.root);
            syncInfoAlign(state.root);
            return state.root;
        }
        var el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.className = 'csg-roa';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('data-rank-skin', 'default');
        el.style.display = 'none';
        el.innerHTML = buildInnerHtml();
        state.root = el;
        attachToMountParent(el);
        bindBackdropOnce(el);
        syncInfoAlign(el);
        return el;
    }

    function bindBackdropOnce(root) {
        if (state.backdropBound) return;
        state.backdropBound = true;
        root.addEventListener('click', function (e) {
            if (e.target === root || (e.target && e.target.getAttribute && e.target.getAttribute('data-csg-roa-veil') === '1')) {
                if (typeof state.onBackdrop === 'function') {
                    state.onBackdrop();
                }
            }
        });
    }

    /**
     * 创建/挂载 overlay DOM（仍隐藏），供 rank_roll 写入 #award-* 后再 present()
     */
    function ensureReady() {
        var root = ensureTemplate();
        attachToMountParent(root);
        syncRankSkin(root);
        syncInfoAlign(root);
        return root;
    }

    /**
     * 渐显（rank_roll 须在调用前写完内容）
     */
    function present() {
        var root = ensureTemplate();
        attachToMountParent(root);
        syncRankSkin(root);
        syncInfoAlign(root);
        clearHideTimer();
        root.classList.remove('csg-roa--out');
        root.classList.remove('csg-roa--in');
        root.style.setProperty('--csg-roa-fi', state.fadeInMs + 'ms');
        root.style.setProperty('--csg-roa-fo', state.fadeOutMs + 'ms');
        root.style.display = 'flex';
        root.setAttribute('aria-hidden', 'false');
        void root.offsetWidth;
        requestAnimationFrame(function () {
            root.classList.add('csg-roa--in');
        });
    }

    function hide() {
        var root = state.root;
        if (!root || root.style.display === 'none') return;
        clearHideTimer();
        root.classList.remove('csg-roa--in');
        root.classList.add('csg-roa--out');
        var ms = state.fadeOutMs;
        state.hideTimer = setTimeout(function () {
            root.style.display = 'none';
            root.classList.remove('csg-roa--out');
            root.classList.remove('csg-roa--in');
            root.setAttribute('aria-hidden', 'true');
            var img = root.querySelector('#award-team-photo');
            if (img) {
                img.onload = null;
                img.onerror = null;
                img.removeAttribute('src');
            }
        }, ms);
    }

    function isOpen() {
        var root = state.root;
        return !!(root && root.style.display === 'flex');
    }

    function getRoot() {
        return state.root || document.getElementById(OVERLAY_ID);
    }

    /**
     * @param {Object} opt
     */
    function configure(opt) {
        opt = opt || {};
        if (typeof opt.fadeInMs === 'number') state.fadeInMs = opt.fadeInMs;
        if (typeof opt.fadeOutMs === 'number') state.fadeOutMs = opt.fadeOutMs;
        if (typeof opt.onBackdrop === 'function') state.onBackdrop = opt.onBackdrop;
        if (typeof opt.getMountParent === 'function') state.getMountParent = opt.getMountParent;
        if (opt.infoAlign != null) {
            state.infoAlign = normalizeInfoAlign(opt.infoAlign);
        }
        if (state.root) {
            syncInfoAlign(state.root);
        }
    }

    function bindFullscreenReparentOnce() {
        if (state._fsReparentBound) return;
        state._fsReparentBound = true;
        var handler = function () {
            if (state.root && state.root.style.display === 'flex') {
                attachToMountParent(state.root);
                syncRankSkin(state.root);
                syncInfoAlign(state.root);
            }
        };
        document.addEventListener('fullscreenchange', handler);
        document.addEventListener('webkitfullscreenchange', handler);
        document.addEventListener('mozfullscreenchange', handler);
        document.addEventListener('MSFullscreenChange', handler);
    }
    bindFullscreenReparentOnce();

    /** @deprecated 使用 ensureReady + present；保留兼容 */
    function show() {
        present();
    }

    global.RollAwardOverlay = {
        configure: configure,
        ensureReady: ensureReady,
        present: present,
        show: show,
        hide: hide,
        isOpen: isOpen,
        getRoot: getRoot
    };
})(typeof window !== 'undefined' ? window : this);
