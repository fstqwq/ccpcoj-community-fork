<?php
namespace app\exindex\controller;

/**
 * exindex About 控制器
 * 继承 Exindexbase，复用 index/About 的逻辑，自动注入 course_key
 */
class About extends Exindexbase
{
    public function MakePageTitle()
    {
        $this->assign('pagetitle', $this->pagetitle = $this->OJ_NAME . ' About');
    }
    
    public function index()
    {
        $nid = $this->staticPage['about_us'];
        $News = db('news');
        $map = [
            'news_id'     => $nid,
        ];
        // 应用 course_key 过滤
        $map = $this->applyQueryFilter($map, 'news');
        $news = $News->where($map)->find();
        // 检查特殊文章是否存在，如果不存在则显示友好提示页面
        if(!$news)
        {
            $this->assign([
                'news_not_found' => true,
                'page_title' => 'About',
                'page_title_cn' => '关于我们'
            ]);
            return $this->fetch('public/news_detail');
        }
        $this->assign('news', $news);
        return $this->fetch('public/news_detail');
    }
}

