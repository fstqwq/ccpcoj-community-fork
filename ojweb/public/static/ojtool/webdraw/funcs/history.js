/**
 * 历史记录相关函数模块
 * 负责撤销/重做功能
 */
(function() {
    'use strict';
    
    const MAX_HISTORY = window.WebDrawConstants.MAX_HISTORY;
    const ShapeFactory = window.WebDrawShapes;
    
    /**
     * 保存状态到历史记录
     * @param {Object} app - WebDrawApp 实例
     */
    function saveState(app) {
        const state = {
            shapes: app.shapes.map(s => s.toJSON()),
            connectors: app.connectors.map(c => c.toJSON()),
            timestamp: Date.now()
        };
        
        app.history = app.history.slice(0, app.historyIndex + 1);
        app.history.push(JSON.parse(JSON.stringify(state)));
        app.historyIndex = app.history.length - 1;
        
        if (app.history.length > MAX_HISTORY) {
            app.history.shift();
            app.historyIndex--;
        }
        
        // 自动保存到 IndexedDB（异步，不阻塞）
        if (window.WebDrawRecordManagement) {
            window.WebDrawRecordManagement.autoSaveToStorage(app, state);
        } else {
            app.autoSaveToStorage(state);
        }
    }
    
    /**
     * 撤销操作
     * @param {Object} app - WebDrawApp 实例
     */
    function undo(app) {
        if (app.historyIndex > 0) {
            app.historyIndex--;
            restoreState(app, app.history[app.historyIndex], true); // 跳过历史记录恢复
            // 保存当前状态到 IndexedDB
            if (window.WebDrawRecordManagement) {
                window.WebDrawRecordManagement.autoSaveToStorage(app, app.history[app.historyIndex]);
            } else {
                app.autoSaveToStorage(app.history[app.historyIndex]);
            }
        }
    }
    
    /**
     * 重做操作
     * @param {Object} app - WebDrawApp 实例
     */
    function redo(app) {
        if (app.historyIndex < app.history.length - 1) {
            app.historyIndex++;
            restoreState(app, app.history[app.historyIndex], true); // 跳过历史记录恢复
            // 保存当前状态到 IndexedDB
            if (window.WebDrawRecordManagement) {
                window.WebDrawRecordManagement.autoSaveToStorage(app, app.history[app.historyIndex]);
            } else {
                app.autoSaveToStorage(app.history[app.historyIndex]);
            }
        }
    }
    
    /**
     * 恢复状态
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} state - 要恢复的状态
     * @param {Boolean} skipHistory - 是否跳过历史记录恢复
     */
    function restoreState(app, state, skipHistory = false) {
        // 清除当前内容
        app.shapes.forEach(s => {
            const elementToRemove = s.groupElement || s.element;
            if (elementToRemove && elementToRemove.parentNode) {
                elementToRemove.parentNode.removeChild(elementToRemove);
            }
        });
        app.connectors.forEach(c => {
            if (c.element && c.element.parentNode) {
                c.element.parentNode.removeChild(c.element);
            }
        });
        app.shapes = [];
        app.connectors = [];
        window.WebDrawSelection.deselectAll(app);
        
        // 恢复历史记录（如果提供且不跳过）
        if (!skipHistory && state.history && Array.isArray(state.history)) {
            app.history = state.history;
            app.historyIndex = state.historyIndex !== undefined ? state.historyIndex : app.history.length - 1;
        }
        
        // 恢复形状
        if (state.shapes) {
            state.shapes.forEach(data => {
                const shape = ShapeFactory.fromJSON(data);
                if (shape) {
                    shape.createElement(app.svgGroup || app.svg);
                    app.shapes.push(shape);
                }
            });
        }
        
        // 恢复连接线
        const Connector = window.WebDrawConnector;
        if (state.connectors && Connector) {
            state.connectors.forEach(data => {
                const connector = Connector.fromJSON(data);
                if (connector) {
                    connector.setAppInstance(app);
                    
                    // 更新连接线的起点和终点形状ID（如果形状已恢复）
                    if (data.startShapeId) {
                        const startShape = app.shapes.find(s => s.id === data.startShapeId);
                        if (startShape) {
                            connector.startShapeId = startShape.id;
                        }
                    }
                    if (data.endShapeId) {
                        const endShape = app.shapes.find(s => s.id === data.endShapeId);
                        if (endShape) {
                            connector.endShapeId = endShape.id;
                        }
                    }
                    
                    connector.createElement(app.svgGroup || app.svg);
                    app.connectors.push(connector);
                    connector.update();
                }
            });
        }
    }
    
    // 导出函数
    window.WebDrawHistory = {
        saveState,
        undo,
        redo,
        restoreState
    };
})();

