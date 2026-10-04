<style>
    .contest_title {
        display: inline-block;
        max-width: 400px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
<script>
var contest_list_now_ms = (typeof CsgContestPageNowMs === 'function')
    ? CsgContestPageNowMs()
    : (function () {
        var raw = $('#page_info').attr('time_stamp');
        if (typeof raw === 'undefined' || raw == null || String(raw).length === 0) {
            return new Date().getTime();
        }
        return parseFloat(String(raw)) * 1000;
    })();
function FormatterTitle(value, row, index, field) {
    // ACM OJ 比赛 URL（不处理 ex 相关模块）
    let contest_url = `/csgoj/contest/problemset?cid=${row.contest_id}`;
    return `<a href="${contest_url}" class="contest_title" title="${row.title}">${row.title}</a>`;
}
function FormatterType(value, row, index, field) {
    let private = parseInt(value);
    let attach = Math.floor(private / 10 + 1e-8);
    let ckind = private % 10;
    let ckind_str, cl
    switch(ckind) {
        case 0: 
            if(row.password != '') {
                cl = 'warning';ckind_str = "Encrypted";
            } else {
                cl = 'success';ckind_str = "Public";
            }
            break;
        case 1: cl = 'danger';ckind_str = "Private"; break;
        case 2: cl = 'primary';ckind_str = "Standard"; break;
    }
    if(attach) {
        ckind_str += "/有附加";
    }
    return `<strong class='text-${cl}'>${ckind_str}</strong>`;
}
function FormatterStatus(value, row, index, field) {
    let cl, wd, sta;
    if(value == '0') {
        cl = 'success';
        wd = 'Available';
        sta = '0';
    } else {
        cl = 'warning';
        wd = 'Reserved';
        sta = '1';
    }
    return `<button type='button' field='defunct' itemid='${row.contest_id}' class='change_status btn btn-${cl}' status='${sta}'>${wd}</button>`;
}
function FormatterContestStatus(value, row, index, field) {
    var phase = (typeof CsgContestPhaseByRowTimes === 'function')
        ? CsgContestPhaseByRowTimes(row)
        : null;
    if (phase === -1) {
        return "<strong class='text-success'>Coming</strong>";
    }
    if (phase === 0) {
        return "<strong class='text-danger'>Running</strong>";
    }
    if (phase === 1) {
        return "<strong class='text-info'>Ended</strong>";
    }
    var nowStr = typeof Timestamp2Time === 'function' ? Timestamp2Time(contest_list_now_ms) : '';
    if (nowStr < row.start_time) {
        return "<strong class='text-success'>Coming</strong>";
    } else if (nowStr <= row.end_time) {
        return "<strong class='text-danger'>Running</strong>";
    }
    return "<strong class='text-info'>Ended</strong>";
}
function FormatterEdit(value, row, index, field) {
    return `<a href='/admin/contest/contest_edit?id=${row.contest_id}'>Edit</a>`;
}
function FormatterCopy(value, row, index, field) {
    return "<a href='__ADMIN__/contest/contest_copy?id=" + row['contest_id'] + "'>Copy</a>";
}
function FormatterAttach(value, row, index, field) {
    return `<a href='/admin/filemanager/filemanager?item=contest&id=${row.contest_id}' target='_blank'>Attach</a>`;
}
function FormatterRejudge(value, row, index, field) {
    return `<a href='/cpcsys/admin/contest_rejudge?cid=${row.contest_id}' target='_blank'>Rejudge</a>`;
}

</script>