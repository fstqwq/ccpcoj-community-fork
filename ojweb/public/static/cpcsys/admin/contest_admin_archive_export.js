/**
 * cpcsys 比赛后台：系统管理员「归档导出」→ /admin/contest/contest_export_enqueue_ajax → 跳转 backtask #bt_task_id
 */
(function () {
    'use strict';

    function alertyBilingualFromRet(ret) {
        var d = ret && ret.data;
        if (d && d.flg_bilingual && d.msg_cn) {
            if (typeof alerty !== 'undefined' && alerty.alert) {
                alerty.alert({ message: d.msg_cn, message_en: d.msg_en || d.msg_cn });
            } else {
                window.alert(d.msg_cn);
            }
            return true;
        }
        return false;
    }

    $(document).on('click', '#cpcsys_contest_archive_export_btn', function (e) {
        e.preventDefault();
        var cid = parseInt($(this).attr('data-cid'), 10);
        if (!cid || cid <= 0) {
            return;
        }
        if (typeof alerty === 'undefined' || !alerty.confirm) {
            window.alert('需要 alerty 组件');
            return;
        }
        alerty.confirm({
            message:
                '将为当前比赛提交「<strong>比赛包导出</strong>」后台任务（默认包含评测数据与题面 PDF、题目附件）。<br/>' +
                '提交后将跳转到<strong>后台任务</strong>页面，并自动筛选本次任务。<br/>确定继续？',
            message_en:
                'Submit a <strong>contest package export</strong> background task (test data &amp; statement PDF and attachments on by default).<br/>' +
                'You will be redirected to <strong>Backtask</strong> with this task filtered.<br/>Continue?',
            okText: '确定',
            cancelText: '取消',
            width: 'lg',
            callback: function () {
                $.post(
                    '/admin/contest/contest_export_enqueue_ajax',
                    {
                        contest_id: cid,
                        test_data_check: 'true',
                        attach_file_check: 'true',
                    },
                    function (ret) {
                        if (ret && ret.code === 1 && ret.data && ret.data.task_id) {
                            var tid = ret.data.task_id;
                            alerty.alert({
                                message:
                                    '归档导出任务已提交（任务 #' + tid + '），即将跳转到后台任务页面。',
                                message_en:
                                    'Archive export task submitted (Task #' + tid + '). Redirecting to Backtask.',
                                width: 'lg',
                                callback: function () {
                                    window.location.href =
                                        '/admin/backtask/index#bt_task_id=' + encodeURIComponent(String(tid));
                                },
                            });
                        } else if (alertyBilingualFromRet(ret)) {
                            /* errorBilingual */
                        } else {
                            var err = (ret && ret.msg) ? ret.msg : '提交失败';
                            alerty.alert({ message: err, message_en: err });
                        }
                    },
                    'json'
                ).fail(function () {
                    alerty.alert({ message: '网络错误', message_en: 'Network error' });
                });
            },
        });
    });
})();
