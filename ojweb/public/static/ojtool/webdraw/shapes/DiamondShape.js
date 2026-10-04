/**
 * 菱形形状
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    const Shape = window.WebDrawShape;
    
    class DiamondShape extends Shape {
        constructor(x, y, width, height, id = null) {
            super('diamond', x, y, width, height, id);
        }
        
        createElement(svg) {
            // 创建包装组
            this.groupElement = document.createElementNS(SVG_NS, 'g');
            this.groupElement.setAttribute('class', 'shape-group');
            this.groupElement.setAttribute('data-id', this.id);
            this.groupElement.setAttribute('data-type', this.type);
            
            // 创建形状元素
            this.element = document.createElementNS(SVG_NS, 'polygon');
            this.element.setAttribute('class', 'shape');
            this.element.setAttribute('data-id', this.id);
            this.element.setAttribute('data-type', this.type);
            
            // 将形状添加到组中
            this.groupElement.appendChild(this.element);
            
            // 将组添加到 SVG
            svg.appendChild(this.groupElement);
            
            this.update();
            this.updateText();
            return this.groupElement;
        }
        
        update() {
            if (!this.element) return;
            const points = [
                [this.x + this.width / 2, this.y].join(','),
                [this.x + this.width, this.y + this.height / 2].join(','),
                [this.x + this.width / 2, this.y + this.height].join(','),
                [this.x, this.y + this.height / 2].join(',')
            ].join(' ');
            this.element.setAttribute('points', points);
            this.updateText();
        }
        
        // 计算点到线段的距离
        _distanceToLineSegment(point, lineStart, lineEnd) {
            const A = point.x - lineStart.x;
            const B = point.y - lineStart.y;
            const C = lineEnd.x - lineStart.x;
            const D = lineEnd.y - lineStart.y;
            
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            
            if (lenSq !== 0) {
                param = dot / lenSq;
            }
            
            let xx, yy;
            if (param < 0) {
                xx = lineStart.x;
                yy = lineStart.y;
            } else if (param > 1) {
                xx = lineEnd.x;
                yy = lineEnd.y;
            } else {
                xx = lineStart.x + param * C;
                yy = lineStart.y + param * D;
            }
            
            const dx = point.x - xx;
            const dy = point.y - yy;
            return Math.sqrt(dx * dx + dy * dy);
        }
        
        // 检测点是否在菱形边缘附近，并返回是顶点还是边
        isPointNearEdge(point, threshold = null) {
            if (threshold === null) {
                threshold = window.WebDrawConstants?.CIRCLE_EDGE_THRESHOLD || 15;
            }
            
            const bounds = this.getBounds();
            const cx = bounds.centerX;
            const cy = bounds.centerY;
            
            // 菱形的四个顶点（按顺序：上、右、下、左）
            const vertices = [
                { x: cx, y: bounds.y, name: 'top' },
                { x: bounds.x + bounds.width, y: cy, name: 'right' },
                { x: cx, y: bounds.y + bounds.height, name: 'bottom' },
                { x: bounds.x, y: cy, name: 'left' }
            ];
            
            // 先检查是否靠近顶点（优先级更高）
            for (const vertex of vertices) {
                const dist = Math.sqrt(Math.pow(point.x - vertex.x, 2) + Math.pow(point.y - vertex.y, 2));
                if (dist <= threshold) {
                    return { near: true, type: 'vertex', name: vertex.name };
                }
            }
            
            // 菱形的四条边（按顺序连接顶点）
            const edges = [
                { start: vertices[0], end: vertices[1], name: 'top-right' },
                { start: vertices[1], end: vertices[2], name: 'bottom-right' },
                { start: vertices[2], end: vertices[3], name: 'bottom-left' },
                { start: vertices[3], end: vertices[0], name: 'top-left' }
            ];
            
            // 检查点是否靠近任何一条边
            let minDist = Infinity;
            let nearestEdge = null;
            
            for (const edge of edges) {
                const dist = this._distanceToLineSegment(point, edge.start, edge.end);
                if (dist < minDist) {
                    minDist = dist;
                    nearestEdge = edge;
                }
            }
            
            // 如果距离小于阈值，返回边信息
            if (minDist <= threshold && nearestEdge) {
                return { near: true, type: 'edge', name: nearestEdge.name };
            }
            
            return { near: false };
        }
        
        // 从边缘拖拽调整大小（Visio风格）
        resizeFromEdge(newPoint, dragStartPoint, resizeStartCenter, resizeStartRadius, resizeStartSize, edge, shiftKey = false) {
            if (!resizeStartSize || !resizeStartCenter) {
                console.warn('Diamond resizeFromEdge: missing resizeStartSize or resizeStartCenter');
                return;
            }
            
            const MIN_SIZE = window.WebDrawConstants.MIN_SHAPE_SIZE || 20;
            const startWidth = resizeStartSize.width;
            const startHeight = resizeStartSize.height;
            const startCenterX = resizeStartCenter.x;
            const startCenterY = resizeStartCenter.y;
            
            // 获取拖拽的起始信息（应该包含是顶点还是边）
            const dragInfo = this._lastDragInfo || { type: 'edge', name: 'top-right' };
            
            if (dragInfo.type === 'vertex') {
                // 拖拽顶点
                if (shiftKey) {
                    // Shift+顶点：等比缩放（使用基类方法）
                    if (this._proportionalResize(newPoint, dragStartPoint, resizeStartCenter, resizeStartSize)) {
                        this.update();
                    }
                } else {
                    // 顶点：只调整对应方向的尺寸（不等比缩放）
                    switch (dragInfo.name) {
                        case 'top':
                            const distYTop = startCenterY - newPoint.y;
                            this.height = Math.max(MIN_SIZE, distYTop * 2);
                            this.y = startCenterY - this.height / 2;
                            break;
                        case 'right':
                            const distXRight = newPoint.x - startCenterX;
                            this.width = Math.max(MIN_SIZE, distXRight * 2);
                            this.x = startCenterX - this.width / 2;
                            break;
                        case 'bottom':
                            const distYBottom = newPoint.y - startCenterY;
                            this.height = Math.max(MIN_SIZE, distYBottom * 2);
                            this.y = startCenterY - this.height / 2;
                            break;
                        case 'left':
                            const distXLeft = startCenterX - newPoint.x;
                            this.width = Math.max(MIN_SIZE, distXLeft * 2);
                            this.x = startCenterX - this.width / 2;
                            break;
                    }
                    this.update();
                }
            } else {
                // 拖拽边中点：等比缩放（使用基类方法）
                if (this._proportionalResize(newPoint, dragStartPoint, resizeStartCenter, resizeStartSize)) {
                    this.update();
                }
            }
        }
        
        getConnectionPoints() {
            // 菱形：8个连接点在顶点和边的中点
            const bounds = this.getBounds();
            const cx = bounds.centerX;
            const cy = bounds.centerY;
            
            return [
                { x: cx, y: bounds.y, name: 'top' }, // 上顶点
                { x: bounds.x + bounds.width * 0.75, y: bounds.y + bounds.height * 0.25, name: 'top-right' }, // 右上边中点
                { x: bounds.x + bounds.width, y: cy, name: 'right' }, // 右顶点
                { x: bounds.x + bounds.width * 0.75, y: bounds.y + bounds.height * 0.75, name: 'bottom-right' }, // 右下边中点
                { x: cx, y: bounds.y + bounds.height, name: 'bottom' }, // 下顶点
                { x: bounds.x + bounds.width * 0.25, y: bounds.y + bounds.height * 0.75, name: 'bottom-left' }, // 左下边中点
                { x: bounds.x, y: cy, name: 'left' }, // 左顶点
                { x: bounds.x + bounds.width * 0.25, y: bounds.y + bounds.height * 0.25, name: 'top-left' } // 左上边中点
            ];
        }
    }
    
    window.WebDrawDiamondShape = DiamondShape;
})();

