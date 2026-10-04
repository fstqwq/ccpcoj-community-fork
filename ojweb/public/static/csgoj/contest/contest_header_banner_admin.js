(function ($) {
    'use strict';

    var MIN_W = 960;
    var MIN_H = 120;
    var MAX_EDGE = 4096;
    var BASENAME = (window.ContestConfig && window.ContestConfig.banner_basename) || 'contest_header_banner';
    var FILE_WEBP = BASENAME + '.webp';
    var FILE_SVG = BASENAME + '.svg';
    var MOD = (window.ContestConfig && window.ContestConfig.module) || 'admin';

    function attachBasePrefix() {
        var b =
            window.ContestConfig && window.ContestConfig.contest_attach_web_base
                ? String(window.ContestConfig.contest_attach_web_base)
                : '/upload/contest_attach';
        return b.replace(/\/?$/, '/') ;
    }

    function apiOk(res) {
        return res && (res.code == 1 || res.status === 'success');
    }

    function esc(text) {
        return typeof DomSantize === 'function' ? DomSantize(text || '') : String(text || '');
    }

    function findRow(cid) {
        var $tbl = $('#contest_list_table');
        if (!$tbl.length || !$tbl.bootstrapTable) {
            return null;
        }
        var rows = $tbl.bootstrapTable('getData') || [];
        for (var i = 0; i < rows.length; i++) {
            if (String(rows[i].contest_id) === String(cid)) {
                return rows[i];
            }
        }
        return null;
    }

    /** @returns {{ kind: string, url: string, mtime: number }} */
    function bannerUrlFromRow(row) {
        var attach = row && row.attach != null ? String(row.attach) : '';
        if (!attach || attach === '-') {
            return { kind: '', url: '', mtime: 0 };
        }
        var kind = row && row.contest_header_banner_kind != null ? String(row.contest_header_banner_kind) : '';
        var ext = kind === 'svg' ? '.svg' : kind === 'webp' ? '.webp' : '';
        if (!ext) {
            return { kind: '', url: '', mtime: 0 };
        }
        var mtime = row && row.contest_header_banner_mtime != null ? parseInt(row.contest_header_banner_mtime, 10) || 0 : 0;
        var url = attachBasePrefix() + encodeURIComponent(attach) + '/' + BASENAME + ext;
        if (mtime > 0) {
            url += (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(String(mtime));
        }
        return { kind: kind, url: url, mtime: mtime };
    }

    function applyBannerPreview(row) {
        var meta = bannerUrlFromRow(row || {});
        if (meta.kind && meta.url) {
            $('#contest_hb_preview_empty').addClass('d-none');
            $('#contest_hb_preview_wrap').removeClass('d-none');
            $('#contest_hb_preview_img').attr(
                'src',
                meta.url + (meta.url.indexOf('?') >= 0 ? '&' : '?') + 't=' + String(Date.now())
            );
            $('#contest_hb_delete_btn').prop('disabled', false);
        } else {
            $('#contest_hb_preview_empty').removeClass('d-none');
            $('#contest_hb_preview_wrap').addClass('d-none');
            $('#contest_hb_preview_img').attr('src', '');
            $('#contest_hb_delete_btn').prop('disabled', true);
        }
    }

    function openModalByRow(row) {
        if (!row || !row.is_admin) {
            return;
        }
        var $modalEl = $('#contest_header_banner_modal');
        if (!$modalEl.length) {
            return;
        }
        var full = findRow(row.contest_id) || row;
        $('#contest_hb_contest_id').val(String(row.contest_id));
        $('#contest_hb_file').val('');
        var fm =
            '/' +
            MOD +
            '/filemanager/filemanager?item=contest&id=' +
            encodeURIComponent(String(row.contest_id));
        $('#contest_hb_open_filemanager').attr('href', fm);
        applyBannerPreview(full);
        var modal =
            typeof bootstrap !== 'undefined' && bootstrap.Modal
                ? bootstrap.Modal.getOrCreateInstance($modalEl[0])
                : null;
        if (modal) {
            modal.show();
        } else {
            $modalEl.modal('show');
        }
    }

    function upload(contestId, file) {
        if (!window.CsgImageUploadPrepare || !window.CsgImageUploadPrepare.prepareForUpload) {
            alerty.error({
                message: '页面资源未就绪，请刷新后重试',
                message_en: 'Page resources not ready; refresh and try again',
            });
            return;
        }
        if (!window.ChunkUpload) {
            alerty.error({
                message: '分片上传未就绪，请刷新后重试',
                message_en: 'Chunk upload not ready; refresh and try again',
            });
            return;
        }

        var ext = CsgImageUploadPrepare.extOf(file && file.name);
        var opts = {
            minWidth: MIN_W,
            minHeight: MIN_H,
            maxEdge: MAX_EDGE,
            quality: 0.9,
            outputName: FILE_WEBP,
        };

        CsgImageUploadPrepare.prepareForUpload(file, opts)
            .then(function (uploadBlob) {
                var finalName = ext === 'svg' ? FILE_SVG : FILE_WEBP;
                var mime =
                    ext === 'svg'
                        ? 'image/svg+xml'
                        : 'image/webp';
                var uploadFile = new File([uploadBlob], finalName, { type: mime });
                var chunkUrl = '/' + MOD + '/filemanager/chunk_upload_ajax';
                var extra = { item: 'contest', id: String(contestId) };
                return window.ChunkUpload(uploadFile, chunkUrl, extra);
            })
            .then(function (ok) {
                if (!ok) {
                    return;
                }
                alerty.success({ message: '顶部图已更新', message_en: 'Top banner updated' });
                try {
                    $('#contest_list_table').bootstrapTable('refresh');
                } catch (e) {
                    /* ignore */
                }
                setTimeout(function () {
                    var r = findRow(contestId);
                    applyBannerPreview(r || {});
                }, 600);
            })
            .catch(function (err) {
                var m = err && err.message ? err.message : String(err);
                alerty.error({ message: m, message_en: m });
            });
    }

    /** 仅按列表中的 kind 删对应文件名，避免对不存在的第二个扩展名调用删除接口报错 */
    function deleteOneBanner(contestId, rowHint) {
        var row = rowHint || findRow(contestId) || {};
        var kind =
            row && row.contest_header_banner_kind != null
                ? String(row.contest_header_banner_kind)
                : '';
        var fname = kind === 'svg' ? FILE_SVG : kind === 'webp' ? FILE_WEBP : '';
        if (!fname) {
            alerty.warning({ message: '当前列表中无顶部图记录', message_en: 'No banner in current list row' });
            return;
        }
        var btn = $('#contest_hb_delete_btn');
        btn.prop('disabled', true);
        $.ajax({
            url: '/' + MOD + '/filemanager/file_delete_ajax',
            type: 'GET',
            dataType: 'json',
            data: { item: 'contest', id: contestId, filename: fname },
        })
            .then(function (res) {
                if (!apiOk(res)) {
                    var msg = (res && res.msg) || '删除失败';
                    alerty.error({ message: msg, message_en: msg });
                    btn.prop('disabled', false);
                    return;
                }
                applyBannerPreview({});
                alerty.success({ message: '已删除', message_en: 'Removed' });
                try {
                    $('#contest_list_table').bootstrapTable('refresh');
                } catch (e) {
                    /* ignore */
                }
            })
            .fail(function (xhr) {
                var m =
                    xhr && xhr.responseJSON && xhr.responseJSON.msg
                        ? xhr.responseJSON.msg
                        : '删除失败';
                alerty.error({ message: m, message_en: m });
                btn.prop('disabled', false);
            });
    }

    function FormatterContestIdForBanner(value, row) {
        var cid = parseInt(row && row.contest_id, 10);
        if (!cid) {
            return esc(value);
        }
        if (!row || !row.is_admin) {
            return String(cid);
        }
        var has = row.contest_header_banner_kind ? ' contest-id-banner-btn--has' : '';
        return (
            '<button type="button" class="btn btn-link p-0 text-decoration-none contest-id-banner-btn' +
            has +
            '" data-contest-id="' +
            cid +
            '" title="管理比赛顶部图 (Manage top banner)">' +
            cid +
            '</button>'
        );
    }
    window.FormatterContestIdForBanner = FormatterContestIdForBanner;

    $(function () {
        $(document).on('click', '.contest-id-banner-btn', function (e) {
            e.preventDefault();
            var cid = parseInt($(this).data('contest-id'), 10);
            if (!cid) {
                return;
            }
            openModalByRow({ contest_id: cid, is_admin: true });
        });

        $('#contest_hb_pick_btn').on('click', function () {
            $('#contest_hb_file').trigger('click');
        });

        $('#contest_hb_file').on('change', function () {
            var id = parseInt($('#contest_hb_contest_id').val(), 10);
            var f = this.files && this.files[0];
            this.value = '';
            if (!f || !id) {
                return;
            }
            upload(id, f);
        });

        $('#contest_hb_delete_btn').on('click', function () {
            var id = parseInt($('#contest_hb_contest_id').val(), 10);
            if (!id) {
                return;
            }
            if (!window.confirm('确定删除比赛顶部图？(Remove contest top banner?)')) {
                return;
            }
            deleteOneBanner(id);
        });

        $('#contest_header_banner_modal').on('hidden.bs.modal', function () {
            $('#contest_hb_file').val('');
        });
    });
})(jQuery);
