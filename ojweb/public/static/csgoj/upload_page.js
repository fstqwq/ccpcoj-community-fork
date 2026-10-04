// Bootstrap Table 需要传统的 function 声明
function FormatterFileName(value, row, index, field) {
    return `<a href='${row['file_url']}' filename='${value}' class="text-decoration-none" target="_blank">
                <i class="bi bi-file-earmark me-1"></i>${value}
            </a>`;
}

function FormatterFileTypeIsImportRow(row) {
    if (!row || !('file_type' in row)) {
        return false;
    }
    const t = String(row.file_type).toLowerCase();
    /* import：题目包；contestimport：比赛包（与 contest_pkg_filemanager_ajax 一致） */
    return t === 'import' || t === 'contestimport';
}

function FormatterFileType(value, row, index, field) {
    if (FormatterFileTypeIsImportRow(row)) {
        return `<button class='fire_button btn btn-success btn-sm' title="导入文件 (Import File)">
                    <i class="bi bi-upload"></i>
                </button>`;
    } else {
        if (row?.file_type === 'directory') {
            return '<span class="text-muted" title="目录禁止读写 (Directory is NOT Accessible)"><i class="bi bi-folder me-1"></i></span>';
        }
        return `<button class='copy_button btn btn-outline-primary btn-sm' data-clipboard-text='${row['file_url']}' title="复制链接 (Copy Link)">
                    <i class="bi bi-clipboard"></i>
                </button>`;
    }
}

function FormatterFileDelete(value, row, index, field) {
    if (row?.file_type === 'directory') {
        return '<span class="text-muted" title="目录禁止读写 (Directory is NOT Accessible)"><i class="bi bi-folder me-1"></i></span>';
    }
    return `<button class='delete_button btn btn-outline-danger btn-sm' title="双击删除 (Double Click to Delete)">
                <i class="bi bi-trash"></i>
            </button>`;
}

function FormatterFileRename(value, row, index, field) {
    if (row?.file_type === 'directory') {
        return '<span class="text-muted" title="目录禁止读写 (Directory is NOT Accessible)"><i class="bi bi-folder me-1"></i></span>';
    }
    return `<button class='rename_button btn btn-outline-info btn-sm' title="重命名文件 (Rename File)">
                <i class="bi bi-pencil-square"></i>
            </button>`;
}

function FormatterFileSize(value, row, index, field) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(n)) return String(value);
    const exact = n.toFixed(3);
    const s = n < 1
        ? n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        : Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
    return '<span title="' + exact + ' KB">' + s + '</span>';
}

// 现代 JavaScript 最佳实践 - 使用 const/let 和模块化
const table = $('#upload_table');
const uploadButton = $('#upload_button');
const idInput = $('#id_input');
const itemId = idInput.val();
const maxFileSize = idInput.attr('maxfilesize');
const deleteUrl = idInput.attr('delete_url');
const renameUrl = idInput.attr('rename_url');
const maxFileNum = idInput.attr('maxfilenum');
const fire_url = idInput.attr('fire_url');
let flgDblclickInform = false;
const uploadUrl = window.uploadUrl || '';

// 文件名校验：独立文件管理页由模板内联 `re_checkfile`；嵌入 ZIP 包页由 js_upload.php 注入，此处兜底防 ReferenceError
const reCheckFileForPage = typeof re_checkfile !== 'undefined' ? re_checkfile : /^[0-9a-zA-Z-_.()]+\.(zip)$/i;

// 使用全局 ClipboardWrite 函数
$(document).on('click', '.copy_button', async function(e) {
    e.preventDefault();
    const url = $(this).data('clipboard-text');
    if (url) {
        const success = await ClipboardWrite(url);
        if (success) {
            alerty.success('文件链接已复制', 'File URL copied');
        } else {
            alerty.error('复制失败', 'Copy failed');
        }
    }
});

const inputHiddenPageInfo = $('#input_hidden_page_info');
const thisAction = inputHiddenPageInfo.attr('action');

// 现代 DOM 就绪事件
document.addEventListener('DOMContentLoaded', function() {
    localStorage.setItem('file_delete_btn', 0);
    initializeEventListeners();
});


// 删除文件函数
const sendDelete = (row) => {
    $.get(deleteUrl, {
        'id': itemId,
        'filename': row.file_name
    })
    .done(function(ret) {
        if (ret.code === 1) {
            alerty.success(`${row.file_name} 删除成功`, `${row.file_name} Successfully Deleted`, );
            table.bootstrapTable('removeByUniqueId', row.file_name);
        } else {
            alerty.error(ret.msg);
        }
    })
    .fail(function() {
        alerty.error('删除请求失败', 'Delete request failed');
    });
};

// 初始化事件监听器
const initializeEventListeners = () => {
    // 双击删除事件
    table.on('dbl-click-cell.bs.table', function(e, field, td, row) {
        if (field === 'file_delete' && row?.file_type !== 'directory') {
            sendDelete(row);
            localStorage.setItem('file_delete_btn', 2);
        }
    });

    // 单击事件处理
    table.on('click-cell.bs.table', function(e, field, td, row) {
        if (field === 'file_delete') {
            if (row?.file_type !== 'directory' && !flgDblclickInform) {
                alerty.info('双击删除', 'Double click to delete');
                flgDblclickInform = true;
            }
        } else if (field === 'file_rename') {
            if (row?.file_type !== 'directory') {
                handleRename(row);
            }
        }
    });
};

// 重命名处理函数（使用 alerty.prompt，校验失败时不关弹窗并显示 tip）
const handleRename = (row) => {
    const filename = row.file_name;
    alerty.prompt({
        title: '重命名文件 <span class="en-text">Rename File</span>',
        message: '请输入新文件名：',
        message_en: 'Enter new filename:',
        defaultValue: filename,
        placeholder: filename,
        callbackConfirm: function(ev, value) {
            const trimmedName = (value || '').trim();
            if (trimmedName.length === 0) {
                return { keepOpen: true, tip: '请输入有效的文件名' };
            }
            if (trimmedName.length > 128) {
                return { keepOpen: true, tip: '文件名过长' };
            }
            if (trimmedName === filename) {
                return { keepOpen: true, tip: '文件名未修改' };
            }
            if (!reCheckFileForPage.test(trimmedName)) {
                return { keepOpen: true, tip: '文件名不合法，仅允许字母、数字、中文、下划线、点号、连字符、括号及正确扩展名' };
            }
            return $.get(renameUrl, {
                id: itemId,
                filename: filename,
                rename: trimmedName
            }).then(function(ret) {
                if (ret && ret.code === 1) {
                    alerty.success(ret.msg);
                    table.bootstrapTable('refresh');
                    return true;
                }
                return { keepOpen: true, tip: (ret && ret.msg) || '重命名失败' };
            }).catch(function() {
                return { keepOpen: true, tip: '重命名请求失败' };
            });
        }
    });
};

// 上传按钮事件
uploadButton.off('click');
uploadButton.on('click', function() {
    const fileButton = $('#upload_input');
    // 现代文件选择触发方式
    fileButton[0].click();
    return false;
});

// 文件选择变化事件
$(document).off('change', '#upload_input');
$(document).on('change', '#upload_input', function() {
    const uploadFileInput = $(this);
    const uploadFileForm = $('#upload_form');
    const uploadFileButton = $('#upload_button');
    const uploadFilepath = uploadFileInput.val()?.trim();
    
    if (!uploadFilepath) return;
    
    const maxFileSize = $('#id_input').attr('maxfilesize');
    const multifileRet = checkMultiFile(this, maxFileSize, reCheckFileForPage);
    const filenameCheck = multifileRet[0];
    const msg = multifileRet[1];
    
    if (filenameCheck) {
        uploadFile(uploadFileInput, uploadFileForm, uploadFileButton);
    } else {
        alerty.error(msg);
        // 清理 file input 内容，确保下次选择相同文件时能触发 change 事件
        uploadFileInput.val('');
    }
});

// 检查多文件上传
const checkMultiFile = (filelist, maxsize, reCheckFile) => {
    let filenameCheck = true;
    let msg = `单文件大小限制 (Single file size limit): ${Math.ceil(maxsize / 1024 / 1024)}MB<br/>文件名限制 (File name limit): 仅包含字母、数字、中文、下划线、点号、连字符、括号和正确的扩展名<br/>`;
    
    if (filelist.files.length > maxFileNum) {
        filenameCheck = false;
        msg = `一次最多上传 ${maxFileNum} 个文件 (Maximum ${maxFileNum} files at once)`;
        return [filenameCheck, msg];
    }
    
    for (let i = 0; i < filelist.files.length; i++) {
        const file = filelist.files[i];
        
        if (file.size > maxsize) {
            msg += `<br/>${file.name}: 文件过大 (size too large)`;
            filenameCheck = false;
        }

        if (!reCheckFile.test(file.name)) {
            filenameCheck = false;
            msg += `<br/>${file.name}: 文件名不合法 (name not valid)`;
        }
    }
    
    return [filenameCheck, msg];
};

// 检查文件是否需要压缩
const shouldCompressFile = (file) => {
    const fileName = file.name.toLowerCase();
    const isTestFile = fileName.endsWith('.in') || fileName.endsWith('.out');
    const isLargeFile = file.size > 1 * 1024 * 1024; // 1MB
    return isTestFile && isLargeFile;
};

// 检查文件是否为测试相关文件
const isTestRelatedFile = (file) => {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.in') || fileName.endsWith('.out') || fileName.endsWith('tpj.cc');
};

// 检查文件是否包含非标准换行符
const checkFileForNonStandardLineEndings = async (file) => {
    if (!file.name.toLowerCase().endsWith('.in') && !file.name.toLowerCase().endsWith('.out')) {
        return { hasIssue: false, lineEndingType: null };
    }
    
    try {
        const text = await file.text();
        
        // 检查各种换行符类型
        const hasCRLF = text.includes('\r\n');  // Windows
        const hasCR = text.includes('\r') && !text.includes('\r\n');  // Mac (旧版本)
        const hasLF = text.includes('\n');  // Unix/Linux (标准)
        
        // 如果只有 \n，则是标准格式
        if (hasLF && !hasCRLF && !hasCR) {
            return { hasIssue: false, lineEndingType: 'LF' };
        }
        
        // 如果有 \r\n，是 Windows 格式
        if (hasCRLF) {
            return { hasIssue: true, lineEndingType: 'CRLF' };
        }
        
        // 如果只有 \r，是 Mac 格式
        if (hasCR) {
            return { hasIssue: true, lineEndingType: 'CR' };
        }
        
        // 其他情况（可能没有换行符）
        return { hasIssue: false, lineEndingType: 'NONE' };
    } catch (error) {
        console.error('检查文件内容失败:', error);
        return { hasIssue: false, lineEndingType: null };
    }
};

// 显示换行符格式确认对话框
const showLineEndingConfirmDialog = (fileName, lineEndingType) => {
    return new Promise((resolve) => {
        // 根据换行符类型生成不同的提示信息
        let warningTitle, warningMessage, lineEndingDesc;
        const maybe_err_info = "可能会在题目评测中出现问题。";
        switch (lineEndingType) {
            case 'CRLF':
                warningTitle = '检测到 Windows 换行符';
                warningMessage = `此文件包含 \\r\\n 换行符，${maybe_err_info}`;
                lineEndingDesc = 'Windows (\\r\\n)';
                break;
            case 'CR':
                warningTitle = '检测到 Mac 换行符';
                warningMessage = `此文件包含 \\r 换行符，${maybe_err_info}`;
                lineEndingDesc = 'Mac (\\r)';
                break;
            default:
                warningTitle = '检测到非标准换行符';
                warningMessage = `此文件包含非标准换行符，${maybe_err_info}`;
                lineEndingDesc = lineEndingType;
        }
        
        // 创建 Bootstrap 5 Modal
        const modalId = 'line-ending-confirm-modal';
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal fade';
        modal.setAttribute('data-bs-backdrop', 'static');
        modal.setAttribute('data-bs-keyboard', 'true');
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header border-0 pb-0">
                        <h5 class="modal-title d-flex align-items-center">
                            <i class="bi bi-exclamation-triangle text-warning me-2"></i>
                            <span class="bilingual-inline">文件格式警告<span class="en-text">File Format Warning</span></span>
                        </h5>
                    </div>
                    <div class="modal-body pt-0">
                        <div class="alert alert-warning d-flex align-items-start mb-3">
                            <i class="bi bi-info-circle me-2 mt-1"></i>
                            <div>
                                <strong class="bilingual-inline">${warningTitle}<span class="en-text">Non-Standard Line Endings Detected</span></strong>
                                <p class="mb-1 mt-2">文件: <code>${fileName}</code></p>
                                <p class="mb-1">换行符类型: <code>${lineEndingDesc}</code></p>
                                <p class="mb-0 small text-muted">
                                    <span class="bilingual-inline">${warningMessage}<span class="en-text">This file contains non-standard line endings, which may cause issues with the judge system.</span></span>
                                </p>
                            </div>
                        </div>
                        <div class="alert alert-info d-flex align-items-start mb-3">
                            <i class="bi bi-lightbulb me-2 mt-1"></i>
                            <div class="small">
                                <strong class="bilingual-inline">建议<span class="en-text">Recommendation</span></strong>
                                <p class="mb-0">
                                    <span class="bilingual-inline">请使用标准换行符 (\\n) 重新保存文件，或使用文本编辑器的"转换换行符"功能。<span class="en-text">Please re-save the file with standard line endings (\\n), or use your text editor's "convert line endings" feature.</span></span>
                                </p>
                            </div>
                        </div>
                        <p class="mb-0">
                            <span class="bilingual-inline">是否继续上传此文件？<span class="en-text">Continue uploading this file?</span></span>
                        </p>
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="line-ending-cancel-btn">
                            <i class="bi bi-x-circle me-1"></i>
                            <span class="bilingual-inline">取消<span class="en-text">Cancel</span></span>
                        </button>
                        <button type="button" class="btn btn-warning" id="line-ending-continue-btn">
                            <i class="bi bi-upload me-1"></i>
                            <span class="bilingual-inline">继续上传<span class="en-text">Continue Upload</span></span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 初始化 Bootstrap Modal
        const bsModal = new bootstrap.Modal(modal);
        
        // 绑定事件
        document.getElementById('line-ending-cancel-btn').addEventListener('click', () => {
            bsModal.hide();
            resolve(false);
        });
        
        document.getElementById('line-ending-continue-btn').addEventListener('click', () => {
            bsModal.hide();
            resolve(true);
        });
        
        // 处理 ESC 键事件
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape') {
                bsModal.hide();
                resolve(false);
            }
        };
        
        // 添加键盘事件监听
        document.addEventListener('keydown', handleEscapeKey);
        
        // Modal 隐藏后清理
        modal.addEventListener('hidden.bs.modal', () => {
            document.removeEventListener('keydown', handleEscapeKey);
            modal.remove();
        });
        
        // 显示 Modal
        bsModal.show();
    });
};

// 检查是否所有文件都是测试相关文件
const areAllTestFiles = (fileList) => {
    return Array.from(fileList).every(file => isTestRelatedFile(file));
};

const uploadPageFmtBytes = (bytes) =>
    typeof window.csgojFormatBytes === 'function'
        ? window.csgojFormatBytes(bytes)
        : `${(Number(bytes) / 1024 / 1024).toFixed(2)} MB`;

// 使用 zip.js 压缩单个文件
const compressFile = async (file) => {
    try {
        showOverlay({
            message: '正在压缩文件',
            message_en: 'Compressing file',
            subtitle: file.name,
            subtitle_en: '',
            detail: `原始大小：${uploadPageFmtBytes(file.size)}`,
            detail_en: `Original: ${uploadPageFmtBytes(file.size)}`,
            detailType: 'text',
            type: 'text',
            theme: 'dark',
            titleIcon: 'bi-file-earmark-zip',
            progressMode: 'indeterminate',
            progressAccent: 'gradient-blue',
        });
        
        const zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'));
        
        // 读取文件内容
        const fileData = await file.arrayBuffer();
        
        // 添加到 zip
        await zipWriter.add(file.name, new zip.BlobReader(new Blob([fileData])));
        
        // 生成 zip 文件
        const zipBlob = await zipWriter.close();
        
        // 创建新的 File 对象
        const zipFileName = file.name.replace(/\.(in|out)$/, '.zip');
        const zipFile = new File([zipBlob], zipFileName, { type: 'application/zip' });
        
        const compressionRatio = file.size > 0 ? ((1 - zipFile.size / file.size) * 100).toFixed(1) : '0.0';
        updateOverlay(
            {
                message: '压缩完成',
                message_en: 'Compression finished',
                subtitle: `${file.name} → ${zipFileName}`,
                subtitle_en: '',
                detail: `原始 ${uploadPageFmtBytes(file.size)} → 压缩后 ${uploadPageFmtBytes(zipFile.size)} · 压缩率 ${compressionRatio}%`,
                detail_en: `${uploadPageFmtBytes(file.size)} → ${uploadPageFmtBytes(zipFile.size)} · ${compressionRatio}% saved`,
                detailType: 'text',
                type: 'text',
                theme: 'dark',
                titleIcon: 'bi-check-circle',
                progressMode: 'determinate',
                progress: 100,
                progressAccent: 'gradient-blue',
                overlayProgressSpinnerPolicy: 'progress_only',
            },
            100
        );
        
        // 显示压缩结果 2 秒后隐藏
        setTimeout(() => {
            hideOverlay();
        }, 2000);
        
        return zipFile;
    } catch (error) {
        hideOverlay();
        throw new Error('文件压缩失败 (File compression failed)');
    }
};

// 使用 zip.js 批量压缩多个文件
const compressMultipleFiles = async (fileList) => {
    try {
        const totalOriginalSize = fileList.reduce((sum, file) => sum + file.size, 0);
        showOverlay({
            message: '正在批量压缩',
            message_en: 'Batch compressing',
            subtitle: `${fileList.length} 个文件 · 合计 ${uploadPageFmtBytes(totalOriginalSize)}`,
            subtitle_en: `${fileList.length} files · ${uploadPageFmtBytes(totalOriginalSize)} total`,
            detail: '准备中…',
            detail_en: 'Preparing…',
            detailType: 'text',
            type: 'text',
            theme: 'dark',
            titleIcon: 'bi-file-earmark-zip',
            progressMode: 'determinate',
            progress: 0,
            progressAccent: 'gradient-blue',
            overlayProgressSpinnerPolicy: 'progress_only',
        });
        
        const zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'));
        
        // 添加所有文件到 zip
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const progress = Math.round(((i + 1) / fileList.length) * 100);
            updateOverlay(
                {
                    message: '正在批量压缩',
                    message_en: 'Batch compressing',
                    subtitle: `${file.name}（${i + 1} / ${fileList.length}）`,
                    subtitle_en: '',
                    detail: `已打包 ${i + 1} / ${fileList.length} 个文件`,
                    detail_en: `${i + 1} / ${fileList.length} files packed`,
                    detailType: 'text',
                    type: 'text',
                    theme: 'dark',
                    titleIcon: 'bi-file-earmark-zip',
                    progressMode: 'determinate',
                    progress,
                    progressAccent: 'gradient-blue',
                    overlayProgressSpinnerPolicy: 'progress_only',
                },
                progress
            );
            
            const fileData = await file.arrayBuffer();
            await zipWriter.add(file.name, new zip.BlobReader(new Blob([fileData])));
        }
        
        // 生成 zip 文件
        const zipBlob = await zipWriter.close();
        
        // 创建新的 File 对象
        const zipFileName = `testdata_${Date.now()}.zip`;
        const zipFile = new File([zipBlob], zipFileName, { type: 'application/zip' });
        
        const compressionRatio =
            totalOriginalSize > 0 ? ((1 - zipFile.size / totalOriginalSize) * 100).toFixed(1) : '0.0';
        updateOverlay(
            {
                message: '批量压缩完成',
                message_en: 'Batch compression finished',
                subtitle: zipFileName,
                subtitle_en: '',
                detail: `已打包 ${fileList.length} 个文件 · 原始 ${uploadPageFmtBytes(totalOriginalSize)} → ${uploadPageFmtBytes(zipFile.size)} · 压缩率 ${compressionRatio}%`,
                detail_en: `${fileList.length} files · ${uploadPageFmtBytes(totalOriginalSize)} → ${uploadPageFmtBytes(zipFile.size)} · ${compressionRatio}%`,
                detailType: 'text',
                type: 'text',
                theme: 'dark',
                titleIcon: 'bi-check-circle',
                progressMode: 'determinate',
                progress: 100,
                progressAccent: 'gradient-blue',
                overlayProgressSpinnerPolicy: 'progress_only',
            },
            100
        );
        
        // 显示压缩结果 3 秒后隐藏
        setTimeout(() => {
            hideOverlay();
        }, 3000);
        
        return zipFile;
    } catch (error) {
        hideOverlay();
        throw new Error('批量压缩失败 (Batch compression failed)');
    }
};

// 异步上传文件函数
const uploadFile = async (uploadFileInput, uploadFileForm, uploadFileButton) => {
    const fileList = uploadFileInput[0].files;
    if (fileList.length === 0) {
        alerty.error('未选择文件', 'No files selected');
        return;
    }

    // 更新按钮状态
    uploadFileButton.attr('disabled', true);

    let allFilesUploaded = true;
    let failedFiles = [];

    const additionalData = {
        item: uploadFileForm.find('input[name="item"]').val(),
        id: uploadFileForm.find('input[name="id"]').val()
    };

    // 使用现代异步处理
    try {
        // 检查 .in 和 .out 文件是否包含非标准换行符
        
        for (const file of fileList) {
            const checkResult = await checkFileForNonStandardLineEndings(file);
            if (checkResult.hasIssue) {
                const shouldContinue = await showLineEndingConfirmDialog(file.name, checkResult.lineEndingType);
                if (!shouldContinue) {
                    // 恢复上传按钮到原始状态
                    uploadFileButton.removeAttr('disabled');
                    uploadFileInput.val('');
                    alerty.warning('用户取消了上传', 'Upload cancelled by user');
                    return;
                }
            }
        }
        
        // 检查是否所有文件都是测试相关文件，如果是则批量压缩
        if (fileList.length > 1 && areAllTestFiles(fileList)) {
            
            try {
                const batchZipFile = await compressMultipleFiles(Array.from(fileList));
                alerty.info(`已将所有 ${fileList.length} 个文件打包为 ${batchZipFile.name}`, `All ${fileList.length} files packed into ${batchZipFile.name}`);
                
                const success = await ChunkUpload(batchZipFile, uploadUrl.replace('/upload_ajax', '/chunk_upload_ajax'), additionalData);
                if (!success) {
                    allFilesUploaded = false;
                    failedFiles.push(batchZipFile.name);
                }
            } catch (compressError) {
                alerty.error(`批量压缩失败: ${compressError.message}`, `Batch compression failed: ${compressError.message}`);
                allFilesUploaded = false;
                failedFiles.push(...Array.from(fileList).map(f => f.name));
            }
        } else {
            // 单个文件处理逻辑
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                const progress = Math.round(((i + 1) / fileList.length) * 100);
                
                let fileToUpload = file;
                let uploadMessage = `上传中 ${progress}%`;
                
                // 检查是否需要压缩
                if (shouldCompressFile(file)) {
                    
                    try {
                        fileToUpload = await compressFile(file);
                        alerty.info(`文件 ${file.name} 已压缩为 ${fileToUpload.name}`, `File ${file.name} compressed to ${fileToUpload.name}`);
                    } catch (compressError) {
                        alerty.error(`压缩文件 ${file.name} 失败: ${compressError.message}`, `Compress file ${file.name} failed: ${compressError.message}`);
                        allFilesUploaded = false;
                        failedFiles.push(file.name);
                        continue;
                    }
                }
                
                const success = await ChunkUpload(fileToUpload, uploadUrl.replace('/upload_ajax', '/chunk_upload_ajax'), additionalData);
                if (!success) {
                    allFilesUploaded = false;
                    failedFiles.push(fileToUpload.name);
                }
            }
        }

        if (allFilesUploaded) {
            alerty.success('所有文件上传成功', 'All files uploaded successfully');
            table.bootstrapTable('refresh');
        } else {
            alerty.error(`以下文件上传失败: ${failedFiles.join(', ')}`, `The following files failed to upload: ${failedFiles.join(', ')}`);
        }
    } catch (error) {
        alerty.error('上传过程中发生错误', 'Upload error occurred');
    } finally {
        uploadFileButton.removeAttr('disabled');
        uploadFileInput.val('');
    }
};

// 表格渲染后事件
table.on('post-body.bs.table', function() {
    // 确保表格在 modal 中正确显示
    const isInModal = $(this).closest('.modal').length > 0;
    if (isInModal) {
        // 在 modal 中，强制设置表格宽度
        $(this).css({
            'width': '100%',
            'min-width': '100%',
            'table-layout': 'auto',
            'max-width': 'none'
        });
        
        // 修复 Bootstrap Table 在 modal 中的宽度问题
        const $container = $(this).closest('.fixed-table-container');
        if ($container.length) {
            $container.css({
                'width': '100%',
                'max-width': 'none',
                'max-height': 'none',
                'height': 'auto'
            });
        }
        
        // 修复表格工具栏
        const $toolbar = $(this).closest('.bootstrap-table').find('.fixed-table-toolbar');
        if ($toolbar.length) {
            $toolbar.css({
                'width': '100%',
                'max-width': 'none'
            });
        }
        
        // 修复表格主体
        const $body = $(this).closest('.bootstrap-table').find('.fixed-table-body');
        if ($body.length) {
            $body.css({
                'max-height': 'none',
                'height': 'auto',
                'overflow': 'visible'
            });
        }
    }
});

// 监听 modal 显示事件，确保表格正确渲染
$(document).on('shown.bs.modal', '.modal', function() {
    if ($(this).find('#upload_table').length) {
        setTimeout(() => {
            // 强制重新计算表格宽度
            const $table = $(this).find('#upload_table');
            const $container = $table.closest('.fixed-table-container');
            const $body = $table.closest('.bootstrap-table').find('.fixed-table-body');
            
            // 重置所有相关容器的宽度和高度
            $table.css({
                'width': '100%',
                'min-width': '100%',
                'max-width': 'none'
            });
            
            if ($container.length) {
                $container.css({
                    'width': '100%',
                    'max-width': 'none',
                    'max-height': 'none',
                    'height': 'auto'
                });
            }
            
            if ($body.length) {
                $body.css({
                    'max-height': 'none',
                    'height': 'auto',
                    'overflow': 'visible'
                });
            }
            
            // 重新初始化表格，但不设置高度
            table.bootstrapTable('resetView');
        }, 100);
    }
});

// ---------- 评测数据管理页：下载全部 / 删除全部（仅当存在对应按钮时生效） ----------
$(document).on('click', '#judgedata_download_all_btn', async function() {
    const meta = document.getElementById('judgedata_meta');
    if (!meta) return;
    const problemId = meta.getAttribute('data-problem-id') || '';
    const problemTitle = meta.getAttribute('data-problem-title') || '';
    const rows = table.bootstrapTable('getData');
    if (!rows || rows.length === 0) {
        alerty.warn('暂无数据可下载', 'No data to download');
        return;
    }
    const total = rows.length;
    showOverlay({
        message: `下载全部数据 (0/${total})`,
        message_en: `Downloading all data (0/${total})`,
        type: 'text'
    });
    const tasks = rows.map(row => async () => {
        const res = await fetch(row.file_url, { credentials: 'include' });
        if (!res.ok) throw new Error(res.statusText);
        const blob = await res.blob();
        return { name: row.file_name, blob };
    });
    const results = await csg.batchCallWithThrottle(tasks, {
        batchSize: 5,
        waitAfterBatchMs: 300,
        onProgress: (completed, totalCount) => {
            const progress = totalCount > 0 ? Math.round((completed / totalCount) * 100) : 0;
            updateOverlay({
                message: `下载全部数据 (${completed}/${totalCount})`,
                message_en: `Downloading all data (${completed}/${totalCount})`,
                type: 'text'
            }, progress);
        }
    });
    const validResults = results.filter(r => r && r.name && r.blob);
    if (validResults.length === 0) {
        hideOverlay();
        alerty.error('全部下载失败', 'All downloads failed');
        return;
    }
    updateOverlay({
        message: '正在打包…',
        message_en: 'Packing…',
        type: 'text'
    }, 95);
    const zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'));
    for (const item of validResults) {
        await zipWriter.add(item.name, new zip.BlobReader(item.blob));
    }
    const zipBlob = await zipWriter.close();
    const safeTitle = csg.sanitizeFilename(problemTitle);
    const dateStr = typeof DateFormat === 'function' ? DateFormat(new Date(), 'yyyyMMddHHmmss') : (new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14));
    const zipName = `${problemId}-${safeTitle}-${dateStr}.zip`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(a.href);
    updateOverlay({
        message: `已下载 ${zipName}`,
        message_en: `Downloaded ${zipName}`,
        type: 'text'
    }, 100);
    setTimeout(hideOverlay, 800);
});

$(document).on('click', '#judgedata_delete_all_btn', function() {
    const meta = document.getElementById('judgedata_meta');
    if (!meta) return;
    const confirmText = meta.getAttribute('data-confirm-text') || '';
    if (!confirmText) {
        alerty.error('缺少确认信息', 'Missing confirm info');
        return;
    }
    const rows = table.bootstrapTable('getData');
    if (!rows || rows.length === 0) {
        alerty.warn('暂无数据可删除', 'No data to delete');
        return;
    }
    const confirmTextEscaped = DomSantize(confirmText);
    alerty.prompt({
        title: '删除全部数据 <span class="en-text">Delete All Data</span>',
        message: '<div class="alert alert-danger mb-0">此操作将删除当前题目下全部评测数据且不可恢复。请将下方内容复制到输入框以确认：<code class="user-select-all d-block mt-1 p-2 bg-white bg-opacity-75 rounded">' + confirmTextEscaped + '</code></div>',
        message_en: 'This will permanently delete all judge data. Copy the content below into the input to confirm:',
        defaultValue: '',
        placeholder: '请将上方内容复制到此处以确认',
        callbackConfirm: async function(ev, value) {
            const trimmed = (value || '').trim();
            if (trimmed === '') {
                return { keepOpen: true, tip: '输入不能为空' };
            }
            if (trimmed !== confirmText) {
                return { keepOpen: true, tip: '输入与题号-标题不一致，请重新输入' };
            }
            const total = rows.length;
            showOverlay({
                message: `正在删除 (0/${total})`,
                message_en: `Deleting (0/${total})`,
                type: 'text'
            });
            const deleteTasks = rows.map(row => ({
                id: row.file_name,
                requestFn: () => $.get(deleteUrl, { id: itemId, filename: row.file_name }).then(ret => {
                    if (ret && ret.code === 1) return ret;
                    return Promise.reject(ret && ret.msg ? { msg: ret.msg } : new Error('Delete failed'));
                })
            }));
            const batchResult = await csg.batchRequest(deleteTasks, {
                concurrency: 5,
                onProgress: (completed, totalCount) => {
                    const progress = totalCount > 0 ? Math.round((completed / totalCount) * 100) : 0;
                    updateOverlay({
                        message: `正在删除 (${completed}/${totalCount})`,
                        message_en: `Deleting (${completed}/${totalCount})`,
                        type: 'text'
                    }, progress);
                }
            });
            hideOverlay();
            table.bootstrapTable('refresh');
            if (batchResult.summary.failCount > 0) {
                alerty.warn(`删除完成：成功 ${batchResult.summary.successCount}，失败 ${batchResult.summary.failCount}`, `Done: ${batchResult.summary.successCount} success, ${batchResult.summary.failCount} failed`);
            } else {
                alerty.success(`已删除 ${batchResult.summary.successCount} 个文件`, `Deleted ${batchResult.summary.successCount} files`);
            }
        }
    });
});
