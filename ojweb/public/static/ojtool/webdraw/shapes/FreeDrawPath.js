/**
 * 自由绘制路径类
 * 使用曲线拟合算法减少采样点
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    const Shape = window.WebDrawShape;
    
    /**
     * Douglas-Peucker 算法：简化路径点
     * @param {Array} points - 点数组 [{x, y}, ...]
     * @param {number} epsilon - 容差
     * @returns {Array} 简化后的点数组
     */
    function douglasPeucker(points, epsilon) {
        if (points.length <= 2) return points;
        
        // 找到距离起点和终点连线最远的点
        let maxDist = 0;
        let maxIndex = 0;
        const end = points.length - 1;
        
        for (let i = 1; i < end; i++) {
            const dist = pointToLineDistance(points[i], points[0], points[end]);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }
        
        // 如果最大距离大于容差，递归处理
        if (maxDist > epsilon) {
            const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
            const right = douglasPeucker(points.slice(maxIndex), epsilon);
            return left.slice(0, -1).concat(right);
        } else {
            return [points[0], points[end]];
        }
    }
    
    /**
     * 计算点到线段的距离
     */
    function pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
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
    
    /**
     * 将点数组转换为平滑的贝塞尔曲线路径
     * @param {Array} points - 点数组 [{x, y}, ...]
     * @returns {string} SVG path 字符串
     */
    function pointsToSmoothPath(points) {
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
        if (points.length === 2) {
            return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
        }
        
        // 使用三次贝塞尔曲线平滑连接
        // 增大平滑系数，使曲线更规范平滑
        let path = `M ${points[0].x} ${points[0].y}`;
        
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            // 计算控制点，使用更大的平滑系数（从 6 改为 4），使曲线更平滑
            const smoothFactor = 4;
            const cp1x = p1.x + (p2.x - p0.x) / smoothFactor;
            const cp1y = p1.y + (p2.y - p0.y) / smoothFactor;
            const cp2x = p2.x - (p3.x - p1.x) / smoothFactor;
            const cp2y = p2.y - (p3.y - p1.y) / smoothFactor;
            
            if (i === 0) {
                // 第一个点使用直线连接，确保起点准确
                path += ` L ${p1.x} ${p1.y}`;
            } else {
                // 使用三次贝塞尔曲线，使曲线更平滑
                path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
            }
        }
        
        return path;
    }
    
    class FreeDrawPath extends Shape {
        constructor(points = [], strokeWidth = 2, id = null) {
            // 计算边界框
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            if (points.length > 0) {
                points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
            }
            
            const width = maxX !== -Infinity ? maxX - minX : 0;
            const height = maxY !== -Infinity ? maxY - minY : 0;
            
            super('freedraw', minX !== Infinity ? minX : 0, minY !== Infinity ? minY : 0, width, height, id);
            this.rawPoints = points; // 原始点（用于编辑）
            this.simplifiedPoints = []; // 简化后的点（用于存储）
            this.strokeWidth = strokeWidth || 2; // 确保有默认值
            this.pathData = ''; // SVG path 数据
        }
        
        /**
         * 添加点并更新路径
         * @param {Object} point - 点坐标 {x, y}
         * @param {number} minDistance - 最小距离阈值，只有距离上一个点超过此值才添加
         */
        addPoint(point, minDistance = 25) {
            // 如果点列表为空，直接添加第一个点
            if (this.rawPoints.length === 0) {
                this.rawPoints.push({ x: point.x, y: point.y });
                this.updateBounds();
                return;
            }
            
            // 计算与上一个点的距离
            const lastPoint = this.rawPoints[this.rawPoints.length - 1];
            const dx = point.x - lastPoint.x;
            const dy = point.y - lastPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 只有距离超过阈值才添加点，使采样更稀疏
            if (distance >= minDistance) {
                this.rawPoints.push({ x: point.x, y: point.y });
                this.updateBounds();
            }
        }
        
        /**
         * 完成绘制，进行曲线拟合
         */
        finishDrawing() {
            if (this.rawPoints.length < 2) return;
            
            // 使用 Douglas-Peucker 算法简化路径
            // 增大 epsilon 值，使简化更激进，优先保证曲线规范平滑
            // epsilon 根据 strokeWidth 调整，但使用更大的倍数以确保更规范的曲线
            const baseEpsilon = Math.max(3, this.strokeWidth * 1.5);
            this.simplifiedPoints = douglasPeucker(this.rawPoints, baseEpsilon);
            
            // 如果简化后点数仍然太多，进一步简化
            if (this.simplifiedPoints.length > 30) {
                this.simplifiedPoints = douglasPeucker(this.rawPoints, baseEpsilon * 2);
            }
            
            // 如果仍然太多，再次简化
            if (this.simplifiedPoints.length > 20) {
                this.simplifiedPoints = douglasPeucker(this.rawPoints, baseEpsilon * 3);
            }
            
            // 生成平滑路径
            this.pathData = pointsToSmoothPath(this.simplifiedPoints);
            this.updateBounds();
        }
        
        /**
         * 更新边界框
         */
        updateBounds() {
            const points = this.simplifiedPoints.length > 0 ? this.simplifiedPoints : this.rawPoints;
            if (points.length === 0) return;
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
            
            this.x = minX;
            this.y = minY;
            this.width = maxX - minX;
            this.height = maxY - minY;
        }
        
        createElement(svg) {
            // 创建包装组
            this.groupElement = document.createElementNS(SVG_NS, 'g');
            this.groupElement.setAttribute('class', 'shape-group freedraw-group');
            this.groupElement.setAttribute('data-id', this.id);
            this.groupElement.setAttribute('data-type', this.type);
            
            // 创建路径元素
            this.element = document.createElementNS(SVG_NS, 'path');
            // 自由绘制路径不使用 'shape' class，避免被通用 CSS 规则影响 stroke-width
            this.element.setAttribute('class', 'freedraw-path');
            this.element.setAttribute('data-id', this.id);
            this.element.setAttribute('data-type', this.type);
            this.element.setAttribute('fill', 'none');
            this.element.setAttribute('stroke', '#333');
            const strokeWidth = this.strokeWidth || 2;
            // 使用 style 属性设置 stroke-width，确保不被 CSS 覆盖
            // 注意：SVG 的 stroke-width 不需要单位（px），但在 style 中需要
            this.element.setAttribute('style', `stroke-width: ${strokeWidth}px !important;`);
            this.element.setAttribute('stroke-width', strokeWidth);
            this.element.setAttribute('stroke-linecap', 'round');
            this.element.setAttribute('stroke-linejoin', 'round');
            
            // 将路径添加到组中
            this.groupElement.appendChild(this.element);
            
            // 将组添加到 SVG
            svg.appendChild(this.groupElement);
            
            this.update();
            return this.groupElement;
        }
        
        update() {
            if (!this.element) return;
            
            // 如果还在绘制中，使用原始点生成临时路径
            if (this.rawPoints.length > 0 && this.simplifiedPoints.length === 0) {
                const tempPath = pointsToSmoothPath(this.rawPoints);
                this.element.setAttribute('d', tempPath);
            } else if (this.pathData) {
                // 使用简化后的路径
                this.element.setAttribute('d', this.pathData);
            }
            
            const strokeWidth = this.strokeWidth || 2;
            // 使用 style 属性设置 stroke-width，确保不被 CSS 覆盖
            // 注意：SVG 的 stroke-width 不需要单位（px），直接使用数值
            const currentStyle = this.element.getAttribute('style') || '';
            // 移除旧的 stroke-width 样式
            const newStyle = currentStyle.replace(/stroke-width\s*:\s*[^;]+;?/gi, '').trim();
            // 添加新的 stroke-width 样式
            const finalStyle = newStyle ? `${newStyle}; stroke-width: ${strokeWidth}px !important;` : `stroke-width: ${strokeWidth}px !important;`;
            this.element.setAttribute('style', finalStyle);
            this.element.setAttribute('stroke-width', strokeWidth);
        }
        
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
        
        getCenter() {
            return {
                x: this.x + this.width / 2,
                y: this.y + this.height / 2
            };
        }
        
        move(dx, dy) {
            // 移动所有点
            this.rawPoints.forEach(p => {
                p.x += dx;
                p.y += dy;
            });
            this.simplifiedPoints.forEach(p => {
                p.x += dx;
                p.y += dy;
            });
            this.x += dx;
            this.y += dy;
            
            // 重新生成路径
            if (this.simplifiedPoints.length > 0) {
                this.pathData = pointsToSmoothPath(this.simplifiedPoints);
            }
            
            this.update();
        }
        
        setPosition(x, y) {
            const dx = x - this.x;
            const dy = y - this.y;
            this.move(dx, dy);
        }
        
        // 获取连接点（自由绘制路径使用边界框的四个角）
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
                strokeWidth: this.strokeWidth,
                points: this.simplifiedPoints.length > 0 ? this.simplifiedPoints : this.rawPoints,
                pathData: this.pathData
            };
        }
        
        static fromJSON(data) {
            const path = new FreeDrawPath(data.points || [], data.strokeWidth || 2, data.id);
            path.simplifiedPoints = data.points || [];
            path.pathData = data.pathData || '';
            path.updateBounds();
            return path;
        }
    }
    
    window.WebDrawFreeDrawPath = FreeDrawPath;
})();

