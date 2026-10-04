/** 通用图片上传预处理（栅格图压缩尺寸后上传；SVG 原样） */
(function (global) {
    'use strict';

    function extOf(name) {
        var n = String(name || '').toLowerCase();
        var i = n.lastIndexOf('.');
        return i >= 0 ? n.slice(i + 1) : '';
    }

    function rasterToWebpBlob(file, opts) {
        var minWidth = Math.max(1, parseInt(opts && opts.minWidth, 10) || 1);
        var minHeight = Math.max(1, parseInt(opts && opts.minHeight, 10) || 1);
        var maxEdge = Math.max(1, parseInt(opts && opts.maxEdge, 10) || 3840);
        var quality = opts && opts.quality != null ? Number(opts.quality) : 0.88;

        return createImageBitmap(file).then(function (bmp) {
            try {
                var w0 = bmp.width;
                var h0 = bmp.height;
                if (!w0 || !h0) {
                    throw new Error('无效图片 / Invalid image');
                }
                var scale = Math.min(1, maxEdge / Math.max(w0, h0));
                var w = Math.max(1, Math.round(w0 * scale));
                var h = Math.max(1, Math.round(h0 * scale));
                if (w < minWidth || h < minHeight) {
                    throw new Error(
                        '图片过小：至少 ' + minWidth + '×' + minHeight + ' 像素（当前约 ' + w + '×' + h + '）\n' +
                        'Image too small: min ' + minWidth + '×' + minHeight + ' px (about ' + w + '×' + h + ')'
                    );
                }
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(bmp, 0, 0, w, h);
                return new Promise(function (resolve, reject) {
                    canvas.toBlob(function (blob) {
                        if (!blob) {
                            reject(
                                new Error(
                                    '当前环境无法处理该图片，请换一张或更换浏览器后重试\n' +
                                        'This image could not be prepared; try another file or a different browser'
                                )
                            );
                            return;
                        }
                        resolve(blob);
                    }, 'image/webp', quality);
                });
            } finally {
                try {
                    bmp.close();
                } catch (e) {
                    /* ignore */
                }
            }
        });
    }

    function prepareForUpload(file, opts) {
        var ext = extOf(file && file.name);
        if (ext === 'svg') {
            return Promise.resolve(file);
        }
        return rasterToWebpBlob(file, opts).then(function (blob) {
            var outputName = (opts && opts.outputName) ? String(opts.outputName) : 'upload.webp';
            return new File([blob], outputName, { type: 'image/webp' });
        });
    }

    global.CsgImageUploadPrepare = {
        extOf: extOf,
        rasterToWebpBlob: rasterToWebpBlob,
        prepareForUpload: prepareForUpload,
    };
})(window);
