/**
 * 对齐和分布相关函数
 * 提供形状的对齐和分布功能
 */
(function() {
    'use strict';
    
    window.WebDrawAlignment = {
        /**
         * 对齐形状
         * @param {Object} app - WebDrawApp 实例
         * @param {string} alignType - 对齐类型：'left', 'center', 'right', 'top', 'middle', 'bottom'
         */
        alignShapes(app, alignType) {
            if (app.selectedShapes.length < 2) {
                alert('请至少选择两个形状\nPlease select at least 2 shapes');
                return;
            }
            
            const shapes = app.selectedShapes;
            
            switch (alignType) {
                case 'left':
                    const leftMost = Math.min(...shapes.map(s => s.getBounds().x));
                    shapes.forEach(shape => shape.setPosition(leftMost, shape.y));
                    break;
                case 'center':
                    const centers = shapes.map(s => s.getCenter().x);
                    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
                    shapes.forEach(shape => {
                        const center = shape.getCenter();
                        shape.setPosition(shape.x + (avgCenter - center.x), shape.y);
                    });
                    break;
                case 'right':
                    const rightMost = Math.max(...shapes.map(s => s.getBounds().x + s.getBounds().width));
                    shapes.forEach(shape => {
                        const bounds = shape.getBounds();
                        shape.setPosition(rightMost - bounds.width, shape.y);
                    });
                    break;
                case 'top':
                    const topMost = Math.min(...shapes.map(s => s.getBounds().y));
                    shapes.forEach(shape => shape.setPosition(shape.x, topMost));
                    break;
                case 'middle':
                    const middles = shapes.map(s => s.getCenter().y);
                    const avgMiddle = middles.reduce((a, b) => a + b, 0) / middles.length;
                    shapes.forEach(shape => {
                        const center = shape.getCenter();
                        shape.setPosition(shape.x, shape.y + (avgMiddle - center.y));
                    });
                    break;
                case 'bottom':
                    const bottomMost = Math.max(...shapes.map(s => s.getBounds().y + s.getBounds().height));
                    shapes.forEach(shape => {
                        const bounds = shape.getBounds();
                        shape.setPosition(shape.x, bottomMost - bounds.height);
                    });
                    break;
            }
            
            window.WebDrawConnectorManagement.updateConnectors(app);
            app.saveState();
        },
        
        /**
         * 分布形状
         * @param {Object} app - WebDrawApp 实例
         * @param {string} direction - 分布方向：'horizontal' 或 'vertical'
         */
        distributeShapes(app, direction) {
            if (app.selectedShapes.length < 3) {
                alert('请至少选择三个形状\nPlease select at least 3 shapes');
                return;
            }
            
            const shapes = [...app.selectedShapes].sort((a, b) => {
                if (direction === 'horizontal') {
                    return a.getBounds().x - b.getBounds().x;
                } else {
                    return a.getBounds().y - b.getBounds().y;
                }
            });
            
            if (direction === 'horizontal') {
                const first = shapes[0].getBounds();
                const last = shapes[shapes.length - 1].getBounds();
                const totalWidth = last.x + last.width - first.x;
                const shapeWidths = shapes.reduce((sum, s) => sum + s.getBounds().width, 0);
                const gap = (totalWidth - shapeWidths) / (shapes.length - 1);
                
                let currentX = first.x;
                for (let i = 1; i < shapes.length - 1; i++) {
                    currentX += shapes[i - 1].getBounds().width + gap;
                    shapes[i].setPosition(currentX, shapes[i].y);
                }
            } else {
                const first = shapes[0].getBounds();
                const last = shapes[shapes.length - 1].getBounds();
                const totalHeight = last.y + last.height - first.y;
                const shapeHeights = shapes.reduce((sum, s) => sum + s.getBounds().height, 0);
                const gap = (totalHeight - shapeHeights) / (shapes.length - 1);
                
                let currentY = first.y;
                for (let i = 1; i < shapes.length - 1; i++) {
                    currentY += shapes[i - 1].getBounds().height + gap;
                    shapes[i].setPosition(shapes[i].x, currentY);
                }
            }
            
            window.WebDrawConnectorManagement.updateConnectors(app);
            app.saveState();
        }
    };
})();

