/**
 * expsys 比赛列表筛选 JavaScript
 * 实现复杂的客户端筛选功能，包括班级信息合并和筛选
 */

// 全局变量
let clss_map = {};
let user_map = {};  // user_id -> user_info 映射
let contest_list_table;
let ready_cnt_flag = 0;
let data_contest = [];
let data_clss = [];
let data_user = [];
// 根据是否是管理后台决定筛选键（前台不需要 defunct 筛选）
let filter_keys = ['title', 'year', 'semester', 'clss', 'teachers', 'attach', 'status'];

// 获取页面信息（从 script 标签设置的变量）
// 支持动态模块（优先从 clssPageInfo，其次从 expContestPageInfo）
let pageInfo = window.clssPageInfo || window.expContestPageInfo || {};
let timeStamp = pageInfo.timeStamp || (new Date().getTime() / 1000);
let now_course_key = pageInfo.courseKey || '';

// 获取用户配置
let config = window.expContestFilterConfig || {};
let now_user_id = config.userId || '';
let now_user_admin = config.isAdmin || config.isCourseAdmin || false;
let is_admin_module = config.isAdminModule || false;
// 兼容：部分页面未正确注入 isAdminModule，但实际渲染了 defunct（公开状态）控件。
// 一旦页面存在 defunct 控件，就必须按“管理态”处理（否则 defunct 不进入 filter_keys，清空也会跳过它）。
const HAS_DEFUNCT_CONTROL = (typeof document !== 'undefined') && !!document.querySelector('.contest_filter[name="defunct"]');
if (HAS_DEFUNCT_CONTROL && !is_admin_module) {
    is_admin_module = true;
}

// 如果是管理后台（或页面存在 defunct 控件），添加 defunct 到筛选键
if (is_admin_module || HAS_DEFUNCT_CONTROL) {
    filter_keys.push('defunct');
}

/**
 * 判断是否有权限管理该比赛
 * 是管理员或该班级的教师
 */
function CouldManage(item) {
    if (!item || !item.teachers || !Array.isArray(item.teachers)) {
        return false;
    }
    // teachers 现在是数组格式：[{user_id, nick, school}, ...]
    return now_user_admin || item.teachers.some(teacher => teacher.user_id === now_user_id);
}

/**
 * 初始化页面变量
 */
function InitPageVar() {
    const pi = (window.tplPickerFilterMode && window.tplPickerContestPageInfo)
        ? window.tplPickerContestPageInfo
        : (window.clssPageInfo || window.expContestPageInfo || {});
    timeStamp = pi.timeStamp || (new Date().getTime() / 1000);
    now_course_key = pi.courseKey || '';

    if (window.tplPickerFilterMode && $('#tpl_picker_table').length > 0) {
        contest_list_table = $('#tpl_picker_table');
    } else {
        contest_list_table = $('#contest_list_table');
    }
}

/**
 * 获取行的班级字段值
 */
function GetRowClssField(row, key) {
    if (!(row.clss_id in clss_map)) {
        return null;
    }
    return clss_map[row.clss_id]?.[key];
}

/**
 * 自定义筛选算法 - 用于 expsys 比赛列表
 * 支持复杂的筛选逻辑，包括班级信息合并和时间状态计算
 */
function customContestFilterAlgorithm(row, filters) {
    if (!filters) return true;
    
    // 遍历所有筛选键
    for (let i = 0; i < filter_keys.length; i++) {
        const key = filter_keys[i];
        const value = filters[key];
        
        // 跳过空值和默认值
        if (!value || value === '' || value === '-1') {
            continue;
        }
        
        let flag, field_content;
        
        switch(key) {
            case 'title': 
                if (!row.title || row.title.indexOf(value) === -1) {
                    return false;
                }
                break;
                
            case 'year':
                let year_list = value.split(/[,，]+/).map(y => y.trim()).filter(y => y);
                if (year_list.length === 0) break;
                // 数据已经合并到 row.clss_year，直接使用
                field_content = row.clss_year;
                if (field_content == null || field_content === undefined || year_list.indexOf(field_content.toString()) === -1) {
                    return false;
                }
                break;
                
            case 'semester':
                flag = false;
                // 数据已经合并到 row.clss_semester，直接使用
                field_content = row.clss_semester;
                if (field_content == null || field_content === undefined) {
                    return false;
                }
                value.split(/[,，]+/).forEach((sm) => {
                    if (field_content.indexOf(sm.trim()) !== -1) {
                        flag = true;
                        return;
                    }
                });
                if (!flag) return false;
                break;
                
            case 'teachers':
                flag = false;
                // 数据已经合并到 row.teachers，直接使用
                field_content = row.teachers;
                if (!field_content || !Array.isArray(field_content)) {
                    return false;
                }
                // teachers 现在是数组格式：[{user_id, nick, school}, ...]
                const teacherIds = value.split(/[,，]+/).map(t => t.trim()).filter(t => t);
                teacherIds.forEach((tc) => {
                    if (field_content.some(teacher => 
                        teacher.user_id === tc || 
                        teacher.nick === tc ||
                        (teacher.user_id && teacher.user_id.indexOf(tc) !== -1) ||
                        (teacher.nick && teacher.nick.indexOf(tc) !== -1)
                    )) {
                        flag = true;
                        return;
                    }
                });
                if (!flag) return false;
                break;
                
            case 'clss':
                if (!row.clss_title || row.clss_title.indexOf(value) === -1) {
                    return false;
                }
                break;
                
            case 'attach':
                const attachVal = parseInt(value);
                if (attachVal == 3) break;
                const ckind = Math.floor(row.private / 10 + 1e-8);
                if (!!attachVal != !!ckind) {
                    return false;
                }
                break;
                
            case 'defunct':
                // 确保类型一致：将 row.defunct 转换为字符串进行比较
                const rowDefunct = String(row.defunct || '');
                const filterDefunct = String(value || '');
                if (rowDefunct !== filterDefunct) {
                    return false;
                }
                break;
                
            case 'status': {
                let status = -1;
                if (typeof CsgContestPhaseByRowTimes === 'function') {
                    const ph = CsgContestPhaseByRowTimes(row);
                    if (ph === -1) {
                        status = 0;
                    } else if (ph === 0) {
                        status = 1;
                    } else if (ph === 1) {
                        status = 2;
                    }
                } else {
                    let now_time = timeStamp * 1000;
                    now_time = Timestamp2Time(now_time);
                    if (now_time < row.start_time) {
                        status = 0;
                    } else if (now_time <= row.end_time) {
                        status = 1;
                    } else {
                        status = 2;
                    }
                }
                if (status != parseInt(value)) {
                    return false;
                }
                break;
            }
        }
    }
    
    return true;
}

/**
 * 筛选比赛
 */
function FilterContest() {
    let filter_dict = GetFilterDict();
    
    contest_list_table.bootstrapTable('filterBy', filter_dict, {
        filterAlgorithm: customContestFilterAlgorithm
    });
    
    SaveFilter();
}

/**
 * 获取筛选条件字典
 */
function GetFilterDict() {
    let filter_dict = {};
    $('.contest_filter').each(function() {
        let key = this.getAttribute('name');
        if (key) {
            if (this.tagName === 'SELECT') {
                const val = this.value;
                // 对于 defunct，确保值正确传递（即使是 -1 也要传递，由筛选算法决定是否跳过）
                filter_dict[key] = val;
            } else {
                filter_dict[key] = this.value.trim();
            }
        }
    });
    return filter_dict;
}

/**
 * 设置筛选条件字典
 */
function SetFilterDict(filter_dict) {
    $('.contest_filter').each(function() {
        let key = this.getAttribute('name');
        if (key && key in filter_dict) {
            if (key == 'attach') {
                // select 元素
                for (let i = 0; i < this.options.length; i++) {
                    this.options[i].selected = this.options[i].value == filter_dict[key];
                }
            } else {
                this.value = filter_dict[key];
            }
        }
    });
    
    // 如果是教师而不是管理员，则自动筛选为该教师负责的班级
    if (config.isCourseTeacher && !config.isCourseAdmin && !config.isAdmin) {
        if ($('#contest_teachers_filter').val().trim() == '') {
            $('#contest_teachers_filter').val(now_user_id);
        }
    }
    
    FilterContest();
}

/**
 * 获取缓存 key（基于 course_key）
 * 模板选择 Modal（tpl_picker_table）与练习主列表分开存储，避免互相覆盖。
 */
function GetFilterCacheKey() {
    const base = `exp_contest_filter_${now_course_key || 'default'}`;
    const isTplPickerTable =
        window.tplPickerFilterMode &&
        typeof contest_list_table !== 'undefined' &&
        contest_list_table &&
        contest_list_table.length &&
        contest_list_table.attr('id') === 'tpl_picker_table';
    if (isTplPickerTable) {
        return `${base}_tpl_picker_modal`;
    }
    return base;
}

/**
 * 保存筛选条件到本地存储
 * 使用 csg.store(key, val) 永久缓存
 */
function SaveFilter() {
    let filter_dict = GetFilterDict();
    const cacheKey = GetFilterCacheKey();
    csg.store(cacheKey, filter_dict);
    // 更新筛选标签和徽章
    updateFilterTags();
    updateFilterBadge();
}

/**
 * 从本地存储加载筛选条件
 * 使用 csg.store(key) 获取
 */
function LoadFilter() {
    const cacheKey = GetFilterCacheKey();
    let filter_dict = csg.store(cacheKey) || {};
    SetFilterDict(filter_dict);
    // 同步主工具栏和侧边栏的筛选控件
    syncFilterControls();
    // 更新筛选标签和徽章
    updateFilterTags();
    updateFilterBadge();
    // 自动应用筛选条件
    FilterContest();
}

/**
 * 同步主工具栏和侧边栏的筛选控件值
 */
function syncFilterControls() {
    // 同步所有筛选控件（包括标题搜索框）
    $('.contest_filter').each(function() {
        let key = this.getAttribute('name');
        if (key) {
            let value = this.value;
            // 找到所有同名控件并同步
            $(`.contest_filter[name="${key}"]`).not(this).each(function() {
                const $other = $(this);
                // 如果其他控件正在初始化，跳过同步（避免循环触发）
                if ($other.data('initializing-from-anchor')) {
                    return;
                }
                if (this.tagName === 'SELECT') {
                    // 对于 select，先设置值，然后触发 change
                    if (this.value !== value) {
                        this.value = value;
                        $other.trigger('change');
                    }
                } else {
                    $(this).val(value);
                }
            });
        }
    });
}

/**
 * 更新筛选标签显示
 */
function updateFilterTags() {
    let filter_dict = GetFilterDict();
    let tagsContainer = $('#filterTags');
    tagsContainer.empty();
    
    let hasActiveFilters = false;
    
    // 筛选标签配置
    const filterLabels = {
        'title': { label: '标题', labelEn: 'Title', icon: 'bi-search' },
        'status': { 
            label: '时间状态', 
            labelEn: 'Time Status', 
            icon: 'bi-clock-history',
            values: {
                '-1': '全部',
                '0': '未开始',
                '1': '进行中',
                '2': '已结束'
            }
        },
        'clss': { label: '班级', labelEn: 'Class', icon: 'bi-people' },
        'year': { label: '年级', labelEn: 'Year', icon: 'bi-calendar' },
        'semester': { label: '学期', labelEn: 'Semester', icon: 'bi-calendar3' },
        'teachers': { label: '教师', labelEn: 'Teacher', icon: 'bi-person' },
        'attach': {
            label: '附加题',
            labelEn: 'Attach',
            icon: 'bi-tags',
            values: {
                '3': '全部',
                '0': '无附加题',
                '1': '有附加题'
            }
        },
        'defunct': {
            label: '公开状态',
            labelEn: 'Status',
            icon: 'bi-eye',
            values: {
                '-1': '全部',
                '0': '公开',
                '1': '隐藏'
            }
        }
    };
    
    for (let key in filter_dict) {
        let value = filter_dict[key];
        // 跳过空值和默认值
        if (!value || value === '' || value === '-1') {
            continue;
        }
        // 跳过'attach'的默认值'3'（全部）
        if (key === 'attach' && value === '3') {
            continue;
        }
        
        let config = filterLabels[key];
        if (!config) continue;
        
        hasActiveFilters = true;
        
        // 格式化显示值
        let displayValue = value;
        if (config.values && config.values[value]) {
            displayValue = config.values[value];
        }
        
        let tagHtml = `
            <span class="filter-tag" data-filter-key="${key}">
                <i class="bi ${config.icon}"></i>
                <span class="filter-tag-label">${config.label}:</span>
                <span class="filter-tag-value">${displayValue}</span>
                <button type="button" class="filter-tag-remove" data-filter-key="${key}" title="移除筛选">
                    <i class="bi bi-x"></i>
                </button>
            </span>
        `;
        tagsContainer.append(tagHtml);
    }
    
    // 显示/隐藏标签容器
    if (hasActiveFilters) {
        $('#filterTagsContainer').show();
    } else {
        $('#filterTagsContainer').hide();
    }
}

/**
 * 检查是否有额外筛选条件（排除基础筛选：status 和 title）
 */
function hasExtraFilters() {
    let filter_dict = GetFilterDict();
    const extraFilterKeys = ['clss', 'year', 'semester', 'teachers', 'attach', 'defunct'];
    
    for (let key of extraFilterKeys) {
        let value = filter_dict[key];
        if (value && value !== '' && value !== '-1') {
            // 跳过'attach'的默认值'3'（全部）
            if (key === 'attach' && value === '3') {
                continue;
            }
            return true;
        }
    }
    return false;
}

/**
 * 更新筛选徽章数量和按钮特效
 */
function updateFilterBadge() {
    let filter_dict = GetFilterDict();
    let count = 0;
    
    for (let key in filter_dict) {
        let value = filter_dict[key];
        if (value && value !== '' && value !== '-1') {
            // 跳过'attach'的默认值'3'（全部）
            if (key === 'attach' && value === '3') {
                continue;
            }
            count++;
        }
    }
    
    let badge = $('#filterBadge');
    if (count > 0) {
        badge.text(count).show();
    } else {
        badge.hide();
    }
    
    // 更新"更多"按钮特效
    updateMoreButtonEffect();
}

/**
 * 更新"更多"按钮的特效，显示是否有额外筛选条件
 */
function updateMoreButtonEffect() {
    const moreButton = $('#toggleFilterSidebar');
    const hasExtra = hasExtraFilters();
    
    if (hasExtra) {
        // 有额外筛选条件：添加特效类
        moreButton.addClass('has-extra-filters');
    } else {
        // 无额外筛选条件：移除特效类
        moreButton.removeClass('has-extra-filters');
    }
}

/**
 * 移除单个筛选标签
 */
function removeFilterTag(key) {
    $(`.contest_filter[name="${key}"]`).each(function() {
        if (this.tagName === 'SELECT') {
            if (key === 'attach') {
                this.value = '3';
            } else if (key === 'status' || key === 'defunct') {
                this.value = '-1';
            } else {
                this.value = '';
            }
        } else {
            this.value = '';
        }
    });
    // 与 clearAllFilters 一致：去掉 URL anchor，避免与控件或 hashchange 回填不同步
    if (typeof csg !== 'undefined' && csg.GetAnchor && csg.SetAnchor) {
        const prefix = 'contest';
        const anchorKey = `${prefix}_${key}`;
        if (csg.GetAnchor(anchorKey) !== null && csg.GetAnchor(anchorKey) !== '') {
            csg.SetAnchor(null, anchorKey);
        }
        if (csg.GetAnchor(key) !== null && csg.GetAnchor(key) !== '') {
            csg.SetAnchor(null, key);
        }
    }
    if (typeof syncFilterControls === 'function') {
        syncFilterControls();
    }
    FilterContest();
    if (typeof updateFilterTags === 'function') {
        updateFilterTags();
    }
    if (typeof updateFilterBadge === 'function') {
        updateFilterBadge();
    }
    if (typeof updateMoreButtonEffect === 'function') {
        updateMoreButtonEffect();
    }
}

/**
 * 从 user_list 构建 user_map
 */
function BuildUserMap(userList) {
    const map = {};
    if (userList && Array.isArray(userList)) {
        userList.forEach(user => {
            if (user.user_id) {
                map[user.user_id] = {
                    user_id: user.user_id,
                    nick: user.nick || user.user_id,
                    school: user.school || ''
                };
            }
        });
    }
    return map;
}

/**
 * 从 clss 列表构建 clss_map，并通过 user_map 填充 teachers 详细信息
 */
function BuildClssMap(clssList) {
    const map = {};
    if (clssList && Array.isArray(clssList)) {
        clssList.forEach(clss => {
            if (clss.clss_id) {
                // teachers 从 user_id 数组转换为结构化数据
                let teachers = [];
                if (clss.teachers && Array.isArray(clss.teachers)) {
                    teachers = clss.teachers.map(user_id => {
                        return user_map[user_id] || {
                            user_id: user_id,
                            nick: user_id,
                            school: ''
                        };
                    });
                }
                
                map[clss.clss_id] = {
                    clss_id: clss.clss_id,
                    title: clss.title || clss.clss_title || '',
                    year: clss.year || clss.clss_year || null,
                    semester: clss.semester || clss.clss_semester || '',
                    teachers: teachers
                };
            }
        });
    }
    return map;
}

/**
 * 统一的数据加载函数
 * 处理从后端获取的数据，整合 contest_list, clss_list, user_list
 */
function LoadContestData() {
    // 支持动态模块（模板选择器 / clssPageInfo / expContestPageInfo）
    const pageInfo = (window.tplPickerFilterMode && window.tplPickerContestPageInfo && window.tplPickerContestPageInfo.tableUrl)
        ? window.tplPickerContestPageInfo
        : (window.clssPageInfo || window.expContestPageInfo);
    if (!pageInfo || !pageInfo.tableUrl) {
        console.error('Page info not found. Please set window.clssPageInfo or window.expContestPageInfo (or tplPickerContestPageInfo in tpl picker mode).');
        return;
    }
    
    $.get(pageInfo.tableUrl, function(ret) {
        // 新格式：{ contest_list: [...], clss_list: [...], user_list: [...] }
        if (ret && typeof ret === 'object' && !Array.isArray(ret)) {
            // 构建 user_map
            user_map = BuildUserMap(ret.user_list || []);
            
            // 构建 clss_map（通过 user_map 填充 teachers 详细信息）
            clss_map = BuildClssMap(ret.clss_list || []);
            
            // 处理 contest_list，整合 teachers 详细信息
            data_contest = (ret.contest_list || []).map(contest => {
                // 如果 teachers 是 user_id 数组，转换为结构化数据
                if (contest.teachers && Array.isArray(contest.teachers)) {
                    contest.teachers = contest.teachers.map(user_id => {
                        return user_map[user_id] || {
                            user_id: user_id,
                            nick: user_id,
                            school: ''
                        };
                    });
                }
                
                // 确保每个 contest 都有必要的字段
                if (contest.clss_title && !contest.clss_year) {
                    // 从 clss_map 中补充信息
                    if (contest.clss_id in clss_map) {
                        const clss_info = clss_map[contest.clss_id];
                        contest.clss_year = clss_info.year;
                        contest.clss_semester = clss_info.semester;
                    }
                }
                
                // 配合formatter决定是否显示
                contest.edit = CouldManage(contest);
                contest.rejudge = CouldManage(contest);
                contest.defunct_change = CouldManage(contest);
                
                return contest;
            });
        } else if (Array.isArray(ret)) {
            // 旧格式兼容：直接是数组
            data_contest = ret;
            clss_map = BuildClssMapFromContest(data_contest);
        } else {
            data_contest = [];
            clss_map = {};
            user_map = {};
        }
        
        // 加载数据到表格
        contest_list_table.bootstrapTable('load', data_contest);

        // 模板选择 Modal 重载数据后清空「勾选顺序」与 Shift 锚点，与表格勾选状态一致
        if (window.tplPickerFilterMode && contest_list_table.length && contest_list_table.attr('id') === 'tpl_picker_table') {
            window.tplPickerCheckOrder = [];
            window.tplPickerShiftAnchorIndex = -1;
            if (typeof window.updateTplPickerPickFooter === 'function') {
                window.updateTplPickerPickFooter();
            }
        }
        
        // 加载保存的筛选条件
        LoadFilter();
    }).fail(function() {
        console.error('Failed to load contest data');
        data_contest = [];
        clss_map = {};
        user_map = {};
        contest_list_table.bootstrapTable('load', []);
    });
}

/**
 * 从 contest 数据中提取并构建 clss_map（兼容旧格式）
 * 如果 teachers 是 user_id 数组，通过 user_map 转换为结构化数据
 */
function BuildClssMapFromContest(contestList) {
    const clssMap = {};
    if (contestList && Array.isArray(contestList)) {
        contestList.forEach(contest => {
            if (contest.clss_id && !clssMap[contest.clss_id]) {
                // 处理 teachers：如果是 user_id 数组，转换为结构化数据
                let teachers = contest.teachers || [];
                if (Array.isArray(teachers) && teachers.length > 0) {
                    // 检查第一个元素是否是字符串（user_id）还是对象（结构化数据）
                    if (typeof teachers[0] === 'string') {
                        // user_id 数组，通过 user_map 转换为结构化数据
                        teachers = teachers.map(user_id => {
                            return user_map[user_id] || {
                                user_id: user_id,
                                nick: user_id,
                                school: ''
                            };
                        });
                    }
                    // 如果已经是结构化数据，直接使用
                }
                
                clssMap[contest.clss_id] = {
                    clss_id: contest.clss_id,
                    title: contest.clss_title || '',
                    year: contest.clss_year || null,
                    semester: contest.clss_semester || '',
                    teachers: teachers
                };
            }
        });
    }
    return clssMap;
}

// ========================================
// 侧边栏管理函数
// ========================================

// 侧边栏显示/隐藏状态（模块级变量）
let filterSidebarVisible = false;
let filterSidebarCollapsed = false;
let resizeTimer = null;

/**
 * 更新侧边栏切换图标
 */
function updateFilterSidebarToggleIcon() {
    const toggleBtn = $('#filterSidebarToggle');
    const icon = toggleBtn.find('i');
    if (filterSidebarCollapsed) {
        icon.removeClass('bi-chevron-right').addClass('bi-chevron-left');
    } else {
        icon.removeClass('bi-chevron-left').addClass('bi-chevron-right');
    }
}

/**
 * 强制隐藏「更多筛选」侧栏并同步内部状态（模板选择 Modal 关闭时调用，避免侧栏留在页面上）
 */
function hideFilterSidebarIfVisible() {
    const sidebar = document.getElementById('filterSidebar');
    if (!sidebar) {
        return;
    }
    if (filterSidebarVisible) {
        sidebar.classList.remove('show');
        filterSidebarVisible = false;
    }
    filterSidebarCollapsed = false;
    sidebar.classList.remove('collapsed');
    updateFilterSidebarToggleIcon();
    updateFilterSidebarPosition();
    updateMoreButtonEffect();
}

/**
 * 侧边栏显示/隐藏切换函数
 */
function toggleFilterSidebar() {
    const sidebar = document.getElementById('filterSidebar');
    if (!sidebar) return;
    
    filterSidebarVisible = !filterSidebarVisible;
    
    if (filterSidebarVisible) {
        // 显示侧边栏
        sidebar.classList.add('show');
        // 如果之前是收起状态，保持收起；否则展开
        if (!filterSidebarCollapsed) {
            sidebar.classList.remove('collapsed');
        }
        // 计算并更新位置
        updateFilterSidebarPosition();
    } else {
        // 隐藏侧边栏
        sidebar.classList.remove('show');
    }
}

/**
 * 双击填筛选时：确保侧栏显示并处于展开态，便于看到已填条件
 */
function ensureContestFilterSidebarOpenAndExpanded() {
    const sidebar = document.getElementById('filterSidebar');
    if (!sidebar) {
        return;
    }
    if (!filterSidebarVisible) {
        toggleFilterSidebar();
    }
    if (filterSidebarCollapsed) {
        filterSidebarCollapsed = false;
        sidebar.classList.remove('collapsed');
        updateFilterSidebarToggleIcon();
        setTimeout(() => {
            updateFilterSidebarPosition();
        }, 300);
    }
}

/**
 * 侧边栏折叠/展开切换函数（仅当侧边栏显示时）
 */
function toggleFilterSidebarCollapse() {
    if (!filterSidebarVisible) return;
    
    const sidebar = document.getElementById('filterSidebar');
    if (sidebar) {
        filterSidebarCollapsed = !filterSidebarCollapsed;
        if (filterSidebarCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
        updateFilterSidebarToggleIcon();
        // 侧边栏宽度变化后，重新计算位置
        setTimeout(() => {
            updateFilterSidebarPosition();
        }, 300); // 等待 CSS transition 完成
    }
}

/**
 * 动态更新侧边栏位置
 */
function updateFilterSidebarPosition() {
    const sidebar = document.getElementById('filterSidebar');
    const main = document.querySelector('main');
    if (!sidebar || !main) return;
    
    const mainRect = main.getBoundingClientRect();
    const sidebarWidth = sidebar.classList.contains('collapsed') ? 50 : (sidebar.offsetWidth || 300);
    const gap = 20; // 间距
    const minRightMargin = 20; // 最小右边距
    
    // 计算main的右侧位置和可用空间
    const mainRight = mainRect.right;
    const availableRight = window.innerWidth - mainRight;
    
    // 如果main的右侧空间足够（能放下侧边栏+间距），就贴main放右侧
    if (availableRight >= sidebarWidth + gap) {
        sidebar.style.left = `${mainRight + gap}px`;
        sidebar.style.right = 'auto';
    } else {
        // main的右侧空间不够，贴窗口右侧
        sidebar.style.left = 'auto';
        sidebar.style.right = `${minRightMargin}px`;
    }
}

/**
 * 初始化侧边栏事件
 */
function initFilterSidebarEvents() {
    // 侧边栏头部点击切换（整个头部区域可点击，用于折叠/展开）
    // 仅练习列表 #filterSidebar：模板管理页的 #tpl_filter_sidebar 另有独立脚本，避免误绑
    $(document).off('click.filterSidebar').on('click.filterSidebar', '#filterSidebar .filter-sidebar-header', function(e) {
        // 如果点击的是按钮或其他交互元素，不触发折叠（让按钮自己的事件处理）
        if ($(e.target).closest('button, .filter-tag-remove').length > 0) {
            return;
        }
        toggleFilterSidebarCollapse();
    });
    
    // 切换按钮点击事件（防止事件冒泡，用于折叠/展开）
    $(document).off('click.filterSidebarToggle').on('click.filterSidebarToggle', '#filterSidebarToggle', function(e) {
        e.stopPropagation();
        toggleFilterSidebarCollapse();
    });
    
    // 主工具栏的"更多"按钮（用于显示/隐藏侧边栏）
    $('#toggleFilterSidebar').off('click.filterSidebar').on('click.filterSidebar', function() {
        toggleFilterSidebar();
    });
    
    // 窗口大小改变时更新位置
    $(window).off('resize.filterSidebar').on('resize.filterSidebar', function() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            updateFilterSidebarPosition();
        }, 200);
    });
}

/**
 * 初始化侧边栏状态
 */
function initFilterSidebar() {
    // 初始化侧边栏状态（默认隐藏，展开状态）
    filterSidebarVisible = false;
    filterSidebarCollapsed = false;
    updateFilterSidebarToggleIcon();
    updateFilterSidebarPosition();
    initFilterSidebarEvents();
}

// ========================================
// 主初始化函数
// ========================================

/**
 * 在年级/学期单元格内按坐标命中徽块（用于点到单元格空白、padding）
 */
function csgPickYearSemBadgeAtPoint($td, clientX, clientY) {
    const $empty = $();
    if (!$td || !$td.length) {
        return $empty;
    }
    const x = clientX;
    const y = clientY;
    if (x == null || y == null || isNaN(x) || isNaN(y)) {
        return $empty;
    }
    let best = null;
    let bestArea = Infinity;
    $td.find('.csg-yearsem-year, .csg-yearsem-sem').each(function () {
        const r = this.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            const area = Math.max(1, r.width) * Math.max(1, r.height);
            if (area < bestArea) {
                bestArea = area;
                best = this;
            }
        }
    });
    return best ? $(best) : $empty;
}

/**
 * BT 的 dbl-click-cell 为合成事件，e.target 常为 TABLE；年级/学期必须在原生捕获阶段用真实 target 处理，
 * 并 stopPropagation，避免 td 上 BT 监听器再触发。
 */
function csgContestYearSemDblclickCapture(ev) {
    const tbl = ev.currentTarget;
    const raw = ev.target;
    const el = raw && raw.nodeType === 3 ? raw.parentElement : raw;
    const td = el && el.closest ? el.closest('td') : null;
    if (!td || !tbl.contains(td)) {
        return;
    }
    if (!td.querySelector || !td.querySelector('.csg-yearsem-year, .csg-yearsem-sem')) {
        return;
    }

    let badge = el && el.closest ? (el.closest('.csg-yearsem-year') || el.closest('.csg-yearsem-sem')) : null;
    if (!badge) {
        const $hit = csgPickYearSemBadgeAtPoint($(td), ev.clientX, ev.clientY);
        if ($hit.length) {
            badge = $hit[0];
        }
    }
    if (!badge) {
        return;
    }

    const $anchor = $(badge);
    const isYear = $anchor.hasClass('csg-yearsem-year');
    const isSem = $anchor.hasClass('csg-yearsem-sem');
    if (!isYear && !isSem) {
        return;
    }
    const input_dom = $(`.contest_filter[name="${isYear ? 'year' : 'semester'}"]`);
    const filterValue = isYear
        ? ($anchor.attr('data-filter-year') || '')
        : ($anchor.attr('data-filter-semester') || '');
    if (input_dom.length === 0) {
        return;
    }
    ev.stopPropagation();
    ev.preventDefault();
    input_dom.val(filterValue);
    syncFilterControls();
    ensureContestFilterSidebarOpenAndExpanded();
    FilterContest();
}

function csgEnsureYearSemCaptureOnTable($table) {
    const el = $table && $table[0];
    if (!el || el._csgYearSemCaptureBound) {
        return;
    }
    el._csgYearSemCaptureBound = true;
    el.addEventListener('dblclick', csgContestYearSemDblclickCapture, true);
}

/**
 * 初始化比赛列表筛选功能
 * 此函数应在页面加载完成后调用
 */
function initContestFilter() {
    InitPageVar();

    if (!contest_list_table || !contest_list_table.length) {
        console.warn('initContestFilter: contest list table not found');
        return;
    }

    csgEnsureYearSemCaptureOnTable(contest_list_table);

    // contest_filter.php 的内联脚本在本文件之后合并 window.expContestFilterConfig，此处再同步一次模块级变量
    if (window.expContestFilterConfig && typeof window.expContestFilterConfig === 'object') {
        config = window.expContestFilterConfig;
        now_user_id = config.userId || '';
        now_user_admin = config.isAdmin || config.isCourseAdmin || false;
        is_admin_module = config.isAdminModule || false;
        if (HAS_DEFUNCT_CONTROL && !is_admin_module) {
            is_admin_module = true;
        }
    }
    
    // 统一的数据加载逻辑
    LoadContestData();
    
    // 监听 Bootstrap Table 的 refresh 事件，重新加载数据
    contest_list_table.off('refresh.bs.table.contestFilter').on('refresh.bs.table.contestFilter', function(e, params) {
        LoadContestData();
    });
    
    // 双击单元格填充筛选条件（确保侧边栏展开并填充）
    // Bootstrap Table 约定：dbl-click-cell 参数为 (e, field, value, row, $td)，见 bootstrap-table.js trigger
    contest_list_table.off('dbl-click-cell.bs.table.contestFilter').on('dbl-click-cell.bs.table.contestFilter', function(e, field, value, row, $td) {
        // 无 data-field 的列（如部分状态列）无法映射筛选
        if (field === undefined || field === null || field === '') {
            return;
        }
        // 模板选择 Modal：勾选列、勾选顺序列无对应筛选框（仍允许标题、班级等列双击填筛选）
        if (window.tplPickerFilterMode && (field === 'state' || field === 'picker_seq')) {
            return;
        }

        // 年级/学期：已在原生 capture 阶段处理并 stopPropagation（BT 合成事件 e.target 不可靠）
        if (field === 'clss_year') {
            return;
        }
        const input_dom_name = field == 'clss_title' ? 'clss' : String(field).replace(/^clss_/, '');
        const input_dom = $(`.contest_filter[name="${input_dom_name}"]`);
        if (input_dom.length > 0) {
            let filterValue = row[field];
            
            // 特殊处理 teachers 字段：如果是数组格式，提取 user_id 或 nick
            if (field === 'teachers' && Array.isArray(filterValue) && filterValue.length > 0) {
                // 提取所有教师的 user_id，用逗号连接
                filterValue = filterValue.map(teacher => teacher.user_id || teacher.nick || '').filter(id => id).join(',');
            }
            
            // 填充所有同名控件
            input_dom.val(filterValue);
            syncFilterControls();
            ensureContestFilterSidebarOpenAndExpanded();
            FilterContest();
        }
    });
    
    // 使用 initBootstrapTableClientToolbar 统一管理工具栏
    const contestTableId = (window.tplPickerFilterMode && $('#tpl_picker_table').length > 0)
        ? 'tpl_picker_table'
        : 'contest_list_table';
    initBootstrapTableClientToolbar({
        tableId: contestTableId,
        prefix: 'contest',
        filterSelectors: ['status', 'attach', 'defunct'],
        searchInputId: 'contest_title_filter',
        searchFields: { title: 'title' },
        customFilterAlgorithm: customContestFilterAlgorithm,
        customHandlers: {
            // 自定义刷新处理：统一调用数据加载函数
            refresh: function() {
                LoadContestData();
            },
            // 自定义清空处理：需要同步筛选控件和更新标签
            clear: function() {
                clearAllFilters();
            }
        }
    });
    
    // 筛选条件变化时同步控件并更新标签（覆盖 initBootstrapTableClientToolbar 的默认处理）
    $('.contest_filter').off('change.contestFilter input.contestFilter').on('input.contestFilter change.contestFilter', function(e) {
        // 确保 defunct 选择框的值变化能正确触发筛选
        const name = this.getAttribute('name');
        const $elem = $(this);
        
        // 如果正在从 anchor 初始化，跳过处理（避免循环触发）
        if ($elem.data('initializing-from-anchor')) {
            return;
        }
        
        syncFilterControls();
        FilterContest();
        // 更新标签和徽章
        if (name === 'defunct' || name === 'attach' || name === 'status') {
            updateFilterTags();
            updateFilterBadge();
        }
    });
    
    // 清空筛选条件按钮（侧边栏）
    $('#contest_clear_sidebar').off('click.contestFilter').on('click.contestFilter', function() {
        clearAllFilters();
    });
    
    // 初始化侧边栏
    initFilterSidebar();

    // 模板选择 Modal 关闭时收起侧栏，避免叠在已关闭 Modal 之下的主页面
    if (window.tplPickerFilterMode && $('#tplPickerModal').length) {
        $('#tplPickerModal')
            .off('hidden.bs.modal.tplPickerSidebar')
            .on('hidden.bs.modal.tplPickerSidebar', function () {
                hideFilterSidebarIfVisible();
            });
    }
    
    // 移除筛选标签事件
    $(document).off('click.filterTagRemove').on('click.filterTagRemove', '.filter-tag-remove', function(e) {
        e.preventDefault();
        let key = $(this).data('filter-key');
        removeFilterTag(key);
    });
    
    // 初始化时同步筛选控件
    syncFilterControls();
    
    // 初始化筛选标签和徽章
    updateFilterTags();
    updateFilterBadge();
    // 初始化按钮特效
    updateMoreButtonEffect();
}

/**
 * 清空所有筛选条件
 */
function clearAllFilters() {
    const prefix = 'contest'; // 与 initBootstrapTableClientToolbar 中的 prefix 保持一致
    
    $('.contest_filter').each(function() {
        const $elem = $(this);
        let key = this.getAttribute('name');
        if (!key) return;
        
        let newValue;
        
        if (key == 'attach') {
            newValue = '3';
        } else if (key == 'status') {
            newValue = '-1';
        } else if (key == 'defunct' && (is_admin_module || HAS_DEFUNCT_CONTROL)) {
            // 只在管理后台（或存在 defunct 控件）时清空 defunct
            newValue = '-1';
        } else if (key != 'defunct') {
            // 前台不处理 defunct 字段
            newValue = '';
        } else {
            return; // 跳过 defunct 字段（前台）
        }
        
        // 清空对应的 anchor 参数（使用带 namespace 的格式）
        const anchorKey = `${prefix}_${key}`;
        const anchorVal = csg.GetAnchor(anchorKey);
        if (anchorVal !== null && anchorVal !== '') {
            csg.SetAnchor(null, anchorKey);
        }
        // 也尝试清空不带 namespace 的格式（向后兼容）
        const fallbackAnchorVal = csg.GetAnchor(key);
        if (fallbackAnchorVal !== null && fallbackAnchorVal !== '') {
            csg.SetAnchor(null, key);
        }
        
        // 标记为正在清空，避免触发 anchor 更新事件
        $elem.data('initializing-from-anchor', true);
        
        // 设置值（无论当前值是什么，都强制设置并触发事件，确保 Bootstrap Table 正确更新）
        if ($elem.is('select')) {
            // 对于 select，需要触发 change 事件以同步 csg-select 和 Bootstrap Table
            // 强制设置值，即使值相同也要触发 change 事件，确保 Bootstrap Table 更新筛选状态
            if (this.tagName === 'SELECT') {
                // 使用原生方式设置值并触发事件
                const oldValue = this.value;
                this.value = newValue;
                
                // 对于 defunct 字段，始终触发 change 事件（确保筛选更新）
                if (key === 'defunct') {
                    // 触发原生 change 事件
                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                    this.dispatchEvent(changeEvent);
                    // 也使用 jQuery 触发，确保所有监听器都能收到
                    $elem.trigger('change');
                } else if (oldValue !== newValue) {
                    // 其他字段：只有值改变时才触发
                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                    this.dispatchEvent(changeEvent);
                } else {
                    // 即使值相同，也触发 change 事件（确保筛选更新）
                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                    this.dispatchEvent(changeEvent);
                }
            } else {
                $elem.val(newValue).trigger('change');
            }
        } else {
            // 对于 input，直接设置值并触发 change 事件
            this.value = newValue;
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            this.dispatchEvent(changeEvent);
        }
        
        // 延迟清除标记
        setTimeout(function() {
            $elem.removeData('initializing-from-anchor');
        }, 100);
    });
    
    // 清空搜索框的 anchor 参数（如果有）
    const searchInputId = 'contest_title_filter';
    if ($(`#${searchInputId}`).length > 0) {
        const searchAnchorKey = `${prefix}_search`;
        const searchAnchorVal = csg.GetAnchor(searchAnchorKey);
        if (searchAnchorVal !== null && searchAnchorVal !== '') {
            csg.SetAnchor(null, searchAnchorKey);
        }
        // 也尝试清空不带 namespace 的格式
        const fallbackSearchAnchorVal = csg.GetAnchor('search');
        if (fallbackSearchAnchorVal !== null && fallbackSearchAnchorVal !== '') {
            csg.SetAnchor(null, 'search');
        }
    }
    
    syncFilterControls();
    FilterContest();
    updateFilterTags(); // 确保标签也更新
    updateFilterBadge(); // 确保徽章也更新
}

// ========================================
// expsys 专用的 Formatter 函数
// ========================================

/**
 * 比赛标题 formatter - expsys 专用
 */
function FormatterExpContestTitle(value, row, index, field) {
    if (!value) {
        return '';
    }
    const contest_url = `/expsys/contest/problemset?cid=${row['contest_id']}`;
    // 限宽与折行由 contest_filter.css 中 td[data-field="title"] 统一控制（与 FormatterContestTitle 一致）
    return `<a class="text-decoration-none text-primary" title="${value}" href="${contest_url}">${value}</a>`;
}

/**
 * 比赛类型 formatter - expsys 专用（只显示是否有附加题）
 */
function FormatterExpContestAttachpro(value, row, index, field) {
    const privateValue = parseInt(value);
    const attach = Math.floor(privateValue / 10 + 1e-8);
    let ckind_str, cl;
    
    if (attach) {
        cl = 'info';
        ckind_str = "有<span class='en-text'>Yes</span>";
    } else {
        cl = 'secondary';
        ckind_str = "无<span class='en-text'>No</span>";
    }
    
    return `<span class='badge bg-${cl}' >${ckind_str}</span>`;
}

/**
 * 比赛进行状态 formatter - expsys 专用（根据时间判断）
 */
function FormatterExpContestTimeStatus(value, row, index, field) {
    var phase = (typeof CsgContestPhaseByRowTimes === 'function')
        ? CsgContestPhaseByRowTimes(row)
        : null;
    if (phase === -1) {
        return "<span class='badge bg-success'>未开始<span class='en-text'>Coming</span></span>";
    }
    if (phase === 0) {
        return "<span class='badge bg-danger'>进行中<span class='en-text'>Running</span></span>";
    }
    if (phase === 1) {
        return "<span class='badge bg-secondary'>已结束<span class='en-text'>Ended</span></span>";
    }
    var nowMs = (typeof timeStamp !== 'undefined' && timeStamp != null) ? timeStamp * 1000 : Date.now();
    var nowStr = typeof Timestamp2Time === 'function' ? Timestamp2Time(nowMs) : '';
    if (nowStr < row.start_time) {
        return "<span class='badge bg-success'>未开始<span class='en-text'>Coming</span></span>";
    } else if (nowStr <= row.end_time) {
        return "<span class='badge bg-danger'>进行中<span class='en-text'>Running</span></span>";
    }
    return "<span class='badge bg-secondary'>已结束<span class='en-text'>Ended</span></span>";
}

/**
 * 班级标题 formatter - expsys 专用
 * 支持动态模块（从 window.clssPageInfo 或 window.expContestPageInfo 读取）
 */
function FormatterExpClssTitle(value, row, index, field) {
    if (!value) return '';
    
    // 获取模块信息（优先从 clssPageInfo，其次从 expContestPageInfo）
    let module = 'expsys';
    if (window.clssPageInfo && window.clssPageInfo.module) {
        module = window.clssPageInfo.module;
    } else if (window.expContestPageInfo && window.expContestPageInfo.module) {
        module = window.expContestPageInfo.module;
    }
    
    // 根据班级名称获取颜色索引（通用哈希逻辑在 util.js：csg.hashColorIndex）
    const colorIndex = csg.hashColorIndex(value, 8);
    const colorClass = `clss-title-color-${colorIndex}`;
    
    if (row.clss_id) {
        return `<a href="/expsys/clss/stu?clss_id=${row.clss_id}" class="clss_title ${colorClass}" title="${value}">${value}</a>`;
    }
    return `<span class="clss_title ${colorClass}" title="${value}">${value}</span>`;
}

/**
 * 班级教师 formatter - expsys 专用
 * 显示教师姓名和ID，鼠标悬停显示详细信息，点击跳转到用户信息页
 */
function FormatterExpClssTeachers(value, row, index, field) {
    if (!value || !Array.isArray(value) || value.length === 0) {
        return '<span class="text-muted">-</span>';
    }
    
    // 构建教师标签列表
    let teacherTags = value.map(teacher => {
        const user_id = teacher.user_id || '';
        const nick = teacher.nick || user_id;
        const school = teacher.school || '';
        
        // 构建悬停提示信息
        let tooltip = `用户ID: ${user_id}`;
        if (school) {
            tooltip += `\n单位: ${school}`;
        }
        
        // 构建用户信息页URL
        const userUrl = `/expsys/user/userinfo?user_id=${encodeURIComponent(user_id)}`;
        
        // 返回紧凑美观的标签
        return `
            <a href="${userUrl}" 
               class="teacher-tag" 
               title="${tooltip}"
               data-bs-toggle="tooltip" 
               data-bs-placement="top">
                <span class="teacher-name">${nick}</span>
            </a>
        `;
    });
    
    return `<div class="teacher-list">${teacherTags.join('')}</div>`;
}

/** HTML 文本/属性转义（年级学期单元格、徽块 data-*） */
function csgContestCellTextEsc(s) {
    if (s === undefined || s === null) {
        return '';
    }
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * 练习列表「年级」列：与合并列年级徽块一致，供双击 capture 识别
 */
function FormatterExpClssYear(value, row, index, field) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return '<span class="text-muted">-</span>';
    }
    const yearRaw = String(value).trim();
    return `<span class="badge bg-primary csg-yearsem-year" style="font-size: 0.75em;" data-filter-year="${csgContestCellTextEsc(yearRaw)}" title="双击按年级筛选 (Double-click to filter by year)">${csgContestCellTextEsc(yearRaw)}</span>`;
}

/**
 * 练习列表「学期」列：带 csg-yearsem-sem + data-filter-semester（与 contest_filter 双击 capture 一致）
 * 班级表等仍用 FormatterExpSemester（无徽块、无侧栏筛选）
 */
function FormatterExpContestClssSemester(value, row, index, field) {
    if (!value || typeof value !== 'string') {
        return '<span class="text-muted">-</span>';
    }
    const raw = String(value);
    let display = raw;
    const match = raw.match(/^(\d{4})-(\d{4})-(\d+)$/);
    if (match) {
        const startYear = match[1].substring(2);
        const endYear = match[2].substring(2);
        const semester = match[3];
        display = `${startYear}-${endYear}-${semester}`;
    }
    return `<span class="badge bg-secondary csg-yearsem-sem" style="font-size: 0.7em; white-space: nowrap;" data-filter-semester="${csgContestCellTextEsc(raw)}" title="${csgContestCellTextEsc(raw)} · 双击按学期筛选 (Double-click to filter by semester)">${csgContestCellTextEsc(display)}</span>`;
}

/**
 * 学期 formatter - expsys 专用
 * 将 2025-2026-1 格式转换为 25-26-1，字体更小更紧凑
 */
function FormatterExpSemester(value, row, index, field) {
    if (!value || typeof value !== 'string') {
        return '<span class="text-muted">-</span>';
    }
    
    // 匹配格式：YYYY-YYYY-N 或 YYYY-YYYY-NN
    const match = value.match(/^(\d{4})-(\d{4})-(\d+)$/);
    if (match) {
        const startYear = match[1].substring(2); // 取后两位
        const endYear = match[2].substring(2);   // 取后两位
        const semester = match[3];
        const compactValue = `${startYear}-${endYear}-${semester}`;
        return `<span style="font-size: 0.85em; white-space: nowrap;" title="${value}">${compactValue}</span>`;
    }
    
    // 如果格式不匹配，返回原值（字体小一点）
    return `<span style="font-size: 0.85em; white-space: nowrap;">${value}</span>`;
}

/**
 * 年级学期合并列 formatter
 * 数据形式：2024	25-26-1
 */
function FormatterExpYearSemester(value, row, index, field) {
    const year = row.clss_year || '';
    const semester = row.clss_semester || '';
    
    if (!year && !semester) {
        return '<span class="text-muted">-</span>';
    }
    
    // 处理学期格式：YYYY-YYYY-N => YY-YY-N（展示用；筛选双击写入原始 clss_semester）
    let semesterDisplay = semester;
    if (semester && typeof semester === 'string') {
        const match = semester.match(/^(\d{4})-(\d{4})-(\d+)$/);
        if (match) {
            const startYear = match[1].substring(2);
            const endYear = match[2].substring(2);
            const sem = match[3];
            semesterDisplay = `${startYear}-${endYear}-${sem}`;
        }
    }
    
    const yearRaw = year ? String(year) : '';
    const semRaw = semester ? String(semester) : '';
    const yearHtml = yearRaw
        ? `<div class="mb-1"><span class="badge bg-primary csg-yearsem-year" style="font-size: 0.75em;" data-filter-year="${csgContestCellTextEsc(yearRaw)}" title="双击按年级筛选 (Double-click to filter by year)">${csgContestCellTextEsc(yearRaw)}</span></div>`
        : '';
    const semesterHtml = semesterDisplay
        ? `<div><span class="badge bg-secondary csg-yearsem-sem" style="font-size: 0.7em;" data-filter-semester="${csgContestCellTextEsc(semRaw)}" title="双击按学期筛选 (Double-click to filter by semester)">${csgContestCellTextEsc(String(semesterDisplay))}</span></div>`
        : '';
    
    return `<div class="d-flex flex-column align-items-center csg-yearsem-cell" style="line-height: 1.2;">${yearHtml}${semesterHtml}</div>`;
}

/**
 * 练习删除按钮 formatter（带权限检查）
 */
function FormatterContestDelete(value, row, index, field) {
    // 检查是否有管理权限
    if (!row || !row.is_admin) {
        return `<span class="btn btn-sm btn-outline-secondary disabled" title="无权限(No Permission)">
                    <i class="bi bi-lock"></i>
                </span>`;
    }
    
    return `<button type="button" class="btn btn-sm btn-danger contest-delete-btn"
                data-contest-id="${row.contest_id}"
                data-contest-title="${(row.title || '').replace(/"/g, '&quot;')}"
                title="删除练习 (Delete Contest)">
                <i class="bi bi-trash"></i>
            </button>`;
}

// 绑定练习删除按钮事件（使用事件委托）
$(document).on('click', '.contest-delete-btn', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const contestId = $(this).data('contest-id');
    const contestTitle = $(this).data('contest-title') || `练习 #${contestId}`;
    
    alerty.confirm(
        `确定要删除练习吗？<br><br>` +
        `<strong>练习ID：</strong>${contestId}<br>` +
        `<strong>练习标题：</strong>${contestTitle}<br><br>` +
        `<span class="text-danger">注意：只有在该练习没有任何提交记录和考生账号的情况下才能删除。删除后无法恢复！</span>`,
        '确认删除',
        function() {
            // 确认删除，发送 AJAX 请求
            $.post('/exadmin/contest/contest_delete_ajax', {
                contest_id: contestId
            }, function(response) {
                if (response.code === 1) {
                    // 删除成功，直接从表格中移除该行
                    $('#contest_list_table').bootstrapTable('remove', {
                        field: 'contest_id',
                        values: [contestId]
                    });
                    alerty.success(response.msg || '删除成功！', '成功');
                } else {
                    alerty.error(response.msg || '删除失败！', '错误');
                }
            }).fail(function(xhr, status, error) {
                alerty.error('网络错误，请稍后重试。', '错误');
            });
        },
        function() {
            // 取消删除
        }
    );
});
