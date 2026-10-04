/**
 * 考题导入功能
 * 依赖：zip.js, question_default.js, question_list.js, alerty, jQuery, Bootstrap Table
 */
(function() {
    'use strict';

    // DOM 元素引用
    const question_import_file = $('#question_import_file');
    const selected_file_name = $('#selected_file_name');
    const import_selected_btn = $('#import_selected_btn');
    const import_selected_btn_top = $('#import_selected_btn_top');
    const select_all_btn = $('#select_all_btn');
    const deselect_all_btn = $('#deselect_all_btn');
    const selected_count_span = $('#selected_count_span');
    const question_preview_section = $('#question_preview_section');
    const question_preview_table = $('#question_preview_table');
    const process_ratio_bar = $('#process_ratio_bar');
    const process_ratio_bar_div = $('#process_ratio_bar_div');
    const progress_tip_span = $('#progress_tip_span');

    // 数据状态
    let filemap = {};
    let question_list = [];
    let err_msg = '';

    // 获取当前课程 key（从隐藏输入或 data 属性）
    function getNowCourseKey() {
        const hiddenInput = $('#tpl_now_course_key');
        if (hiddenInput.length && hiddenInput.val()) {
            return hiddenInput.val();
        }
        const container = $('#question_import_div');
        if (container.length && container.data('course-key')) {
            return container.data('course-key');
        }
        return '';
    }

    // 进度条更新
    function Pratio(r = 0, content = "") {
        progress_tip_span.text(content);
        const ratio = parseInt(r * 100);
        process_ratio_bar.attr('aria-valuenow', ratio);
        process_ratio_bar.text(ratio + "%");
        process_ratio_bar.css('width', ratio + "%");
    }

    // UI 状态：开始处理
    function UIProcessstart() {
        Pratio();
        process_ratio_bar_div.show();
        $('.import_form_item').prop('disabled', true);
        import_selected_btn.prop('disabled', true);
        import_selected_btn_top.prop('disabled', true);
    }

    // UI 状态：结束处理
    function UIProcessend() {
        Pratio();
        process_ratio_bar_div.hide();
        $('.import_form_item').prop('disabled', false);
        import_selected_btn.prop('disabled', false);
        import_selected_btn_top.prop('disabled', false);
    }

    // 加载 ZIP 文件
    async function LoadZipFile() {
        const file = question_import_file[0].files[0];
        if (!file) {
            alerty.error('请选择zip文件', 'Please select a zip file');
            return false;
        }
        const entries = await (new zip.ZipReader(new zip.BlobReader(file))).getEntries();
        return entries;
    }

    // 预处理文件列表
    function PreprocessFiles(entries) {
        filemap = {};
        entries.forEach((entry) => {
            if (entry.filename == 'question_list.json') {
                filemap[entry.filename] = entry;
            } else {
                const tmp = entry.filename.split('/');
                if (!(tmp[0] in filemap)) {
                    filemap[tmp[0]] = [];
                }
                filemap[tmp[0]].push({
                    'entry': entry,
                    'filename': entry.filename
                });
            }
        });
    }

    // 异步获取 Blob
    async function GetBlobAsync(entry) {
        const blob = await entry.getData(new zip.BlobWriter(), {});
        return blob;
    }

    // 获取 Blob（返回 Promise）
    function GetBlob(entry) {
        return entry.getData(new zip.BlobWriter(), {});
    }

    // 获取题目列表
    async function GetQuestionList(entry) {
        const blob = await GetBlobAsync(entry);
        try {
            const qstr = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsText(blob);
            });
            question_list = JSON.parse(qstr);
            // 为每行添加索引和原始数据引用
            question_list.forEach((item, idx) => {
                item.idx = idx + 1;
                item._original_index = idx; // 保存原始索引，用于导入时定位
            });
        } catch (e) {
            alerty.error('加载JSON失败', 'Load JSON failed');
            console.error(e);
            return false;
        }
        return true;
    }

    // ===== 导入页专用 formatter：挂到 window，供 bootstrap-table 的 data-formatter 调用 =====
    // 题型：直接复用 exadmin/question_list.js 提供的全局 FormatterQuestionType（模板里已写死）

    window.FormatterImportIdx = function(value, row, index) {
        return (row && row.idx) ? row.idx : (index + 1);
    };

    // 导入页不要复用 question_list.js 的 FormatterQuestionTitle（它会绑定“点击预览/跳转编辑”）
    // 导入包内的 ex_question_id 可能在本系统不存在，点了会误导用户。
    window.FormatterImportQuestionTitle = function(value, row, index) {
        const title = String(value || '');
        if (!title) return '<span class="text-muted">-</span>';
        const maxLen = 80;
        const short = title.length > maxLen ? (title.substring(0, maxLen) + '...') : title;
        const escTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const escShort = short.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<span title="${escTitle}">${escShort}</span>`;
    };

    window.FormatterImportQuestionAttach = function(value, row, index) {
        const attach = String(value || '');
        if (!attach || !filemap[attach] || filemap[attach].length === 0) {
            return '<span class="text-muted">-</span>';
        }
        const count = filemap[attach].length;
        return `<span class="badge bg-info">${count} 个文件</span>`;
    };

    // 更新选中数量
    function UpdateSelectedCount() {
        const selectedRows = question_preview_table.bootstrapTable('getSelections');
        const count = selectedRows.length;
        selected_count_span.text(`已选择 ${count} / ${question_list.length} 题 (Selected: ${count} / ${question_list.length})`);
        import_selected_btn.prop('disabled', count === 0);
    }

    // 加载预览
    async function LoadPreview() {
        const entries = await LoadZipFile();
        if (entries === false) {
            return;
        }

        question_import_file.prop('disabled', true);
        try {
            PreprocessFiles(entries);
            const success = await GetQuestionList(filemap['question_list.json']);
            if (!success || !question_list || question_list.length === 0) {
                alerty.warn('未找到题目数据', 'No question data found');
                return;
            }

            delete (filemap['question_list.json']);

            // 加载到表格
            question_preview_table.bootstrapTable('load', question_list);
            question_preview_section.show();

            // 默认全选
            question_preview_table.bootstrapTable('checkAll');
            UpdateSelectedCount();

            alerty.success(`已加载 ${question_list.length} 道题目，请预览并选择要导入的题目`, `Loaded ${question_list.length} questions, please preview and select questions to import`);
        } catch (e) {
            console.error(e);
            alerty.error('加载预览失败', 'Failed to load preview');
        } finally {
            question_import_file.prop('disabled', false);
        }
    }

    // 上传 Blob 到服务器
    function UploadBlob(blob, filename, ex_question_id) {
        const formData = new FormData();
        formData.append('upload_file[]', new File([blob], filename, { type: filename.split('.').pop() }));
        formData.append('item', 'ex_question');
        formData.append('id', ex_question_id);
        return fetch('/exadmin/filemanager/upload_ajax', {
            method: 'POST',
            body: formData,
        });
    }

    // 上传附件（支持相对子目录），用于导入包中的 answer_image 等
    function UploadBlobWithRelPath(blob, relPath, ex_question_id) {
        const formData = new FormData();
        formData.append('upload_file[]', new File([blob], relPath.split('/').pop(), { type: relPath.split('.').pop() }));
        formData.append('ex_question_id', ex_question_id);
        formData.append('rel_path', relPath);
        return fetch('/exadmin/question/question_attach_upload_ajax', {
            method: 'POST',
            body: formData,
        });
    }

    // 导入单个题目
    function ImportQuestion(selectedItems, currentIndex) {
        if (currentIndex >= selectedItems.length) {
            UIProcessend();
            const successMsg = err_msg ? `导入完成，但有错误：\n${err_msg}` : '导入成功';
            const successMsgEn = err_msg ? `Import completed with errors:\n${err_msg}` : 'Import success';
            // 使用 alert modal，确保用户看到结果，并在确认后跳转
            alerty.alert({
                message: successMsg,
                message_en: successMsgEn,
                callback: function () {
                    location.href = "/exadmin/question/question_list";
                }
            });
            return;
        }

        const item = selectedItems[currentIndex];
        const originalItem = question_list[item._original_index];
        const importItem = Object.assign({}, originalItem);
        importItem.course_key = getNowCourseKey();

        // 进度提示：用纯文本（不要依赖 formatter，它可能返回 HTML）
        const pkindCn = window.question_default?.pkind_table_cn?.[importItem.pkind] || '';
        const pkindEn = window.question_default?.pkind_table?.[importItem.pkind] || '';
        const pkindTip = pkindCn || pkindEn || String(importItem.pkind || '');
        Pratio((currentIndex + 1) / selectedItems.length, `导入中：${pkindTip} | ${importItem.title}`);

        if (!('uni_id' in importItem) || importItem.uni_id == null || importItem.uni_id == '') {
            importItem.uni_id = Date.parse(importItem.create_at || new Date()) * 100 + (importItem.ex_question_id || 0);
        }
        delete (importItem.ex_question_id);
        delete (importItem.idx);
        delete (importItem._original_index);

        $.post('/exadmin/question/question_edit_ajax', importItem, function (ret) {
            if (ret.code == 1) {
                const new_ex_question_id = ret.data.ex_question_id;
                const promises = [];
                if (originalItem.attach && originalItem.attach in filemap) {
                    filemap[originalItem.attach].forEach((entry_item) => {
                        GetBlob(entry_item.entry).then(blob => {
                            const relPath = entry_item.filename.split('/').slice(1).join('/');
                            // 如果没有子目录，则回退到旧路径（仅文件名）
                            if (relPath && relPath.trim() !== '') {
                                promises.push(UploadBlobWithRelPath(blob, relPath, new_ex_question_id));
                            } else {
                                promises.push(UploadBlob(blob, entry_item.filename, new_ex_question_id));
                            }
                        });
                    });
                    Promise.all(promises).then(() => {
                        ImportQuestion(selectedItems, currentIndex + 1);
                    }).catch((e) => {
                        console.error(e);
                        err_msg += `题目 ${importItem.title} 附件上传失败\n`;
                        ImportQuestion(selectedItems, currentIndex + 1);
                    });
                } else {
                    ImportQuestion(selectedItems, currentIndex + 1);
                }
            } else {
                err_msg += `题目 ${importItem.title}: ${ret.msg}\n`;
                ImportQuestion(selectedItems, currentIndex + 1);
            }
        }).fail(function (xhr, status, error) {
            err_msg += `题目 ${importItem.title}: 请求失败 (${error})\n`;
            ImportQuestion(selectedItems, currentIndex + 1);
        });
    }

    // 导入选中的题目
    function ImportSelectedQuestions() {
        const selectedRows = question_preview_table.bootstrapTable('getSelections');
        if (selectedRows.length === 0) {
            alerty.warn('请至少选择一道题目', 'Please select at least one question');
            return;
        }

        if (!confirm(`确定要导入选中的 ${selectedRows.length} 道题目吗？\nAre you sure to import ${selectedRows.length} selected questions?`)) {
            return;
        }

        err_msg = '';
        UIProcessstart();
        ImportQuestion(selectedRows, 0);
    }

    // 初始化
    $(document).ready(function () {
        // 文件选择事件：自动加载预览
        question_import_file.on('change', function () {
            const file = this.files[0];
            if (file) {
                selected_file_name.text(`已选择: ${file.name}`);
                LoadPreview();
            } else {
                selected_file_name.text('');
                question_preview_section.hide();
                question_preview_table.bootstrapTable('load', []);
            }
        });

        // 导入按钮事件
        import_selected_btn.on('click', function () {
            ImportSelectedQuestions();
        });
        import_selected_btn_top.on('click', function () {
            ImportSelectedQuestions();
        });

        // 全选按钮事件
        select_all_btn.on('click', function () {
            question_preview_table.bootstrapTable('checkAll');
            UpdateSelectedCount();
        });

        // 清空按钮事件
        deselect_all_btn.on('click', function () {
            question_preview_table.bootstrapTable('uncheckAll');
            UpdateSelectedCount();
        });

        // 监听选择变化
        question_preview_table.on('check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table', function () {
            UpdateSelectedCount();
        });

        // 初始化选中数量显示
        UpdateSelectedCount();
    });
})();

