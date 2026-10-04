/**
 * 题目导入导出 JavaScript
 * Problem Import/Export JavaScript
 * 
 * 依赖：
 * - jQuery
 * - Bootstrap Table
 * - alerty
 * - button_delay（global.js）、CsgConfirmBacktaskFollowup（global.js）
 * 
 * 全局变量（由视图定义）：
 * - fire_url: 导入请求的 URL
 * - NOW_COURSE_ID: 可选的课程组 ID（exp 模式使用）
 * - NOW_COURSE_KEY: 可选的课程组标识（exp 模式使用）
 */

(function() {
    'use strict';

    /** 与 backtask result 一致：优先 newCount/boundCount，否则从 addedList 推断 */
    function problemImportCountSummary(data) {
        if (!data) {
            return { n: 0, b: 0, total: 0 };
        }
        var list = data.addedList || [];
        var total = list.length;
        if (typeof data.newCount === 'number' && typeof data.boundCount === 'number') {
            return { n: data.newCount, b: data.boundCount, total: total };
        }
        var bound = 0;
        var j;
        for (j = 0; j < list.length; j++) {
            if (String(list[j]).indexOf(':bind:') >= 0) {
                bound++;
            }
        }
        return { n: total - bound, b: bound, total: total };
    }

    // 等待 DOM 加载完成
    $(document).ready(function() {
        const upload_table_problem_import = $('#upload_table');
        // id_input 在 js_upload.php，获取变量（itemId、fire_url在 upload_page.js）
        const item_name_problem_import = $('#item_input').val();
        
        // 从 id_input 元素的 fire_url 属性中获取导入 URL
        // fire_url 由 js_upload.php 通过 HTML 属性传递
        const fire_url = $('#id_input').attr('fire_url');
        
        if (!upload_table_problem_import.length) {
            console.warn('problem_export.js: upload_table not found');
            return;
        }
        
        if (!fire_url || fire_url === 'null') {
            console.warn('problem_export.js: fire_url not found or is null');
            return;
        }
        
        upload_table_problem_import.on('click-cell.bs.table', function(e, field, td, row) {
            if (field === 'file_type') {
                var button = $('#' + $(td).attr('id'));
                alerty.confirm({
                    
                    title: "导入题目",
                    message: "导入题目将添加新题目，重复导入题目文件可能会导致重复题目。\n\n确定要导入吗？",
                    message_en: "Import problem will add new problems, reimport problem file may make duplicated problems.\n\nAre you sure to import?",
                    okText: '确定',
                    cancelText: '取消',
                    width: 'lg',
                    switches: [
                        {
                            id: 'auto_submit_solutions',
                            label: '自动提交包内代码',
                            label_en: 'Auto-submit included solutions',
                            checked: false,
                            tip: '勾选后，包内附带的评测代码将自动提交至新题目，由评测机重新评测',
                            tip_en: 'When enabled, bundled solution code will be auto-submitted for re-judging',
                        }
                    ],
                    callback: function(switchValues) {
                        var autoSubmit = switchValues && switchValues.auto_submit_solutions;
                        button.attr('disabled', true);
                        var button_text = button.text();
                        button.text('Running...');
                        
                        // 导入期间全屏遮罩，禁止其它操作
                        showOverlay({
                            message: '正在导入题目，请勿操作页面…',
                            message_en: 'Importing problems, please do not interact with the page.'
                        });
                        
                        var requestParams = {
                            'filename': row.file_name,
                            'item': item_name_problem_import,
                            'auto_submit_solutions': autoSubmit ? '1' : '0'
                        };
                        
                        // 在 exp 模式下，如果定义了 NOW_COURSE_ID 和 NOW_COURSE_KEY，则添加到请求参数
                        if (typeof window.NOW_COURSE_ID !== 'undefined' && window.NOW_COURSE_ID !== null && window.NOW_COURSE_ID !== '') {
                            requestParams['now_course_id'] = window.NOW_COURSE_ID;
                        }
                        if (typeof window.NOW_COURSE_KEY !== 'undefined' && window.NOW_COURSE_KEY !== null && window.NOW_COURSE_KEY !== '') {
                            requestParams['now_course_key'] = window.NOW_COURSE_KEY;
                        }
                        
                        $.get(
                            fire_url,
                            requestParams,
                            function(ret) {
                                hideOverlay();
                                if (ret.code === 1) {
                                    var data = ret.data;
                                    if (data && data.task_id) {
                                        var btUrl = (typeof window.PROBLEM_BACKTASK_URL === 'string' && window.PROBLEM_BACKTASK_URL)
                                            ? window.PROBLEM_BACKTASK_URL
                                            : '';
                                        var msgCn = ret.msg || '导入任务已提交';
                                        var msgEn = ret.msg || 'Import task submitted';
                                        window.CsgConfirmBacktaskFollowup({
                                            backtaskUrl: btUrl,
                                            taskId: data.task_id,
                                            title: '导入已入队<span class="en-text">Import queued</span>',
                                            messageCn: msgCn,
                                            messageEn: msgEn,
                                            onDone: function () {
                                                button_delay(button, 3, 'Import', 'Import');
                                                upload_table_problem_import.bootstrapTable('refresh');
                                            },
                                        });
                                        return false;
                                    }

                                    // 构建格式化的消息（中文）
                                    var msg_cn = '\n';
                                    msg_cn += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                                    msg_cn += '导入结果\n';
                                    msg_cn += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
                                    
                                    // 构建格式化的消息（英文）
                                    var msg_en = '\n';
                                    msg_en += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                                    msg_en += 'Import Result\n';
                                    msg_en += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
                                    
                                    var pc = problemImportCountSummary(data);
                                    var partsCn = [];
                                    var partsEn = [];
                                    if (pc.n > 0) {
                                        partsCn.push('新增题目 ' + pc.n);
                                        partsEn.push(pc.n + (pc.n === 1 ? ' new problem' : ' new problems'));
                                    }
                                    if (pc.b > 0) {
                                        partsCn.push('与题库已有题目合并 ' + pc.b + '（未再建新题）');
                                        partsEn.push(
                                            pc.b +
                                                (pc.b === 1
                                                    ? ' merged with an existing problem (no duplicate)'
                                                    : ' merged with existing problems (no duplicates)')
                                        );
                                    }
                                    if (partsCn.length > 0) {
                                        msg_cn += '✅ ' + partsCn.join('；') + '\n\n';
                                        msg_en += '✅ ' + partsEn.join('; ') + '\n\n';
                                    } else if (!data.failedList || data.failedList.length === 0) {
                                        msg_cn += '✅ 导入处理完成\n\n';
                                        msg_en += '✅ Import finished\n\n';
                                    }

                                    if (data.failedList && data.failedList.length > 0) {
                                        msg_cn += '❌ ' + data.failedList.length + ' 个题目未成功导入\n\n';
                                        msg_en += '❌ ' + data.failedList.length + ' problem(s) not imported\n\n';
                                    }
                                    
                                    // 权限问题提示
                                    var permissionWarnings_cn = [];
                                    var permissionWarnings_en = [];
                                    if (data['judgeDataFolderPermission'] === false) {
                                        permissionWarnings_cn.push('⚠️ 数据文件夹权限被拒绝');
                                        permissionWarnings_en.push('⚠️ Data Folder Permission Denied');
                                    }
                                    if (data['attachFolderPermission'] === false) {
                                        permissionWarnings_cn.push('⚠️ 附件文件夹权限被拒绝');
                                        permissionWarnings_en.push('⚠️ Attach Folder Permission Denied');
                                    }
                                    
                                    if (permissionWarnings_cn.length > 0) {
                                        msg_cn += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                                        msg_cn += '⚠️ 权限警告\n';
                                        msg_cn += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
                                        permissionWarnings_cn.forEach(function(warning) {
                                            msg_cn += warning + '\n';
                                        });
                                        msg_cn += '\n';
                                        
                                        msg_en += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                                        msg_en += '⚠️ Permission Warning\n';
                                        msg_en += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
                                        permissionWarnings_en.forEach(function(warning) {
                                            msg_en += warning + '\n';
                                        });
                                        msg_en += '\n';
                                    }
                                    
                                    // 失败详情
                                    if (data.failedList && data.failedList.length > 0) {
                                        msg_cn += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                                        msg_cn += '失败详情\n';
                                        msg_cn += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
                                        data.failedList.forEach(function(failedItem) {
                                            msg_cn += '  • ' + failedItem + '\n';
                                        });
                                        
                                        msg_en += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                                        msg_en += 'Failed Details\n';
                                        msg_en += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
                                        data.failedList.forEach(function(failedItem) {
                                            msg_en += '  • ' + failedItem + '\n';
                                        });
                                    }

                                    alerty.alert({
                                        message: (ret.msg || '导入完成') + msg_cn,
                                        message_en: (ret.msg || 'Import completed') + msg_en,
                                        width: 'lg',
                                        callback: function() {
                                            button_delay(button, 3, 'Import', 'Import');
                                            upload_table_problem_import.bootstrapTable('refresh');
                                        }
                                    });
                                } else {
                                    alerty.alert({
                                        message: ret.msg || '导入失败',
                                        message_en: ret.msg || 'Import failed',
                                        width: 'lg',
                                        callback: function() {
                                            button_delay(button, 3, 'Import', 'Import');
                                        }
                                    });
                                }
                                return false;
                            }
                        ).fail(function(xhr, status, error) {
                            hideOverlay();
                            alerty.error('网络错误：' + error, 'Network error: ' + error);
                            button_delay(button, 3, 'Import', 'Import');
                        });
                    },
                    callbackCancel: function() {
                        alerty.info('已取消导入', 'Import canceled');
                    }
                });
            }
        });
    });
})();

