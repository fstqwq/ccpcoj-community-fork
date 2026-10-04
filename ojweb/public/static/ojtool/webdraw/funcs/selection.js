/**
 * 选择管理相关函数
 * 提供形状和连接线的选择功能
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    
    window.WebDrawSelection = {
        /**
         * 选中形状
         * @param {Object} app - WebDrawApp 实例
         * @param {Shape} shape - 要选中的形状
         */
        selectShape(app, shape) {
            if (!app.selectedShapes.includes(shape)) {
                app.selectedShapes.push(shape);
            }
            // 在组元素上添加选中类
            if (shape.groupElement) {
                shape.groupElement.classList.add('selected');
            } else if (shape.element) {
                shape.element.classList.add('selected');
            }
            window.WebDrawUtils.addResizeHandles(app, shape);
            // 更新删除按钮状态
            window.WebDrawUtils.updateDeleteButtonState(app);
        },
        
        /**
         * 取消选中形状
         * @param {Object} app - WebDrawApp 实例
         * @param {Shape} shape - 要取消选中的形状
         */
        deselectShape(app, shape) {
            // 在组元素上移除选中类
            if (shape && shape.groupElement) {
                shape.groupElement.classList.remove('selected');
            } else if (shape && shape.element) {
                shape.element.classList.remove('selected');
            }
            app.selectedShapes = app.selectedShapes.filter(s => s !== shape);
            window.WebDrawUtils.updateResizeHandles(app);
            // 更新删除按钮状态
            window.WebDrawUtils.updateDeleteButtonState(app);
        },
        
        /**
         * 取消所有选择
         * @param {Object} app - WebDrawApp 实例
         */
        deselectAll(app) {
            app.selectedShapes.forEach(shape => {
                if (shape.groupElement) {
                    shape.groupElement.classList.remove('selected');
                } else if (shape.element) {
                    shape.element.classList.remove('selected');
                }
            });
            app.selectedShapes = [];
            if (app.selectedConnector && app.selectedConnector.lineElement) {
                app.selectedConnector.lineElement.classList.remove('selected');
            }
            app.selectedConnector = null;
            // 隐藏箭头设置按钮组（除非是连接线模式）并移除醒目样式
            const lineArrowSettings = document.getElementById('line-arrow-settings');
            if (lineArrowSettings) {
                lineArrowSettings.classList.remove('connector-selected');
                if (app.currentMode !== 'line') {
                    lineArrowSettings.style.display = 'none';
                }
            }
            window.WebDrawUtils.updateResizeHandles(app);
            // 移除连接线端点手柄
            document.querySelectorAll('.connector-endpoint-handle').forEach(h => h.remove());
            // 更新删除按钮状态
            window.WebDrawUtils.updateDeleteButtonState(app);
        },
        
        /**
         * 切换形状选择状态
         * @param {Object} app - WebDrawApp 实例
         * @param {Shape} shape - 要切换选择状态的形状
         */
        toggleShapeSelection(app, shape) {
            if (app.selectedShapes.includes(shape)) {
                this.deselectShape(app, shape);
            } else {
                this.selectShape(app, shape);
            }
            // 更新删除按钮状态
            window.WebDrawUtils.updateDeleteButtonState(app);
        }
    };
})();

