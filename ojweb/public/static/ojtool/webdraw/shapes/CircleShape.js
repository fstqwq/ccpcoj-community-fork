/**
 * 正圆形状
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    const MIN_SIZE = window.WebDrawConstants.MIN_SHAPE_SIZE;
    const Shape = window.WebDrawShape;
    
    class CircleShape extends Shape {
        constructor(x, y, diameter, id = null) {
            super('circle', x, y, diameter, diameter, id);
        }
        
        createElement(svg) {
            // 创建包装组
            this.groupElement = document.createElementNS(SVG_NS, 'g');
            this.groupElement.setAttribute('class', 'shape-group');
            this.groupElement.setAttribute('data-id', this.id);
            this.groupElement.setAttribute('data-type', this.type);
            
            // 创建形状元素
            this.element = document.createElementNS(SVG_NS, 'circle');
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
            // 保持圆形
            const diameter = Math.min(this.width, this.height);
            this.width = diameter;
            this.height = diameter;
            const r = diameter / 2;
            const cx = this.x + r;
            const cy = this.y + r;
            this.element.setAttribute('cx', cx);
            this.element.setAttribute('cy', cy);
            this.element.setAttribute('r', r);
            this.updateText();
        }
        
        getBounds() {
            const r = Math.min(this.width, this.height) / 2;
            return {
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height,
                centerX: this.x + r,
                centerY: this.y + r,
                radius: r
            };
        }
        
        getConnectionPoints() {
            // 圆形：8个连接点在圆周上（45度间隔）
            const bounds = this.getBounds();
            const cx = bounds.centerX;
            const cy = bounds.centerY;
            const r = bounds.radius;
            
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
                { x: cx, y: cy - r, name: 'top' },
                { x: cx + r * Math.cos(angles[1]), y: cy + r * Math.sin(angles[1]), name: 'top-right' },
                { x: cx + r, y: cy, name: 'right' },
                { x: cx + r * Math.cos(angles[3]), y: cy + r * Math.sin(angles[3]), name: 'bottom-right' },
                { x: cx, y: cy + r, name: 'bottom' },
                { x: cx + r * Math.cos(angles[5]), y: cy + r * Math.sin(angles[5]), name: 'bottom-left' },
                { x: cx - r, y: cy, name: 'left' },
                { x: cx + r * Math.cos(angles[7]), y: cy + r * Math.sin(angles[7]), name: 'top-left' }
            ];
        }
        
        // 检测点是否在圆形边缘附近（用于边缘拖拽调整大小）
        isPointNearEdge(point, threshold = null) {
            // 如果没有提供阈值，使用常量中的默认值
            if (threshold === null) {
                threshold = window.WebDrawConstants?.CIRCLE_EDGE_THRESHOLD || 15;
            }
            const bounds = this.getBounds();
            const cx = bounds.centerX;
            const cy = bounds.centerY;
            const r = bounds.radius;
            
            // 计算点到圆心的距离
            const distToCenter = Math.sqrt(
                Math.pow(point.x - cx, 2) + 
                Math.pow(point.y - cy, 2)
            );
            
            // 如果点在圆内或圆外，但距离边缘在阈值内，则认为在边缘附近
            const distToEdge = Math.abs(distToCenter - r);
            const result = distToEdge <= threshold;
            
            // 返回对象格式以保持一致性（圆形不使用edge信息，因为从圆心计算）
            return result ? { near: true } : { near: false };
        }
        
        resize(dw, dh) {
            // 正圆调整大小：以圆心为中心，计算到调整手柄的距离作为新半径
            const currentR = Math.min(this.width, this.height) / 2;
            const centerX = this.x + currentR;
            const centerY = this.y + currentR;
            
            // 调整手柄原本在右下角 (this.x + this.width, this.y + this.height)
            // 新位置是 (this.x + this.width + dw, this.y + this.height + dh)
            const oldHandleX = this.x + this.width;
            const oldHandleY = this.y + this.height;
            const newHandleX = oldHandleX + dw;
            const newHandleY = oldHandleY + dh;
            
            // 计算从圆心到新手柄位置的距离作为新半径
            const newRadius = Math.sqrt(
                Math.pow(newHandleX - centerX, 2) + 
                Math.pow(newHandleY - centerY, 2)
            );
            
            const diameter = Math.max(MIN_SIZE, newRadius * 2);
            this.width = diameter;
            this.height = diameter;
            
            // 更新位置，保持圆心不变
            this.x = centerX - diameter / 2;
            this.y = centerY - diameter / 2;
            
            this.update();
        }
    }
    
    window.WebDrawCircleShape = CircleShape;
})();

