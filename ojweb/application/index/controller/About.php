<?php
/**
 * Created by PhpStorm.
 * User: CSGrandeur
 * Date: 2017/3/4
 * Time: 9:39
 */
namespace app\index\controller;
use think\Controller;
class About extends Homebase
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
