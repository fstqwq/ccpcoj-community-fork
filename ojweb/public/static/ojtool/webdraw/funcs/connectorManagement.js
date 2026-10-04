/**
 * 连接线管理相关函数
 * 提供连接线的选择、更新、端点管理等功能
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    
    window.WebDrawConnectorManagement = {
        /**
         * 选择连接线
         * @param {Object} app - WebDrawApp 实例
         * @param {Element} connectorElement - 连接线元素
         */
        selectConnector(app, connectorElement) {
            window.WebDrawSelection.deselectAll(app);
            
            const connector = window.WebDrawFinders.findConnectorByElement(app, connectorElement);
            if (connector) {
                app.selectedConnector = connector;
                if (connector.lineElement) {
                    connector.lineElement.classList.add('selected');
                }
                // 更新箭头按钮状态
                const btnLineStartArrow = document.getElementById('btn-line-start-arrow');
                const btnLineEndArrow = document.getElementById('btn-line-end-arrow');
                if (btnLineStartArrow) {
                    if (connector.startArrow) {
                        btnLineStartArrow.classList.add('active');
                    } else {
                        btnLineStartArrow.classList.remove('active');
                    }
                }
                if (btnLineEndArrow) {
                    if (connector.endArrow) {
                        btnLineEndArrow.classList.add('active');
                    } else {
                        btnLineEndArrow.classList.remove('active');
                    }
                }
                // 显示箭头设置按钮组并添加醒目样式
                const lineArrowSettings = document.getElementById('line-arrow-settings');
                if (lineArrowSettings) {
                    lineArrowSettings.style.display = 'flex';
                    lineArrowSettings.classList.add('connector-selected');
                }
                // 添加端点手柄
                window.WebDrawConnectorEndpoints.updateConnectorEndpoints(app);
                // 更新删除按钮状态
                window.WebDrawUtils.updateDeleteButtonState(app);
            }
        },
        
        /**
         * 更新所有连接线
         * @param {Object} app - WebDrawApp 实例
         */
        updateConnectors(app) {
            app.connectors.forEach(connector => connector.update());
        },
        
        /**
         * 更新连接线箭头设置
         * @param {Object} app - WebDrawApp 实例
         */
        updateConnectorArrows(app) {
            if (app.selectedConnector) {
                const btnLineStartArrow = document.getElementById('btn-line-start-arrow');
                const btnLineEndArrow = document.getElementById('btn-line-end-arrow');
                app.selectedConnector.startArrow = btnLineStartArrow ? btnLineStartArrow.classList.contains('active') : false;
                app.selectedConnector.endArrow = btnLineEndArrow ? btnLineEndArrow.classList.contains('active') : false;
                app.selectedConnector.update();
                window.WebDrawHistory.saveState(app);
            }
        },
        
        /**
         * 获取当前箭头设置（用于绘制新连接线）
         * @param {Object} app - WebDrawApp 实例
         * @returns {Object} 箭头设置 {startArrow: boolean, endArrow: boolean}
         */
        getCurrentArrowSettings(app) {
            const btnLineStartArrow = document.getElementById('btn-line-start-arrow');
            const btnLineEndArrow = document.getElementById('btn-line-end-arrow');
            return {
                startArrow: btnLineStartArrow ? btnLineStartArrow.classList.contains('active') : false,
                endArrow: btnLineEndArrow ? btnLineEndArrow.classList.contains('active') : true
            };
        }
    };
})();

