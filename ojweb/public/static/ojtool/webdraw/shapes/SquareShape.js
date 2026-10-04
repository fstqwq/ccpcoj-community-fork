/**
 * 正方形形状
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    const MIN_SIZE = window.WebDrawConstants.MIN_SHAPE_SIZE;
    const Shape = window.WebDrawShape;
    
    class SquareShape extends Shape {
        constructor(x, y, size, id = null) {
            super('square', x, y, size, size, id);
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
            // 保持正方形
            const size = Math.min(this.width, this.height);
            this.width = size;
            this.height = size;
            this.element.setAttribute('x', this.x);
            this.element.setAttribute('y', this.y);
            this.element.setAttribute('width', this.width);
            this.element.setAttribute('height', this.height);
            this.updateText();
        }
        
        resize(dw, dh) {
            const size = Math.max(MIN_SIZE, Math.max(this.width + dw, this.height + dh));
            this.width = size;
            this.height = size;
            this.update();
        }
        
        // 重写 resizeFromEdge 以保持正方形特性
        resizeFromEdge(newPoint, dragStartPoint = null, resizeStartCenter = null, resizeStartRadius = null, resizeStartSize = null, edge = null) {
            if (dragStartPoint && resizeStartSize && resizeStartCenter) {
                // 计算从拖拽起始点到当前点的增量
                const dx = newPoint.x - dragStartPoint.x;
                const dy = newPoint.y - dragStartPoint.y;
                
                const MIN_SIZE = window.WebDrawConstants?.MIN_SHAPE_SIZE || 20;
                
                // 根据边缘信息调整尺寸，但保持正方形（宽高相等）
                let newSize;
                if (edge === 'left' || edge === 'right') {
                    // 左右边缘：根据宽度变化调整
                    const newWidth = edge === 'left' 
                        ? Math.max(MIN_SIZE, resizeStartSize.width - dx)
                        : Math.max(MIN_SIZE, resizeStartSize.width + dx);
                    newSize = newWidth;
                } else if (edge === 'top' || edge === 'bottom') {
                    // 上下边缘：根据高度变化调整
                    const newHeight = edge === 'top'
                        ? Math.max(MIN_SIZE, resizeStartSize.height - dy)
                        : Math.max(MIN_SIZE, resizeStartSize.height + dy);
                    newSize = newHeight;
                } else {
                    // 如果没有边缘信息，使用较大的增量（保持正方形）
                    const maxDelta = Math.max(Math.abs(dx), Math.abs(dy));
                    const sign = (Math.abs(dx) > Math.abs(dy)) ? (dx > 0 ? 1 : -1) : (dy > 0 ? 1 : -1);
                    newSize = Math.max(MIN_SIZE, resizeStartSize.width + sign * maxDelta);
                }
                
                // 保持正方形
                this.width = newSize;
                this.height = newSize;
                
                // 根据边缘调整位置（保持对应边缘位置不变）
                if (edge === 'left') {
                    // 左边缘：保持右边缘位置不变
                    const rightEdgeX = resizeStartCenter.x + resizeStartSize.width / 2;
                    this.x = rightEdgeX - newSize / 2;
                    // 保持中心y不变（因为只调整宽度）
                    this.y = resizeStartCenter.y - newSize / 2;
                } else if (edge === 'right') {
                    // 右边缘：保持左边缘位置不变
                    const leftEdgeX = resizeStartCenter.x - resizeStartSize.width / 2;
                    this.x = leftEdgeX;
                    // 保持中心y不变（因为只调整宽度）
                    this.y = resizeStartCenter.y - newSize / 2;
                } else if (edge === 'top') {
                    // 上边缘：保持下边缘位置不变
                    const bottomEdgeY = resizeStartCenter.y + resizeStartSize.height / 2;
                    this.y = bottomEdgeY - newSize / 2;
                    // 保持中心x不变（因为只调整高度）
                    this.x = resizeStartCenter.x - newSize / 2;
                } else if (edge === 'bottom') {
                    // 下边缘：保持上边缘位置不变
                    const topEdgeY = resizeStartCenter.y - resizeStartSize.height / 2;
                    this.y = topEdgeY;
                    // 保持中心x不变（因为只调整高度）
                    this.x = resizeStartCenter.x - newSize / 2;
                } else {
                    // 默认：保持中心点不变
                    this.x = resizeStartCenter.x - newSize / 2;
                    this.y = resizeStartCenter.y - newSize / 2;
                }
                
                this.update();
            } else {
                // 如果没有提供起始信息，调用基类方法
                super.resizeFromEdge(newPoint, dragStartPoint, resizeStartCenter, resizeStartRadius, resizeStartSize, edge);
            }
        }
    }
    
    window.WebDrawSquareShape = SquareShape;
})();

