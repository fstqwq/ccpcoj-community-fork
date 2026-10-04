// **************************************************
// 题目导航通用功能模块（拖拽 + 展开/收起）
// 适用于考试答题页和阅卷页
// **************************************************

/**
 * 初始化题目导航的拖拽和展开/收起功能
 * @param {Object} options 配置选项
 * @param {Function} options.getStorageKey - 获取存储键的函数，接收suffix参数，返回localStorage键
 * @param {Function} options.getDefaultPosition - 获取默认位置的函数，返回 {right, top}
 * @param {Function} options.updatePosition - 更新位置的函数（可选，用于自动定位）
 */
function initQuestionNavCommon(options = {}) {
    const {
        getStorageKey,
        getDefaultPosition = () => ({ right: 20, top: 120 }),
        updatePosition = null
    } = options;

    if (!getStorageKey) {
        console.error('initQuestionNavCommon: getStorageKey is required');
        return;
    }

    const navMenu = document.getElementById('question_nav_menu');
    if (!navMenu) return;

    // 状态变量
    let navMenuUserPinned = false; // 是否使用用户自定义位置（拖动后）
    let navMenuPinnedRT = getDefaultPosition(); // 统一锚点：展开态右上角（距窗口右/上）
    let navMenuCollapsed = false;
    let navMenuLastExpandedPos = null; // 收起前的位置（即使从未拖动过，也记录自动定位的位置）

    // 工具函数
    function clampNavRT(right, top, navMenuEl) {
        const pad = 8;
        const rect = navMenuEl.getBoundingClientRect();
        const maxRight = window.innerWidth - rect.width - pad;
        const maxTop = window.innerHeight - rect.height - pad;
        const r = Math.max(pad, Math.min(maxRight, right));
        const t = Math.max(pad, Math.min(maxTop, top));
        return { right: r, top: t };
    }

    function applyNavRT(navMenuEl, right, top) {
        navMenuEl.style.left = 'auto';
        navMenuEl.style.right = `${Math.round(right)}px`;
        navMenuEl.style.top = `${Math.round(top)}px`;
        navMenuEl.style.transform = ''; // 清除transform，使用top定位
    }

    function persistNavMenuPos(right, top) {
        try {
            localStorage.setItem(getStorageKey('pos'), JSON.stringify({ 
                right, 
                top, 
                pinned: true, 
                anchor: 'rt' 
            }));
        } catch (e) {
            console.warn('Failed to persist nav menu position:', e);
        }
    }

    function clearNavMenuPos() {
        try {
            localStorage.removeItem(getStorageKey('pos'));
        } catch (e) {}
        navMenuUserPinned = false;
    }

    function persistNavCollapsedState() {
        try {
            localStorage.setItem(getStorageKey('collapsed'), navMenuCollapsed ? '1' : '0');
        } catch (e) {
            console.warn('Failed to persist nav menu collapsed state:', e);
        }
    }

    // 加载保存的状态
    function loadNavMenuState() {
        // 位置
        try {
            const raw = localStorage.getItem(getStorageKey('pos'));
            if (raw) {
                const pos = JSON.parse(raw);
                const right = Number(pos?.right);
                const top = Number(pos?.top);
                const pinned = pos?.pinned === true;
                if (Number.isFinite(right) && Number.isFinite(top) && pinned) {
                    navMenuUserPinned = true;
                    navMenuPinnedRT = clampNavRT(right, top, navMenu);
                    applyNavRT(navMenu, navMenuPinnedRT.right, navMenuPinnedRT.top);
                } else {
                    // 旧格式兼容：left/top -> 转成 right/top
                    const leftOld = Number(pos?.left);
                    const topOld = Number(pos?.top);
                    if (Number.isFinite(leftOld) && Number.isFinite(topOld)) {
                        navMenuUserPinned = true;
                        const w = navMenu.offsetWidth || 260;
                        const rightNew = Math.max(8, window.innerWidth - (leftOld + w));
                        navMenuPinnedRT = clampNavRT(rightNew, topOld, navMenu);
                        applyNavRT(navMenu, navMenuPinnedRT.right, navMenuPinnedRT.top);
                        persistNavMenuPos(navMenuPinnedRT.right, navMenuPinnedRT.top);
                    }
                }
            }
            // 如果没有保存的位置，不设置默认位置，等待 updatePosition 回调进行自动定位
            // 这样可以确保自动定位逻辑（如适配带鱼屏）能够正确执行
        } catch (e) {
            console.warn('Failed to load nav menu position:', e);
        }

        // 收起状态
        try {
            const collapsedRaw = localStorage.getItem(getStorageKey('collapsed'));
            const collapsed = collapsedRaw === '1';
            navMenuCollapsed = collapsed;
            const $navMenu = $(navMenu);
            const $btn = $('#nav_menu_toggle');
            
            // 确保按钮存在才更新图标
            if ($btn.length === 0) {
                // 按钮不存在，延迟更新（可能在 DOM 加载完成前调用）
                setTimeout(() => {
                    const $btnDelayed = $('#nav_menu_toggle');
                    if ($btnDelayed.length > 0) {
                        updateToggleIcon($btnDelayed, navMenuCollapsed);
                    }
                }, 100);
            }
            
            if (collapsed) {
                $navMenu.addClass('collapsed');
                if (navMenuUserPinned) {
                    applyNavRT(navMenu, navMenuPinnedRT.right, navMenuPinnedRT.top);
                } else {
                    // 收起态且未拖动过：使用默认位置
                    const defaultPos = getDefaultPosition();
                    navMenu.style.left = 'auto';
                    navMenu.style.right = `${defaultPos.right}px`;
                    navMenu.style.top = `${defaultPos.top}px`;
                }
                // 收起态：显示"展开"图标
                if ($btn.length > 0) {
                    updateToggleIcon($btn, true);
                }
            } else {
                $navMenu.removeClass('collapsed');
                // 展开态：显示"收起"图标
                if ($btn.length > 0) {
                    updateToggleIcon($btn, false);
                }
            }
        } catch (e) {
            console.warn('Failed to load nav menu collapsed state:', e);
        }
    }

    // 初始化拖拽
    function initNavMenuDrag() {
        const header = navMenu.querySelector('.question-nav-header');
        const toggleBtn = navMenu.querySelector('#nav_menu_toggle');
        if (!header) return;

        let dragging = false;
        let startX = 0, startY = 0;
        let startRight = 20, startTop = 120;

        const onMove = (clientX, clientY) => {
            const dx = clientX - startX;
            const dy = clientY - startY;
            // right 坐标：向右拖动 -> right 变小；向左拖动 -> right 变大
            let right = startRight - dx;
            let top = startTop + dy;

            navMenuUserPinned = true;
            navMenuPinnedRT = clampNavRT(right, top, navMenu);
            applyNavRT(navMenu, navMenuPinnedRT.right, navMenuPinnedRT.top);
        };

        const endDrag = () => {
            if (!dragging) return;
            dragging = false;
            document.body.classList.remove('question-nav-dragging');
            navMenu.classList.remove('dragging');
            // 持久化最终锚点（right/top）
            persistNavMenuPos(navMenuPinnedRT.right, navMenuPinnedRT.top);
        };

        const startDrag = (clientX, clientY) => {
            dragging = true;
            document.body.classList.add('question-nav-dragging');
            navMenu.classList.add('dragging');
            startX = clientX;
            startY = clientY;
            // 以当前 right/top 为起点（统一坐标系）
            const rect = navMenu.getBoundingClientRect();
            startTop = rect.top;
            startRight = window.innerWidth - (rect.left + rect.width);
        };

        header.addEventListener('mousedown', (e) => {
            // 点到按钮不触发拖动
            if (toggleBtn && (e.target === toggleBtn || toggleBtn.contains(e.target))) return;
            // 仅左键
            if (e.button !== 0) return;
            e.preventDefault();
            startDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            onMove(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => endDrag());

        // Touch 支持
        header.addEventListener('touchstart', (e) => {
            if (toggleBtn && (e.target === toggleBtn || toggleBtn.contains(e.target))) return;
            const t = e.touches && e.touches[0];
            if (!t) return;
            startDrag(t.clientX, t.clientY);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const t = e.touches && e.touches[0];
            if (!t) return;
            onMove(t.clientX, t.clientY);
        }, { passive: true });

        window.addEventListener('touchend', () => endDrag());

        // 双击标题栏：重置为自动定位（清空缓存）
        header.addEventListener('dblclick', (e) => {
            if (toggleBtn && (e.target === toggleBtn || toggleBtn.contains(e.target))) return;
            clearNavMenuPos();
            navMenu.style.left = 'auto';
            navMenu.style.top = '';
            navMenu.style.right = '';
            if (updatePosition && typeof updatePosition === 'function') {
                setTimeout(updatePosition, 0);
            }
        });
    }

    // 更新切换按钮图标
    function updateToggleIcon($btn, isCollapsed) {
        if (!$btn || $btn.length === 0) return;
        const $icon = $btn.find('i');
        if ($icon.length === 0) return;
        
        if (isCollapsed) {
            // 收起态：显示"展开"图标
            $icon.removeClass('bi-arrows-angle-contract bi-chevron-left bi-chevron-right').addClass('bi-arrows-angle-expand');
        } else {
            // 展开态：显示"收起"图标
            $icon.removeClass('bi-arrows-angle-expand bi-chevron-left bi-chevron-right').addClass('bi-arrows-angle-contract');
        }
    }

    // 展开/收起切换
    function setupToggleButton() {
        const $btn = $('#nav_menu_toggle');
        if ($btn.length === 0) {
            // 按钮不存在，延迟绑定（可能在 DOM 加载完成前调用）
            setTimeout(() => {
                const $btnDelayed = $('#nav_menu_toggle');
                if ($btnDelayed.length > 0) {
                    bindToggleEvent($btnDelayed);
                }
            }, 100);
            return;
        }
        
        bindToggleEvent($btn);
    }
    
    // 获取导航栏当前位置（right/top 格式）
    function getCurrentNavPosition() {
        const rect = navMenu.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(navMenu);
        const right = computedStyle.right;
        const top = computedStyle.top;
        
        // 如果 right 和 top 都有值且不是 'auto'
        if (right !== 'auto' && top !== 'auto' && right !== '' && top !== '') {
            return {
                right: parseFloat(right),
                top: parseFloat(top)
            };
        }
        
        // 否则从 getBoundingClientRect 计算
        return {
            right: window.innerWidth - (rect.left + rect.width),
            top: rect.top
        };
    }

    function bindToggleEvent($btn) {
        $btn.off('click').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // 切换状态
            navMenuCollapsed = !navMenuCollapsed;
            const $navMenu = $(navMenu);
            const navMenuDom = navMenu;
            
            if (navMenuCollapsed) {
                // 收起：记录当前位置（即使从未拖动过）
                if (!navMenuUserPinned) {
                    navMenuLastExpandedPos = getCurrentNavPosition();
                }
                
                $navMenu.addClass('collapsed');
                if (navMenuUserPinned) {
                    applyNavRT(navMenuDom, navMenuPinnedRT.right, navMenuPinnedRT.top);
                } else {
                    // 收起态且未拖动过：使用默认位置
                    const defaultPos = getDefaultPosition();
                    navMenuDom.style.left = 'auto';
                    navMenuDom.style.right = `${defaultPos.right}px`;
                    navMenuDom.style.top = `${defaultPos.top}px`;
                }
                updateToggleIcon($(this), true);
            } else {
                // 展开
                $navMenu.removeClass('collapsed');
                updateToggleIcon($(this), false);
                
                // 展开时恢复位置
                if (navMenuUserPinned === true) {
                    // 用户拖动过：恢复到拖动后的位置
                    applyNavRT(navMenuDom, navMenuPinnedRT.right, navMenuPinnedRT.top);
                } else if (navMenuLastExpandedPos !== null) {
                    // 从未拖动过，但有记录的位置：恢复到收起前的位置
                    applyNavRT(navMenuDom, navMenuLastExpandedPos.right, navMenuLastExpandedPos.top);
                } else if (updatePosition && typeof updatePosition === 'function') {
                    // 首次展开且没有记录：使用自动定位
                    setTimeout(() => {
                        // 再次检查状态，确保仍然是展开态且未拖动
                        if (!navMenu.classList.contains('collapsed') && !navMenuUserPinned) {
                            updatePosition();
                            // 记录自动定位后的位置
                            navMenuLastExpandedPos = getCurrentNavPosition();
                        }
                    }, 10);
                }
            }
            
            // 持久化状态
            persistNavCollapsedState();
        });
    }

    // 初始化
    loadNavMenuState();
    initNavMenuDrag();
    setupToggleButton();

    // 如果没有用户自定义位置，调用自动定位函数
    // 延迟调用，确保 DOM 已完全渲染（特别是题目容器）
    if (!navMenuUserPinned && updatePosition && typeof updatePosition === 'function') {
        // 使用 setTimeout 确保在页面加载完成后再调用
        // 延迟时间稍长，确保题目容器已渲染
        setTimeout(() => {
            // 再次检查是否仍未拖动（可能在延迟期间用户已拖动）
            if (!navMenuUserPinned && !navMenu.classList.contains('collapsed')) {
                updatePosition();
                // 记录自动定位后的位置
                navMenuLastExpandedPos = getCurrentNavPosition();
            }
        }, 300);
    }

    // 窗口大小改变时，如果用户已拖动过，保持位置；否则重新计算
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (navMenuUserPinned) {
                navMenuPinnedRT = clampNavRT(navMenuPinnedRT.right, navMenuPinnedRT.top, navMenu);
                applyNavRT(navMenu, navMenuPinnedRT.right, navMenuPinnedRT.top);
            } else if (updatePosition && typeof updatePosition === 'function') {
                updatePosition();
            }
        }, 100);
    });
}

// 暴露到全局
window.initQuestionNavCommon = initQuestionNavCommon;

