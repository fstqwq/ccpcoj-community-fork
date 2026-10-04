<?php
namespace app\exadmin\controller;
use app\admin\controller\Contestsummary as AdminContestsummary;

/**
 * exadmin Contestsummary 控制器
 * 继承 admin/Contestsummary，复用比赛统计归档逻辑
 * 需要重写部分方法以修正 URL 路径
 */
class Contestsummary extends AdminContestsummary
{
    /**
     * 练习模式（online-exp）统计归档权限：
     * - 课程教师/课程管理员/全局管理员/练习编辑 可访问
     */
    protected function BaseAuth()
    {
        if($this->OJ_MODE != 'online' || $this->OJ_STATUS != 'exp') {
            $this->error('统计归档仅适用于练习模式', '/');
        }
        if(!IsAdmin('administrator') && !IsAdmin('contest_editor') && !PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
            $this->error('无管理权限', '/');
        }
    }

    public function contest_summary()
    {
        $this->BaseAuth();
        $this->assign('pagetitle', '统计归档');
        return $this->fetch();
    }

    /**
     * 重写：修正 URL 路径为 exadmin 模块
     * 增加鉴权：教师只能归档自己管辖的班级的练习，管理员可以对任意班级归档
     */
    public function contest_summary_ajax() {
        $this->BaseAuth();
        $cidList = explode("\n", trim(input('cid_list/s')));
        $cidList = array_values(array_filter(array_map('trim', $cidList), function($v) {
            return $v !== '';
        }));
        $cidList = array_values(array_unique($cidList));

        if(count($cidList) > 64) {
            $this->error("Too many contests.");
        }
        foreach($cidList as $cid) {
            if(!preg_match('/^\d{1,10}$/', $cid)) {
                $this->error("Contest ID list format invalid.");
            }
        }

        // ThinkPHP 5.1：使用显式 where 链式写法，避免数组条件解析差异
        $contestList = db('contest')
            ->where('contest_id', 'in', $cidList)
            ->where('private', 'in', [0,1,4,10,11,14])
            ->select();
        
        // 鉴权检查：教师只能归档自己管辖的班级的练习，管理员可以对任意班级归档
        $is_global_admin = IsAdmin();
        $is_course_admin = PrivCourse('admin', $this->NOW_COURSE_KEY);
        $is_teacher_only = !$is_global_admin && !$is_course_admin && PrivCourse('teacher', $this->NOW_COURSE_KEY);
        
        if($is_teacher_only) {
            // 教师：检查所有练习是否都属于自己管辖的班级
            $user_id = session('user_id');
            $pvrole_teacher = GetPvroleConfig('clss_teacher', 'teacher');
            
            // 提取所有涉及的班级ID
            $clss_ids = [];
            foreach($contestList as $contest) {
                if(isset($contest['clss_id']) && intval($contest['clss_id']) > 0) {
                    $clss_ids[intval($contest['clss_id'])] = true;
                }
            }
            $clss_ids = array_keys($clss_ids);
            
            if(!empty($clss_ids)) {
                // 检查用户是否是这些班级的教师
                // ThinkPHP 5.1：在数组 where 中，IN 查询需要使用链式调用
                $teacher_clss_ids = db('privilege_item')
                    ->where('rightitem', 'clss')
                    ->where('item_id', 'in', $clss_ids)
                    ->where('user_id', $user_id)
                    ->where('pvrole', $pvrole_teacher)
                    ->where('defunct', '0')
                    ->column('item_id');
                
                // 检查是否所有班级都是该教师的管辖班级
                $unauthorized_clss_ids = array_diff($clss_ids, $teacher_clss_ids);
                if(!empty($unauthorized_clss_ids)) {
                    $this->error("您只能归档自己管辖的班级的练习。班级ID: " . implode(', ', $unauthorized_clss_ids));
                }
            }
        }

        $this->synScore = [];
        $this->GetConfigs();
        set_time_limit(180); // 有些数据比较大，可能需要压缩久一点，php默认30秒超时，所以这里改一下
        foreach($contestList as $contest) {
            $this->SummaryOneContest($contest);
        }
        $totalSynScoreStr = $this->SummarySynScore($contestList);
        $this->WriteMd("", $totalSynScoreStr, "total_syn_score", true);
        $this->ZipContestFiles();
        // 修正 URL 为 exadmin 模块
        $this->success("ok", "/exadmin/contestsummary/download?file=" . $this->taskName . ".zip");
    }

    /**
     * exadmin：文件列表统一返回 ThinkPHP success 格式，便于前端 responseHandler 处理
     */
    public function summary_file_list_ajax()
    {
        $this->BaseAuth();
        // 保险：确保父类配置已加载（避免某些 action 路径下未触发 _initialize 的情况）
        $this->GetConfigs();
        $list = parent::summary_file_list_ajax();
        return $this->success('ok', null, $list);
    }

    public function download()
    {
        $this->BaseAuth();
        $this->GetConfigs();
        return parent::download();
    }

    public function delete()
    {
        $this->BaseAuth();
        $this->GetConfigs();
        return parent::delete();
    }
}
