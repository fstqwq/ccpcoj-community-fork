/**
 * 选择框相关函数模块
 * 负责圈选功能
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    
    /**
     * 开始选择框
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} point - 起始点 {x, y}
     */
    function startSelectionBox(app, point) {
        // 如果已有选择框，先移除
        if (app.selectionBox && app.selectionBox.parentNode) {
            app.selectionBox.parentNode.removeChild(app.selectionBox);
        }
        
        app.selectionBox = document.createElementNS(SVG_NS, 'rect');
        app.selectionBox.setAttribute('class', 'selection-box');
        app.selectionBox.setAttribute('x', point.x);
        app.selectionBox.setAttribute('y', point.y);
        app.selectionBox.setAttribute('width', 0);
        app.selectionBox.setAttribute('height', 0);
        app.selectionBox.setAttribute('fill', 'rgba(13, 110, 253, 0.1)');
        app.selectionBox.setAttribute('stroke', '#0d6efd');
        app.selectionBox.setAttribute('stroke-width', '1');
        app.selectionBox.setAttribute('stroke-dasharray', '5,5');
        app.selectionBox.style.pointerEvents = 'none';
        // 选择框添加到 SVG 根元素（不在缩放组内）
        app.svg.appendChild(app.selectionBox);
    }
    
    /**
     * 更新选择框
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} point - 当前点 {x, y}
     */
    function updateSelectionBox(app, point) {
        if (!app.selectionBox) return;
        
        const x = Math.min(app.dragStart.x, point.x);
        const y = Math.min(app.dragStart.y, point.y);
        const width = Math.abs(point.x - app.dragStart.x);
        const height = Math.abs(point.y - app.dragStart.y);
        
        app.selectionBox.setAttribute('x', x);
        app.selectionBox.setAttribute('y', y);
        app.selectionBox.setAttribute('width', width);
        app.selectionBox.setAttribute('height', height);
    }
    
    /**
     * 完成选择框
     * @param {Object} app - WebDrawApp 实例
     */
    function finishSelectionBox(app) {
        if (!app.selectionBox) return;
        
        const boxBounds = {
            x: parseFloat(app.selectionBox.getAttribute('x')),
            y: parseFloat(app.selectionBox.getAttribute('y')),
            width: parseFloat(app.selectionBox.getAttribute('width')),
            height: parseFloat(app.selectionBox.getAttribute('height'))
        };
        
        // 移除选择框
        if (app.selectionBox.parentNode) {
            app.selectionBox.parentNode.removeChild(app.selectionBox);
        }
        app.selectionBox = null;
        
        // 如果选择框太小，忽略
        if (boxBounds.width < 5 || boxBounds.height < 5) {
            return;
        }
        
        // 选择在选择框内的所有形状
        const boxRight = boxBounds.x + boxBounds.width;
        const boxBottom = boxBounds.y + boxBounds.height;
        
        app.shapes.forEach(shape => {
            const bounds = shape.getBounds();
            const shapeCenterX = bounds.centerX;
            const shapeCenterY = bounds.centerY;
            
            // 检查形状中心点是否在选择框内（更宽松的选择方式）
            const isInside = shapeCenterX >= boxBounds.x && 
                            shapeCenterX <= boxRight &&
                            shapeCenterY >= boxBounds.y &&
                            shapeCenterY <= boxBottom;
            
            if (isInside) {
                if (!app.selectedShapes.includes(shape)) {
                    window.WebDrawSelection.selectShape(app, shape);
                }
            }
        });
    }
    
    // 导出函数
    window.WebDrawSelectionBox = {
        startSelectionBox,
        updateSelectionBox,
        finishSelectionBox
    };
})();

