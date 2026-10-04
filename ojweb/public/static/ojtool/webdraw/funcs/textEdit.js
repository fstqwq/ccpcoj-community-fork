/**
 * 文本编辑相关函数模块
 * 负责形状文本的编辑功能
 */
(function() {
    'use strict';
    
    /**
     * 开始文本编辑
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} shape - 要编辑的形状
     */
    function startTextEdit(app, shape) {
        // 取消其他形状的编辑状态
        app.shapes.forEach(s => {
            if (s !== shape && s.isEditing) {
                s.cancelTextEdit();
            }
        });
        
        app.editingShape = shape;
        shape.startTextEdit();
    }
    
    /**
     * 完成文本编辑
     * @param {Object} app - WebDrawApp 实例
     */
    function finishTextEdit(app) {
        if (!app.editingShape) return;
        
        // 调用形状的完成编辑方法
        app.editingShape.finishTextEdit();
        app.editingShape = null;
        window.WebDrawHistory.saveState(app);
    }
    
    /**
     * 取消文本编辑
     * @param {Object} app - WebDrawApp 实例
     */
    function cancelTextEdit(app) {
        if (!app.editingShape) return;
        
        // 调用形状的取消编辑方法
        app.editingShape.cancelTextEdit();
        app.editingShape = null;
    }
    
    // 导出函数
    window.WebDrawTextEdit = {
        startTextEdit,
        finishTextEdit,
        cancelTextEdit
    };
})();

