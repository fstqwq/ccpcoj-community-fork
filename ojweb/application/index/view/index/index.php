{if $showCarousel}
    <div class="mb-4">
        <div id="indexCarousel" class="carousel slide" data-bs-ride="carousel">
            <!-- 轮播指标 -->
            <div class="carousel-indicators">
                {for start="0" end="3"}
                    <button type="button" data-bs-target="#indexCarousel" data-bs-slide-to="{$i}" {if($i == 0)} class="active" aria-current="true"{/if} aria-label="Slide {$i}"></button>
                {/for}
            </div>
            <!-- 轮播项目 -->
            <div class="carousel-inner">
                {for start="0" end="3"}
                    <div class="carousel-item {if($i == 0)} active{/if}">
                        <img src="{if(strlen($carousel['src'][$i]) > 0)} {$carousel['src'][$i]}{else/}__IMG__/carousel_default/carousel{$i}.png{/if}" class="d-block w-100" alt="{$carousel['header'][$i]}">
                        <div class="carousel-caption d-none d-md-block">
                            <h5>{$carousel['header'][$i]}</h5>
                            <p>{$carousel['content'][$i]}</p>
                        </div>
                    </div>
                {/for}
            </div>
            <!-- 轮播导航 -->
            <button class="carousel-control-prev" type="button" data-bs-target="#indexCarousel" data-bs-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#indexCarousel" data-bs-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Next</span>
            </button>
        </div>
    </div>
{/if}
    <br/>
    <div class="row g-4" id="news-categories-container">
        <!-- 分类文章将通过 JavaScript 动态加载到这里 -->
    </div>

{css href="__STATIC__/csgoj/news/news.css" /}
{js href="__STATIC__/csgoj/news/index.js" /}
<script type="text/javascript">
// 页面加载完成后初始化新闻列表
// 使用延迟执行确保 NewsModule 已加载（即使脚本被多次加载）
(function() {
    function initNewsWhenReady() {
        if (window.NewsModule && window.NewsModule.initIndexNews) {
            // 检查是否已初始化，避免重复初始化
            const container = document.querySelector('#news-categories-container');
            if (container && !container.hasAttribute('data-news-initialized')) {
                window.NewsModule.initIndexNews();
            }
        } else if (document.readyState === 'loading') {
            // 如果 DOM 还在加载，等待 DOMContentLoaded
            document.addEventListener('DOMContentLoaded', initNewsWhenReady);
        } else {
            // DOM 已加载但 NewsModule 可能还没加载，延迟重试
            setTimeout(initNewsWhenReady, 50);
        }
    }
    
    // 立即尝试初始化，如果失败则等待
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initNewsWhenReady();
    } else {
        document.addEventListener('DOMContentLoaded', initNewsWhenReady);
    }
})();
</script>