/**
 * 自由文本类
 * 无边框的文本框，可以自由定位
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    const Shape = window.WebDrawShape;
    
    class FreeText extends Shape {
        constructor(x, y, text = '', id = null) {
            // 自由文本没有实际的宽度和高度，使用默认值
            // 实际大小由文本内容决定
            super('freetext', x, y, 100, 30, id);
            this.text = text;
            // 使用统一的字体大小配置，与形状内文字一致
            this.fontSize = window.WebDrawConstants?.TEXT_FONT_SIZE || 24;
            this.fontFamily = 'Arial, sans-serif';
            this.fill = '#333'; // 文本颜色
        }
        
        createElement(svg) {
            // 创建包装组
            this.groupElement = document.createElementNS(SVG_NS, 'g');
            this.groupElement.setAttribute('class', 'shape-group freetext-group');
            this.groupElement.setAttribute('data-id', this.id);
            this.groupElement.setAttribute('data-type', this.type);
            
            // 自由文本不创建形状元素，只创建文本元素
            this.element = null;
            
            // 将组添加到 SVG
            svg.appendChild(this.groupElement);
            
            this.update();
            return this.groupElement;
        }
        
        update() {
            if (!this.groupElement) return;
            
            // 移除旧的文本元素
            if (this.textElement && this.textElement.parentNode) {
                this.textElement.parentNode.removeChild(this.textElement);
            }
            
            // 如果不在编辑状态，显示文本
            if (!this.isEditing) {
                this.updateText();
            }
        }
        
        updateText() {
            if (!this.groupElement) return;
            
            // 移除旧的文本元素
            if (this.textElement && this.textElement.parentNode) {
                this.textElement.parentNode.removeChild(this.textElement);
            }
            
            // 如果没有文本，不显示
            if (!this.text || this.text.trim() === '') {
                return;
            }
            
            // 创建文本元素
            this.textElement = document.createElementNS(SVG_NS, 'text');
            this.textElement.setAttribute('class', 'shape-text freetext-text');
            this.textElement.setAttribute('x', this.x);
            this.textElement.setAttribute('y', this.y);
            // 不设置 font-size 属性，使用 CSS 中的统一配置
            // this.textElement.setAttribute('font-size', this.fontSize);
            this.textElement.setAttribute('font-family', this.fontFamily);
            this.textElement.setAttribute('fill', this.fill);
            this.textElement.setAttribute('text-anchor', 'start');
            this.textElement.setAttribute('dominant-baseline', 'hanging');
            this.textElement.textContent = this.text;
            
            // 将文本添加到组中
            this.groupElement.appendChild(this.textElement);
            
            // 更新边界框（基于文本实际大小）
            this.updateBounds();
        }
        
        /**
         * 更新边界框（基于文本内容）
         */
        updateBounds() {
            if (!this.textElement || !this.text) return;
            
            // 使用 SVG 的 getBBox 获取文本的实际边界
            try {
                const bbox = this.textElement.getBBox();
                this.x = bbox.x;
                this.y = bbox.y;
                this.width = bbox.width;
                this.height = bbox.height;
            } catch (e) {
                // 如果 getBBox 失败，使用估算值
                const fontSize = window.WebDrawConstants?.TEXT_FONT_SIZE || 24;
                const estimatedWidth = this.text.length * fontSize * 0.6;
                const estimatedHeight = fontSize * 1.2;
                this.width = estimatedWidth;
                this.height = estimatedHeight;
            }
        }
        
        getBounds() {
            // 如果文本元素存在，使用实际边界
            if (this.textElement) {
                try {
                    const bbox = this.textElement.getBBox();
                    return {
                        x: bbox.x,
                        y: bbox.y,
                        width: bbox.width,
                        height: bbox.height,
                        centerX: bbox.x + bbox.width / 2,
                        centerY: bbox.y + bbox.height / 2
                    };
                } catch (e) {
                    // 降级处理
                }
            }
            
            // 默认边界框
            return {
                x: this.x,
                y: this.y,
                width: this.width || 100,
                height: this.height || 30,
                centerX: this.x + (this.width || 100) / 2,
                centerY: this.y + (this.height || 30) / 2
            };
        }
        
        getCenter() {
            const bounds = this.getBounds();
            return {
                x: bounds.centerX,
                y: bounds.centerY
            };
        }
        
        move(dx, dy) {
            this.x += dx;
            this.y += dy;
            
            // 更新文本元素位置
            if (this.textElement) {
                this.textElement.setAttribute('x', this.x);
                this.textElement.setAttribute('y', this.y);
            }
            
            // 更新编辑器位置
            if (this.textEditorElement) {
                const currentX = parseFloat(this.textEditorElement.getAttribute('x')) || this.x;
                const currentY = parseFloat(this.textEditorElement.getAttribute('y')) || this.y;
                this.textEditorElement.setAttribute('x', currentX + dx);
                this.textEditorElement.setAttribute('y', currentY + dy);
            }
        }
        
        setPosition(x, y) {
            const dx = x - this.x;
            const dy = y - this.y;
            this.move(dx, dy);
        }
        
        // 开始编辑文本（自由文本创建后立即进入编辑模式）
        startTextEdit() {
            if (this.isEditing) {
                return;
            }
            
            const container = this.groupElement;
            if (!container) {
                return;
            }
            
            this.isEditing = true;
            
            // 移除显示文本
            if (this.textElement && this.textElement.parentNode) {
                this.textElement.parentNode.removeChild(this.textElement);
            }
            
            const SVG_NS = window.WebDrawConstants.SVG_NS;
            
            // 创建 foreignObject 用于嵌入 HTML 输入框
            this.textEditorElement = document.createElementNS(SVG_NS, 'foreignObject');
            
            // 计算位置和大小（自由文本使用固定大小，无边框）
            const width = 300; // 默认宽度
            const height = 40; // 默认高度
            
            this.textEditorElement.setAttribute('x', this.x);
            this.textEditorElement.setAttribute('y', this.y);
            this.textEditorElement.setAttribute('width', width);
            this.textEditorElement.setAttribute('height', height);
            this.textEditorElement.setAttribute('class', 'text-editor-foreign freetext-editor');
            // 确保 foreignObject 可以接收事件
            this.textEditorElement.style.pointerEvents = 'all';
            
            // 创建输入框（无边框）
            const input = document.createElement('input');
            input.type = 'text';
            input.value = this.text || '';
            input.className = 'shape-text-input freetext-input';
            input.placeholder = '输入文字...';
            input.style.cssText = `
                width: 100%;
                height: 100%;
                border: none;
                border-radius: 0;
                padding: 4px 8px;
                font-family: ${this.fontFamily};
                font-size: ${window.WebDrawConstants?.TEXT_FONT_SIZE || 24}px;
                text-align: left;
                outline: none;
                background: transparent;
                box-sizing: border-box;
                color: ${this.fill};
                pointer-events: all;
                position: relative;
                z-index: 1000;
            `;
            
            this.textEditorElement.appendChild(input);
            container.appendChild(this.textEditorElement);
            
            // 阻止输入框上的事件冒泡，避免被 SVG 事件处理干扰
            input.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            input.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            input.addEventListener('mousemove', (e) => {
                e.stopPropagation();
            });
            this.textEditorElement.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            this.textEditorElement.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // 延迟聚焦，确保 DOM 已完全更新
            setTimeout(() => {
                try {
                    input.focus();
                    input.select();
                } catch (e) {
                    console.warn('[FreeText Debug] startTextEdit - Failed to focus input:', e);
                }
            }, 10);
            
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
            
            const newText = this.textInputElement.value;
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
            
            // 如果文本为空，删除这个自由文本对象
            if (!this.text || this.text.trim() === '') {
                // 从父节点移除
                if (this.groupElement && this.groupElement.parentNode) {
                    this.groupElement.parentNode.removeChild(this.groupElement);
                }
            } else {
                // 恢复显示文本
                this.updateText();
            }
        }
        
        // 获取连接点（自由文本使用文本边界框的四个角）
        getConnectionPoints() {
            const bounds = this.getBounds();
            return [
                { x: bounds.centerX, y: bounds.y, name: 'top' },
                { x: bounds.x + bounds.width, y: bounds.centerY, name: 'right' },
                { x: bounds.centerX, y: bounds.y + bounds.height, name: 'bottom' },
                { x: bounds.x, y: bounds.centerY, name: 'left' }
            ];
        }
        
        toJSON() {
            return {
                id: this.id,
                type: this.type,
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height,
                text: this.text,
                fontSize: this.fontSize,
                fontFamily: this.fontFamily,
                fill: this.fill
            };
        }
        
        static fromJSON(data) {
            const freeText = new FreeText(data.x || 0, data.y || 0, data.text || '', data.id);
            // 使用统一的字体大小配置
            freeText.fontSize = window.WebDrawConstants?.TEXT_FONT_SIZE || 24;
            freeText.fontFamily = data.fontFamily || 'Arial, sans-serif';
            freeText.fill = data.fill || '#333';
            freeText.width = data.width || 100;
            freeText.height = data.height || 30;
            return freeText;
        }
    }
    
    window.WebDrawFreeText = FreeText;
})();

