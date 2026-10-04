<?php
namespace app\exindex\controller;

/**
 * exindex Index 控制器
 * 继承 Exindexbase，复用 index/Index 的逻辑，自动注入 course_key
 */
class Index extends Exindexbase
{
    public function index()
    {
        $ncarousel = SetCarousel();
        $showCarousel = CsgHomeCarouselShouldShow($ncarousel['news']);

        $this->assign([
            'carousel'             => $ncarousel['carousel'],
            'showCarousel'        => $showCarousel,
        ]);
        $this->assign('now', time());
        return $this->fetch();
    }
    
    public function news_detail()
    {
        $news = $this->get_news_info();
        $this->assign(['news'=>$news]);
        return $this->fetch();
    }
    
    public function news_list()
    {
        return $this->fetch();
    }
    
    // news_list_ajax 已由 Homebase 基类提供，通过 applyQueryFilter hook 自动应用 course_key 过滤
    // title 的链接由前端 formatter 生成
    
    public function test()
    {
        return $this->fetch();
    }
}

