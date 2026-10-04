/**
 * 导入/导出相关函数模块
 * 负责 JSON 文件的导入导出和图片导出
 */
(function() {
    'use strict';
    
    /**
     * 导出图片
     * @param {Object} app - WebDrawApp 实例
     * @param {String} format - 导出格式 ('svg', 'png', 'jpg')
     */
    function exportImage(app, format) {
        // 确保所有连接线都更新到最新状态
        window.WebDrawConnectorManagement.updateConnectors(app);
        window.WebDrawExport.exportImage(app.svg, format, app.shapes, app.connectors);
    }
    
    /**
     * 下载 JSON 文件
     * @param {Object} app - WebDrawApp 实例
     */
    function downloadJSON(app) {
        const state = {
            shapes: app.shapes.map(s => s.toJSON()),
            connectors: app.connectors.map(c => c.toJSON()),
            timestamp: Date.now(),
            version: '1.0'
        };
        
        const jsonStr = JSON.stringify(state, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `webdraw-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    /**
     * 从 JSON 文件加载
     * @param {Object} app - WebDrawApp 实例
     */
    function loadFromJSONFile(app) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const state = JSON.parse(event.target.result);
                    if (state && (state.shapes || state.connectors)) {
                        if (confirm('加载文件将替换当前内容，是否继续？\nLoading file will replace current content, continue?')) {
                            window.WebDrawHistory.restoreState(app, state);
                            window.WebDrawHistory.saveState(app); // 保存到 IndexedDB
                        }
                    } else {
                        alert('无效的 JSON 文件格式\nInvalid JSON file format');
                    }
                } catch (error) {
                    console.error('Load JSON error:', error);
                    alert('读取文件失败\nFailed to read file');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    // 导出函数
    window.WebDrawImportExport = {
        exportImage,
        downloadJSON,
        loadFromJSONFile
    };
})();

