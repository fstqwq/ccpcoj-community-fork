<?php
namespace app\ojtool\controller;
use think\Controller;
class Tool extends Ojtoolbase
{
    public function award() {
        if(!IsAdmin()) {
            $this->error("You are not admin.");
        }
        $this->assign("pagetitle", "Award");
        return $this->fetch();
    }
    public function time_page_set() {
        // 监考时显示时间的小工具
        $this->assign("pagetitle", "Time Page Set");
        return $this->fetch();
    }
    public function time_page_show() {
        // 监考时显示时间的小工具
        $this->assign("pagetitle", "Time Page Show");
        return $this->fetch();
    }
    /**
     * 公开 Web 工具：外格式题包解析与打包（与后台 problem/pkg_convert 共用视图，assign 关闭导入）。
     */
    public function problem_pkg_tool() {
        $this->assign('pagetitle', '题包解析工具 Package Parser Tool');
        $this->assign([
            'problem_pkg_import_enable' => 0,
            'problem_pkg_public_tool' => 1,
            'pkg_convert_now_course_id' => 0,
            'pkg_convert_now_course_key' => '',
            'problem_pkg_username_for_zip' => (string) (session('user_id') ?: ''),
            'problem_judge_type_options_json' => json_encode(problem_judge_type_options_list(), JSON_UNESCAPED_UNICODE),
        ]);
        return $this->fetch();
    }

    /** 旧路由：统一至 problem_pkg_tool（Polygon 标签） */
    public function polygon_parser() {
        $this->redirect('/' . $this->request->module() . '/tool/problem_pkg_tool');
    }

    /** 旧路由：统一至 problem_pkg_tool（酒井标签；HTTP 重定向不保证保留 #，故用查询参数） */
    public function thusaa_parser() {
        $this->redirect('/' . $this->request->module() . '/tool/problem_pkg_tool?pkg_tab=thusaa');
    }
    
    public function webdraw() {
        $this->assign("pagetitle", "Web Draw");
        return $this->fetch();
    }
    
    public function server_time_ajax() {
        if (!IsLogin()) {
            $this->error("Please login first");
        }
        $this->success("OK", null, [
            'server_time' => microtime(true)
        ]);
    }
}
