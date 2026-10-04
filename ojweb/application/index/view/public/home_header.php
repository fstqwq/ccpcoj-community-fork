
<ul class="nav nav-tabs">
    <!-- 所有菜单项将通过 JavaScript 动态生成 -->
</ul>

<script type="text/javascript">
    // 设置当前控制器和 OJ_NAME 供 JavaScript 使用
    window.currentController = '<?php echo strtolower(request()->controller()); ?>';
    window.OJ_NAME = <?php echo isset($OJ_NAME) ? json_encode($OJ_NAME) : '""'; ?>;
</script>
{js href="__STATIC__/csgoj/news/index.js" /}
<script type="text/javascript">
// 页面加载完成后初始化菜单
// 使用延迟执行确保 NewsModule 已加载（即使脚本被多次加载）
(function() {
    function initMenuWhenReady() {
        if (window.NewsModule && window.NewsModule.initMenu && window.currentController) {
            // 检查菜单是否已初始化，避免重复初始化
            const menuContainer = document.querySelector('.nav-tabs');
            if (menuContainer && !menuContainer.hasAttribute('data-menu-initialized')) {
                window.NewsModule.initMenu(window.currentController, window.OJ_NAME);
            }
        } else if (document.readyState === 'loading') {
            // 如果 DOM 还在加载，等待 DOMContentLoaded
            document.addEventListener('DOMContentLoaded', initMenuWhenReady);
        } else {
            // DOM 已加载但 NewsModule 可能还没加载，延迟重试
            setTimeout(initMenuWhenReady, 50);
        }
    }
    
    // 立即尝试初始化，如果失败则等待
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initMenuWhenReady();
    } else {
        document.addEventListener('DOMContentLoaded', initMenuWhenReady);
    }
})();
</script>