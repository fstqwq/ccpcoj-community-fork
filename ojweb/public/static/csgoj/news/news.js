/**
 * 文章模块 JavaScript
 * Article Module JavaScript
 */

// 防重复执行检查
if (window.NewsModuleDetail && window.NewsModuleDetail._initialized) {
    console.warn('NewsModuleDetail already initialized, skipping duplicate initialization');
} else {
    // 标记为已初始化
    if (window.NewsModuleDetail) {
        window.NewsModuleDetail._initialized = true;
    }

window.NewsModuleDetail = {
    // 初始化文章详情页
    init: function() {
        // 检查是否已经初始化过
        if (this._initExecuted) {
            console.warn('NewsModuleDetail.init() already executed, skipping');
            return;
        }
        this._initExecuted = true;

        this.initNewsDetail();
        this.initNewsList();
    },

    // 初始化文章详情页
    initNewsDetail: function() {
        
        // 初始化文章编辑页面
        this.initNewsEdit();
    },

    // 初始化文章编辑页面
    initNewsEdit: function() {
        const pageInfo = $('#page_info');
        const editMode = pageInfo.attr('edit_mode');
        const submitButton = $('#submit_button');
        
        if (submitButton.length && pageInfo.length) {
            // 使用简化的表单验证工具（所有依赖已全局引入）
            FormValidationTip.initCommonFormValidation('#news_edit_form', {
                    title: {
                        rules: { required: true, maxlength: 200 }
                        // 优先使用默认提示信息，不定义 messages
                    },
                    content: {
                        rules: { required: true, maxlength: 65536 }
                        // 优先使用默认提示信息，不定义 messages
                    }
                }, function(form) {
                    // 提交处理函数
                    // 使用 button_delay_auto 的 before 状态：禁用按钮，显示提示，但不倒计时
                    button_delay_auto(submitButton, 3, 'before');
                    
                    // 统一使用 FormValidationTip 提供的 ajaxSubmit（内部使用 util.js 的 csg.ajax）
                    $(form).ajaxSubmit({
                        success: function(ret) {
                            if(ret && ret['code'] == 1) {
                                if(ret['data'] && ret['data']['alert'] === true){
                                    alerty.alert(ret['msg']);
                                } else {
                                    alerty.success(ret['msg']);
                                }
                                // 使用 button_delay_auto 的 start 状态：开始倒计时
                                button_delay_auto(submitButton, 3, 'start');
                                if(editMode != '1' && ret['data'] && ret['data']['id']) {
                                    setTimeout(function(){location.href='news_edit?id='+ret['data']['id']}, 500);
                                }
                            } else {
                                alerty.alert(ret && ret['msg'] ? ret['msg'] : '提交失败');
                                button_delay_auto(submitButton, 3, 'start');
                            }
                            return false;
                        },
                        error: function() {
                            alerty.alert('提交失败（网络或服务端错误）');
                            button_delay_auto(submitButton, 3, 'start');
                        }
                    });
                    return false;
                });
            }
            
            // Ctrl+S 快捷键保存
            $(window).keydown(function(e) {
                if (e.keyCode == 83 && e.ctrlKey) {
                    e.preventDefault();
                    var a = document.createEvent("MouseEvents");
                    a.initEvent("click", true, true);
                    $('#submit_button')[0].dispatchEvent(a);
                }
            });
    },

    // 初始化文章列表页
    initNewsList: function() {
        
        // 初始化文章列表表格
        this.initArticleListTable();
        
        // 初始化文章详情列表表格
        this.initNewsDetailListTable();
    },

    // 初始化文章列表表格
    initArticleListTable: function() {
        const articleListTable = $('#article_list_table');
        const articleListDiv = $('#article_list_div');
        
        if (articleListTable.length && articleListDiv.length) {
            articleListTable.on('post-body.bs.table', function(){
                // 处理rank宽度
                if(articleListTable[0].scrollWidth > articleListDiv.width())
                    articleListDiv.width(articleListTable[0].scrollWidth + 20);
            });
        }
        
        // 禁用F5刷新，改为刷新表格
        $(window).keydown(function(e) {
            if (e.keyCode == 116 && !e.ctrlKey) {
                if(window.event){
                    try{e.keyCode = 0;}catch(e){}
                    e.returnValue = false;
                }
                e.preventDefault();
                $('#article_list_table').bootstrapTable('refresh');
            }
        });
    },

    // 初始化文章详情列表表格
    initNewsDetailListTable: function() {
        const table = $('#news_detail_list_table');
        
        if (table.length) {
            table.on('post-body.bs.table', function(){
                table.bootstrapTable('resetView', {'height': this.scrollHeight + 120});
            });
            table.on('expand-row.bs.table', function(index, row, $detail){
                table.bootstrapTable('resetView', {'height': this.scrollHeight + 120});
            });
            table.on('collapse-row.bs.table', function(index, row, $detail){
                table.bootstrapTable('resetView', {'height': this.scrollHeight + 120});
            });
        }
    },


    // 标记为已初始化
    _initialized: true,
    _initExecuted: false
};

// ========================================
// 文章管理表格 Formatter 函数
// ========================================

// 文章标题formatter - 带自适应宽度和链接
function FormatterNewsTitle(value, row, index, field) {
    if (!value) return '';
    
    // 根据状态确定颜色类
    let colorClass = '';
    if (row['defunct'] == '1') {
        colorClass = 'text-muted'; // 隐藏状态用灰色
    } else {
        colorClass = 'text-primary'; // 公开状态用蓝色
    }
    
    // 构建查看页面的链接：根据 OJ_STATUS 决定 index/exindex
    const category = row['category'] || 'news';
    const ojStatus = (window.menuConfig && window.menuConfig.OJ_STATUS) ? window.menuConfig.OJ_STATUS : '';
    const publicModule = (ojStatus === 'exp') ? 'exindex' : 'index';
    const detailUrl = `/${publicModule}/${category}/detail?nid=${row['news_id']}`;
    
    // 不再根据 window width 动态计算宽度，统一交由 CSS 处理（.article-title-in-table）
    return `<a class="text-decoration-none article-title-in-table ${colorClass}" title="${value}" href="${detailUrl}" target="_blank">${value}</a>`;
}

// 文章分类formatter
function FormatterNewsCategory(value, row, index, field) {
    // 根据分类设置不同的颜色
    const colorMap = {
        'news': 'bg-info',
        'notification': 'bg-warning', 
        'answer': 'bg-success',
        'cpcinfo': 'bg-primary'
    };
    const colorClass = colorMap[value] || 'bg-secondary';
    
    // 使用 NewsModule 的配置获取分类名称
    if (window.NewsModule) {
        const categoryConfig = window.NewsModule.getCategory(value);
        if (categoryConfig) {
            return `<span class="badge ${colorClass}">${categoryConfig.chinese}<span class="en-text">${categoryConfig.english}</span></span>`;
        }
    }
    
    // 如果没有 NewsModule 或找不到配置，使用默认值
    return `<span class="badge ${colorClass}">${value}<span class="en-text">Unknown</span></span>`;
}

// 文章标签formatter
function FormatterNewsTags(value, row, index, field) {
    if (!value || value.trim() === '') {
        return '<span class="text-muted">-</span>';
    }
    
    // 标签用分号分隔
    const tags = value.split(';').map(tag => tag.trim()).filter(tag => tag.length > 0);
    
    if (tags.length === 0) {
        return '<span class="text-muted">-</span>';
    }
    
    // 生成标签徽章
    let html = '';
    tags.forEach((tag, idx) => {
        if (idx > 0) html += ' ';
        html += `<span class="badge bg-secondary" title="${tag}">${tag}</span>`;
    });
    
    return html;
}

// 文章状态formatter
function FormatterNewsStatus(value, row, index, field) {
    return createDefunctFormatter({
        idField: 'news_id',
        publicText: '公开',
        hiddenText: '隐藏',
        publicTextEn: 'Public',
        hiddenTextEn: 'Hidden',
        itemName: 'news'
    })(value, row, index, field);
}

// 文章编辑formatter（复用 Admin 列表统一样式）
function FormatterNewsEdit(value, row, index, field) {
    var module = (window.NewsConfig && window.NewsConfig.module) || 'admin';
    return createAdminEditBtn({
        disabled: !row.is_admin,
        url: '/' + module + '/news/news_edit?id=' + row.news_id,
        title: '编辑文章(Edit Article)'
    });
}

// 新闻列表标题 formatter（用于 index/exindex 的新闻列表页）
function FormatterNewsListTitle(value, row, index, field) {
    if (!value) return '';
    // 根据 OJ_STATUS 决定 index/exindex（exp => exindex）
    const ojStatus = (window.menuConfig && window.menuConfig.OJ_STATUS) ? window.menuConfig.OJ_STATUS : '';
    const module = (ojStatus === 'exp') ? 'exindex' : 'index';
    const detailUrl = `/${module}/index/news_detail?id=${row.news_id}`;
    return `<a href="${detailUrl}" target="_blank" class="text-decoration-none" title="${value}">${value}</a>`;
}

// 用户 formatter（用于显示用户链接）
function FormatterUser(value, row, index, field) {
    if (!value) return '-';
    return `<a href='/csgoj/user/userinfo?user_id=${value}' target='_blank'>${value}</a>`;
}

// 标题 formatter（用于分类新闻列表页，根据 page_category 生成链接）
function FormatterTitle(value, row, index, field) {
    if (!value) return '';
    // 从 page_info 元素获取分类
    const pageInfo = document.getElementById('page_info');
    const pageCategory = pageInfo ? pageInfo.getAttribute('category') : 'news';
    // 根据 OJ_STATUS 决定 index/exindex（exp => exindex）
    const ojStatus = (window.menuConfig && window.menuConfig.OJ_STATUS) ? window.menuConfig.OJ_STATUS : '';
    const module = (ojStatus === 'exp') ? 'exindex' : 'index';
    const detailUrl = `/${module}/${pageCategory}/detail?nid=${row.news_id}`;
    return `<a href="${detailUrl}" title="${value}" class="article-title-in-table">${value}</a>`;
}

// 标签 formatter（用于分类新闻列表页）
function FormatterTags(value, row, index, field) {
    if (!value || value === null || value === '') {
        return '<span class="text-muted">-</span>';
    }
    return `<span title="${value}" class="tags-in-table">${value}</span>`;
}

// 生成分类选项HTML（用于管理后台）
function generateCategoryOptions() {
    if (!window.NewsModule) return '';
    
    let html = '<option value="-1" selected>全部<span class="en-text">All</span></option>';
    const categories = window.NewsModule.getAllCategories();
    
    for (const [key, config] of Object.entries(categories)) {
        html += `<option value="${key}">${config.chinese}</option>`;
    }
    
    return html;
}

// 标签单元格样式函数
function TagCellStyle(value, row, index) {
    return {
        css: {'max-width': '120px'}
    };
}

// 新闻单元格样式函数
function NewsCellStyle(value, row, index) {
    return {
        css: {'max-width': '650px'}
    };
}

// 详情格式化函数
function detailFormatter(index, row) {
    var html = [];
    $.each(row, function (key, value) {
        if(key == 'content')
            html.push("<article class='md_display_div'>" + value + "</article>");
    });
    return html.join('');
}

// 将函数暴露到全局作用域
window.generateCategoryOptions = generateCategoryOptions;
window.TagCellStyle = TagCellStyle;
window.NewsCellStyle = NewsCellStyle;
window.detailFormatter = detailFormatter;
// 暴露 formatter 函数到全局作用域
window.FormatterNewsListTitle = FormatterNewsListTitle;
window.FormatterUser = FormatterUser;
window.FormatterTitle = FormatterTitle;
window.FormatterTags = FormatterTags;

// 页面加载完成后自动初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否在文章相关页面（排除首页，避免与NewsModule冲突）
    if ((window.location.pathname.includes('/news') || 
         window.location.pathname.includes('/notification') ||
         window.location.pathname.includes('/answer') ||
         window.location.pathname.includes('/cpcinfo')) &&
        !window.location.pathname.includes('/index') && 
        window.location.pathname !== '/index') {
        if (window.NewsModuleDetail && !window.NewsModuleDetail._initExecuted) {
            window.NewsModuleDetail.init();
        }
    }
    
    // 如果是管理后台文章列表页面（不是编辑页面），初始化分类筛选选项
    if (window.location.pathname.includes('/admin/news') && 
        !window.location.pathname.includes('/news_edit') && 
        !window.location.pathname.includes('/news_add')) {
        const categorySelect = document.getElementById('category_filter_select');
        if (categorySelect && window.generateCategoryOptions) {
            categorySelect.innerHTML = generateCategoryOptions();
        }
    }
});

} // 结束防重复执行检查的 else 块
