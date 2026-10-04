<!-- 侧边栏筛选面板 -->
<div id="filterSidebar" class="filter-sidebar">
    <div class="filter-sidebar-header">
        <h5 class="filter-sidebar-title">
            <i class="bi bi-funnel me-2"></i>更多筛选<span class="en-text">More Filters</span>
        </h5>
        <button type="button" class="btn btn-sm btn-link p-0" id="filterSidebarToggle" title="收起/展开">
            <i class="bi bi-chevron-right"></i>
        </button>
    </div>
    <div class="filter-sidebar-body">
        <div class="filter-section">
            <h6 class="filter-section-title">
                <i class="bi bi-people me-2"></i>班级信息<span class="en-text">Class Info</span>
            </h6>
            <div class="mb-3">
                <label class="form-label">班级<span class="en-text">Class</span></label>
                <input id="contest_clss_filter" name="clss" class="form-control contest_filter" type="text" placeholder="支持模糊查询">
            </div>
            <div class="mb-3">
                <label class="form-label">年级<span class="en-text">Year</span></label>
                <input id="contest_year_filter" name="year" class="form-control contest_filter" type="text" placeholder="“,”隔开查询多个">
            </div>
            <div class="mb-3">
                <label class="form-label">学期<span class="en-text">Semester</span></label>
                <input id="contest_semester_filter" name="semester" class="form-control contest_filter" type="text" placeholder="支持模糊查询">
            </div>
            <div class="mb-3">
                <label class="form-label">教师ID<span class="en-text">Teacher ID</span></label>
                <input id="contest_teachers_filter" name="teachers" class="form-control contest_filter" type="text" placeholder="“,”隔开查询多个">
            </div>
        </div>
        
        <div class="filter-section">
            <h6 class="filter-section-title">
                <i class="bi bi-tags me-2"></i>其他筛选<span class="en-text">Other Filters</span>
            </h6>
            <div class="mb-3">
                <label class="form-label">附加题<span class="en-text">Attach</span></label>
                <select name="attach" id="contest_attach_filter" class="form-select contest_filter">
                    <option value="3" selected>全部 <span class="en-text">All</span></option>
                    <option value="0">无附加题 <span class="en-text">No Attach</span></option>
                    <option value="1">有附加题 <span class="en-text">Has Attach</span></option>
                </select>
            </div>
            {if isset($module) && $module == 'exadmin'}
            <div class="mb-3">
                <label class="form-label">公开状态<span class="en-text">Contest Status</span></label>
                <select name="defunct" class="form-select contest_filter">
                    <option value="-1">全部 <span class="en-text">All</span></option>
                    <option value="0">公开 <span class="en-text">Public</span></option>
                    <option value="1">隐藏 <span class="en-text">Hidden</span></option>
                </select>
            </div>
            {/if}
        </div>
        
        <div class="filter-actions mt-4 pt-3 border-top">
            <button type="button" class="btn btn-outline-secondary w-100 mb-2" id="contest_clear_sidebar">
                <i class="bi bi-eraser me-2"></i>清空所有筛选<span class="en-text">Clear All</span>
            </button>
        </div>
    </div>
</div>

{css href="__STATIC__/expsys/contest_filter.css" /}
{js href="__STATIC__/expsys/contest_filter.js" /}
<script type="text/javascript">
// 传递用户权限信息和模块信息给 JavaScript
if (typeof window.expContestFilterConfig === 'undefined') {
    window.expContestFilterConfig = {};
}
// 合并配置
window.expContestFilterConfig = Object.assign({
    userId: <?php echo json_encode(session('user_id')); ?>,
    isAdmin: <?php echo (isset($isAdmin) && $isAdmin) ? 'true' : 'false'; ?>,
    isCourseAdmin: <?php echo (function_exists('PrivCourse') && isset($NOW_COURSE_KEY) && PrivCourse('admin', $NOW_COURSE_KEY)) ? 'true' : 'false'; ?>,
    isCourseTeacher: <?php echo (function_exists('PrivCourse') && isset($NOW_COURSE_KEY) && PrivCourse('teacher', $NOW_COURSE_KEY)) ? 'true' : 'false'; ?>,
    isAdminModule: <?php echo (isset($module) && $module == 'exadmin') ? 'true' : 'false'; ?>
}, window.expContestFilterConfig);

// 初始化比赛列表筛选功能
$(document).ready(function() {
    if (typeof initContestFilter === 'function') {
        initContestFilter();
    } else {
        console.error('initContestFilter function not found. Please ensure contest_filter.js is loaded.');
    }
});
</script>
