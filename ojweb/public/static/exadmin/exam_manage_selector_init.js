/**
 * 考试可管理人(教师)选择器：通过 DualListSelector 通用组件 + 参数定制
 * 依赖：jQuery、dual_list_selector.js
 * 页面需提供 window.EXAM_MANAGE_INIT = { courseKey, manageList, ownerList }
 */
(function() {
    'use strict';
    var PVROLE_LABELS = { super: '超级管理员', admin: '普通管理员', teacher: '教师' };
    function pvroleLabel(pv) {
        return PVROLE_LABELS[(pv || '').toLowerCase()] || (pv || '');
    }
    $(function() {
        var $wrap = $('#exam_manage_selector_wrapper');
        if (!$wrap.length || !window.EXAM_MANAGE_INIT) return;
        var opt = window.EXAM_MANAGE_INIT;
        window.examManageSelector = new DualListSelector({
            container: '#exam_manage_selector_wrapper',
            fetch: {
                url: '/exadmin/course/course_privilege_list_ajax',
                method: 'GET',
                params: function() { return { key: opt.courseKey || '' }; }
            },
            idField: 'user_id',
            itemDisplay: [
                { field: 'user_id', tag: 'strong' },
                { field: 'nick' },
                { field: 'pvrole_label', tag: 'span', className: 'badge bg-secondary ms-1' },
                { field: 'school', tag: 'small', className: 'text-muted d-block' }
            ],
            excludeIds: Array.isArray(opt.ownerList) ? opt.ownerList : [],
            initialSelectedIds: Array.isArray(opt.manageList) ? opt.manageList : [],
            outputInputId: 'manage_ids_input',
            searchFields: ['user_id', 'nick', 'school', 'pvrole_label'],
            itemTransform: function(item) {
                var t = typeof item === 'object' && item !== null ? item : {};
                t.pvrole_label = t.pvrole_label || pvroleLabel(t.pvrole);
                return t;
            },
            labels: {
                candidateTitle: '候选教师',
                candidateTitleEn: 'Available',
                selectedTitle: '已选可管理人',
                selectedTitleEn: 'Selected Managers',
                selectedEmpty: '暂无已选可管理人',
                loading: '加载中...',
                noResults: '没有找到教师（负责人已排除）',
                searchPlaceholder: '搜索工号、姓名、学院...'
            }
        });
    });
})();
