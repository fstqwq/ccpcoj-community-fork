/**
 * 矩形形状
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    const Shape = window.WebDrawShape;
    
    class RectShape extends Shape {
        constructor(x, y, width, height, id = null) {
            super('rect', x, y, width, height, id);
        }
        
        createElement(svg) {
            // 创建包装组
            this.groupElement = document.createElementNS(SVG_NS, 'g');
            this.groupElement.setAttribute('class', 'shape-group');
            this.groupElement.setAttribute('data-id', this.id);
            this.groupElement.setAttribute('data-type', this.type);
            
            // 创建形状元素
            this.element = document.createElementNS(SVG_NS, 'rect');
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
            this.element.setAttribute('x', this.x);
            this.element.setAttribute('y', this.y);
            this.element.setAttribute('width', this.width);
            this.element.setAttribute('height', this.height);
            this.updateText();
        }
        
        // 检测点是否在矩形边缘附近，区分边和顶点
        isPointNearEdge(point, threshold = null) {
            if (threshold === null) {
                threshold = window.WebDrawConstants?.CIRCLE_EDGE_THRESHOLD || 15;
            }
            
            const bounds = this.getBounds();
            const { x, y, width, height } = bounds;
            
            // 矩形的四个顶点
            const vertices = [
                { x: x, y: y, name: 'top-left' },
                { x: x + width, y: y, name: 'top-right' },
                { x: x + width, y: y + height, name: 'bottom-right' },
                { x: x, y: y + height, name: 'bottom-left' }
            ];
            
            // 矩形的四条边中点
            const edgeMidpoints = [
                { x: x + width / 2, y: y, name: 'top' },
                { x: x + width, y: y + height / 2, name: 'right' },
                { x: x + width / 2, y: y + height, name: 'bottom' },
                { x: x, y: y + height / 2, name: 'left' }
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
                console.warn('Rect resizeFromEdge: missing resizeStartSize or resizeStartCenter');
                return;
            }
            
            const MIN_SIZE = window.WebDrawConstants.MIN_SHAPE_SIZE || 20;
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
                    const startWidth = resizeStartSize.width;
                    const startHeight = resizeStartSize.height;
                    const startCenterX = resizeStartCenter.x;
                    const startCenterY = resizeStartCenter.y;
                    
                    let newWidth = startWidth;
                    let newHeight = startHeight;
                    
                    switch (dragInfo.name) {
                        case 'top-left':
                            newWidth = Math.max(MIN_SIZE, startWidth - dx);
                            newHeight = Math.max(MIN_SIZE, startHeight - dy);
                            break;
                        case 'top-right':
                            newWidth = Math.max(MIN_SIZE, startWidth + dx);
                            newHeight = Math.max(MIN_SIZE, startHeight - dy);
                            break;
                        case 'bottom-right':
                            newWidth = Math.max(MIN_SIZE, startWidth + dx);
                            newHeight = Math.max(MIN_SIZE, startHeight + dy);
                            break;
                        case 'bottom-left':
                            newWidth = Math.max(MIN_SIZE, startWidth - dx);
                            newHeight = Math.max(MIN_SIZE, startHeight + dy);
                            break;
                    }
                    
                    this.width = newWidth;
                    this.height = newHeight;
                    this.x = startCenterX - newWidth / 2;
                    this.y = startCenterY - newHeight / 2;
                    this.update();
                }
            } else {
                // 拖拽边：单向缩放（使用基类方法）
                if (!this._unidirectionalResize(edge, dx, dy, resizeStartCenter, resizeStartSize)) {
                    // 如果基类方法失败，使用默认增量调整
                    this.width = Math.max(MIN_SIZE, resizeStartSize.width + dx);
                    this.height = Math.max(MIN_SIZE, resizeStartSize.height + dy);
                    this.x = resizeStartCenter.x - this.width / 2;
                    this.y = resizeStartCenter.y - this.height / 2;
                }
                this.update();
            }
        }
    }
    
    window.WebDrawRectShape = RectShape;
})();

