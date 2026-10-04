/**
 * 画布操作相关函数模块
 * 负责画布缩放、平移、坐标转换等
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    
    /**
     * 更新 SVG 尺寸
     * @param {Object} app - WebDrawApp 实例
     */
    function updateSVGSize(app) {
        const rect = app.svgContainer.getBoundingClientRect();
        app.svg.setAttribute('width', rect.width);
        app.svg.setAttribute('height', rect.height);
        app.svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    }
    
    /**
     * 更新画布变换
     * @param {Object} app - WebDrawApp 实例
     */
    function updateCanvasTransform(app) {
        if (!app.svgGroup) return;
        // 应用缩放和平移变换
        const transform = `translate(${app.canvasOffsetX}, ${app.canvasOffsetY}) scale(${app.canvasScale})`;
        app.svgGroup.setAttribute('transform', transform);
    }
    
    /**
     * 画布缩放
     * @param {Object} app - WebDrawApp 实例
     * @param {Number} delta - 缩放增量（正数放大，负数缩小）
     * @param {Number} centerX - 缩放中心 X 坐标（屏幕坐标）
     * @param {Number} centerY - 缩放中心 Y 坐标（屏幕坐标）
     */
    function zoomCanvas(app, delta, centerX, centerY) {
        const zoomFactor = delta > 0 ? 1.1 : 0.9;
        const newScale = Math.max(0.1, Math.min(5.0, app.canvasScale * zoomFactor));
        
        // 以鼠标位置为中心缩放
        const svgRect = app.svg.getBoundingClientRect();
        const svgX = centerX - svgRect.left;
        const svgY = centerY - svgRect.top;
        
        // 计算缩放前后的坐标转换
        const worldX = (svgX - app.canvasOffsetX) / app.canvasScale;
        const worldY = (svgY - app.canvasOffsetY) / app.canvasScale;
        
        // 更新缩放
        app.canvasScale = newScale;
        
        // 调整偏移，使鼠标位置保持不变
        app.canvasOffsetX = svgX - worldX * app.canvasScale;
        app.canvasOffsetY = svgY - worldY * app.canvasScale;
        
        updateCanvasTransform(app);
    }
    
    /**
     * 开始画布平移
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} point - 起始点 {x, y}（屏幕坐标）
     */
    function startPanning(app, point) {
        app.isPanning = true;
        app.panStart = { x: point.x - app.canvasOffsetX, y: point.y - app.canvasOffsetY };
    }
    
    /**
     * 更新画布平移
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} point - 当前点 {x, y}（屏幕坐标）
     */
    function updatePanning(app, point) {
        if (!app.isPanning) return;
        app.canvasOffsetX = point.x - app.panStart.x;
        app.canvasOffsetY = point.y - app.panStart.y;
        updateCanvasTransform(app);
    }
    
    /**
     * 停止画布平移
     * @param {Object} app - WebDrawApp 实例
     */
    function stopPanning(app) {
        app.isPanning = false;
    }
    
    /**
     * 创建箭头标记
     * @param {Object} app - WebDrawApp 实例
     */
    function createArrowMarkers(app) {
        const defs = document.createElementNS(SVG_NS, 'defs');
        
        // 起点箭头：使用 auto-start-reverse 确保方向正确（指向起点，与路径方向相反）
        const markerStart = document.createElementNS(SVG_NS, 'marker');
        markerStart.setAttribute('id', 'arrow-start');
        markerStart.setAttribute('markerWidth', '10');
        markerStart.setAttribute('markerHeight', '10');
        markerStart.setAttribute('refX', '9');
        markerStart.setAttribute('refY', '3');
        markerStart.setAttribute('orient', 'auto-start-reverse');
        markerStart.setAttribute('markerUnits', 'strokeWidth');
        const arrowStartPath = document.createElementNS(SVG_NS, 'path');
        arrowStartPath.setAttribute('d', 'M0,0 L0,6 L9,3 z');
        arrowStartPath.setAttribute('class', 'arrow-marker');
        markerStart.appendChild(arrowStartPath);
        
        // 终点箭头：指向终点，与路径方向相同
        const markerEnd = document.createElementNS(SVG_NS, 'marker');
        markerEnd.setAttribute('id', 'arrow-end');
        markerEnd.setAttribute('markerWidth', '10');
        markerEnd.setAttribute('markerHeight', '10');
        markerEnd.setAttribute('refX', '9');
        markerEnd.setAttribute('refY', '3');
        markerEnd.setAttribute('orient', 'auto');
        markerEnd.setAttribute('markerUnits', 'strokeWidth');
        const arrowEndPath = document.createElementNS(SVG_NS, 'path');
        arrowEndPath.setAttribute('d', 'M0,0 L0,6 L9,3 z');
        arrowEndPath.setAttribute('class', 'arrow-marker');
        markerEnd.appendChild(arrowEndPath);
        
        defs.appendChild(markerStart);
        defs.appendChild(markerEnd);
        app.svg.appendChild(defs);
    }
    
    /**
     * 获取 SVG 坐标点（考虑缩放和平移）
     * @param {Object} app - WebDrawApp 实例
     * @param {Event} e - 鼠标事件
     * @returns {Object} 转换后的坐标点 {x, y}
     */
    function getSVGPoint(app, e) {
        const rect = app.svg.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;

        // 考虑 SVG 容器的偏移
        const rawX = clientX - rect.left;
        const rawY = clientY - rect.top;

        // 考虑画布的缩放和平移
        const transformedX = (rawX - app.canvasOffsetX) / app.canvasScale;
        const transformedY = (rawY - app.canvasOffsetY) / app.canvasScale;

        return { x: transformedX, y: transformedY };
    }
    
    // 导出函数
    window.WebDrawCanvas = {
        updateSVGSize,
        updateCanvasTransform,
        zoomCanvas,
        startPanning,
        updatePanning,
        stopPanning,
        createArrowMarkers,
        getSVGPoint
    };
})();

