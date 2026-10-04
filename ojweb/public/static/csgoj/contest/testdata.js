/**
 * 测试数据下载功能
 * 使用 util.js 封装的 AJAX 方法下载文件，不跳转页面
 */

(function() {
    'use strict';
    
    // 从全局配置获取参数
    const config = window.testdataConfig || {};
    const module_name = config.module_name || '';
    const controller_name = config.controller_name || '';
    const contest_id = config.contest_id || 0;
    const apid = config.apid || '';
    const downloadWaitTime = (config.downloadWaitTime || 0) * 60; // 转换为秒
    const isAdmin = config.isAdmin || false;
    
    /**
     * Bootstrap Table formatter: 文件下载链接
     */
    window.FileDownload = function(value, row, index) {
        return `<a href="javascript:void(0);" class="testdown text-decoration-none" data-filename="${value}">
            <i class="bi bi-download me-1"></i>${value}
        </a>`;
    };
    
    /**
     * 使用 JavaScript 下载文件，不跳转页面
     * @param {string} filename - 文件名
     */
    async function downloadTestDataFile(filename) {
        // 检查下载频率限制（非管理员）
        if (!isAdmin) {
            let last_test_download_num = localStorage.getItem('last_test_download_num');
            let last_test_download_time = localStorage.getItem('last_test_download_time');
            
            if(typeof(last_test_download_num) == 'undefined' || last_test_download_num === null){
                last_test_download_num = 0;
            } else {
                last_test_download_num = parseInt(last_test_download_num);
            }
            
            if(typeof(last_test_download_time) != 'undefined' && last_test_download_time !== null) {
                last_test_download_time = parseFloat(last_test_download_time);
                let now = new Date().getTime() / 1000;
                if(last_test_download_num >= 2 && now - last_test_download_time < downloadWaitTime) {
                    let secondsLeft = Math.ceil(downloadWaitTime - (now - last_test_download_time));
                alerty.error(
                    '<span class="cn-text">下载过于频繁，请等待 ' + secondsLeft + ' 秒后再试。</span>' +
                    '<span class="en-text">Don\'t download test data too frequently. ' + secondsLeft + ' seconds left.</span>'
                );
                    return;
                }
                if(now - last_test_download_time > downloadWaitTime) {
                    last_test_download_num = 0;
                }
                last_test_download_num++;
            } else {
                last_test_download_num = 1;
            }
            
            localStorage.setItem('last_test_download_time', new Date().getTime() / 1000);
            localStorage.setItem('last_test_download_num', last_test_download_num);
        }
        
        // 构建下载 URL 和参数
        const downloadUrl = `/${module_name}/${controller_name}/testdata_download`;
        const downloadParams = {
            cid: contest_id,
            pid: apid,
            filename: filename
        };
        
        try {
            // 使用 util.js 封装的方法下载文件（返回 Response 对象）
            const response = await csg.ajax('get', downloadUrl, downloadParams, {}, 'blob');
            
            if (!response.ok) {
                // 如果响应不是 OK，尝试解析错误信息
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    alerty.error(errorData.msg || '<span class="cn-text">下载失败</span><span class="en-text">Download failed</span>');
                } else {
                    alerty.error('<span class="cn-text">下载失败：' + response.status + ' ' + response.statusText + '</span><span class="en-text">Download failed: ' + response.status + ' ' + response.statusText + '</span>');
                }
                return;
            }
            
            // 获取文件内容为 Blob
            const blob = await response.blob();
            
            // 从响应头获取文件名，如果没有则使用默认名称
            const contentDisposition = response.headers.get('content-disposition');
            let downloadFilename = filename;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    downloadFilename = filenameMatch[1].replace(/['"]/g, '');
                }
            }
            
            // 创建下载链接并触发下载
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // 成功时提示"下载马上开始"
            alerty.success('<span class="cn-text">下载马上开始</span><span class="en-text">Download starting</span>');
        } catch (error) {
            console.error('Download error:', error);
            alerty.error('<span class="cn-text">下载失败：' + error.message + '</span><span class="en-text">Download failed: ' + error.message + '</span>');
        }
    }
    
    // 绑定下载事件（使用事件委托，避免重复绑定）
    $(function() {
        // 只使用事件委托，避免重复绑定
        $(document).off('click.testdata', '.testdown').on('click.testdata', '.testdown', function(e){
            e.preventDefault();
            const filename = $(this).data('filename');
            if (filename) {
                downloadTestDataFile(filename);
            }
        });
    });
})();

