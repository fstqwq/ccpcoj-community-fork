/**
 * 比赛页右上角浮动面板：拖拽与位置持久化（Pointer Events）
 * 依赖 window.csg.store / DelStore（可选，无则降级 localStorage）
 */
(function (global) {
    'use strict';

    function storeKey(contestId, panelId) {
        return `contest_float_${panelId}_${contestId}`;
    }

    function load(contestId, panelId) {
        if (!contestId || !panelId) return null;
        const k = storeKey(contestId, panelId);
        let raw = null;
        try {
            if (global.csg && typeof global.csg.store === 'function') {
                raw = global.csg.store(k);
            } else {
                const s = localStorage.getItem(k);
                if (s) raw = JSON.parse(s);
            }
        } catch (e) {
            return null;
        }
        if (!raw || typeof raw !== 'object') return null;
        const left = Number(raw.left);
        const top = Number(raw.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
        return { left, top };
    }

    function save(contestId, panelId, pos) {
        if (!contestId || !panelId || !pos) return;
        const k = storeKey(contestId, panelId);
        if (global.csg && typeof global.csg.store === 'function') {
            global.csg.store(k, { left: pos.left, top: pos.top });
        } else {
            try {
                localStorage.setItem(k, JSON.stringify({ left: pos.left, top: pos.top }));
            } catch (e) {}
        }
    }

    function clear(contestId, panelId) {
        if (!contestId || !panelId) return;
        const k = storeKey(contestId, panelId);
        if (global.csg && typeof global.csg.DelStore === 'function') {
            global.csg.DelStore(k);
        } else {
            try {
                localStorage.removeItem(k);
            } catch (e) {}
        }
    }

    function clampPanel(panel, pos) {
        const rect = panel.getBoundingClientRect();
        const pw = Math.max(rect.width || panel.offsetWidth || 200, 100);
        const ph = Math.max(rect.height || panel.offsetHeight || 80, 48);
        return clampPanelOuterSize(pw, ph, pos);
    }

    /**
     * 仅用外接宽高钳制（不读布局），拖拽中每帧调用可避免对「重面板」强制同步布局。
     * @param {number} pw
     * @param {number} ph
     */
    function clampPanelOuterSize(pw, ph, pos) {
        const m = 4;
        const w = global.innerWidth;
        const h = global.innerHeight;
        const pww = Math.max(pw, 100);
        const phh = Math.max(ph, 48);
        return {
            left: Math.min(Math.max(m, pos.left), w - pww - m),
            top: Math.min(Math.max(m, pos.top), h - phh - m),
        };
    }

    /** 写入 fixed + left/top（调用方保证坐标已钳制或接受 applyFixed） */
    function setPanelFixedPosition(panel, left, top) {
        if (!panel) return;
        panel.style.setProperty('position', 'fixed', 'important');
        panel.style.setProperty('transform', 'none', 'important');
        panel.style.removeProperty('right');
        panel.style.setProperty('right', 'auto', 'important');
        panel.style.setProperty('left', `${left}px`, 'important');
        panel.style.setProperty('top', `${top}px`, 'important');
    }

    /** @returns {{ left: number, top: number }} 钳制后的坐标 */
    function applyFixed(panel, pos) {
        if (!panel || !pos) return pos;
        const p = clampPanel(panel, pos);
        setPanelFixedPosition(panel, p.left, p.top);
        return p;
    }

    function isDragIgnoreTarget(t) {
        return !!(t && t.closest && t.closest(
            'button, a, input, textarea, select, [data-bs-toggle], [data-bs-dismiss], label'
        ));
    }

    /**
     * @param {object} opts
     * @param {HTMLElement} opts.panel
     * @param {HTMLElement} opts.handle
     * @param {string} opts.contestId
     * @param {string} opts.panelId
     * @param {() => boolean} opts.isExpanded
     * @param {(pos: {left:number,top:number}|null) => void} opts.onPositionCommit
     */
    function attachDrag(opts) {
        const { panel, handle, contestId, panelId, isExpanded, onPositionCommit } = opts;
        if (!panel || !handle || !contestId || !panelId || typeof onPositionCommit !== 'function') return;

        let active = false;
        let capId = null;
        let base = { x: 0, y: 0, left: 0, top: 0 };
        /** pointerdown 时面板尺寸，供拖拽中钳制且无每帧强制布局 */
        let dragPw = 0;
        let dragPh = 0;
        let moveRaf = null;
        /** @type {PointerEvent|null} */
        let pendingMove = null;

        function finishBodyChrome() {
            global.document.body.style.userSelect = '';
        }

        function cancelMoveRaf() {
            if (moveRaf != null) {
                global.cancelAnimationFrame(moveRaf);
                moveRaf = null;
            }
        }

        function flushPendingMove() {
            moveRaf = null;
            if (!active || !pendingMove || pendingMove.pointerId !== capId) {
                pendingMove = null;
                return;
            }
            const e = pendingMove;
            pendingMove = null;
            const dx = e.clientX - base.x;
            const dy = e.clientY - base.y;
            const raw = { left: base.left + dx, top: base.top + dy };
            const next = clampPanelOuterSize(dragPw, dragPh, raw);
            setPanelFixedPosition(panel, next.left, next.top);
        }

        handle.addEventListener('pointerdown', (e) => {
            if (!isExpanded()) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (isDragIgnoreTarget(e.target)) return;
            e.preventDefault();
            cancelMoveRaf();
            active = true;
            capId = e.pointerId;
            const r = panel.getBoundingClientRect();
            dragPw = Math.max(r.width || panel.offsetWidth || 100, 100);
            dragPh = Math.max(r.height || panel.offsetHeight || 48, 48);
            base = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
            /* 队伍面板等：若开场动画未结束就拖拽，须在拖前卸下入场类，否则松手后 .show 会重新播 from{opacity:0} */
            panel.classList.remove('team-info-panel-intro');
            panel.classList.add('contest-float-panel-dragging');
            try {
                handle.setPointerCapture(e.pointerId);
            } catch (err) {}
            global.document.body.style.userSelect = 'none';
        });

        handle.addEventListener('pointermove', (e) => {
            if (!active || e.pointerId !== capId) return;
            pendingMove = e;
            if (moveRaf != null) return;
            moveRaf = global.requestAnimationFrame(flushPendingMove);
        });

        handle.addEventListener('pointerup', (e) => {
            if (!active || e.pointerId !== capId) return;
            cancelMoveRaf();
            /* 结束前把最后一帧 pending 移到 DOM，避免松开时跳过一格 */
            if (pendingMove && pendingMove.pointerId === capId) {
                const ee = pendingMove;
                pendingMove = null;
                const dx = ee.clientX - base.x;
                const dy = ee.clientY - base.y;
                const next = clampPanelOuterSize(dragPw, dragPh, {
                    left: base.left + dx,
                    top: base.top + dy,
                });
                setPanelFixedPosition(panel, next.left, next.top);
            }
            try {
                handle.releasePointerCapture(e.pointerId);
            } catch (err) {}
            const r = panel.getBoundingClientRect();
            const pos = clampPanel(panel, { left: r.left, top: r.top });
            setPanelFixedPosition(panel, pos.left, pos.top);
            panel.classList.remove('contest-float-panel-dragging');
            save(contestId, panelId, pos);
            onPositionCommit(pos);
            active = false;
            capId = null;
            finishBodyChrome();
        });

        handle.addEventListener('pointercancel', (e) => {
            if (!active || e.pointerId !== capId) return;
            cancelMoveRaf();
            panel.classList.remove('contest-float-panel-dragging');
            active = false;
            capId = null;
            finishBodyChrome();
        });

        handle.addEventListener('lostpointercapture', () => {
            cancelMoveRaf();
            panel.classList.remove('contest-float-panel-dragging');
            finishBodyChrome();
            active = false;
            capId = null;
        });

        handle.addEventListener('dblclick', (e) => {
            if (!isExpanded()) return;
            if (isDragIgnoreTarget(e.target)) return;
            e.preventDefault();
            cancelMoveRaf();
            pendingMove = null;
            panel.classList.remove('contest-float-panel-dragging');
            clear(contestId, panelId);
            onPositionCommit(null);
        });
    }

    global.ContestFloatingPanel = {
        storeKey,
        load,
        save,
        clear,
        clampPanel,
        clampPanelOuterSize,
        applyFixed,
        attachDrag,
    };
})(typeof window !== 'undefined' ? window : globalThis);
