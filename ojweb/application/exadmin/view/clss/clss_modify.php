<!-- 修改班级信息 Modal -->
<div class="modal fade" id="clssModifyModal" tabindex="-1" aria-labelledby="clssModifyModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline" id="clssModifyModalLabel">
                    <span class="cn-text"><i class="bi bi-pencil-square me-2"></i>
                    修改班级信息
                    </span><span class="en-text">Update Class Information</span>
                    <span class="ms-2 text-muted" id="clss_modify_header_clss_id" style="font-size: 0.85em; font-weight: normal;"></span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="clss_modify_form" method="post" action="/{$module}/{$controller}/clss_modify_ajax">
                    <div class="row g-3">
                        <!-- 班级ID (隐藏) -->
                        <input type="hidden" id="clss_modify_clss_id" name="clss_id" value="">
                        
                        <!-- 班级名称 -->
                        <div class="col-md-12">
                            <label for="clss_modify_title" class="form-label bilingual-label">
                                班级名称：<span class="en-text">Class Name</span>
                            </label>
                            <input type="text" id="clss_modify_title" class="form-control" name="clss_title" 
                                   placeholder="最多99个字符" value="" required>
                        </div>
                        
                        <!-- 年级 -->
                        <div class="col-md-6">
                            <label for="clss_modify_year" class="form-label bilingual-label">
                                年级：<span class="en-text">Year</span>
                            </label>
                            <input type="number" id="clss_modify_year" class="form-control" name="clss_year" 
                                   placeholder="如：2024" value="" min="-1">
                        </div>
                        
                        <!-- 学期 -->
                        <div class="col-md-6">
                            <label for="clss_modify_semester" class="form-label bilingual-label">
                                学期：<span class="en-text">Semester</span>
                            </label>
                            <input type="text" id="clss_modify_semester" class="form-control" name="clss_semester" 
                                   placeholder="格式：2024-2025-1" value="" pattern="^\d{4}-\d{4}-\d$" required>
                            <div class="form-text">
                                <span class="bilingual-inline">
                                    格式：YYYY-YYYY-N（如：2024-2025-1）
                                    <span class="en-text">Format: YYYY-YYYY-N (e.g., 2024-2025-1)</span>
                                </span>
                            </div>
                        </div>
                        
                        <!-- 教师 -->
                        <div class="col-12">
                            <label for="clss_modify_teachers" class="form-label bilingual-label">
                                教师：<span class="en-text">Teachers</span>
                            </label>
                            <input type="text" id="clss_modify_teachers" class="form-control" name="teachers" 
                                   placeholder="教师账号，用逗号分隔（如：teacher1,teacher2）" value="">
                            <div class="form-text">
                                <span class="bilingual-inline">
                                    教师账号用逗号分隔，最多100个
                                    <span class="en-text">Teacher IDs separated by commas, max 100</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <span class="cn-text"><i class="bi bi-x-circle me-1"></i>
                    取消</span><span class="en-text">Cancel</span>
                </button>
                <button type="button" class="btn btn-primary bilingual-button" id="clss_modify_submit_button">
                    <span class="cn-text"><i class="bi bi-check-circle me-2"></i>
                    提交修改</span><span class="en-text">Submit Changes</span>
                </button>
            </div>
        </div>
    </div>
</div>

