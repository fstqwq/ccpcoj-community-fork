/**
 * exadmin 模块通用 Formatter 函数
 * Common Formatter Functions for exadmin module
 */

// ========================================
// 考试管理 Formatter 函数
// ========================================

/**
 * 考试标题 formatter - exadmin 专用
 */
window.FormatterExpContestAdminTitle = function(value, row, index, field) {
    if (!value) return '';
    
    // 标题列：进入考试（examsys 前台）
    let contest_url = `/examsys/contest/problemset?cid=${row['contest_id']}`;
    
    return `<a class="text-decoration-none text-primary" title="${value}" href="${contest_url}">${value}</a>`;
};

/**
 * 考试类型 formatter - exadmin 专用（只显示是否有附加题）
 */
window.FormatterExpContestAdminType = function(value, row, index, field) {
    // value 是 protected 字段（实际是 private 字段的别名）
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
    
    return `<span class='badge bg-${cl}'>${ckind_str}</span>`;
};

/**
 * 考试编辑 formatter - exadmin 专用
 */
window.FormatterExpContestAdminEdit = function(value, row, index, field) {
    // 与 OJ 管理后台风格一致：编辑使用实心 primary
    return `<a href='/exadmin/exam/contest_edit?id=${row.contest_id}' class="btn btn-sm btn-primary" title="编辑考试(Edit Exam)">
                <i class="bi bi-pencil-square"></i>
            </a>`;
};

/**
 * 考试复制 formatter - exadmin 专用
 */
window.FormatterExpContestAdminCopy = function(value, row, index, field) {
    // 与 OJ 管理后台风格一致：复制使用实心 warning
    return `<a href='/exadmin/exam/contest_copy?id=${row.contest_id}' class="btn btn-sm btn-warning" title="复制考试(Copy Exam)">
                <i class="bi bi-files"></i>
            </a>`;
};

/**
 * 课程组状态 formatter - exadmin 专用（使用 createDefunctFormatter）
 */
window.FormatterDefunctCourse = function(value, row, index, field) {
    // 临时设置 is_admin 标志，用于 createDefunctFormatter 判断是否显示按钮
    const originalIsAdmin = row.is_admin;
    row.is_admin = true; // 课程组管理页面，管理员可以看到按钮
    
    const result = createDefunctFormatter({
        idField: 'course_id',
        publicText: '公开',
        hiddenText: '隐藏',
        publicTextEn: 'Public',
        hiddenTextEn: 'Hidden',
        itemName: 'course' // 指定 item_name 属性
    })(value, row, index, field);
    
    // 恢复原始值
    row.is_admin = originalIsAdmin;
    
    return result;
};

/**
 * 只读状态 formatter - 用于非管理员显示（使用 createDefunctFormatter）
 */
window.FormatterDefunct = function(value, row, index, field) {
    // 临时设置 is_admin 标志为 false，用于 createDefunctFormatter 判断只显示文本
    const originalIsAdmin = row.is_admin;
    row.is_admin = false;
    
    const result = createDefunctFormatter({
        idField: 'id',
        publicText: '公开',
        hiddenText: '隐藏',
        publicTextEn: 'Public',
        hiddenTextEn: 'Hidden'
    })(value, row, index, field);
    
    // 恢复原始值
    row.is_admin = originalIsAdmin;
    
    return result;
};

/**
 * 考试状态 formatter - exadmin 专用（带权限检查，使用 createDefunctFormatter）
 */
window.FormatterDefunctExam = function(value, row, index, field) {
    // 从全局变量获取权限信息
    const flg_admin = window.exadmin_flg_admin || false;
    const now_user_id = window.exadmin_now_user_id || '';
    
    // 检查是否有权限管理该考试
    const canManage = flg_admin || (typeof(row.teachers) == 'string' && row.teachers.includes(`,${now_user_id},`));
    
    // 临时设置 is_admin 标志，用于 createDefunctFormatter 判断是否显示按钮
    const originalIsAdmin = row.is_admin;
    row.is_admin = canManage;
    
    const result = createDefunctFormatter({
        idField: 'contest_id',
        publicText: '启用',
        hiddenText: '禁用',
        publicTextEn: 'Public',
        hiddenTextEn: 'Hidden',
        itemName: 'contest'
    })(value, row, index, field);
    
    // 恢复原始值
    row.is_admin = originalIsAdmin;
    
    return result;
};

/**
 * 考试编辑 formatter - exadmin 专用（带权限检查）
 */
window.FormatterExpContestAdminEditExam = function(value, row, index, field) {
    // 从全局变量获取权限信息
    const flg_admin = window.exadmin_flg_admin || false;
    const flg_teacher = window.exadmin_flg_teacher || false;
    const now_user_id = window.exadmin_now_user_id || '';
    
    // 检查是否有权限管理该考试（优先使用后端下发的 can_write；否则回退到 teachers 字段）
    const canManage = (row && (row.can_write === 1 || row.can_write === '1')) ||
        flg_admin ||
        (typeof(row.teachers) == 'string' && row.teachers.includes(`,${now_user_id},`));
    
    if(canManage) {
        return FormatterExpContestAdminEdit(value, row, index, field);
    }
    // teacher：允许查看（只读）
    if (flg_teacher) {
        return `<a href='/exadmin/exam/contest_edit?id=${row.contest_id}' class="btn btn-sm btn-secondary" title="查看考试(View Exam)">
                    <i class="bi bi-eye"></i>
                </a>`;
    }
    return `<span class="btn btn-sm btn-outline-secondary disabled" title="无权限(No Permission)">
                <i class="bi bi-lock"></i>
            </span>`;
};

/**
 * 考试复制 formatter - exadmin 专用（带权限检查）
 */
window.FormatterExpContestAdminCopyExam = function(value, row, index, field) {
    // 从全局变量获取权限信息
    const flg_admin = window.exadmin_flg_admin || false;
    const flg_teacher = window.exadmin_flg_teacher || false;
    const now_user_id = window.exadmin_now_user_id || '';
    
    // 复制权限：teacher 至少应当可以复制本课程内任意考试（不等同于“可管理/可编辑”）
    // 管理权限仍由 Edit/Defunct formatter 控制
    const canCopy = flg_admin || flg_teacher;

    if (canCopy) {
        return FormatterExpContestAdminCopy(value, row, index, field);
    }
    return '-';
};

/**
 * 考试附件 formatter - exadmin 专用（带权限检查，弹出 iframe modal）
 */
window.FormatterExpContestAdminAttachExam = function(value, row, index, field) {
    const flg_admin = window.exadmin_flg_admin || false;
    const now_user_id = window.exadmin_now_user_id || '';
    const canManage = (row && (row.can_attach === 1 || row.can_attach === '1')) ||
        flg_admin ||
        (typeof(row.teachers) === 'string' && row.teachers.includes(`,${now_user_id},`));
    if (!canManage) {
        return `<span class="btn btn-sm btn-outline-secondary disabled" title="无权限管理附件(No Permission)">
                    <i class="bi bi-lock"></i>
                </span>`;
    }
    const title = (row && row.title) ? String(row.title) : '';
    const shortTitle = title.length > 150 ? (title.substring(0, 150) + '...') : title;
    const modalTitle = `附件管理 - 考试 #${row.contest_id} - ${shortTitle}`;
    return `<button type="button" class="btn btn-sm btn-info"
                data-modal-url="/exadmin/filemanager/filemanager?item=contest&id=${row.contest_id}"
                data-modal-title="${modalTitle.replace(/"/g, '&quot;')}"
                title="附件管理 (File Manager)">
                <i class="bi bi-paperclip"></i>
            </button>`;
};

/**
 * 考试删除 formatter - exadmin 专用（带权限检查）
 */
window.FormatterExpContestAdminDeleteExam = function(value, row, index, field) {
    const flg_admin = window.exadmin_flg_admin || false;
    const now_user_id = window.exadmin_now_user_id || '';
    
    // 只有 admin 或 owner 可以删除
    const canDelete = (row && (row.can_write === 1 || row.can_write === '1')) || flg_admin;
    
    if (!canDelete) {
        return `<span class="btn btn-sm btn-outline-secondary disabled" title="无权限(No Permission)">
                    <i class="bi bi-lock"></i>
                </span>`;
    }
    
    return `<button type="button" class="btn btn-sm btn-danger exam-delete-btn"
                data-contest-id="${row.contest_id}"
                data-contest-title="${(row.title || '').replace(/"/g, '&quot;')}"
                title="删除考试 (Delete Exam)">
                <i class="bi bi-trash"></i>
            </button>`;
};

/**
 * 教师 formatter - exadmin 专用（兼容字符串和数组格式）
 */
window.FormatterClssTeachers = function(value, row, index, field) {
    if (!value) {
        return '<span class="text-muted">-</span>';
    }
    
    // 处理字符串格式（逗号分隔的 user_id）
    if (typeof value === 'string') {
        const teacherIds = value.split(',').filter(id => id.trim());
        if (teacherIds.length === 0) {
            return '<span class="text-muted">-</span>';
        }
        
        // 构建教师标签列表
        let teacherTags = teacherIds.map(user_id => {
            const trimmedId = user_id.trim();
            if (!trimmedId) return '';
            const userUrl = `/examsys/user/userinfo?user_id=${encodeURIComponent(trimmedId)}`;
            return `
                <a href="${userUrl}" 
                   class="teacher-tag" 
                   title="用户ID: ${trimmedId}"
                   data-bs-toggle="tooltip" 
                   data-bs-placement="top">
                    <span class="teacher-name">${trimmedId}</span>
                </a>
            `;
        }).filter(tag => tag);
        
        return `<div class="teacher-list">${teacherTags.join('')}</div>`;
    }
    
    // 处理数组格式（结构化数据）
    if (Array.isArray(value) && value.length > 0) {
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
            const userUrl = `/examsys/user/userinfo?user_id=${encodeURIComponent(user_id)}`;
            
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
    
    return '<span class="text-muted">-</span>';
};

