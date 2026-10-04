<?php
namespace app\csgoj\controller;
use think\Controller;
class Faqs extends Csgojbase
{
    public function index()
    {
        $judgeConfig = GetJudgerConfig()['config'];
        $this->assign([
            'pagetitle' => 'F.A.Qs',
            'faq_config' => $judgeConfig,
            'faq_commands' => \app\common\funcs\FaqEnvironment::commands($judgeConfig),
            'faq_english' => input('lang', 'cn') === 'other',
            'faq_environment' => json_decode(file_get_contents(__DIR__.'/../../../config/judge_environment.json'), true),
        ]);
        $staticPage = config('CsgcpcConst.STATIC_PAGE');
        if (!is_array($staticPage)) {
            $staticPage = [];
        }

        // 兼容：旧配置可能只有 oj_faq，新配置为 oj_faq_cn / oj_faq_other
        // 目标：后端未编辑 FAQ 或配置未更新时也不报错
        $faq_cn_id = $staticPage['oj_faq_cn'] ?? ($staticPage['oj_faq'] ?? 20);
        // 兼容：旧部署未配置 oj_faq_other 时默认使用 21
        $faq_other_id = $staticPage['oj_faq_other'] ?? 21;

        // STATIC_PAGE 下的 FAQ 不按 defunct 限制（与关于我们、轮播等特殊 news 一致）
        $news_cn = db('news')->where('news_id', $faq_cn_id)->find();
        $news_other = db('news')->where('news_id', $faq_other_id)->find();

        // 检查主语言文章是否存在，如果不存在则显示友好提示页面
        if(!$news_cn)
        {
            $this->assign([
                'news_not_found' => true,
                'page_title' => 'F.A.Qs',
                'page_title_cn' => '常见问题'
            ]);
            return $this->fetch();
        }
        
        // 默认显示主语言
        $current_news = $news_cn;
        $current_lang = 'cn';
        
        // 检查是否有语言切换参数
        $lang = input('lang', 'cn');
        if($lang == 'other' && $news_other)
        {
            $current_news = $news_other;
            $current_lang = 'other';
        }
        
        $this->assign([
            'news' => $current_news,
            'news_cn' => $news_cn,
            'news_other' => $news_other,
            'current_lang' => $current_lang,
            // FAQ 页仅当另一语言版本“可见”时显示切换标签
            'has_other_lang' => !empty($news_other)
        ]);
        return $this->fetch();
    }
}
