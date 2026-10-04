<h3 class="bilingual-inline">考试说明<span class="en-text">Exam Description</span></h3>
<div class="contest-announcement-content">
    {if $contestStatus == -1}
        <div class="alert alert-info bilingual-inline">考试尚未开始<span class="en-text">This exam is not started yet.</span></div>
    {elseif !session('?user_id') && (!isset($contest_user) || !$contest_user) }
        <div class="alert alert-info bilingual-inline">请先登录后再参加考试<span class="en-text">Please login before joining the exam.</span></div>
    {/if}
    
    {include file="../../examsys/view/contest/contest_login" /}
    
    {if $contest_user !== null && isset($login_teaminfo) && $login_teaminfo && !empty($login_teaminfo['current_ip'])} 
    <div class="alert alert-info">
        <strong class="text-danger">当前IP： {$login_teaminfo['current_ip']|htmlspecialchars}</strong>
    </div>
    {/if}
    
    <?php if(strlen($contest['description']) == 0): ?>
        <div class="text-muted bilingual-inline">暂无更多信息<span class="en-text">Nothing more.</span></div>
    <?php else: ?>
        <div class="contest-description md_display_div">
            {$contest['description']|raw}
        </div>
    <?php endif; ?>
</div>

<div id="contest_fullscreen_info">
    <h1 id="fs_contest_title">{$contest['title']}</h1>
    <div class="row d-flex flex-nowrap">
        <div class="col-auto" id="fs_qrcode_div">
            <div id="fs_page_qrcode"></div>
            <div class="bilingual-inline">移动设备扫码访问<span class="en-text">Scan QR Code to Access</span></div>
        </div>
        <div class="col-auto" id="fs_time_div">
            <div id="fs_qr_logo" class="fs-4 mb-3"><i class="bi bi-qr-code"></i></div>
            <table id="fs_contest_time_table">
                <tr><td class="bilingual-inline">开始：<span class="en-text">Start: </span></td><td>{$contest['start_time']}</td></tr>
                <tr><td class="bilingual-inline">结束：<span class="en-text">End: </span></td><td>{$contest['end_time']}</td></tr>
                <tr><td class="bilingual-inline">当前：<span class="en-text">Current: </span></td><td><span class="current_time_div_cls text-primary" time_stamp=<?php echo microtime(true); ?> ></span></td></tr>
            </table>
            <div id="url_span"></div>
        </div>
    </div>
</div>

{include file="../../examsys/view/public/js_qrcode" /}
<script>
    let contest_fullscreen_info = $('#contest_fullscreen_info');
    let page_qrcode_container = $('#page_qrcode_container');
    let fs_qrcode_div = $('#fs_qrcode_div');
    let fs_time_div = $('#fs_time_div');
    let fs_qr_logo = $('#fs_qr_logo');
    const qrCodeFull = new QRCodeStyling({
        width: window.screen.width / 3.5,
        height: window.screen.width / 3.5,
        margin: 0,
        type: "svg",
        data: location.href,
        image: "/static/image/global/gothic_sign.svg",
        dotsOptions: {
            type: "classy-rounded",
            color: "#337AB7",
            gradient: null
        },
        imageOptions: {
            hideBackgroundDots: true,
            imageSize: 0.4,
            margin: 0
        }
    });
    qrCodeFull.append(document.getElementById("fs_page_qrcode"));
    page_qrcode_container.click(function(){
        ToggleFullScreen('contest_fullscreen_info');
    });
    fs_qrcode_div.click(function(){
        fs_qrcode_div.hide();
        fs_qr_logo.show();
    });
    fs_qr_logo.click(function(){
        fs_qrcode_div.show();
        fs_qr_logo.hide();
    })
    document.addEventListener("fullscreenchange", function () {
        if (!document.fullscreenElement) {
            contest_fullscreen_info.hide();
        } else {
            contest_fullscreen_info.show();
        }
    });
    document.addEventListener("DOMContentLoaded", function(){
        let url_span = document.getElementById('url_span');
        url_span.textContent = location.host;
        if(StrWidthLength(url_span.textContent) > 0) {
            url_span.style.fontSize = 100 / StrWidthLength(url_span.textContent) + "vw";
        }
        let fs_contest_title = document.getElementById('fs_contest_title');
        fs_contest_title.textContent = fs_contest_title.textContent.split('#')[0];
    }); 
</script>

<style>
    .contest-announcement-content {
        margin-bottom: 1rem;
    }

    .contest-announcement-content .alert {
        margin-bottom: 0.75rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.9rem;
    }

    .contest-announcement-content .mb-3 {
        margin-bottom: 1rem;
    }

    .contest-announcement-content .form-control {
        font-size: 0.9rem;
        padding: 0.375rem 0.75rem;
    }

    .contest-announcement-content .btn {
        font-size: 0.9rem;
        padding: 0.375rem 0.75rem;
    }

    .contest-description {
        margin-top: 1rem;
        line-height: 1.5;
    }

    .contest-description h1,
    .contest-description h2,
    .contest-description h3,
    .contest-description h4,
    .contest-description h5,
    .contest-description h6 {
        margin-top: 1rem;
        margin-bottom: 0.5rem;
    }

    .contest-description p {
        margin-bottom: 0.75rem;
    }

    .contest-description ul,
    .contest-description ol {
        margin-bottom: 0.75rem;
        padding-left: 1.5rem;
    }

    .contest-description code {
        background: #f8f9fa;
        padding: 0.125rem 0.25rem;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        color: #e83e8c;
        font-size: 0.9em;
    }

    .contest-description pre {
        background: #f8f9fa;
        padding: 0.75rem;
        border-radius: 4px;
        overflow-x: auto;
        margin-bottom: 0.75rem;
        font-size: 0.9em;
    }

    :-webkit-full-screen,
    :-moz-full-screen,
    :-ms-fullscreen,
    :fullscreen {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    #url_span {
        font-size: 5vw;
    }
    #contest_fullscreen_info>h1 {
        margin-bottom: 2vw;
        hyphens: auto;
        font-size: 4vw;
    }
    #contest_fullscreen_info,#fs_qrcode_div,#fs_time_div,#fs_qr_logo{
        margin: auto;
    }
    #fs_qrcode_div {
        display: none;
    }
    #fs_contest_time_table {
        display: flex;
        justify-content: center;
        align-items: center;
    }
    #contest_fullscreen_info {
        padding: 3vw;
        font-weight: bold;
        text-align: center;
        font-size: 3vw;
        font-family: "等线", Helvetica Neue,Helvetica,PingFang SC,Hiragino Sans GB,Microsoft YaHei,Noto Sans CJK SC,WenQuanYi Micro Hei,Arial,sans-serif;
        background-color: white;
        display: none;
    }
</style>
