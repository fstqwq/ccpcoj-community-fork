/**
 * 导出功能
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    
    // 获取样式规则并转换为内联样式
    function getStyleRules() {
        const styles = `
            .shape {
                stroke: #333;
                stroke-width: 3;
                fill: #ffffff;
                fill-opacity: 0.9;
            }
            .shape.selected {
                stroke: #0d6efd;
                stroke-width: 4;
                stroke-dasharray: 5,5;
            }
            .shape-text {
                font-family: Arial, sans-serif;
                font-size: 18px;
                fill: #333;
            }
            .connector-line {
                stroke: #333;
                stroke-width: 2.5;
                fill: none;
            }
            .connector-line.selected {
                stroke: #0d6efd;
                stroke-width: 3.5;
            }
            .arrow-marker {
                fill: #333;
            }
        `;
        return styles;
    }
    
    // 将样式应用到SVG元素
    function applyStylesToSVG(svgClone) {
        // 移除选择状态类
        svgClone.querySelectorAll('.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // 移除选择框
        svgClone.querySelectorAll('.selection-box').forEach(el => {
            el.remove();
        });
        
        // 移除调整手柄
        svgClone.querySelectorAll('.resize-handle').forEach(el => {
            el.remove();
        });
        
        // 添加样式定义
        let styleDefs = svgClone.querySelector('defs');
        if (!styleDefs) {
            styleDefs = document.createElementNS(SVG_NS, 'defs');
            svgClone.insertBefore(styleDefs, svgClone.firstChild);
        }
        
        const style = document.createElementNS(SVG_NS, 'style');
        style.textContent = getStyleRules();
        styleDefs.appendChild(style);
        
        // 确保所有形状都有正确的样式属性
        svgClone.querySelectorAll('.shape').forEach(shape => {
            if (!shape.getAttribute('stroke')) {
                shape.setAttribute('stroke', '#333');
            }
            if (!shape.getAttribute('stroke-width')) {
                shape.setAttribute('stroke-width', '3');
            }
            if (!shape.getAttribute('fill')) {
                shape.setAttribute('fill', '#ffffff');
            }
            if (!shape.getAttribute('fill-opacity')) {
                shape.setAttribute('fill-opacity', '0.9');
            }
        });
        
        // 确保连接线有正确的样式
        svgClone.querySelectorAll('.connector-line').forEach(line => {
            if (!line.getAttribute('stroke')) {
                line.setAttribute('stroke', '#333');
            }
            if (!line.getAttribute('stroke-width')) {
                line.setAttribute('stroke-width', '2.5');
            }
            if (!line.getAttribute('fill')) {
                line.setAttribute('fill', 'none');
            }
        });
        
        // 确保文本有正确的样式
        svgClone.querySelectorAll('.shape-text').forEach(text => {
            if (!text.getAttribute('fill')) {
                text.setAttribute('fill', '#333');
            }
        });
    }
    
    // 计算所有图形的最小包围矩形
    function calculateBoundingBox(shapes, connectors) {
        if ((!shapes || shapes.length === 0) && (!connectors || connectors.length === 0)) {
            return { x: 0, y: 0, width: 800, height: 600 };
        }
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        // stroke-width 的一半（用于扩展边界）
        const strokeHalf = 1.5; // stroke-width 默认是 2.5，一半是 1.25，取 1.5 更安全
        
        // 计算形状的边界
        if (shapes && shapes.length > 0) {
            shapes.forEach(shape => {
                const bounds = shape.getBounds();
                
                // 对于圆形和椭圆，需要考虑半径和stroke
                if (shape.type === 'circle') {
                    const r = bounds.radius || (bounds.width / 2);
                    const cx = bounds.centerX;
                    const cy = bounds.centerY;
                    // 实际边界包括stroke
                    const actualR = r + strokeHalf;
                    minX = Math.min(minX, cx - actualR);
                    minY = Math.min(minY, cy - actualR);
                    maxX = Math.max(maxX, cx + actualR);
                    maxY = Math.max(maxY, cy + actualR);
                } else if (shape.type === 'ellipse') {
                    const rx = bounds.width / 2;
                    const ry = bounds.height / 2;
                    const cx = bounds.centerX;
                    const cy = bounds.centerY;
                    // 实际边界包括stroke
                    const actualRx = rx + strokeHalf;
                    const actualRy = ry + strokeHalf;
                    minX = Math.min(minX, cx - actualRx);
                    minY = Math.min(minY, cy - actualRy);
                    maxX = Math.max(maxX, cx + actualRx);
                    maxY = Math.max(maxY, cy + actualRy);
                } else {
                    // 矩形、正方形、菱形等：直接使用边界框，但需要考虑stroke
                    minX = Math.min(minX, bounds.x - strokeHalf);
                    minY = Math.min(minY, bounds.y - strokeHalf);
                    maxX = Math.max(maxX, bounds.x + bounds.width + strokeHalf);
                    maxY = Math.max(maxY, bounds.y + bounds.height + strokeHalf);
                }
            });
        }
        
        // 计算连接线的边界（使用实际坐标，考虑吸附到形状的情况）
        if (connectors && connectors.length > 0) {
            connectors.forEach(connector => {
                let startX, startY, endX, endY;
                
                // 获取起点实际坐标
                if (connector.startShapeId && connector.startPoint && connector.appInstance) {
                    const shape = window.WebDrawFinders.findShapeById(connector.appInstance, connector.startShapeId);
                    if (shape) {
                        const point = shape.getConnectionPoints().find(p => p.name === connector.startPoint);
                        if (point) {
                            startX = point.x;
                            startY = point.y;
                        } else {
                            startX = connector.startX;
                            startY = connector.startY;
                        }
                    } else {
                        startX = connector.startX;
                        startY = connector.startY;
                    }
                } else {
                    startX = connector.startX;
                    startY = connector.startY;
                }
                
                // 获取终点实际坐标
                if (connector.endShapeId && connector.endPoint && connector.appInstance) {
                    const shape = window.WebDrawFinders.findShapeById(connector.appInstance, connector.endShapeId);
                    if (shape) {
                        const point = shape.getConnectionPoints().find(p => p.name === connector.endPoint);
                        if (point) {
                            endX = point.x;
                            endY = point.y;
                        } else {
                            endX = connector.endX;
                            endY = connector.endY;
                        }
                    } else {
                        endX = connector.endX;
                        endY = connector.endY;
                    }
                } else {
                    endX = connector.endX;
                    endY = connector.endY;
                }
                
                // 连接线的stroke-width是2.5，需要扩展边界
                const connectorStrokeHalf = 1.5; // 2.5 / 2 = 1.25，取1.5更安全
                minX = Math.min(minX, startX - connectorStrokeHalf, endX - connectorStrokeHalf);
                minY = Math.min(minY, startY - connectorStrokeHalf, endY - connectorStrokeHalf);
                maxX = Math.max(maxX, startX + connectorStrokeHalf, endX + connectorStrokeHalf);
                maxY = Math.max(maxY, startY + connectorStrokeHalf, endY + connectorStrokeHalf);
            });
        }
        
        // 如果没有任何有效内容，返回默认值
        if (minX === Infinity || minY === Infinity) {
            return { x: 0, y: 0, width: 800, height: 600 };
        }
        
        // 添加边界冗余（20px）
        const padding = 20;
        minX = minX - padding;  // 允许负坐标，以包含画布上方和左侧的图形
        minY = minY - padding;  // 允许负坐标，以包含画布上方和左侧的图形
        maxX = maxX + padding;
        maxY = maxY + padding;
        
        // 确保宽度和高度至少为 1
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        
        return {
            x: minX,
            y: minY,
            width: width,
            height: height
        };
    }
    
    window.WebDrawExport = {
        /**
         * 导出为图片
         * @param {SVGElement} svg - SVG 元素
         * @param {string} format - 导出格式 ('svg', 'png', 'jpg')
         * @param {Array} shapes - 形状数组
         * @param {Array} connectors - 连接线数组
         */
        exportImage(svg, format, shapes = [], connectors = []) {
            // 计算最小包围矩形
            const bbox = calculateBoundingBox(shapes, connectors);
            
            // 克隆 SVG，但只克隆内容组
            const svgClone = document.createElementNS(SVG_NS, 'svg');
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgClone.setAttribute('width', bbox.width);
            svgClone.setAttribute('height', bbox.height);
            svgClone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
            svgClone.setAttribute('style', 'background-color: white;');
            
            // 复制 defs（箭头标记等）
            const defs = svg.querySelector('defs');
            if (defs) {
                const defsClone = defs.cloneNode(true);
                svgClone.appendChild(defsClone);
            }
            
            // 复制内容组（形状和连接线）
            const contentGroup = svg.querySelector('#canvas-content-group');
            if (contentGroup) {
                const groupClone = contentGroup.cloneNode(true);
                // 移除变换（因为我们已经设置了 viewBox）
                groupClone.removeAttribute('transform');
                svgClone.appendChild(groupClone);
            } else {
                // 如果没有内容组，直接复制所有子元素（除了 defs）
                Array.from(svg.children).forEach(child => {
                    if (child.tagName !== 'defs' && child.id !== 'canvas-content-group') {
                        const clone = child.cloneNode(true);
                        svgClone.appendChild(clone);
                    }
                });
            }
            
            // 应用样式
            applyStylesToSVG(svgClone);
            
            const svgData = new XMLSerializer().serializeToString(svgClone);
            
            if (format === 'svg') {
                const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'webdraw-' + Date.now() + '.svg';
                link.click();
                URL.revokeObjectURL(link.href);
                return;
            }
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            canvas.width = bbox.width;
            canvas.height = bbox.height;
            
            // 填充白色背景（PNG和JPG都需要）
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, bbox.width, bbox.height);
            
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = function() {
                // 绘制SVG图像
                ctx.drawImage(img, 0, 0);
                
                // 导出
                canvas.toBlob(function(blob) {
                    if (!blob) {
                        console.error('Failed to create blob');
                        URL.revokeObjectURL(url);
                        return;
                    }
                    
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'webdraw-' + Date.now() + '.' + format;
                    link.click();
                    URL.revokeObjectURL(link.href);
                    URL.revokeObjectURL(url);
                }, format === 'jpg' ? 'image/jpeg' : 'image/png', format === 'jpg' ? 0.92 : 1.0);
            };
            
            img.onerror = function() {
                console.error('Image load error');
                URL.revokeObjectURL(url);
            };
            
            img.src = url;
        }
    };
})();

