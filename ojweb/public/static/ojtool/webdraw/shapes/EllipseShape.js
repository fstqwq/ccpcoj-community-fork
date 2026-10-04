/**
 * 椭圆形状
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    const Shape = window.WebDrawShape;
    
    class EllipseShape extends Shape {
        constructor(x, y, width, height, id = null) {
            super('ellipse', x, y, width, height, id);
        }
        
        createElement(svg) {
            // 创建包装组
            this.groupElement = document.createElementNS(SVG_NS, 'g');
            this.groupElement.setAttribute('class', 'shape-group');
            this.groupElement.setAttribute('data-id', this.id);
            this.groupElement.setAttribute('data-type', this.type);
            
            // 创建形状元素
            this.element = document.createElementNS(SVG_NS, 'ellipse');
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
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            this.element.setAttribute('cx', cx);
            this.element.setAttribute('cy', cy);
            this.element.setAttribute('rx', this.width / 2);
            this.element.setAttribute('ry', this.height / 2);
            this.updateText();
        }
        
        getConnectionPoints() {
            // 椭圆：8个连接点在椭圆上（45度间隔）
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            const rx = this.width / 2;
            const ry = this.height / 2;
            
            // 使用 Math.PI / 4 (45度) 作为间隔，从顶部（-90度）开始
            // 注意：SVG坐标系中，y轴向下，所以角度需要调整
            const angles = [
                -Math.PI / 2,           // top (0度，向上)
                -Math.PI / 4,           // top-right (45度)
                0,                      // right (90度，向右)
                Math.PI / 4,            // bottom-right (135度)
                Math.PI / 2,             // bottom (180度，向下)
                Math.PI * 3 / 4,        // bottom-left (225度)
                Math.PI,                 // left (270度，向左)
                -Math.PI * 3 / 4        // top-left (315度)
            ];
            
            return [
                { x: cx, y: cy - ry, name: 'top' },
                { x: cx + rx * Math.cos(angles[1]), y: cy + ry * Math.sin(angles[1]), name: 'top-right' },
                { x: cx + rx, y: cy, name: 'right' },
                { x: cx + rx * Math.cos(angles[3]), y: cy + ry * Math.sin(angles[3]), name: 'bottom-right' },
                { x: cx, y: cy + ry, name: 'bottom' },
                { x: cx + rx * Math.cos(angles[5]), y: cy + ry * Math.sin(angles[5]), name: 'bottom-left' },
                { x: cx - rx, y: cy, name: 'left' },
                { x: cx + rx * Math.cos(angles[7]), y: cy + ry * Math.sin(angles[7]), name: 'top-left' }
            ];
        }
        
        // 检测点是否在椭圆边缘附近，区分边和顶点
        isPointNearEdge(point, threshold = null) {
            if (threshold === null) {
                threshold = window.WebDrawConstants?.CIRCLE_EDGE_THRESHOLD || 15;
            }
            
            const bounds = this.getBounds();
            const cx = bounds.centerX;
            const cy = bounds.centerY;
            const rx = bounds.width / 2;
            const ry = bounds.height / 2;
            
            // 椭圆的四个顶点（上下左右）
            const vertices = [
                { x: cx, y: cy - ry, name: 'top' },
                { x: cx + rx, y: cy, name: 'right' },
                { x: cx, y: cy + ry, name: 'bottom' },
                { x: cx - rx, y: cy, name: 'left' }
            ];
            
            // 椭圆的四个边中点（对角线方向）
            const edgeMidpoints = [
                { x: cx + rx * Math.cos(-Math.PI / 4), y: cy + ry * Math.sin(-Math.PI / 4), name: 'top-right' },
                { x: cx + rx * Math.cos(Math.PI / 4), y: cy + ry * Math.sin(Math.PI / 4), name: 'bottom-right' },
                { x: cx + rx * Math.cos(Math.PI * 3 / 4), y: cy + ry * Math.sin(Math.PI * 3 / 4), name: 'bottom-left' },
                { x: cx + rx * Math.cos(-Math.PI * 3 / 4), y: cy + ry * Math.sin(-Math.PI * 3 / 4), name: 'top-left' }
            ];
            
            // 先检查是否靠近顶点（优先级更高）
            for (const vertex of vertices) {
                const dist = Math.sqrt(Math.pow(point.x - vertex.x, 2) + Math.pow(point.y - vertex.y, 2));
                if (dist <= threshold) {
                    return { near: true, type: 'vertex', name: vertex.name };
                }
            }
            
            // 再检查是否靠近边中点
            for (const edge of edgeMidpoints) {
                const dist = Math.sqrt(Math.pow(point.x - edge.x, 2) + Math.pow(point.y - edge.y, 2));
                if (dist <= threshold) {
                    return { near: true, type: 'edge', name: edge.name };
                }
            }
            
            return { near: false };
        }
        
        // 从边缘拖拽调整大小（Visio风格）
        resizeFromEdge(newPoint, dragStartPoint, resizeStartCenter, resizeStartRadius, resizeStartSize, edge, shiftKey = false) {
            if (!resizeStartSize || !resizeStartCenter) {
                console.warn('Ellipse resizeFromEdge: missing resizeStartSize or resizeStartCenter');
                return;
            }
            
            const MIN_SIZE = window.WebDrawConstants.MIN_SHAPE_SIZE || 20;
            const startWidth = resizeStartSize.width;
            const startHeight = resizeStartSize.height;
            const startCenterX = resizeStartCenter.x;
            const startCenterY = resizeStartCenter.y;
            
            // 计算增量
            const dx = newPoint.x - dragStartPoint.x;
            const dy = newPoint.y - dragStartPoint.y;
            
            // 如果没有edge信息，尝试从_lastDragInfo获取（用于顶点拖拽）
            const dragInfo = this._lastDragInfo || (edge ? { type: 'edge', name: edge } : null);
            
            if (dragInfo && dragInfo.type === 'vertex') {
                // 拖拽顶点
                if (shiftKey) {
                    // Shift+顶点：等比缩放（使用基类方法）
                    if (this._proportionalResize(newPoint, dragStartPoint, resizeStartCenter, resizeStartSize)) {
                        this.update();
                    }
                } else {
                    // 顶点：自由缩放（不等比）
                    switch (dragInfo.name) {
                        case 'top':
                            this.height = Math.max(MIN_SIZE, startHeight - dy * 2);
                            this.y = startCenterY - this.height / 2;
                            break;
                        case 'right':
                            this.width = Math.max(MIN_SIZE, startWidth + dx * 2);
                            this.x = startCenterX - this.width / 2;
                            break;
                        case 'bottom':
                            this.height = Math.max(MIN_SIZE, startHeight + dy * 2);
                            this.y = startCenterY - this.height / 2;
                            break;
                        case 'left':
                            this.width = Math.max(MIN_SIZE, startWidth - dx * 2);
                            this.x = startCenterX - this.width / 2;
                            break;
                    }
                    this.update();
                }
            } else {
                // 拖拽边：等比缩放（椭圆边的特性）
                if (this._proportionalResize(newPoint, dragStartPoint, resizeStartCenter, resizeStartSize)) {
                    this.update();
                }
            }
        }
    }
    
    window.WebDrawEllipseShape = EllipseShape;
})();

