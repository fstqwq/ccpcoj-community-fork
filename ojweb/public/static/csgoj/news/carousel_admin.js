/**
 * 管理端首页轮播编辑页（/admin/news/carousel）
 */
(function () {
    'use strict';

    function carouselFieldSelectors() {
        var prefixes = ['href', 'src', 'header', 'content'];
        var sel = [];
        for (var p = 0; p < prefixes.length; p++) {
            for (var j = 0; j < 3; j++) {
                sel.push("input[name='" + prefixes[p] + j + "']");
            }
        }
        return sel.join(',');
    }

    function cyclicShiftSlides() {
        var items = ['href', 'src', 'header', 'content'];
        var now;
        var nex;
        for (var i = 0; i < items.length; i++) {
            nex = undefined;
            for (var j = 0; j < 3; j++) {
                now = $("input[name='" + items[i] + j + "']").val();
                if (j > 0) {
                    $("input[name='" + items[i] + j + "']").val(nex);
                }
                nex = now;
            }
            $("input[name='" + items[i] + "0']").val(nex);
        }
    }

    $(function () {
        var form = $('#carousel_edit_form');
        var submitBtn = $('#carousel_submit_btn');
        if (!form.length || !submitBtn.length) {
            return;
        }

        FormValidationTip.initCommonFormValidation('#carousel_edit_form', {}, function (elForm) {
            button_delay_auto(submitBtn, 3, 'before');
            $(elForm).ajaxSubmit({
                success: function (ret) {
                    if (ret && ret.code == 1) {
                        alerty.success(ret.msg || '保存成功');
                    } else {
                        alerty.error(ret && ret.msg ? ret.msg : '保存失败');
                    }
                    button_delay_auto(submitBtn, 3, 'start');
                    return false;
                },
                error: function () {
                    alerty.alert('提交失败（网络或服务端错误）');
                    button_delay_auto(submitBtn, 3, 'start');
                    return false;
                }
            });
            return false;
        });

        $('#carousel_shift_btn').on('click', function () {
            cyclicShiftSlides();
        });

        $('#carousel_clear_btn').on('click', function () {
            $(carouselFieldSelectors()).val('');
        });

        $(window).on('keydown', function (e) {
            if (e.keyCode === 83 && e.ctrlKey) {
                e.preventDefault();
                submitBtn.trigger('click');
            }
        });
    });
})();
