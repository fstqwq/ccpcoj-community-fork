/**
 * 工具函数模块
 * 提供各种辅助功能
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    
    /**
     * 更新连接线箭头
     * @param {Object} app - WebDrawApp 实例
     */
    function updateConnectorArrows(app) {
        if (app.selectedConnector) {
            const btnLineStartArrow = document.getElementById('btn-line-start-arrow');
            const btnLineEndArrow = document.getElementById('btn-line-end-arrow');
            app.selectedConnector.startArrow = btnLineStartArrow ? btnLineStartArrow.classList.contains('active') : false;
            app.selectedConnector.endArrow = btnLineEndArrow ? btnLineEndArrow.classList.contains('active') : false;
            app.selectedConnector.update();
            window.WebDrawHistory.saveState(app);
        }
    }
    
    /**
     * 更新调整大小手柄
     * @param {Object} app - WebDrawApp 实例
     */
    function updateResizeHandles(app) {
        // 移除所有现有手柄
        document.querySelectorAll('.resize-handle').forEach(h => h.remove());
        
        // 只为单个选中的形状添加手柄
        if (app.selectedShapes.length === 1) {
            const shape = app.selectedShapes[0];
            const bounds = shape.getBounds();
            const handle = document.createElementNS(SVG_NS, 'circle');
            handle.setAttribute('class', 'resize-handle');
            handle.setAttribute('cx', bounds.x + bounds.width);
            handle.setAttribute('cy', bounds.y + bounds.height);
            handle.setAttribute('data-shape-id', shape.id);
            // 调整手柄添加到 SVG 根元素（不在缩放组内）
            app.svg.appendChild(handle);
        }
    }
    
    /**
     * 添加调整大小手柄
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} shape - 形状对象
     */
    function addResizeHandles(app, shape) {
        updateResizeHandles(app);
    }
    
    /**
     * 更新删除按钮状态
     * @param {Object} app - WebDrawApp 实例
     */
    function updateDeleteButtonState(app) {
        const btnDelete = document.getElementById('btn-delete');
        if (btnDelete) {
            // 如果有选中的形状或连接线，启用按钮；否则禁用
            const hasSelection = (app.selectedShapes && app.selectedShapes.length > 0) || app.selectedConnector;
            btnDelete.disabled = !hasSelection;
        }
    }
    
    // 导出函数
    window.WebDrawUtils = {
        updateConnectorArrows,
        updateResizeHandles,
        addResizeHandles,
        updateDeleteButtonState
    };
})();

