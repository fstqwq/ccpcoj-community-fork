<?php
namespace app\index\controller;
use think\Controller;
class Index extends Homebase
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
    // news_list_ajax 已由 Homebase 基类提供，无需重写
    // title 的链接由前端 formatter 生成
    public function test()
    {
        return $this->fetch();
    }
}
