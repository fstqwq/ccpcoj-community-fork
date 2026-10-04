/**
 * 菜单生成器
 * 根据 OJ_MODE 和 OJ_STATUS 动态生成侧边栏菜单
 */

(function() {
    'use strict';
    
    // 可复用的菜单项定义
    const MENU_ITEMS = {
        home: { type: 'item', text: '主页', enText: 'Home', href: '/index', active: { module: ['index', 'exindex'] } },
        problemArchive: { type: 'item', text: '赛事题目归档', enText: 'Problem Archive', href: '/csgoj/problemarchive', active: { controller: ['problemarchive'] }, activeModule: ['csgoj', 'expsys', 'examsys'], condition: 'OJ_OPEN_ARCHIVE' },
        problemSet: { type: 'item', text: '开放题目集', enText: 'Problem Set', href: '/csgoj/problemset', active: { controller: ['problemset'] }, activeModule: ['csgoj', 'expsys', 'examsys'] },
        status: { type: 'item', text: '评测状态', enText: 'Status', href: '/csgoj/status', active: { controller: ['status'] }, activeModule: ['csgoj', 'expsys', 'examsys'] },
        userRank: { type: 'item', text: '刷题榜', enText: 'Training Rank', href: '/csgoj/userrank', active: { controller: ['userrank'] }, activeModule: ['csgoj', 'expsys', 'examsys'] },
        contest: { type: 'item', text: '比赛', enText: 'Contest', href: '/csgoj/contest', active: { module: ['csgoj'], controller: ['contest'] } },
        xcpcContest: { type: 'item', text: '标准XCPC比赛', enText: 'Standard XCPC Contest', href: '/cpcsys/contest', active: { module: ['cpcsys'], controller: ['contest'] } },
        faqs: { type: 'item', text: '常见疑问', enText: 'FAQs', href: '/csgoj/faqs', active: { controller: ['faqs'] }, activeModule: ['csgoj', 'expsys', 'examsys'] },
        faqsCpc: { type: 'item', text: '常见疑问', enText: 'FAQs', href: '/cpcsys/faqs', active: { controller: ['faqs'] }, activeModule: ['cpcsys'] },
        outrankSystem: { type: 'item', text: '外榜', enText: 'Outrank', href: '/outrank/index', active: { module: ['outrank'], controller: ['index', 'rank'] }, targetBlank: true },
        adminPanel: { type: 'item', text: '管理后台', enText: 'Admin Panel', href: '/admin', active: { module: ['admin'] }, condition: 'isAdminOrCourseTeacher' },
        tools: { type: 'item', text: '工具集', enText: 'Tools', href: '/ojtool', condition: 'isAdminOrTeacher' },
        separator: { type: 'separator' },
        
        // expsys/examsys 专用菜单项
        practice: { type: 'item', text: '课程练习', enText: 'Course Practice', href: '/expsys/contest', active: { module: ['expsys'], controller: ['contest'] }, requireLogin: true },
        clss: { type: 'item', text: '班级', enText: 'Class', href: '/expsys/clss', active: { module: ['expsys'], controller: ['clss'] }, requireLogin: true },
        // cpcsys.exp 模式专用：课程练习和班级只对管理员/教师显示
        practiceForExam: { type: 'item', text: '课程练习', enText: 'Course Practice', href: '/expsys/contest', active: { module: ['expsys'], controller: ['contest'] }, condition: 'isAdminOrCourseTeacher' },
        clssForExam: { type: 'item', text: '班级', enText: 'Class', href: '/expsys/clss', active: { module: ['expsys'], controller: ['clss'] }, condition: 'isAdminOrCourseTeacher' },
        exam: { type: 'item', text: '考试', enText: 'Exam', href: '/examsys/contest', active: { module: ['examsys'], controller: ['contest', 'contestadmin'] } },
        course: { type: 'item', text: '课程组', enText: 'Course Group', href: '/course/index', active: { module: ['course'] } }
    };
    
    // 可复用的菜单项包
    const MENU_PACKAGES = {
        // 基础OJ菜单包（主页、题目集、状态、刷题榜、比赛）
        basicOJ: [
            MENU_ITEMS.home,
            MENU_ITEMS.problemSet,
            MENU_ITEMS.status,
            MENU_ITEMS.userRank,
            MENU_ITEMS.contest
        ],
        // 带归档的基础OJ菜单包（problemArchive 会根据 OJ_OPEN_ARCHIVE 条件自动显示/隐藏）
        basicOJWithArchive: [
            MENU_ITEMS.home,
            MENU_ITEMS.problemArchive,  // 有条件显示
            MENU_ITEMS.problemSet,
            MENU_ITEMS.status,
            MENU_ITEMS.userRank,
            MENU_ITEMS.contest
        ],
        // 管理菜单包（adminPanel 会根据 hasAnyAdminPrivilege 条件自动显示/隐藏）
        adminMenu: [
            MENU_ITEMS.separator,
            MENU_ITEMS.adminPanel,  // 有条件显示
            MENU_ITEMS.separator,
            MENU_ITEMS.tools
        ],
        // expsys 管理菜单包（所有项都有条件显示）
        expsysAdminMenu: [
            MENU_ITEMS.separator,
            MENU_ITEMS.tools         // 无条件
        ],
        // examsys 管理菜单包（所有项都有条件显示）
        examsysAdminMenu: [
            MENU_ITEMS.separator,
            MENU_ITEMS.tools         // 无条件
        ]
    };
    
    // 菜单配置
    // 菜单只由 OJ_MODE 和 OJ_STATUS 决定，与正在访问哪个 module 无关（除了 ojtool）
    const MENU_CONFIG = {
        // online 模式菜单配置
        online: {
            // online-cpc 模式：标准 OJ 模式
            cpc: [
                ...MENU_PACKAGES.basicOJWithArchive,
                MENU_ITEMS.xcpcContest,
                MENU_ITEMS.outrankSystem,
                MENU_ITEMS.faqs,
                ...MENU_PACKAGES.adminMenu
            ],
            // online-exp 模式：课程练习模式（expsys）
            exp: [
                MENU_ITEMS.home,
                MENU_ITEMS.practice,  // 课程练习（放在主页下面，第二项）
                MENU_ITEMS.clss,  // 班级（放在课程练习下面）
                MENU_ITEMS.problemArchive,  // 有条件显示
                MENU_ITEMS.problemSet,
                MENU_ITEMS.status,
                MENU_ITEMS.userRank,
                MENU_ITEMS.faqs,
                MENU_ITEMS.course,
                ...MENU_PACKAGES.adminMenu  // 使用统一的管理菜单包（adminPanel 会根据 OJ_STATUS 动态设置为 exadmin）
            ]
        },
        // cpcsys 模式菜单配置
        cpcsys: {
            // cpcsys-cpc 模式：XCPC 标准比赛模式
            cpc: [
                MENU_ITEMS.home,
                MENU_ITEMS.problemSet,
                MENU_ITEMS.status,
                MENU_ITEMS.xcpcContest,
                MENU_ITEMS.faqsCpc,
                ...MENU_PACKAGES.adminMenu
            ],
            // cpcsys-exp 模式：考试模式（examsys）
            exp: [
                MENU_ITEMS.home,
                MENU_ITEMS.exam,  // 考试（放在主页下面，第二项）
                MENU_ITEMS.practiceForExam,  // 课程练习（只对管理员/教师显示）
                MENU_ITEMS.clssForExam,  // 班级（只对管理员/教师显示）
                MENU_ITEMS.problemArchive,  // 有条件显示
                MENU_ITEMS.problemSet,
                MENU_ITEMS.status,
                MENU_ITEMS.userRank,
                MENU_ITEMS.faqs,
                MENU_ITEMS.course,
                MENU_ITEMS.separator,
                MENU_ITEMS.adminPanel,  // 使用统一的管理后台（会根据 OJ_STATUS 动态设置为 exadmin），有条件显示
                MENU_ITEMS.separator,
                MENU_ITEMS.tools  // 工具集，有条件显示（只有 administrator 或课程教师才显示）
            ]
        }
    };
    
    /**
     * 检查菜单项是否应该激活
     * @param {object} item - 菜单项对象（或 active 对象，向后兼容）
     * @param {object} context - 上下文对象
     * @returns {boolean} 是否激活
     */
    function isActive(item, context) {
        // 向后兼容：如果第一个参数是 active 对象而不是 item 对象
        let active, activeModule;
        if (item.active !== undefined) {
            // 新格式：item 对象
            active = item.active;
            activeModule = item.activeModule;
        } else {
            // 旧格式：直接是 active 对象（向后兼容）
            active = item;
            activeModule = null;
        }
        
        if (!active || typeof active !== 'object') {
            return false;
        }
        
        // 如果 active 对象为空，不激活
        const hasAnyCondition = active.module || active.controller || active.action || activeModule;
        if (!hasAnyCondition) {
            return false;
        }
        
        // 检查 module（如果定义了且非空）
        // 优先检查 activeModule（支持跨模块匹配），如果没有则检查 active.module
        if (activeModule && Array.isArray(activeModule) && activeModule.length > 0) {
            if (activeModule.indexOf(context.module) === -1) {
                return false;
            }
        } else if (active.module && Array.isArray(active.module) && active.module.length > 0) {
            if (active.module.indexOf(context.module) === -1) {
                return false;
            }
        }
        
        // 检查 controller（如果定义了且非空）
        if (active.controller && Array.isArray(active.controller) && active.controller.length > 0) {
            if (active.controller.indexOf(context.controller) === -1) {
                return false;
            }
        }
        
        // 检查 action（如果定义了且非空）
        if (active.action && Array.isArray(active.action) && active.action.length > 0) {
            if (active.action.indexOf(context.action) === -1) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 获取菜单项对应的模块和 controller 信息
     * @param {object} item - 菜单项配置
     * @returns {object} {modules: array, controllers: object} 模块列表和每个模块对应的 controller
     */
    function getItemModuleInfo(item) {
        if (!item.href) {
            return { modules: [], controllers: {} };
        }
        
        // 从 href 中提取模块名和 controller
        const href = item.href;
        const moduleControllerMap = {
            '/index': { modules: ['index'], controllers: {} },
            '/exindex': { modules: ['exindex'], controllers: {} },
            '/csgoj/problemarchive': { modules: ['csgoj'], controllers: { csgoj: ['problemarchive'] } },
            '/csgoj/problemset': { modules: ['csgoj'], controllers: { csgoj: ['problemset'] } },
            '/csgoj/status': { modules: ['csgoj'], controllers: { csgoj: ['status'] } },
            '/csgoj/userrank': { modules: ['csgoj'], controllers: { csgoj: ['userrank'] } },
            '/csgoj/contest': { modules: ['csgoj'], controllers: { csgoj: ['contest'] } },
            '/csgoj/faqs': { modules: ['csgoj'], controllers: { csgoj: ['faqs'] } },
            '/cpcsys/contest': { modules: ['cpcsys'], controllers: { cpcsys: ['contest'] } },
            '/cpcsys/faqs': { modules: ['cpcsys'], controllers: { cpcsys: ['faqs'] } },
            '/outrank/index': { modules: ['outrank'], controllers: { outrank: ['index', 'rank'] } },
            '/expsys/contest': { modules: ['expsys'], controllers: { expsys: ['contest'] } },
            '/expsys/clss': { modules: ['expsys'], controllers: { expsys: ['clss'] } },
            '/examsys/contest': { modules: ['examsys'], controllers: { examsys: ['contest', 'contestadmin'] } },
            '/course/index': { modules: ['course'], controllers: {} },
            '/admin': { modules: ['admin'], controllers: {} },
            '/exadmin': { modules: ['exadmin'], controllers: {} },
            '/ojtool': { modules: ['ojtool'], controllers: {} }
        };
        
        return moduleControllerMap[href] || { modules: [], controllers: {} };
    }
    
    /**
     * 检查菜单项是否在用户权限配置中
     * 注意：此函数只根据菜单项本身的模块来判断权限，不受当前访问的 module 影响
     * 菜单内容应该在任何 module 下都保持一致，只由 OJ_MODE、OJ_STATUS 和用户权限决定
     * @param {object} item - 菜单项配置
     * @param {object} context - 上下文对象
     * @returns {boolean} 是否在权限配置中
     */
    function isItemAllowedByPermission(item, context) {
        // 如果是分隔线，不检查权限
        if (item.type === 'separator') {
            return true;
        }
        
        // 如果菜单项有 requireLogin 属性，即使权限配置中不允许，也显示菜单项
        // 这样用户点击后会看到登录提示，而不是菜单项直接消失
        if (item.requireLogin && !context.isLoggedIn) {
            return true; // 允许显示，点击时会提示登录
        }
        // 如果没有 userType，默认允许（向后兼容）
        if (!context.userType) {
            return true;
        }
        
        // 大管理员（super_admin 和 administrator）可以访问所有菜单项
        if (context.userType === 'super_admin' || context.userType === 'administrator') {
            return true;
        }
        
        // 获取菜单项对应的模块和 controller 信息
        const itemInfo = getItemModuleInfo(item);
        
        // 调试信息：检查 adminPanel 菜单项（在整个函数中复用）
        const isAdminPanelItem = item.text === '管理后台' || item.href === '/admin' || item.href === '/exadmin';
        
        if (itemInfo.modules.length === 0) {
            return true; // 无法确定模块，默认允许
        }
        
        // 权限配置映射（从 PHP 配置同步）
        const permissionConfig = {
            'online': {
                'cpc': {
                    'super_admin': ['index', 'admin', 'cr', 'csgoj', 'cpcsys', 'user', 'tt', 'ojtool', 'outrank'],
                    'administrator': ['index', 'admin', 'cr', 'csgoj', 'cpcsys', 'user', 'tt', 'ojtool', 'outrank'],
                    'admin': ['index', 'admin', 'cr', 'csgoj', 'cpcsys', 'user', 'tt', 'ojtool', 'outrank'],
                    'teacher': ['index', 'csgoj', 'cpcsys', 'user', 'outrank'],
                    'logged_in': ['index', 'csgoj', 'cpcsys', 'user', 'outrank'],
                    'guest': ['index', 'csgoj', 'cpcsys', 'user', 'outrank']
                },
                'exp': {
                    'super_admin': ['exindex', 'exadmin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
                    'administrator': ['exindex', 'exadmin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
                    'admin': ['exindex', 'exadmin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
                    'course_super': ['exindex', 'exadmin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
                    'course_admin': ['exindex', 'exadmin', 'user', 'expsys', 'course', 'ojtool', 'csgoj'],
                    'course_teacher': ['exindex', 'exadmin', 'user', 'expsys', 'course', 'csgoj'],
                    'teacher': ['exindex', 'user', 'expsys', 'course', 'csgoj'],
                    'logged_in': ['exindex', 'user', 'expsys', 'course', 'csgoj'],
                    'guest': ['exindex', 'course', 'csgoj']
                }
            },
            'cpcsys': {
                'cpc': {
                    'administrator': ['cpcsys', 'admin', 'user', 'ojtool', 'outrank'],
                    'admin': ['cpcsys', 'admin', 'user', 'ojtool', 'outrank'],
                    'teacher': ['cpcsys', 'user'],
                    'logged_in': ['cpcsys', 'user'],
                    'guest': ['cpcsys', 'user']
                },
                'exp': {
                    // super_admin 和 administrator：可以访问所有常规模块和管理后台
                    'super_admin': ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'ojtool', 'csgoj'],
                    'administrator': ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'ojtool', 'csgoj'],
                    'admin': ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'ojtool', 'csgoj'],
                    // course_super 和 course_admin：可以访问常规模块和管理后台
                    'course_super': ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'ojtool', 'csgoj'],
                    'course_admin': ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'ojtool', 'csgoj'],
                    // course_teacher：可以访问常规模块和管理后台
                    'course_teacher': ['exindex', 'examsys', 'expsys', 'exadmin', 'user', 'course', 'csgoj'],
                    'teacher': ['exindex', 'examsys', 'expsys', 'user', 'course', 'csgoj'],
                    // cpcsys-exp 模式下，普通用户和未登录用户只能访问 examsys 和 csgoj（仅限 faqs controller）
                    'logged_in': {
                        'examsys': true,  // 可以访问所有 controller
                        'course': true,   // 可以访问课程选择页面
                        'csgoj': ['faqs']  // 只能访问 faqs controller
                    },
                    'guest': {
                        'examsys': true,  // 可以访问所有 controller
                        'course': true,   // 可以访问课程选择页面
                        'csgoj': ['faqs']  // 只能访问 faqs controller
                    }
                }
            }
        };
        
        // 获取当前模式下的权限配置
        const modeConfig = permissionConfig[context.OJ_MODE];
        if (!modeConfig) {
            return true; // 配置不存在，默认允许
        }
        
        const statusConfig = modeConfig[context.OJ_STATUS];
        if (!statusConfig) {
            return true; // 配置不存在，默认允许
        }
        
        const userPermission = statusConfig[context.userType];
        
        // 调试信息：检查 adminPanel 菜单项（复用之前定义的变量）
        
        if (!userPermission) {
            return true; // 用户类型配置不存在，默认允许
        }
        
        // 判断配置格式：字符串数组（旧格式）还是关联数组（新格式）
        const isArrayFormat = Array.isArray(userPermission) && (userPermission.length === 0 || typeof userPermission[0] === 'string');
        
        if (isArrayFormat) {
            // 旧格式：字符串数组，可以访问该模块的所有 controller
            for (const module of itemInfo.modules) {
                if (userPermission.indexOf(module) !== -1) {
                    return true;
                }
            }
        } else {
            // 新格式：关联数组，支持 controller 级别控制
            for (const module of itemInfo.modules) {
                if (!userPermission.hasOwnProperty(module)) {
                    continue; // 模块不在允许列表中
                }
                
                const modulePermission = userPermission[module];
                
                // 如果值是 true，表示可以访问该模块的所有 controller
                if (modulePermission === true) {
                    return true;
                }
                
                // 如果值是数组，表示只能访问指定的 controller
                if (Array.isArray(modulePermission)) {
                    const itemControllers = itemInfo.controllers[module] || [];
                    // 检查菜单项的 controller 是否在允许列表中
                    for (const controller of itemControllers) {
                        if (modulePermission.indexOf(controller) !== -1) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * 检查菜单项是否应该显示
     * 重要：此函数绝对不使用 context.module、context.controller、context.action 来判断是否显示
     * 菜单项的显示只由以下因素决定：
     * 1. 用户权限（isItemAllowedByPermission）
     * 2. 菜单项的 condition（如 OJ_OPEN_ARCHIVE、isAdmin 等）
     * 与当前访问的 module/controller/action 完全无关
     * @param {object} item - 菜单项配置
     * @param {object} context - 上下文对象
     * @returns {boolean} 是否显示
     */
    function shouldShow(item, context) {
        // 首先检查权限配置（只根据菜单项本身的模块，不依赖当前访问的 module）
        const permissionAllowed = isItemAllowedByPermission(item, context);
        if (!permissionAllowed) {
            return false;
        }
        
        // 然后检查 condition（condition 函数也不应该依赖 context.module）
        if (!item.condition) {
            return true;
        }
        
        // condition 可以是函数或字符串标识符
        if (typeof item.condition === 'function') {
            return item.condition(context);
        }
        
        // 字符串标识符映射到条件函数
        const conditionMap = {
            'OJ_OPEN_ARCHIVE': (ctx) => ctx.OJ_OPEN_ARCHIVE === true,
            'hasAnyAdminPrivilege': (ctx) => ctx.hasAnyAdminPrivilege === true,
            'isAdmin': (ctx) => ctx.isAdmin === true,
            'isCourseTeacher': (ctx) => ctx.isCourseTeacher === true,
            // 检查是否是管理员或课程教师（基于新的 userType，向后兼容旧逻辑）
            // 支持：super_admin, administrator, course_super, course_admin, course_teacher
            'isAdminOrTeacher': (ctx) => {
                // 向后兼容：优先使用旧的 isAdmin 和 isCourseTeacher 标志
                if (ctx.isAdmin === true || ctx.isCourseTeacher === true) {
                    return true;
                }
                // 使用新的 userType 判断
                const userType = ctx.userType || 'guest';
                // 系统管理员
                if (userType === 'super_admin' || userType === 'administrator') {
                    return true;
                }
                // 课程教师/管理员（course_teacher, course_admin, course_super）
                if (userType === 'course_teacher' || userType === 'course_admin' || userType === 'course_super') {
                    return true;
                }
                return false;
            },
            'isAdminOrHasPrivilege': (ctx) => ctx.isAdmin === true || ctx.hasAnyAdminPrivilege === true,
            // 检查是否是管理员或课程教师/管理员（基于新的 userType）
            // 支持：super_admin, administrator, course_super, course_admin, course_teacher
            'isAdminOrCourseTeacher': (ctx) => {
                const userType = ctx.userType || 'guest';
                // 向后兼容：优先使用旧的 isAdmin 和 isCourseTeacher 标志
                if (ctx.isAdmin === true || ctx.isCourseTeacher === true) {
                    return true;
                }
                // 系统管理员
                if (userType === 'super_admin' || userType === 'administrator') {
                    return true;
                }
                // 课程教师/管理员（course_teacher, course_admin, course_super）
                if (userType === 'course_teacher' || userType === 'course_admin' || userType === 'course_super') {
                    return true;
                }
                return false;
            }
        };
        
        if (typeof item.condition === 'string' && conditionMap[item.condition]) {
            return conditionMap[item.condition](context);
        }
        
        return true;
    }
    
    /**
     * 生成菜单 HTML
     * @param {array} menuItems - 菜单项配置数组
     * @param {object} context - 上下文对象
     * @returns {string} 菜单 HTML
     */
    function generateMenuHTML(menuItems, context) {
        if (!menuItems || menuItems.length === 0) {
            return '';
        }
        
        // 第一步：收集所有可见的菜单项（包括分隔线）
        const visibleItems = [];
        for (const item of menuItems) {
            // 分隔线总是先收集，后续再过滤
            if (item.type === 'separator') {
                visibleItems.push(item);
            } else if (shouldShow(item, context)) {
                visibleItems.push(item);
            }
        }
        
        // 第二步：过滤掉前后都没有可见菜单项的分隔线
        const filteredItems = [];
        for (let i = 0; i < visibleItems.length; i++) {
            const item = visibleItems[i];
            
            if (item.type === 'separator') {
                // 检查分隔线前后是否有可见的菜单项（非分隔线）
                let hasVisibleBefore = false;
                let hasVisibleAfter = false;
                
                // 向前查找
                for (let j = i - 1; j >= 0; j--) {
                    if (visibleItems[j].type !== 'separator') {
                        hasVisibleBefore = true;
                        break;
                    }
                }
                
                // 向后查找
                for (let j = i + 1; j < visibleItems.length; j++) {
                    if (visibleItems[j].type !== 'separator') {
                        hasVisibleAfter = true;
                        break;
                    }
                }
                
                // 只有当分隔线前后都有可见菜单项时，才保留分隔线
                if (hasVisibleBefore && hasVisibleAfter) {
                    filteredItems.push(item);
                }
            } else {
                // 非分隔线项直接添加
                filteredItems.push(item);
            }
        }
        
        // 第三步：生成 HTML
        let html = '';
        for (const item of filteredItems) {
            if (item.type === 'separator') {
                html += '<hr/>';
            } else if (item.type === 'item') {
                const activeClass = isActive(item, context) ? ' active' : '';
                const text = item.enText ? 
                    `${item.text} <span class="en-text">${item.enText}</span>` : 
                    item.text;
                
                // 如果需要登录但用户未登录，添加 data-require-login 属性
                const requireLoginAttr = (item.requireLogin && !context.isLoggedIn) ? ' data-require-login="true"' : '';
                const targetAttr = item.targetBlank ? ' target="_blank" rel="noopener noreferrer"' : '';
                html += `<li class="nav-item"><a class="nav-link${activeClass}" href="${item.href}"${requireLoginAttr}${targetAttr}>${text}</a></li>`;
            }
        }
        
        return html;
    }
    
    /**
     * 展开菜单项引用（处理菜单包和直接引用）
     * @param {array} menuItems - 菜单项配置数组（可能包含引用）
     * @returns {array} 展开后的菜单项数组
     */
    function expandMenuItems(menuItems) {
        const expanded = [];
        for (const item of menuItems) {
            if (typeof item === 'string' && MENU_PACKAGES[item]) {
                // 如果是字符串引用，展开菜单包
                expanded.push(...expandMenuItems(MENU_PACKAGES[item]));
            } else if (Array.isArray(item)) {
                // 如果是数组，递归展开
                expanded.push(...expandMenuItems(item));
            } else {
                // 直接添加菜单项
                expanded.push(item);
            }
        }
        return expanded;
    }
    
    /**
     * 初始化菜单
     */
    function initMenu() {
        if (!window.menuConfig) {
            console.warn('Menu config not found');
            return;
        }
        
        const menuConfig = window.menuConfig;
        const currentModule = menuConfig.module || 'csgoj';  // 当前访问的 module，仅用于 ojtool 检查和 isActive 判断
        const ojMode = menuConfig.OJ_MODE || 'online';
        const ojStatus = menuConfig.OJ_STATUS || 'cpc';
        
        // ojtool 模块有独立菜单，直接返回
        if (currentModule === 'ojtool') {
            return;
        }
        
        // 重要：菜单内容只根据 OJ_MODE 和 OJ_STATUS 决定，与当前访问的 module 完全无关
        // 无论访问 expsys/clss 还是 csgoj/status，只要 OJ_MODE 和 OJ_STATUS 相同，菜单就应该完全一样
        
        // 根据 OJ_STATUS 动态设置 Admin Panel 和 Home 链接
        // OJ_STATUS=cpc 时指向 /admin 和 /index，OJ_STATUS=exp 时指向 /exadmin 和 /exindex
        // adminPanel 的条件保持为 hasAnyAdminPrivilege（与 cpc 模式一致）
        if (ojStatus === 'exp') {
            MENU_ITEMS.adminPanel.href = '/exadmin';
            MENU_ITEMS.adminPanel.active = { module: ['exadmin'] };
            // condition 保持为 hasAnyAdminPrivilege，不需要修改
            MENU_ITEMS.home.href = '/exindex';
        } else {
            MENU_ITEMS.adminPanel.href = '/admin';
            MENU_ITEMS.adminPanel.active = { module: ['admin'] };
            MENU_ITEMS.home.href = '/index';
        }
        
        // 获取菜单配置（只根据 OJ_MODE 和 OJ_STATUS，与当前访问的 module 无关）
        // 菜单内容应该在任何 module 下都保持一致，只由 OJ_MODE 和 OJ_STATUS 决定
        let menuItems = null;
        if (MENU_CONFIG[ojMode] && MENU_CONFIG[ojMode][ojStatus]) {
            menuItems = MENU_CONFIG[ojMode][ojStatus];
        }
        
        if (!menuItems) {
            console.warn('Menu items not found for:', ojMode, ojStatus);
            return;
        }
        
        // 展开菜单项（处理菜单包引用）
        const expandedMenuItems = expandMenuItems(menuItems);
        
        // 构建上下文对象
        // 重要：context.module、context.controller、context.action 只用于判断菜单项是否激活（高亮显示）
        // 菜单项的显示（是否出现在菜单中）完全由以下因素决定：
        // 1. OJ_MODE 和 OJ_STATUS（决定菜单配置）
        // 2. 用户权限（isItemAllowedByPermission 检查）
        // 3. 菜单项的 condition（如 OJ_OPEN_ARCHIVE、isAdmin 等）
        // 绝对不受当前访问的 module/controller/action 影响
        const context = {
            OJ_MODE: menuConfig.OJ_MODE,
            OJ_STATUS: menuConfig.OJ_STATUS,
            OJ_OPEN_ARCHIVE: menuConfig.OJ_OPEN_ARCHIVE || false,
            module: currentModule,  // 仅用于 isActive 判断菜单项是否激活（高亮），绝对不影响菜单显示
            controller: menuConfig.controller,  // 仅用于 isActive 判断，绝对不影响菜单显示
            action: menuConfig.action,  // 仅用于 isActive 判断，绝对不影响菜单显示
            isAdmin: menuConfig.isAdmin || false,
            hasAnyAdminPrivilege: menuConfig.hasAnyAdminPrivilege || false,
            isCourseTeacher: menuConfig.isCourseTeacher || false,
            isLoggedIn: menuConfig.isLoggedIn || false,
            userType: menuConfig.userType || 'guest'  // 用户类型：'super_admin', 'administrator', 'course_super', 'course_admin', 'course_teacher', 'logged_in', 'guest'
        };
        
        // 生成菜单 HTML
        const menuHTML = generateMenuHTML(expandedMenuItems, context);
        
        // 插入到页面中
        const menuContainer = document.getElementById('menu_container');
        if (menuContainer) {
            // 使用 menu_container 容器
            menuContainer.innerHTML = menuHTML;
            
            // 添加额外链接（如果有）
            if (menuConfig.OJ_ADDITION_LINK) {
                menuContainer.insertAdjacentHTML('beforeend', menuConfig.OJ_ADDITION_LINK);
            }
        } else {
            // 如果没有 menu_container，尝试使用 sidebar_div
            const sidebarDiv = document.getElementById('sidebar_div');
            if (sidebarDiv) {
                // 查找 hidden_user_panel 的位置
                const hiddenUserPanel = document.getElementById('hidden_user_panel');
                if (hiddenUserPanel) {
                    // 在 hidden_user_panel 之后插入菜单
                    hiddenUserPanel.insertAdjacentHTML('afterend', menuHTML);
                } else {
                    // 如果没有 hidden_user_panel，直接追加到 sidebar_div
                    sidebarDiv.insertAdjacentHTML('beforeend', menuHTML);
                }
                
                // 添加额外链接（如果有）
                if (menuConfig.OJ_ADDITION_LINK) {
                    sidebarDiv.insertAdjacentHTML('beforeend', menuConfig.OJ_ADDITION_LINK);
                }
            }
        }
        
        // 绑定需要登录的菜单项点击事件
        bindLoginRequiredMenuItems();
    }
    
    /**
     * 绑定需要登录的菜单项点击事件
     */
    function bindLoginRequiredMenuItems() {
        const menuContainer = document.getElementById('menu_container') || document.getElementById('sidebar_div');
        if (!menuContainer) {
            return;
        }
        
        // 使用事件委托处理需要登录的菜单项
        menuContainer.addEventListener('click', function(e) {
            const link = e.target.closest('a[data-require-login="true"]');
            if (!link) {
                return;
            }
            
            const menuConfig = window.menuConfig;
            if (!menuConfig || !menuConfig.isLoggedIn) {
                e.preventDefault();
                e.stopPropagation();
                if (menuConfig && menuConfig.OJ_FLG_LOGIN_DISABLED) {
                    alerty.warning('当前站点未开放网页登录<span class="en-text">Web sign-in is not available</span>');
                } else {
                    alerty.warning('请先登录后再访问<span class="en-text">Please login first</span>');
                }
                return false;
            }
        });
    }
    
    // 页面加载完成后初始化菜单
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initMenu();
        });
    } else {
        initMenu();
    }
    
    // 导出函数供外部调用
    window.MenuGenerator = {
        init: initMenu,
        generateMenuHTML: generateMenuHTML,
        isActive: isActive
    };
})();
