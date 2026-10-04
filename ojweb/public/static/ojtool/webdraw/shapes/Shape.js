/**
 * Shape 基类
 * 所有形状的基类，提供通用的属性和方法
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    const MIN_SIZE = window.WebDrawConstants.MIN_SHAPE_SIZE;
    
    class Shape {
        constructor(type, x, y, width, height, id = null) {
            this.type = type;
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.id = id || `shape-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
            this.text = '';
            this.textAlign = 'center'; // 'left', 'center', 'right'
            this.textVerticalAlign = 'middle'; // 'top', 'middle', 'bottom'
            this.element = null; // 形状元素（rect, circle等）
            this.groupElement = null; // 包装组（g元素），包含形状和文本
            this.textElement = null;
            this.textEditorElement = null; // 可编辑的文本元素（foreignObject）
            this.isEditing = false; // 是否正在编辑
        }
        
        // 获取边界框
        getBounds() {
            return {
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height,
                centerX: this.x + this.width / 2,
                centerY: this.y + this.height / 2
            };
        }
        
        // 获取中心点
        getCenter() {
            return {
                x: this.x + this.width / 2,
                y: this.y + this.height / 2
            };
        }
        
        // 移动到新位置
        move(dx, dy) {
            this.x += dx;
            this.y += dy;
            this.update();
        }
        
        // 设置位置
        setPosition(x, y) {
            this.x = x;
            this.y = y;
            this.update();
        }
        
        // 调整大小
        resize(dw, dh) {
            this.width = Math.max(MIN_SIZE, this.width + dw);
            this.height = Math.max(MIN_SIZE, this.height + dh);
            this.update();
        }
        
        // 设置大小
        setSize(width, height) {
            this.width = Math.max(MIN_SIZE, width);
            this.height = Math.max(MIN_SIZE, height);
            this.update();
        }
        
        // 设置文本
        setText(text) {
            this.text = text || '';
            this.updateText();
        }
        
        // 设置文本对齐
        setTextAlign(horizontal, vertical) {
            if (horizontal) this.textAlign = horizontal;
            if (vertical) this.textVerticalAlign = vertical;
            this.updateText();
        }
        
        // 创建 SVG 元素（子类实现）
        createElement(svg) {
            throw new Error('createElement must be implemented by subclass');
        }
        
        // 更新 SVG 元素（子类实现）
        update() {
            throw new Error('update must be implemented by subclass');
        }
        
        // 更新文本元素
        updateText() {
            // 如果正在编辑，不更新（保持编辑状态）
            if (this.isEditing && this.textEditorElement) {
                return;
            }
            
            // 使用 groupElement 或 element 的父节点（SVG根元素）
            const container = this.groupElement || (this.element ? this.element.parentNode : null);
            if (!container) return;
            
            // 移除旧文本和编辑器
            if (this.textElement) {
                if (this.textElement.parentNode) {
                    this.textElement.parentNode.removeChild(this.textElement);
                }
                this.textElement = null;
            }
            if (this.textEditorElement) {
                if (this.textEditorElement.parentNode) {
                    this.textEditorElement.parentNode.removeChild(this.textEditorElement);
                }
                this.textEditorElement = null;
            }
            
            if (!this.text || this.text.trim() === '') {
                return;
            }
            
            // 创建新文本元素
            this.textElement = document.createElementNS(SVG_NS, 'text');
            this.textElement.setAttribute('class', 'shape-text');
            this.textElement.textContent = this.text;
            
            const bounds = this.getBounds();
            let x, y;
            
            // 水平对齐
            switch (this.textAlign) {
                case 'left':
                    x = bounds.x + 5;
                    this.textElement.setAttribute('text-anchor', 'start');
                    break;
                case 'right':
                    x = bounds.x + bounds.width - 5;
                    this.textElement.setAttribute('text-anchor', 'end');
                    break;
                default: // center
                    x = bounds.centerX;
                    this.textElement.setAttribute('text-anchor', 'middle');
            }
            
            // 垂直对齐
            switch (this.textVerticalAlign) {
                case 'top':
                    y = bounds.y + 15;
                    this.textElement.setAttribute('dominant-baseline', 'hanging');
                    break;
                case 'bottom':
                    y = bounds.y + bounds.height - 5;
                    this.textElement.setAttribute('dominant-baseline', 'text-before-edge');
                    break;
                default: // middle
                    y = bounds.centerY;
                    this.textElement.setAttribute('dominant-baseline', 'middle');
            }
            
            this.textElement.setAttribute('x', x);
            this.textElement.setAttribute('y', y);
            
            // 将文本添加到容器中（groupElement 或 SVG 根元素）
            container.appendChild(this.textElement);
        }
        
        // 开始编辑文本（直接在图形内）
        startTextEdit() {
            if (this.isEditing) return;
            
            const container = this.groupElement || (this.element ? this.element.parentNode : null);
            if (!container) return;
            
            this.isEditing = true;
            
            // 移除显示文本
            if (this.textElement && this.textElement.parentNode) {
                this.textElement.parentNode.removeChild(this.textElement);
            }
            
            const bounds = this.getBounds();
            const SVG_NS = window.WebDrawConstants.SVG_NS;
            
            // 创建 foreignObject 用于嵌入 HTML 输入框
            this.textEditorElement = document.createElementNS(SVG_NS, 'foreignObject');
            
            // 计算位置和大小
            let x, y, width, height;
            width = Math.max(100, bounds.width - 10);
            height = Math.max(30, bounds.height - 10);
            
            switch (this.textAlign) {
                case 'left':
                    x = bounds.x + 5;
                    break;
                case 'right':
                    x = bounds.x + bounds.width - width - 5;
                    break;
                default: // center
                    x = bounds.x + (bounds.width - width) / 2;
            }
            
            switch (this.textVerticalAlign) {
                case 'top':
                    y = bounds.y + 5;
                    break;
                case 'bottom':
                    y = bounds.y + bounds.height - height - 5;
                    break;
                default: // middle
                    y = bounds.y + (bounds.height - height) / 2;
            }
            
            this.textEditorElement.setAttribute('x', x);
            this.textEditorElement.setAttribute('y', y);
            this.textEditorElement.setAttribute('width', width);
            this.textEditorElement.setAttribute('height', height);
            this.textEditorElement.setAttribute('class', 'text-editor-foreign');
            
            // 创建输入框
            const input = document.createElement('input');
            input.type = 'text';
            input.value = this.text || '';
            input.className = 'shape-text-input';
            input.style.cssText = `
                width: 100%;
                height: 100%;
                border: 2px solid #0d6efd;
                border-radius: 4px;
                padding: 4px 8px;
                font-family: Arial, sans-serif;
                font-size: ${window.WebDrawConstants?.TEXT_FONT_SIZE || 24}px;
                text-align: ${this.textAlign};
                outline: none;
                background: rgba(255, 255, 255, 0.95);
                box-sizing: border-box;
            `;
            
            this.textEditorElement.appendChild(input);
            container.appendChild(this.textEditorElement);
            
            // 聚焦并选中文本
            input.focus();
            input.select();
            
            // 事件处理
            const finishEdit = () => {
                this.finishTextEdit();
            };
            
            const cancelEdit = () => {
                this.cancelTextEdit();
            };
            
            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    finishEdit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEdit();
                }
            });
            
            // 保存引用以便后续使用
            this.textInputElement = input;
        }
        
        // 完成文本编辑
        finishTextEdit() {
            if (!this.isEditing || !this.textInputElement) return;
            
            const newText = this.textInputElement.value.trim();
            this.text = newText;
            this.isEditing = false;
            
            // 移除编辑器
            if (this.textEditorElement && this.textEditorElement.parentNode) {
                this.textEditorElement.parentNode.removeChild(this.textEditorElement);
            }
            this.textEditorElement = null;
            this.textInputElement = null;
            
            // 更新显示文本
            this.updateText();
            
            // 通知 WebDrawApp 保存状态（文本编辑完成后立即保存）
            // 通过全局 WebDrawApp 实例保存状态
            try {
                if (window.WebDrawApp && typeof window.WebDrawApp.getInstance === 'function') {
                    const app = window.WebDrawApp.getInstance();
                    if (app) {
                        // 使用 WebDrawHistory.saveState 保存状态（会自动保存到 IndexedDB）
                        if (window.WebDrawHistory && typeof window.WebDrawHistory.saveState === 'function') {
                            window.WebDrawHistory.saveState(app);
                        }
                    }
                }
            } catch (error) {
                console.warn('Failed to save state after text edit:', error);
            }
        }
        
        // 取消文本编辑
        cancelTextEdit() {
            if (!this.isEditing) return;
            
            this.isEditing = false;
            
            // 移除编辑器
            if (this.textEditorElement && this.textEditorElement.parentNode) {
                this.textEditorElement.parentNode.removeChild(this.textEditorElement);
            }
            this.textEditorElement = null;
            this.textInputElement = null;
            
            // 恢复显示文本
            this.updateText();
        }
        
        // 获取连接点（上、右、下、左）
        getConnectionPoints() {
            const bounds = this.getBounds();
            // 8个连接点：上、右上、右、右下、下、左下、左、左上
            return [
                { x: bounds.centerX, y: bounds.y, name: 'top' },
                { x: bounds.x + bounds.width, y: bounds.y, name: 'top-right' },
                { x: bounds.x + bounds.width, y: bounds.centerY, name: 'right' },
                { x: bounds.x + bounds.width, y: bounds.y + bounds.height, name: 'bottom-right' },
                { x: bounds.centerX, y: bounds.y + bounds.height, name: 'bottom' },
                { x: bounds.x, y: bounds.y + bounds.height, name: 'bottom-left' },
                { x: bounds.x, y: bounds.centerY, name: 'left' },
                { x: bounds.x, y: bounds.y, name: 'top-left' }
            ];
        }
        
        // 查找最近的连接点
        findNearestConnectionPoint(point) {
            const points = this.getConnectionPoints();
            let minDist = Infinity;
            let nearest = null;
            
            points.forEach(p => {
                const dist = Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2));
                if (dist < minDist) {
                    minDist = dist;
                    nearest = p.name;
                }
            });
            
            return nearest;
        }
        
        // 检测点是否在形状边缘附近（用于边缘拖拽调整大小）
        // 默认实现：检测点是否在边界框的边缘附近（适用于矩形、正方形等）
        // 子类可以重写此方法以实现特定逻辑（如圆形）
        // 返回 {near: boolean, edge: string} 或 boolean（向后兼容）
        isPointNearEdge(point, threshold = null) {
            // 如果没有提供阈值，使用常量中的默认值
            if (threshold === null) {
                threshold = window.WebDrawConstants?.CIRCLE_EDGE_THRESHOLD || 15;
            }
            
            const bounds = this.getBounds();
            const { x, y, width, height } = bounds;
            
            // 计算点到各边的距离
            const distToLeft = Math.abs(point.x - x);
            const distToRight = Math.abs(point.x - (x + width));
            const distToTop = Math.abs(point.y - y);
            const distToBottom = Math.abs(point.y - (y + height));
            
            // 检查点是否在边界框内或附近
            const isNearLeft = distToLeft <= threshold && point.y >= y - threshold && point.y <= y + height + threshold;
            const isNearRight = distToRight <= threshold && point.y >= y - threshold && point.y <= y + height + threshold;
            const isNearTop = distToTop <= threshold && point.x >= x - threshold && point.x <= x + width + threshold;
            const isNearBottom = distToBottom <= threshold && point.x >= x - threshold && point.x <= x + width + threshold;
            
            // 找到最近的边
            if (isNearLeft || isNearRight || isNearTop || isNearBottom) {
                const distances = [
                    { edge: 'left', dist: distToLeft },
                    { edge: 'right', dist: distToRight },
                    { edge: 'top', dist: distToTop },
                    { edge: 'bottom', dist: distToBottom }
                ];
                distances.sort((a, b) => a.dist - b.dist);
                return { near: true, edge: distances[0].edge };
            }
            
            return { near: false };
        }
        
        // 等比缩放（从中心点计算比例）
        _proportionalResize(newPoint, dragStartPoint, resizeStartCenter, resizeStartSize) {
            const MIN_SIZE = window.WebDrawConstants?.MIN_SHAPE_SIZE || 20;
            const distToNew = Math.sqrt(
                Math.pow(newPoint.x - resizeStartCenter.x, 2) + 
                Math.pow(newPoint.y - resizeStartCenter.y, 2)
            );
            const distToStart = Math.sqrt(
                Math.pow(dragStartPoint.x - resizeStartCenter.x, 2) + 
                Math.pow(dragStartPoint.y - resizeStartCenter.y, 2)
            );
            
            if (distToStart > 0) {
                const scale = distToNew / distToStart;
                const newWidth = Math.max(MIN_SIZE, resizeStartSize.width * scale);
                const newHeight = Math.max(MIN_SIZE, resizeStartSize.height * scale);
                
                this.width = newWidth;
                this.height = newHeight;
                this.x = resizeStartCenter.x - newWidth / 2;
                this.y = resizeStartCenter.y - newHeight / 2;
                return true;
            }
            return false;
        }
        
        // 单向缩放（根据边缘方向）
        _unidirectionalResize(edge, dx, dy, resizeStartCenter, resizeStartSize) {
            const MIN_SIZE = window.WebDrawConstants?.MIN_SHAPE_SIZE || 20;
            
            if (edge === 'left') {
                const newWidth = Math.max(MIN_SIZE, resizeStartSize.width - dx);
                this.width = newWidth;
                const rightEdgeX = resizeStartCenter.x + resizeStartSize.width / 2;
                this.x = rightEdgeX - newWidth;
            } else if (edge === 'right') {
                const newWidth = Math.max(MIN_SIZE, resizeStartSize.width + dx);
                this.width = newWidth;
                const leftEdgeX = resizeStartCenter.x - resizeStartSize.width / 2;
                this.x = leftEdgeX;
            } else if (edge === 'top') {
                const newHeight = Math.max(MIN_SIZE, resizeStartSize.height - dy);
                this.height = newHeight;
                const bottomEdgeY = resizeStartCenter.y + resizeStartSize.height / 2;
                this.y = bottomEdgeY - newHeight;
            } else if (edge === 'bottom') {
                const newHeight = Math.max(MIN_SIZE, resizeStartSize.height + dy);
                this.height = newHeight;
                const topEdgeY = resizeStartCenter.y - resizeStartSize.height / 2;
                this.y = topEdgeY;
            } else {
                return false;
            }
            return true;
        }
        
        // 从边缘拖拽调整大小的统一接口
        // 默认实现：使用增量调整（适用于矩形、正方形等）
        // 子类可以重写此方法以实现特定逻辑（如圆形从圆心计算、菱形区分顶点和边）
        resizeFromEdge(newPoint, dragStartPoint = null, resizeStartCenter = null, resizeStartRadius = null, resizeStartSize = null, edge = null, shiftKey = false) {
            // 默认实现：使用从拖拽起始点到当前点的增量
            // 这样计算更准确，避免从中心点计算导致的缩放错误
            if (dragStartPoint && resizeStartSize && resizeStartCenter) {
                // 计算从拖拽起始点到当前点的增量
                const dx = newPoint.x - dragStartPoint.x;
                const dy = newPoint.y - dragStartPoint.y;
                
                // 如果提供了边缘信息，使用单向缩放
                if (edge && this._unidirectionalResize(edge, dx, dy, resizeStartCenter, resizeStartSize)) {
                    this.update();
                    return;
                }
                
                // 默认：使用增量调整
                const MIN_SIZE = window.WebDrawConstants?.MIN_SHAPE_SIZE || 20;
                this.width = Math.max(MIN_SIZE, resizeStartSize.width + dx);
                this.height = Math.max(MIN_SIZE, resizeStartSize.height + dy);
                this.x = resizeStartCenter.x - this.width / 2;
                this.y = resizeStartCenter.y - this.height / 2;
                
                this.update();
            } else {
                // 如果没有提供起始信息，使用默认的增量调整
                console.warn('resizeFromEdge called without dragStartPoint/resizeStartSize/resizeStartCenter');
            }
        }
        
        // 转换为 JSON
        toJSON() {
            return {
                type: this.type,
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height,
                id: this.id,
                text: this.text,
                textAlign: this.textAlign,
                textVerticalAlign: this.textVerticalAlign
            };
        }
        
        // 复制
        clone() {
            const data = this.toJSON();
            const ShapeFactory = window.WebDrawShapes;
            const cloned = ShapeFactory.fromJSON(data);
            cloned.id = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
            return cloned;
        }
    }
    
    window.WebDrawShape = Shape;
})();

