<div class="page-title-container">
    <h1 class="page-title">班级学生<span class="en-text">Class Students</span></h1>
    <div class="page-title-actions">
        <div class="d-flex align-items-center gap-3 flex-wrap">
                {if $isClssTeacher || IsAdmin()}
                    {if $allow_modify}
                    <button id="clss_stu_batch_manage" class="btn btn-success btn-sm">
                        <span><i class="bi bi-person-plus-fill me-1"></i>
                            <span class="cn-text">批量管理</span>
                        </span>
                        <span class="en-text">Batch Manage</span>
                    </button>
                    {else}
                    <span class="text-danger small">
                        <span class="cn-text">已结束的学期禁止修改班级成员</span>
                        <span class="en-text">Modifying class members is prohibited for ended semesters</span>
                    </span>
                    {/if}
                {/if}
            <div>
                <span class="text-muted small">
                    <span class="cn-text">班级：</span>
                    <span class="en-text">Class: </span>
                </span>
                <strong>{$clss['clss_title']}</strong>
            </div>
            {if isset($clss['clss_year'])}
            <div>
                <span class="text-muted small">
                    <span class="cn-text">年级：</span>
                    <span class="en-text">Year: </span>
                </span>
                <span>{$clss['clss_year']}</span>
            </div>
            {/if}
            {if isset($clss['clss_semester'])}
            <div>
                <span class="text-muted small">
                    <span class="cn-text">学期：</span>
                    <span class="en-text">Semester: </span>
                </span>
                <span>{$clss['clss_semester']}</span>
            </div>
            {/if}
        </div>
    </div>
</div>

<div class="card shadow-sm">
    <div class="card-body p-0">
        <table
            class="bootstraptable_refresh_local table table-borderless table-hover table-striped mb-0"
            id="stu_list_table"
            data-url="/{$module}/{$controller}/stu_list_ajax?clss_id={$clss['clss_id']}"
            data-toggle="table"
            data-method="get"
            data-side-pagination="client"
            data-unique-id="user_id"
            data-sort-name="user_id"
            data-sort-order="asc"
            data-pagination-v-align="both"
            data-pagination-h-align="left"
            data-pagination-detail-h-align="right"
        >
            <thead class="table-light">
            <tr>
                <th data-field="idx" data-align="center" data-valign="middle" data-sortable="false" data-width="30" data-formatter="FormatterIndex">Idx</th>
                {if $isClssTeacher || IsAdmin()}
                <th data-field="user_id" data-align="left" data-valign="middle" data-sortable="true" data-width="120">
                    <span class="cn-text">学号</span>
                    <span class="en-text">Student ID</span>
                </th>
                {/if}
                <th data-field="nick" data-align="left" data-valign="middle" data-sortable="true" data-formatter="FormatterStuNick">
                    <span class="cn-text">姓名</span>
                    <span class="en-text">Name</span>
                </th>
                <th data-field="school" data-align="left" data-valign="middle" data-sortable="true">
                    <span class="cn-text">单位</span>
                    <span class="en-text">Unit</span>
                </th>
                {if $isClssTeacher || IsAdmin()}
                <th data-field="operate" data-align="center" data-valign="middle" data-width="100" data-formatter="FormatterStuOperate">
                    <span class="cn-text">操作</span>
                    <span class="en-text">Action</span>
                </th>
                {/if}
            </tr>
            </thead>
        </table>
    </div>
</div>

<!-- Modal -->
<div class="modal fade" id="clss_stu_modal" tabindex="-1" aria-labelledby="clss_stu_modal_label" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title bilingual-inline" id="clss_stu_modal_label">
                    <span class="cn-text">班级学生列表修改</span>
                    <span class="en-text">Modify Class Student List</span>
                </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <p class="text-muted small mb-0">
                        <span class="cn-text">每行一个学号，如果设置助教，则在该行学号后"#"或制表符"\t"隔开填1。</span>
                        <span class="en-text">One student ID per line. To set as TA, append "#1" or "\t1" after the ID.</span>
                        <br/>
                        <span class="cn-text">例如：<code>202000000000#1</code> (设为助教), <code>202066666666</code> (普通学生)</span>
                        <span class="en-text">e.g.: <code>202000000000#1</code> (set as TA), <code>202066666666</code> (regular student)</span>
                    </p>
                    <button type="button" class="btn btn-success btn-sm" id="clss_stu_modal_submit_top">
                        <span><i class="bi bi-check-circle me-1"></i>
                            <span class="cn-text">确认</span>
                        </span>
                        <span class="en-text">Confirm</span>
                    </button>
                </div>
                <textarea id="stu_id_list_text" class="form-control" rows="20" placeholder="202000000000#1&#10;202066666666&#10;..."></textarea>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-success" id="clss_stu_modal_submit">
                    <span><i class="bi bi-check-circle me-1"></i>
                        <span class="cn-text">确认</span>
                    </span>
                    <span class="en-text">Confirm</span>
                </button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <span>
                        <i class="bi bi-x-circle me-1"></i>
                        <span class="cn-text">取消</span>
                    </span>
                    <span class="en-text">Cancel</span>
                </button>
            </div>
        </div>
    </div>
</div>

<input type="hidden" id="page_info" 
    page_module="{$module}" 
    page_controller="{$controller}"
    clss_id="{$clss['clss_id']}"
    is_clss_teacher="{if $isClssTeacher}1{else/}0{/if}"
    is_course_admin="{if $isCourseAdmin}1{else/}0{/if}"
    allow_modify="{if $allow_modify}1{else/}0{/if}">
<script>
let page_info = $('#page_info');
let module_name = page_info.attr('page_module');
let controller_name = page_info.attr('page_controller');
let clss_id = page_info.attr('clss_id');
let is_clss_teacher = page_info.attr('is_clss_teacher') === '1';
let is_course_admin = page_info.attr('is_course_admin') === '1';
let allow_modify = page_info.attr('allow_modify') === '1';

function FormatterStuNick(value, row, index, field) {
    // 如果是助教，在姓名后添加图标
    if(row.pvrole === 'ta') {
        return `${value || ''}<i class="bi bi-person-badge text-info ms-1" title="助教 / TA"></i>`;
    }
    return value || '';
}

function FormatterStuOperate(value, row, index, field) {
    if(!is_clss_teacher && !IsAdmin()) {
        return '';
    }
    // 只有允许修改时才显示删除按钮
    if (!allow_modify && !is_course_admin) {
        return '<span class="text-muted">-</span>';
    }
    return `<div class="d-flex justify-content-center">
        <button class="btn btn-sm btn-danger" onclick="deleteStu('${row.user_id}')">
            <span><i class="bi bi-trash"></i><span class="cn-text">删除</span></span>
            <span class="en-text">Delete</span>
        </button>
    </div>`;
}

function deleteStu(user_id) {
    if (!allow_modify && !is_course_admin) {
        alerty.error('已结束的学期禁止修改班级成员', 'Modifying class members is prohibited for ended semesters');
        return;
    }
    alerty.confirm({
        message: '确定要删除该学生吗？',
        message_en: 'Are you sure to delete this student?',
        callback: function() {
            $.post(`/${module_name}/${controller_name}/stu_del_ajax`, {
                'clss_id': clss_id,
                'user_id': user_id
            }, function(ret) {
                if(ret.code == 1) {
                    alerty.success(ret.msg);
                    $('#stu_list_table').bootstrapTable('refresh');
                } else {
                    alerty.error(ret.msg);
                }
            });
        },
        callbackCancel: function() {
            alerty.message('已取消', 'Canceled');
        }
    });
}

$(function() {
    let clss_stu_modal = $('#clss_stu_modal');
    let stu_id_list_text = $('#stu_id_list_text');
    let stu_list_table = $('#stu_list_table');

    $('#clss_stu_batch_manage').on('click', function() {
        if (!allow_modify && !is_course_admin) {
            alerty.error('已结束的学期禁止修改班级成员', 'Modifying class members is prohibited for ended semesters');
            return;
        }
        let stu_id_list = [];
        stu_list_table.bootstrapTable('getData', {includeHiddenRows: true}).forEach((row) => {
            // 使用 pvrole 字段判断是否为助教：pvrole='ta' 表示助教，pvrole='student' 表示学生
            let is_ta = row.pvrole === 'ta';
            stu_id_list.push(`${row.user_id}${is_ta ? '#1' : ''}`);
        });
        stu_id_list_text.val(stu_id_list.join('\n'));
        clss_stu_modal.modal('show');
    });

    // 统一的提交处理函数
    function handleStuSubmit() {
        if (!allow_modify && !is_course_admin) {
            alerty.error('已结束的学期禁止修改班级成员', 'Modifying class members is prohibited for ended semesters');
            return;
        }
        let stu_id_str = stu_id_list_text.val().trim();
        let stu_info_list = stu_id_str.split('\n');
        let stu_add_list = [];
        if(stu_id_str == '') {
            stu_add_list = [];
        } else {
            for(let i = 0; i < stu_info_list.length; i ++) {
                stu_info_list[i] = stu_info_list[i].trim();
                if (stu_info_list[i] === '') continue; // Skip empty lines
                let line_info = stu_info_list[i].split(/[#\t]/);
                let line_add = {};
                if(!(/^\w+$/.test(line_info[0])) || line_info[0].length < 3 || line_info[0].length > 32) {
                    alerty.error("存在ID不合规范：" + stu_info_list[i]);
                    return;
                }
                line_add['user_id'] = line_info[0].trim();
                // 使用 pvrole 字段：如果后面有 #1 或 \t1，则标记为助教（pvrole='ta'），否则为学生（pvrole='student'）
                if(line_info.length > 1) {
                    let duty = parseInt(line_info[1]);
                    if(isNaN(duty) || duty !== 1) {
                        alerty.error("助教标记必须为1：" + stu_info_list[i]);
                        return;
                    }
                    line_add['pvrole'] = 'ta';  // 助教
                } else {
                    line_add['pvrole'] = 'student';  // 学生
                }
                stu_add_list.push(line_add);
            }
        }
        
        // 前端验证：检查学生数量上限（512个）
        if(stu_add_list.length > 512) {
            alerty.error('学生数量不能超过512个', 'Student count cannot exceed 512');
            return;
        }
        
        $.post(`/${module_name}/${controller_name}/stu_add_ajax`, {'clss_id': clss_id, 'stu_add_list': stu_add_list}, function(ret) {
            if(ret.code == 1) {
                alerty.success(ret.msg);
                stu_list_table.bootstrapTable('refresh');
            } else {
                alerty.error(ret.msg);
            }
            clss_stu_modal.modal("hide");
        });
    }
    
    // 绑定所有确认按钮的点击事件
    $('#clss_stu_modal_submit, #clss_stu_modal_submit_top').on('click', handleStuSubmit);
});
</script>
