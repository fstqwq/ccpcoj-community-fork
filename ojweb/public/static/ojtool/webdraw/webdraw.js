/**
 * Web Draw 绘图工具 - 模块化版本
 * 入口文件：初始化应用
 * 
 * 注意：所有模块文件需要在视图文件中按顺序加载
 */

(function() {
    'use strict';
    
    // 等待所有模块加载完成后初始化
    function initApp() {
        if (window.WebDrawApp && window.WebDrawApp.getInstance) {
            window.WebDrawApp.getInstance().init();
        } else {
            // 如果模块还未加载完成，稍后重试
            setTimeout(initApp, 50);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
