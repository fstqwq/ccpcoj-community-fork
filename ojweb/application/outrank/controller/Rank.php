<?php

namespace app\outrank\controller;

use app\outrank\library\OutrankSponsorBannerService;

class Rank extends Outrankbase {
    function index() {
        return $this->showRankPage('index');
    }

    function roll() {
        return $this->showRankPage('roll');
    }

    protected function showRankPage($template) {
        $outrank_uuid = input('outrank_uuid/s', '');
        
        if (empty($outrank_uuid)) {
            $this->error('Missing outrank_uuid parameter');
        }
        
        // 查询 outrank 信息
        $outrank = db('outrank')->where('outrank_uuid', $outrank_uuid)->find();
        
        if (!$outrank) {
            $this->error('Outrank not found');
        }

        // 非大管理员仅可访问启用态（defunct='0'；'1' 禁用、'2' 已删除均不可见）
        if (!IsAdmin('administrator') && isset($outrank['defunct']) && $outrank['defunct'] != '0') {
            $this->error('Outrank not found');
        }

        // assign 变量
        $this->assign('outrank_uuid', $outrank_uuid);
        $this->assign('outrank', $outrank);
        $this->assign('timeStamp', microtime(true)); // 用于计算时间差

        $outrankTitle = trim((string) ($outrank['title'] ?? ''));
        if ($outrankTitle === '') {
            $outrankTitle = '外榜';
        }
        if ($template === 'roll') {
            $this->assign('pagetitle', $outrankTitle . ' · 滚榜');
            $this->assign('pagetitle_en', 'Award Roll');
        } else {
            $this->assign('pagetitle', $outrankTitle . ' · 实时榜单');
            $this->assign('pagetitle_en', 'Live Scoreboard');
        }

        $rollUrl = '/outrank/rank/roll?outrank_uuid=' . rawurlencode($outrank_uuid);
        $rankUrl = '/outrank/rank?outrank_uuid=' . rawurlencode($outrank_uuid);
        if ($template === 'index') {
            $this->assign('csg_ph_icon_href', '/outrank');
            $this->assign('csg_ph_icon_title', '返回外榜列表 (Back to outrank list)');
            $this->assign('csg_ph_actions_html',
                '<a class="btn btn-outline-primary btn-sm" href="' . htmlspecialchars($rollUrl, ENT_QUOTES, 'UTF-8') . '">'
                . '<i class="bi bi-trophy me-1"></i><span class="cn-text">滚榜</span><span class="en-text">Roll</span></a>'
            );
        } else {
            $this->assign('csg_ph_actions_html',
                '<a class="btn btn-outline-primary btn-sm" href="' . htmlspecialchars($rankUrl, ENT_QUOTES, 'UTF-8') . '">'
                . '<i class="bi bi-bar-chart-steps me-1"></i><span class="cn-text">回到榜单</span><span class="en-text">Back to Rank</span></a>'
            );
        }

        $ojPath = config('OjPath.');
        $banner = OutrankSponsorBannerService::resolvePublicMeta(
            $ojPath['PUBLIC'],
            $ojPath['outrank_ATTACH'],
            $ojPath['outrank_ATTACH'],
            $outrank_uuid
        );
        $this->assign('outrank_sponsor_banner', $banner ?: ['kind' => '', 'url' => '', 'mtime' => 0]);

        return $this->fetch($template);
    }
}