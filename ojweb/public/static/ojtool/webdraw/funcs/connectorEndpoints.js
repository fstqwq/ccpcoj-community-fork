/**
 * 连接线端点管理相关函数模块
 * 负责连接线端点的显示和拖拽
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    
    /**
     * 更新连接线端点手柄
     * @param {Object} app - WebDrawApp 实例
     */
    function updateConnectorEndpoints(app) {
        // 移除所有现有端点手柄
        document.querySelectorAll('.connector-endpoint-handle').forEach(h => h.remove());
        
        if (app.selectedConnector) {
            const connector = app.selectedConnector;
            
            // 使用 Connector 类的方法获取实际坐标
            const coords = connector.getActualCoordinates();
            const { startX, startY, endX, endY } = coords;
            
            // 确定手柄应该添加到哪个容器（与连接线相同的容器）
            const targetContainer = app.svgGroup || app.svg;
            
            // 创建起点手柄
            const startHandle = document.createElementNS(SVG_NS, 'circle');
            startHandle.setAttribute('class', 'connector-endpoint-handle connector-endpoint-start');
            startHandle.setAttribute('cx', startX);
            startHandle.setAttribute('cy', startY);
            startHandle.setAttribute('r', 6);
            startHandle.setAttribute('fill', '#0d6efd');
            startHandle.setAttribute('stroke', '#fff');
            startHandle.setAttribute('stroke-width', 2);
            startHandle.setAttribute('cursor', 'pointer');
            startHandle.setAttribute('data-connector-id', connector.id);
            startHandle.setAttribute('data-endpoint', 'start');
            targetContainer.appendChild(startHandle);
            
            // 创建终点手柄
            const endHandle = document.createElementNS(SVG_NS, 'circle');
            endHandle.setAttribute('class', 'connector-endpoint-handle connector-endpoint-end');
            endHandle.setAttribute('cx', endX);
            endHandle.setAttribute('cy', endY);
            endHandle.setAttribute('r', 6);
            endHandle.setAttribute('fill', '#0d6efd');
            endHandle.setAttribute('stroke', '#fff');
            endHandle.setAttribute('stroke-width', 2);
            endHandle.setAttribute('cursor', 'pointer');
            endHandle.setAttribute('data-connector-id', connector.id);
            endHandle.setAttribute('data-endpoint', 'end');
            targetContainer.appendChild(endHandle);
        }
    }
    
    /**
     * 更新连接线端点位置
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} point - 当前点 {x, y}
     */
    function updateConnectorEndpoint(app, point) {
        if (!app.selectedConnector || !app.draggingEndpoint) return;
        
        const connector = app.selectedConnector;
        const SNAP_DISTANCE = window.WebDrawConstants.SNAP_DISTANCE || 15;
        
        // 查找最近的形状和连接点
        let nearestShape = null;
        let nearestPoint = null;
        let minDist = Infinity;
        
        app.shapes.forEach(shape => {
            const points = shape.getConnectionPoints();
            points.forEach(p => {
                const dist = Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2));
                if (dist < minDist && dist <= SNAP_DISTANCE) {
                    minDist = dist;
                    nearestShape = shape;
                    nearestPoint = p;
                }
            });
        });
        
        if (app.draggingEndpoint === 'start') {
            if (nearestShape && nearestPoint) {
                // 吸附到连接点
                connector.startShapeId = nearestShape.id;
                connector.startPoint = nearestPoint.name;
                // 更新坐标（从连接点获取）
                const actualPoint = nearestShape.getConnectionPoints().find(p => p.name === nearestPoint.name);
                if (actualPoint) {
                    connector.startX = actualPoint.x;
                    connector.startY = actualPoint.y;
                }
            } else {
                // 自由位置
                connector.startX = point.x;
                connector.startY = point.y;
                connector.startShapeId = null;
                connector.startPoint = null;
            }
        } else if (app.draggingEndpoint === 'end') {
            if (nearestShape && nearestPoint) {
                // 吸附到连接点
                connector.endShapeId = nearestShape.id;
                connector.endPoint = nearestPoint.name;
                // 更新坐标（从连接点获取）
                const actualPoint = nearestShape.getConnectionPoints().find(p => p.name === nearestPoint.name);
                if (actualPoint) {
                    connector.endX = actualPoint.x;
                    connector.endY = actualPoint.y;
                }
            } else {
                // 自由位置
                connector.endX = point.x;
                connector.endY = point.y;
                connector.endShapeId = null;
                connector.endPoint = null;
            }
        }
        
        connector.update();
        updateConnectorEndpoints(app); // 更新手柄位置
    }
    
    // 导出函数
    window.WebDrawConnectorEndpoints = {
        updateConnectorEndpoints,
        updateConnectorEndpoint
    };
})();

