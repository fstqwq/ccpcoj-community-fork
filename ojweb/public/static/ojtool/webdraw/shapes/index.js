/**
 * 形状工厂 - 统一导出和创建形状
 */
(function() {
    'use strict';
    
    window.WebDrawShapes = {
        Shape: window.WebDrawShape,
        RectShape: window.WebDrawRectShape,
        SquareShape: window.WebDrawSquareShape,
        CircleShape: window.WebDrawCircleShape,
        EllipseShape: window.WebDrawEllipseShape,
        DiamondShape: window.WebDrawDiamondShape,
        FreeDrawPath: window.WebDrawFreeDrawPath,
        FreeText: window.WebDrawFreeText,
        
        // 从 JSON 创建形状
        fromJSON(data) {
            let shape;
            switch (data.type) {
                case 'rect':
                    shape = new window.WebDrawRectShape(data.x, data.y, data.width, data.height, data.id);
                    break;
                case 'square':
                    shape = new window.WebDrawSquareShape(data.x, data.y, data.width, data.id);
                    break;
                case 'circle':
                    shape = new window.WebDrawCircleShape(data.x, data.y, data.width, data.id);
                    break;
                case 'ellipse':
                    shape = new window.WebDrawEllipseShape(data.x, data.y, data.width, data.height, data.id);
                    break;
                case 'diamond':
                    shape = new window.WebDrawDiamondShape(data.x, data.y, data.width, data.height, data.id);
                    break;
                case 'freedraw':
                    shape = window.WebDrawFreeDrawPath.fromJSON(data);
                    break;
                case 'freetext':
                    shape = window.WebDrawFreeText.fromJSON(data);
                    break;
                default:
                    return null;
            }
            if (shape && data.type !== 'freedraw' && data.type !== 'freetext') {
                shape.text = data.text || '';
                shape.textAlign = data.textAlign || 'center';
                shape.textVerticalAlign = data.textVerticalAlign || 'middle';
            }
            return shape;
        }
    };
})();

