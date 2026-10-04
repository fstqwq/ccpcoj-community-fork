/** 外榜列表：页眉横幅（上传 / 预览 / 删除） */
(function ($) {
    'use strict';

    var MIN_W = 800;
    var MIN_H = 80;
    /** 与 OutrankSponsorBannerService 导出上限思路一致：单边缩放上限 */
    var OUTRANK_SB_MAX_EDGE = 3840;

    function sbApiOk(res) {
        return res && (res.code == 1 || res.status === 'success');
    }

    function sbApplyMeta(meta) {
        var kind = meta && meta.kind ? String(meta.kind) : '';
        var url = meta && meta.url ? String(meta.url) : '';
        var mtime = meta && meta.mtime != null ? String(meta.mtime) : '0';
        if (kind && url) {
            $('#outrank_sb_preview_empty').addClass('d-none');
            $('#outrank_sb_preview_wrap').removeClass('d-none');
            $('#outrank_sb_preview_img').attr('src', url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(mtime));
            $('#outrank_sb_delete_btn').prop('disabled', false);
        } else {
            $('#outrank_sb_preview_empty').removeClass('d-none');
            $('#outrank_sb_preview_wrap').addClass('d-none');
            $('#outrank_sb_preview_img').attr('src', '');
            $('#outrank_sb_delete_btn').prop('disabled', true);
        }
    }

    function sbLoadMeta(outrankId) {
        $.get(
            '/outrank/index/outrank_page_header_meta_ajax',
            { outrank_id: outrankId },
            function (res) {
                if (!sbApiOk(res)) {
                    alerty.error({
                        message: (res && res.msg) || '加载失败',
                        message_en: (res && res.msg) || 'Load failed',
                    });
                    return;
                }
                sbApplyMeta(res.data || {});
            },
            'json'
        ).fail(function (xhr) {
            var m = xhr && xhr.responseJSON && xhr.responseJSON.msg ? xhr.responseJSON.msg : '加载失败';
            alerty.error({ message: m, message_en: m });
        });
    }

    function sbPrepareFileForUpload(file) {
        if (!window.CsgImageUploadPrepare || !window.CsgImageUploadPrepare.prepareForUpload) {
            return Promise.reject(new Error('缺少图片预处理组件 (Missing image upload helper)'));
        }
        return window.CsgImageUploadPrepare.prepareForUpload(file, {
            minWidth: MIN_W,
            minHeight: MIN_H,
            maxEdge: OUTRANK_SB_MAX_EDGE,
            quality: 0.88,
            outputName: 'outrank_sponsor_banner.webp',
        });
    }

    function sbUpload(outrankId, file) {
        sbPrepareFileForUpload(file)
            .then(function (uploadFile) {
                var fd = new FormData();
                fd.append('file', uploadFile);
                fd.append('outrank_id', String(outrankId));
                showOverlay({
                    message: '正在上传页眉横幅…',
                    message_en: 'Uploading header banner…',
                    progressMode: 'indeterminate',
                });
                return $.ajax({
                    url: '/outrank/index/outrank_page_header_upload_ajax',
                    type: 'POST',
                    data: fd,
                    processData: false,
                    contentType: false,
                    dataType: 'json',
                }).then(function (res) {
                    if (!sbApiOk(res)) {
                        alerty.error({
                            message: (res && res.msg) || '上传失败',
                            message_en: (res && res.msg) || 'Upload failed',
                        });
                        return;
                    }
                    sbApplyMeta(res.data || {});
                    alerty.success({
                        message: '已更新页眉横幅',
                        message_en: 'Header banner updated',
                    });
                    try {
                        $('#outrank_list_table').bootstrapTable('refresh');
                    } catch (e1) {
                        /* ignore */
                    }
                });
            })
            .catch(function (err) {
                var m = err && err.message ? err.message : String(err);
                alerty.error({ message: m, message_en: m });
            })
            .finally(function () {
                hideOverlay();
            });
    }

    $(function () {
        var $modalEl = $('#outrank_sponsor_banner_modal');
        if (!$modalEl.length) {
            return;
        }

        var modal = typeof bootstrap !== 'undefined' && bootstrap.Modal ? new bootstrap.Modal($modalEl[0]) : null;

        $(document).on('click', '.outrank-sponsor-banner-admin-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var id = $(this).data('id');
            $('#outrank_sb_outrank_id').val(id);
            $('#outrank_sb_file').val('');
            sbLoadMeta(id);
            if (modal) {
                modal.show();
            } else {
                $modalEl.modal('show');
            }
        });

        $('#outrank_sb_pick_btn').on('click', function () {
            $('#outrank_sb_file').trigger('click');
        });

        $('#outrank_sb_file').on('change', function () {
            var id = parseInt($('#outrank_sb_outrank_id').val(), 10);
            var f = this.files && this.files[0];
            this.value = '';
            if (!f || !id) {
                return;
            }
            sbUpload(id, f);
        });

        $('#outrank_sb_delete_btn').on('click', function () {
            var id = parseInt($('#outrank_sb_outrank_id').val(), 10);
            if (!id) {
                return;
            }
            if (!window.confirm('确定删除页眉横幅？(Remove header banner?)')) {
                return;
            }
            var btn = $(this);
            btn.prop('disabled', true);
            $.post(
                '/outrank/index/outrank_page_header_delete_ajax',
                { outrank_id: id },
                function (res) {
                    if (!sbApiOk(res)) {
                        alerty.error({
                            message: (res && res.msg) || '删除失败',
                            message_en: (res && res.msg) || 'Delete failed',
                        });
                        btn.prop('disabled', false);
                        return;
                    }
                    sbApplyMeta({});
                    alerty.success({
                        message: '已删除',
                        message_en: 'Removed',
                    });
                    try {
                        $('#outrank_list_table').bootstrapTable('refresh');
                    } catch (e2) {
                        /* ignore */
                    }
                },
                'json'
            ).fail(function (xhr) {
                var m = xhr && xhr.responseJSON && xhr.responseJSON.msg ? xhr.responseJSON.msg : '删除失败';
                alerty.error({ message: m, message_en: m });
                btn.prop('disabled', false);
            });
        });
    });
})(jQuery);
