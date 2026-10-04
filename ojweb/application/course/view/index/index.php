<div class="container-fluid py-4">
    <div class="row g-4 h-100">
        <!-- 左侧课程列表 -->
        <div class="col-lg-4 col-xl-3">
            <div class="card h-100 shadow-sm border-0">
                <div class="card-header bg-primary text-white border-0 py-3">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-book-fill me-2 fs-5"></i>
                        <h5 class="mb-0 fw-semibold">课程列表</h5>
                    </div>
                </div>
                <div class="card-body d-flex flex-column p-0" style="height: calc(100vh - 180px); min-height: 600px;">
                    <!-- 搜索框 -->
                    <div class="p-3 border-bottom">
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-light border-end-0">
                                <i class="bi bi-search text-muted"></i>
                            </span>
                            <input type="text" 
                                   id="course_search" 
                                   class="form-control border-start-0" 
                                   placeholder="搜索课程名称、编号或所在单位..." 
                                   autocomplete="off">
                        </div>
                    </div>
                    
                    <!-- 课程列表 -->
                    <div class="flex-grow-1 overflow-auto">
                        <div id="course_list_loading" class="d-none d-flex align-items-center justify-content-center py-5">
                            <div class="text-center">
                                <div class="spinner-border text-primary mb-3" role="status">
                                    <span class="visually-hidden">加载中...</span>
                                </div>
                                <p class="text-muted small mb-0">正在加载课程列表...</p>
                            </div>
                        </div>
                        <ul id="course_list" class="list-group list-group-flush">
                            <!-- 课程列表将通过 JavaScript 动态加载 -->
                        </ul>
                        <div id="course_list_empty" class="d-none text-center text-muted py-5">
                            <i class="bi bi-inbox fs-1 d-block mb-3 opacity-50"></i>
                            <p class="mb-0 small">暂无课程</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 右侧内容区域（课程介绍或系统介绍） -->
        <div class="col-lg-8 col-xl-9">
            <div class="card h-100 shadow-sm border-0">
                <div class="card-header border-0 py-3" id="course_info_header">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-info-circle-fill me-2 text-primary" id="course_info_icon"></i>
                        <h5 class="mb-0 fw-semibold" id="course_info_title">课程介绍</h5>
                    </div>
                </div>
                <div class="card-body overflow-auto" style="height: calc(100vh - 180px); min-height: 600px;">
                    <div id="course_description" class="md_display_div">
                        <!-- 内容将通过 JavaScript 动态加载 -->
                        <!-- 初始状态：显示加载提示或空状态 -->
                        <div class="text-center text-muted py-5" id="course_description_loading">
                            <div class="spinner-border text-primary mb-3" role="status">
                                <span class="visually-hidden">加载中...</span>
                            </div>
                            <p class="mb-0 small">正在加载...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
    
{css href='__STATIC__/course/course.css' /}
{js href='__STATIC__/course/course.js' /}

<script>
$(document).ready(function() {
    // 初始化课程列表页
    if (typeof window.CourseListPage !== 'undefined') {
        const courseListPage = new window.CourseListPage("<?php echo $OJ_MODE; ?>", "<?php echo $OJ_STATUS; ?>");
        courseListPage.init();
    }
});
</script>

