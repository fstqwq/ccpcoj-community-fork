<h1 class="page-title bilingual-inline">课程组管理<span class="en-text">Course Group Management</span></h1>

<table
    class="bootstraptable_refresh_local table table-borderless table-hover table-striped"
    id="course_list_table"
    data-toggle="table"
    data-url="/{$module}/course/course_list_ajax"
    data-pagination="true"
    data-page-list="[15, 50, 100, 200]"
    data-page-size="100"
    data-side-pagination="client"
    data-method="get"
    data-search="true"
    data-pagination-v-align="both"
    data-pagination-h-align="left"
    data-pagination-detail-h-align="right"
    data-search-align="center"
    data-sortable="false"
    data-unique-id="course_id"
>
    <thead class="table-light">
    <tr>
        <th data-field="serial" data-formatter="FormatterIdx" data-align="center" data-valign="middle" data-width="55">
            <span class="cn-text">序号</span>
            <span class="en-text">Idx</span>
        </th>
        <th data-field="course_key" data-align="left" data-valign="middle" data-width="80">
            <span class="cn-text">缩写</span>
            <span class="en-text">Key</span>
        </th>
        <th data-field="course_title" data-align="left" data-valign="middle">
            <span class="cn-text">标题</span>
            <span class="en-text">Title</span>
        </th>
        <th data-field="course_unit" data-align="left" data-valign="middle" data-width="200">
            <span class="cn-text">单位</span>
            <span class="en-text">Unit</span>
        </th>
        <th data-field="course_id" data-formatter="{if IsAdmin()}FormatterDefunctCourse{else /}FormatterDefunct{/if}" data-align="left" data-valign="middle" data-width="80">
            <span class="cn-text">状态</span>
            <span class="en-text">Status</span>
        </th>
        <th data-field="edit" data-formatter="FormatterCourseEdit" data-align="center" data-valign="middle" data-width="60">
            <span class="cn-text">编辑</span>
            <span class="en-text">Edit</span>
        </th>
        <th data-formatter="FormatterCoursePrivilege" data-align="center" data-valign="middle" data-width="60">
            <span class="cn-text">权限</span>
            <span class="en-text">Privilege</span>
        </th>
        {if IsAdmin()}
        <th data-field="delete" data-formatter="FormatterDelete" data-align="center" data-valign="middle" data-width="60">
            <span class="cn-text">删除</span>
            <span class="en-text">Delete</span>
        </th>
        {/if}
    </tr>
    </thead>
</table>


{include file="../../admin/view/admin/js_changestatus" /}
{js href="__STATIC__/exadmin/exadmin_formatter.js" /}

<script>
let page_module = '<?php echo $module; ?>';

function FormatterCourseEdit(value, row, index, field) {
    if(row?.edit || !('edit' in row)) {
        return `<a href="/${page_module}/course/course_edit?key=${row.course_key}" class="btn btn-sm btn-outline-primary" title="编辑课程组 (Edit Course Group)">
            <i class="bi bi-pencil-square"></i>
        </a>`;
    }
    return '<span class="btn btn-sm btn-outline-secondary disabled" title="无权限编辑 (No Permission)"><i class="bi bi-lock"></i></span>';
}

function FormatterCoursePrivilege(value, row, index, field) {
    if(row?.privilege || !('privilege' in row)) {
        return `<a href="/${page_module}/course/course_privilege?key=${row.course_key}" class="btn btn-sm btn-outline-info" title="管理权限 (Manage Privilege)">
            <i class="bi bi-shield-lock"></i>
        </a>`;
    }
    return '<span class="btn btn-sm btn-outline-secondary disabled" title="无权限管理 (No Permission)"><i class="bi bi-lock"></i></span>';
}

function FormatterIdx(value, row, index, field) {
    return index + 1;
}

// FormatterDefunct 和 FormatterDefunctCourse 已在 exadmin_formatter.js 中定义，使用 createDefunctFormatter

function FormatterDelete(value, row, index, field) {
    return `<button class="btn btn-sm btn-outline-danger" onclick="deleteCourse(${row.course_id})" title="双击删除 / Double Click to Delete">
        <i class="bi bi-trash"></i>
    </button>`;
}

function deleteCourse(course_id) {
    alerty.confirm({
        message: '确定要删除该课程组吗？',
        message_en: 'Are you sure to delete this course group?',
        callback: function() {
            $.post(`/${page_module}/course/course_del_ajax`, {
                'course_id': course_id
            }, function(ret) {
                if(ret.code == 1) {
                    alerty.success(ret.msg);
                    $('#course_list_table').bootstrapTable('refresh');
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

// 双击删除功能
$(document).ready(function(){
    $('#course_list_table').on('dbl-click-cell.bs.table', function(e, field, value, row, $element){
        if(field == 'delete') {
            deleteCourse(row.course_id);
        }
    });
});
</script>

