/**
 * 人类可读字节（与附件上传遮罩、其它后台脚本共用）
 * @param {number} bytes
 * @returns {string}
 */
function csgojFormatBytes(bytes) {
    const n = Number(bytes);
    if (!isFinite(n) || n < 0) {
        return '0 B';
    }
    if (n < 1024) {
        return `${Math.round(n)} B`;
    }
    if (n < 1048576) {
        return `${(n / 1024).toFixed(n < 10240 ? 2 : 1)} KB`;
    }
    if (n < 1073741824) {
        return `${(n / 1048576).toFixed(2)} MB`;
    }
    return `${(n / 1073741824).toFixed(2)} GB`;
}

/** @param {File} file @param {number} uploadedChunks 已成功片数 */
function csgojChunkUploadOverlayPayload(file, uploadedChunks, totalChunks, chunkSize) {
    const uploaded = Math.min(file.size, uploadedChunks * chunkSize);
    const pct = totalChunks > 0 ? Math.round((uploadedChunks / totalChunks) * 100) : 0;
    const totalStr = csgojFormatBytes(file.size);
    const doneStr = csgojFormatBytes(uploaded);
    return {
        message: '正在上传附件',
        message_en: 'Uploading attachment',
        subtitle: file.name,
        subtitle_en: '',
        subtitleType: 'text',
        detail: `已传输 ${doneStr} / 共 ${totalStr}`,
        detail_en: `${doneStr} / ${totalStr} transferred`,
        detailType: 'text',
        type: 'text',
        titleIcon: 'bi-cloud-arrow-up',
        progressMode: 'determinate',
        progress: pct,
        progressAccent: 'gradient-blue',
        overlayProgressSpinnerPolicy: 'progress_only',
    };
}

async function ChunkUpload(file, url, data = {}) {
    const chunkSize = 1024 * 1024; // 1MB
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

    showOverlay(csgojChunkUploadOverlayPayload(file, 0, totalChunks, chunkSize));

    await new Promise(resolve => setTimeout(resolve, 100));

    let uploadedChunks = 0;

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append("upload_file", chunk);
        formData.append("index", i);
        formData.append("totalChunks", totalChunks);
        formData.append("fileName", file.name);
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                formData.append(key, data[key]);
            }
        }

        try {
            const rep = await csg.post({
                url: url,
                data: formData,
                contentType: null,
                dtype: 'json'
            });
            if (rep.code !== 1) {
                throw new Error(rep.msg || `Failed to upload chunk ${i}`);
            }

            uploadedChunks++;
            const progress = totalChunks > 0 ? Math.round((uploadedChunks / totalChunks) * 100) : 0;
            updateOverlay(csgojChunkUploadOverlayPayload(file, uploadedChunks, totalChunks, chunkSize), progress);

            if (uploadedChunks % 10 === 0 && uploadedChunks < totalChunks) {
                // 每批分片后让出宏任务：① 浏览器有机会合并 DOM/绘制（updateOverlay 已同步调用）② 略降打满服务器的速率。
                // 不在此处使用 requestAnimationFrame：隐藏标签页中 rAF 不运行，await 会无限挂起，上传表现为「彻底停、切回才继续」。
                await new Promise(r => setTimeout(r, 0));
                await csg.sleep(150);
            }
        } catch (error) {
            console.error(error);
            alerty.alert({
                message: `上传文件 ${file.name} 的第 ${i} 个分片时出错：${error.message}`,
                message_en: `Error uploading chunk ${i} of file ${file.name}: ${error.message}`
            });
            hideOverlay();
            return false;
        }
    }

    hideOverlay();
    return true;
}

if (typeof window !== 'undefined') {
    window.csgojFormatBytes = csgojFormatBytes;
}