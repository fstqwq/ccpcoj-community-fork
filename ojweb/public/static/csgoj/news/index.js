/**
 * 首页文章模块 JavaScript
 * Home Article Module JavaScript
 */

// 防重复执行检查
if (window.NewsModule && window.NewsModule._initialized) {
    // 已经初始化，直接返回，不显示警告（避免控制台噪音）
    // 但确保关键方法存在
    if (!window.NewsModule.initMenu || !window.NewsModule.initIndexNews) {
        console.warn('NewsModule partially initialized, some methods may be missing');
    }
} else {
    // 标记为已初始化
    if (window.NewsModule) {
        window.NewsModule._initialized = true;
    }

window.NewsModule = {
    // 菜单配置（URL 会在 getUrl 中动态替换为当前模块）
    // OJ_STATUS=exp 使用左侧标题，OJ_STATUS=cpc 使用右侧标题
    categoryLabelsExp: {
        'news': { chinese: '系统公告', english: 'System Announcement' },
        'notification': { chinese: '课程公告', english: 'Course Notice' },
        'answer': { chinese: '题目详解', english: 'Problem Solution' },
        'cpcinfo': { chinese: '课程资源', english: 'Course Resource' }
    },
    categoryLabelsCpc: {
        'news': { chinese: '团队新闻', english: 'Team News' },
        'notification': { chinese: '通知公告', english: 'Notice' },
        'answer': { chinese: '解题报告', english: 'Solution Report' },
        'cpcinfo': { chinese: '竞赛周边', english: 'Contest Info' }
    },
    // icon、url 不随 OJ_STATUS 变化，只在此保留；标题见 categoryLabelsExp / categoryLabelsCpc
    categories: {
        'news': { icon: 'bi-newspaper', url: '/index/news' },
        'notification': { icon: 'bi-bell', url: '/index/notification' },
        'answer': { icon: 'bi-lightbulb', url: '/index/answer' },
        'cpcinfo': { icon: 'bi-trophy', url: '/index/cpcinfo' }
    },

    // 首页显示的分类（对应后端的 CATEGORY_SHOW_INDEX）
    showInIndex: ['news', 'notification', 'answer', 'cpcinfo'],

    // 获取所有菜单项
    getAllCategories: function() {
        return this.categories;
    },

    // 获取指定菜单项
    getCategory: function(key) {
        return this.categories[key] || null;
    },

    // 根据 OJ_STATUS 取当前标题集（cpc=竞赛标题，exp 或未设置=教学标题）
    _getLabelSet: function() {
        const status = (window.menuConfig && window.menuConfig.OJ_STATUS) || 'exp';
        return status === 'cpc' ? this.categoryLabelsCpc : this.categoryLabelsExp;
    },

    // 获取菜单项的中文名称（按 OJ_STATUS 切换）
    getChineseName: function(key) {
        const labels = this._getLabelSet()[key];
        if (labels) return labels.chinese;
        const category = this.getCategory(key);
        return category ? category.chinese : key;
    },

    // 获取菜单项的英文名称（按 OJ_STATUS 切换）
    getEnglishName: function(key) {
        const labels = this._getLabelSet()[key];
        if (labels) return labels.english;
        const category = this.getCategory(key);
        return category ? category.english : key;
    },

    // 获取菜单项的图标
    getIcon: function(key) {
        const category = this.getCategory(key);
        return category ? category.icon : 'bi-question-circle';
    },

    // 获取当前模块路径前缀（index 或 exindex）
    getModulePrefix: function() {
        const pathname = window.location.pathname;
        if (pathname.includes('/exindex')) {
            return '/exindex';
        }
        return '/index';
    },
    
    // 获取菜单项的URL
    getUrl: function(key) {
        const category = this.getCategory(key);
        const modulePrefix = this.getModulePrefix();
        if (category) {
            // 替换 URL 中的模块前缀
            return category.url.replace('/index', modulePrefix);
        }
        return modulePrefix + '/' + key;
    },

    // 生成主页菜单项HTML
    generateHomeMenuItemHtml: function(currentController, ojName, modulePrefix) {
        const isActive = currentController === 'index' ? ' active' : '';
        const homeUrl = `${modulePrefix}/index`;
        return `
            <li class="nav-item">
                <a class="nav-link${isActive}" href="${homeUrl}" role="button" aria-haspopup="true" aria-expanded="false">
                    <span class="cn-text"><i class="bi bi-house me-1"></i>${ojName}主页</span><span class="en-text">Home</span>
                </a>
            </li>
        `;
    },

    // 生成关于菜单项HTML
    generateAboutMenuItemHtml: function(currentController, modulePrefix) {
        const isActive = currentController === 'about' ? ' active' : '';
        const aboutUrl = `${modulePrefix}/about`;
        return `
            <li class="nav-item">
                <a class="nav-link${isActive}" href="${aboutUrl}" role="button" aria-haspopup="true" aria-expanded="false">
                    <span class="cn-text"><i class="bi bi-info-circle me-1"></i>关于</span><span class="en-text">About</span>
                </a>
            </li>
        `;
    },

    // 生成动态分类菜单HTML
    generateCategoryMenuHtml: function(currentController) {
        let html = '';
        const categories = this.getAllCategories();
        
        for (const [key, config] of Object.entries(categories)) {
            const isActive = currentController === key ? ' active' : '';
            const url = this.getUrl(key);
            const chinese = this.getChineseName(key);
            const english = this.getEnglishName(key);
            html += `
                <li class="nav-item">
                    <a class="nav-link${isActive}" href="${url}" role="button" aria-haspopup="true" aria-expanded="false">
                        <i class="${config.icon} me-1"></i>${chinese}<span class="en-text">${english}</span>
                    </a>
                </li>
            `;
        }
        
        return html;
    },

    // 生成完整菜单HTML（主页 + 动态分类菜单 + 关于）
    generateMenuHtml: function(currentController, ojName) {
        const modulePrefix = this.getModulePrefix();
        let html = '';
        
        // 主页菜单项
        html += this.generateHomeMenuItemHtml(currentController, ojName || '', modulePrefix);
        
        // 动态分类菜单项
        html += this.generateCategoryMenuHtml(currentController);
        
        // 关于菜单项
        html += this.generateAboutMenuItemHtml(currentController, modulePrefix);
        
        return html;
    },


    // 生成分类新闻列表HTML
    generateCategoryNewsHtml: function(categoryKey, newsList) {
        const categoryConfig = this.getCategory(categoryKey);
        if (!categoryConfig) return '';

        const hasNews = newsList && newsList.length > 0;
        const newsHtml = hasNews ? this.generateNewsListHtml(newsList, categoryKey) : this.generateEmptyNewsHtml();
        const chinese = this.getChineseName(categoryKey);
        
        return `
            <div class="col-md-12 col-lg-6 col-sm-12">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="card-title mb-0">
                            <i class="${categoryConfig.icon} me-2"></i>${chinese}
                        </h5>
                        <a href="${window.NewsModule ? window.NewsModule.getUrl(categoryKey) : categoryConfig.url}" class="btn btn-outline-primary btn-sm">
                            更多<span class="en-text">More</span> 
                        </a>
                    </div>
                    <div class="card-body p-0">
                        ${newsHtml}
                    </div>
                </div>
            </div>
        `;
    },

    // 生成新闻列表HTML
    generateNewsListHtml: function(newsList, categoryKey) {
        let html = '<div class="list-group list-group-flush">';
        
        newsList.forEach(function(news) {
            const isNew = window.NewsModule.isRecentNews(news.time);
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <a href="${window.NewsModule ? window.NewsModule.getModulePrefix() : '/index'}/${categoryKey}/detail?nid=${news.news_id}" class="text-decoration-none" title="${news.title}">
                                <h5 class="mb-1">${news.title}</h5>
                            </a>
                            <small class="text-muted">
                                ${news.time ? news.time.substring(0, 16) : '0000-00-00 00:00'}
                            </small>
                        </div>
                        ${isNew ? '<span class="badge bg-danger">New</span>' : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    },

    // 生成空文章HTML
    generateEmptyNewsHtml: function() {
        return `
            <div class="card-body text-center text-muted">
                <i class="bi bi-inbox fs-1"></i>
                <p class="mt-2">暂无<span class="en-text">No Articles</span></p>
            </div>
        `;
    },

    // 检查是否为最近文章（15天内）
    isRecentNews: function(timeStr) {
        if (!timeStr) return false;
        const newsTime = new Date(timeStr).getTime();
        const now = Date.now();
        const fifteenDays = 15 * 24 * 60 * 60 * 1000; // 15天的毫秒数
        return (now - newsTime) < fifteenDays;
    },

    // 加载分类文章数据
    loadCategoryNews: function(categoryKey) {
        const self = this;
        return new Promise(function(resolve, reject) {
            const modulePrefix = self.getModulePrefix();
            $.ajax({
                url: `${modulePrefix}/${categoryKey}/category_news_list_ajax`,
                method: 'GET',
                dataType: 'json',
                success: function(data) {
                    // 只取前5条
                    const limitedData = data.slice(0, 5);
                    resolve(limitedData);
                },
                error: function(xhr, status, error) {
                    console.error(`Failed to load articles for category ${categoryKey}:`, error);
                    resolve([]);
                }
            });
        });
    },



    // 初始化菜单（由视图主动调用）
    initMenu: function(currentController, ojName) {
        const menuContainer = document.querySelector('.nav-tabs');
        if (menuContainer) {
            // 检查是否已经初始化过菜单
            if (menuContainer.hasAttribute('data-menu-initialized')) {
                return; // 已经初始化过，避免重复
            }
            
            // 生成完整菜单HTML（主页 + 动态分类菜单 + 关于）
            const menuHtml = this.generateMenuHtml(currentController, ojName);
            menuContainer.innerHTML = menuHtml;
            
            // 标记已初始化
            menuContainer.setAttribute('data-menu-initialized', 'true');
        }
    },

    // 初始化首页新闻列表（由视图主动调用）
    initIndexNews: function() {
        const container = document.querySelector('.row.g-4');
        if (!container) return;

        // 检查是否已经初始化过
        if (container.hasAttribute('data-news-initialized')) {
            return; // 已经初始化过，避免重复
        }

        // 清空现有内容
        container.innerHTML = '';

        // 为每个分类加载数据并生成HTML
        const promises = this.showInIndex.map(categoryKey => {
            return this.loadCategoryNews(categoryKey).then(articleList => {
                return {
                    categoryKey: categoryKey,
                    newsList: articleList
                };
            });
        });

        Promise.all(promises).then(results => {
            results.forEach(result => {
                const categoryHtml = this.generateCategoryNewsHtml(result.categoryKey, result.newsList);
                container.insertAdjacentHTML('beforeend', categoryHtml);
            });
            // 标记已初始化
            container.setAttribute('data-news-initialized', 'true');
        }).catch(error => {
            console.error('Failed to load some category articles:', error);
        });
    },

    // 标记为已初始化
    _initialized: true
};

} // 结束防重复执行检查的 else 块
