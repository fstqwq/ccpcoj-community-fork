/**
 * 查找相关函数
 * 提供形状和连接线的查找功能
 */
(function() {
    'use strict';
    
    window.WebDrawFinders = {
        /**
         * 通过元素查找形状
         * @param {Object} app - WebDrawApp 实例
         * @param {Element} element - DOM 元素
         * @returns {Shape|null} 找到的形状或 null
         */
        findShapeByElement(app, element) {
            return app.shapes.find(s => {
                if (s.groupElement === element || s.element === element) {
                    return true;
                }
                // 检查元素是否在组内
                if (s.groupElement && s.groupElement.contains && s.groupElement.contains(element)) {
                    return true;
                }
                return false;
            });
        },
        
        /**
         * 通过 ID 查找形状
         * @param {Object} app - WebDrawApp 实例
         * @param {string} id - 形状 ID
         * @returns {Shape|null} 找到的形状或 null
         */
        findShapeById(app, id) {
            return app.shapes.find(s => s.id === id);
        },
        
        /**
         * 通过坐标点查找形状
         * @param {Object} app - WebDrawApp 实例
         * @param {Object} point - 坐标点 {x, y}
         * @returns {Shape|null} 找到的形状或 null
         */
        findShapeAtPoint(app, point) {
            return app.shapes.find(shape => {
                const bounds = shape.getBounds();
                return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
                       point.y >= bounds.y && point.y <= bounds.y + bounds.height;
            });
        },
        
        /**
         * 通过元素查找连接线
         * @param {Object} app - WebDrawApp 实例
         * @param {Element} element - DOM 元素
         * @returns {Connector|null} 找到的连接线或 null
         */
        findConnectorByElement(app, element) {
            return app.connectors.find(c => c.element === element);
        }
    };
})();

