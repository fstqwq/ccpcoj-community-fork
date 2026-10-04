<?php
namespace app\course\controller;
class Index extends Coursebase {
    public function index() {
        $this->assign('pagetitle', '课程组');
        
        $staticPage = config('CsgcpcConst.STATIC_PAGE');
        $nid = $staticPage['about_us'];
        $map = [
            'news_id'     => $nid,
        ];
        $news = db('news')->where($map)->find();
        if($news) {
            $this->assign('aboutus', $news);
        }
        return $this->fetch();
    }
    public function course_list_ajax() {
        $course_list = db('course')->where('defunct', 0)->field('course_description', true)->select();
        // 兼容附件体系：course 没有 attach 字段，这里约定 attach = course_key
        foreach($course_list as &$c) {
            $c['attach'] = $c['course_key'];
        }
        return $this->success('获取课程列表成功', '', $course_list);
    }
    
    public function course_ajax() {
        if(input("?course_id")) {
            $course = db('course')->where('course_id', input('course_id/d'))->find();
        } else {
            $course = db('course')->where('course_key', input('course_key/s'))->find();
        }
        
        if($course) {
            return $this->success('获取课程信息成功', '', $course);
        } else {
            return $this->error('课程不存在');
        }
    }
    
    /**
     * 获取 About Us 内容（用于未选中课程时显示）
     */
    public function aboutus_ajax() {
        $staticPage = config('CsgcpcConst.STATIC_PAGE');
        $nid = $staticPage['about_us'];
        $map = [
            'news_id' => $nid,
        ];
        $news = db('news')->where($map)->find();
        
        if($news) {
            // 检查是否有 news_md 表的内容
            $news_md = db('news_md')->where('news_id', $news['news_id'])->find();
            if($news_md != null) {
                $news = array_replace($news, $news_md);
            }
            return $this->success('获取成功', '', $news);
        } else {
            // About Us 不存在，返回空内容
            return $this->success('获取成功', '', [
                'title' => '编程实践及多模式考试平台',
                'content' => '',
                'time' => date('Y-m-d H:i:s'),
                'modify_time' => date('Y-m-d H:i:s'),
                'user_id' => '',
                'modify_user_id' => ''
            ]);
        }
    }
}
