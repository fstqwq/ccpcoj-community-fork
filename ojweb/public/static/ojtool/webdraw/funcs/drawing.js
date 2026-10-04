/**
 * 绘制相关函数模块
 * 负责形状和连接线的绘制逻辑
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    const ShapeFactory = window.WebDrawShapes;
    
    /**
     * 开始绘制形状
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} point - 起始点 {x, y}
     */
    function startDrawingShape(app, point) {
        let shape;
        switch (app.currentMode) {
            case 'rect':
                shape = new ShapeFactory.RectShape(point.x, point.y, 0, 0);
                break;
            case 'square':
                shape = new ShapeFactory.SquareShape(point.x, point.y, 0);
                break;
            case 'circle':
                // 正圆：以点击位置为圆心，初始半径为 0
                shape = new ShapeFactory.CircleShape(point.x, point.y, 0);
                break;
            case 'ellipse':
                shape = new ShapeFactory.EllipseShape(point.x, point.y, 0, 0);
                break;
            case 'diamond':
                shape = new ShapeFactory.DiamondShape(point.x, point.y, 0, 0);
                break;
            case 'freedraw':
                // 自由绘制：创建路径并添加第一个点
                shape = new ShapeFactory.FreeDrawPath([], app.freeDrawBrushSize);
                shape.addPoint(point);
                app.currentFreeDrawPath = shape;
                break;
            case 'freetext':
                // 自由文字：创建文本并立即进入编辑模式
                shape = new ShapeFactory.FreeText(point.x, point.y, '');
                app.currentShape = shape;
                const targetSVG = app.svgGroup || app.svg;
                shape.createElement(targetSVG);
                // 立即进入编辑模式
                shape.startTextEdit();
                // 添加到形状列表
                app.shapes.push(shape);
                // 保存状态
                window.WebDrawHistory.saveState(app);
                // 重置状态
                app.currentShape = null;
                app.isDrawing = false;
                app.pendingDrawStart = null;
                app.pendingDrawStartShape = null;
                app.pendingDrawStartConnector = null;
                app.hasExceededDrawThreshold = false;
                return; // 自由文字不需要继续绘制流程
            default:
                return;
        }
        
        app.currentShape = shape;
        shape.createElement(app.svgGroup || app.svg);
    }
    
    /**
     * 更新绘制中的形状
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} point - 当前点 {x, y}
     */
    function updateDrawingShape(app, point) {
        if (!app.currentShape) return;
        
        const bounds = app.currentShape.getBounds();
        const dx = point.x - bounds.x;
        const dy = point.y - bounds.y;
        
        if (app.currentMode === 'square') {
            const size = Math.max(Math.abs(dx), Math.abs(dy));
            app.currentShape.setSize(size, size);
            if (dx < 0) app.currentShape.x = point.x;
            if (dy < 0) app.currentShape.y = point.y;
        } else if (app.currentMode === 'circle') {
            // 正圆：以 dragStart（圆心）为中心，鼠标拖出的距离为半径
            const centerX = app.dragStart.x;
            const centerY = app.dragStart.y;
            const radius = Math.sqrt(
                Math.pow(point.x - centerX, 2) + 
                Math.pow(point.y - centerY, 2)
            );
            const diameter = radius * 2;
            
            // 设置直径，位置为圆心减去半径
            app.currentShape.setSize(diameter, diameter);
            app.currentShape.setPosition(centerX - radius, centerY - radius);
        } else {
            app.currentShape.setSize(Math.abs(dx), Math.abs(dy));
            if (dx < 0) app.currentShape.x = point.x;
            if (dy < 0) app.currentShape.y = point.y;
        }
    }
    
    /**
     * 完成绘制形状
     * @param {Object} app - WebDrawApp 实例
     */
    function finishDrawingShape(app) {
        if (!app.currentShape) return;
        
        const bounds = app.currentShape.getBounds();
        if (bounds.width < 10 || bounds.height < 10) {
            const elementToRemove = app.currentShape.groupElement || app.currentShape.element;
            if (elementToRemove && elementToRemove.parentNode) {
                elementToRemove.parentNode.removeChild(elementToRemove);
            }
            app.currentShape = null;
            // 如果形状太小被取消，保持当前绘制模式
            app.hasExceededDrawThreshold = false;
            app.pendingDrawStart = null;
            app.pendingDrawStartShape = null;
            app.pendingDrawStartConnector = null;
            return;
        }
        
        app.shapes.push(app.currentShape);
        // 选中刚绘制的形状，确保与重新选中时的状态一致
        window.WebDrawSelection.selectShape(app, app.currentShape);
        app.currentShape = null;
        
        // 绘制完成后，保持当前绘制模式，可以继续绘制下一个
        // 不再自动切换回选择模式
        app.hasExceededDrawThreshold = false;
        app.pendingDrawStart = null;
    }
    
    /**
     * 开始绘制连接线
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} point - 起始点 {x, y}
     */
    function startDrawingLine(app, point) {
        const Connector = window.WebDrawConnector;
        if (!Connector) {
            console.error('Connector class not found');
            return;
        }
        const connector = new Connector(point.x, point.y, point.x, point.y);
        connector.setAppInstance(app);
        
        // 使用当前箭头设置
        const arrowSettings = getCurrentArrowSettings(app);
        connector.startArrow = arrowSettings.startArrow;
        connector.endArrow = arrowSettings.endArrow;
        
        app.currentConnector = connector;
        
        // 不在 mousedown 时检查图形吸附，改为在 mouseup 时检查
        // 这样可以在绘制过程中判断是否超过阈值
        
        connector.createElement(app.svgGroup || app.svg);
    }
    
    /**
     * 更新绘制中的连接线
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} point - 当前点 {x, y}
     */
    function updateDrawingLine(app, point) {
        if (!app.currentConnector) return;
        
        app.currentConnector.endX = point.x;
        app.currentConnector.endY = point.y;
        
        const shape = window.WebDrawFinders.findShapeAtPoint(app, point); 
                     (window.WebDrawFinders ? window.WebDrawFinders.findShapeAtPoint(app, point) : null);
        if (shape && shape.id !== app.currentConnector.startShapeId) {
            app.currentConnector.endShapeId = shape.id;
            app.currentConnector.endPoint = shape.findNearestConnectionPoint(point);
        } else {
            app.currentConnector.endShapeId = null;
            app.currentConnector.endPoint = null;
        }
        
        app.currentConnector.update();
    }
    
    /**
     * 完成绘制连接线
     * @param {Object} app - WebDrawApp 实例
     */
    function finishDrawingLine(app) {
        if (!app.currentConnector) return;
        
        // 允许没有吸附到图形的连接线也被保存
        // 检查连接线是否有有效长度（避免点击一下就创建连接线）
        const dx = app.currentConnector.endX - app.currentConnector.startX;
        const dy = app.currentConnector.endY - app.currentConnector.startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < 10) {
            // 连接线太短，取消绘制
            if (app.currentConnector.element && app.currentConnector.element.parentNode) {
                app.currentConnector.element.parentNode.removeChild(app.currentConnector.element);
            }
            app.currentConnector = null;
            // 如果连接线无效被取消，保持当前绘制模式
            app.hasExceededDrawThreshold = false;
            app.pendingDrawStart = null;
            return;
        }
        
        // 保存连接线，无论是否吸附到图形
        app.connectors.push(app.currentConnector);
        app.currentConnector = null;
        
        // 绘制完成后，保持当前绘制模式，可以继续绘制下一条连接线
        // 不再自动切换回选择模式
        app.hasExceededDrawThreshold = false;
        app.pendingDrawStart = null;
    }
    
    /**
     * 获取当前箭头设置（用于绘制新连接线）
     * @param {Object} app - WebDrawApp 实例
     * @returns {Object} 箭头设置 {startArrow, endArrow}
     */
    function getCurrentArrowSettings(app) {
        const btnLineStartArrow = document.getElementById('btn-line-start-arrow');
        const btnLineEndArrow = document.getElementById('btn-line-end-arrow');
        return {
            startArrow: btnLineStartArrow ? btnLineStartArrow.classList.contains('active') : false,
            endArrow: btnLineEndArrow ? btnLineEndArrow.classList.contains('active') : true
        };
    }
    
    // 导出函数
    window.WebDrawDrawing = {
        startDrawingShape,
        updateDrawingShape,
        finishDrawingShape,
        startDrawingLine,
        updateDrawingLine,
        finishDrawingLine,
        getCurrentArrowSettings
    };
})();

