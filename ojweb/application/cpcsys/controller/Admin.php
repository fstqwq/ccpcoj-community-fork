<?php
namespace app\cpcsys\controller;
use think\Db;
use think\facade\Validate;
use app\cpcsys\controller\Contest as Contestbase;
require_once(__DIR__ . "../../../common/traits/ContestAdminBaseTrait.php");
use app\common\traits\ContestAdminBaseTrait;
class Admin extends Contestbase
{
    use ContestAdminBaseTrait;
    
    // teamgen_list_ajax, team_list_ajax, team_modify, teaminfo_ajax, team_modify_ajax, 
    // IpCheckAuth, ipcheck, ipcheck_ajax, contest_teamgen, contest_staffgen, 
    // contest_teamgen_ajax, generateSeededPassword, ClearTeam, team_del_ajax,
    // rank_team_image, team_image_list_ajax, team_image_upload_ajax, team_image_del_ajax,
    // client_manage, contest_client_list_ajax, contest_client_save_ajax, contest_client_del_ajax,
    // updateContestAddition, contest_collect_mode_toggle_ajax 方法已通过 ContestAdminBaseTrait 提供

    /**
     * ICPC CCS Contest API 说明与请求测试（仅 cpcsys 比赛后台）
     */
    public function ccs_api_console()
    {
        $cid = intval($this->contest['contest_id'] ?? 0);
        if ($cid <= 0) {
            $this->error('invalid contest');
        }
        $this->redirect('/' . $this->module . '/contest/ccs_api_console?cid=' . $cid);
    }

    public function TeamDel($teamStr)
    {
        if(!isset($teamStr) || strlen($teamStr) == 0)
            $this->error("No team prefix set");
        $Users = db('users');
        $Solution = db('solution');
        // TP5.1：避免 where(['field'=>['like', ...]]) 这种 TP5.0 风格数组写法，统一使用显式 where
        $teamList = $Users->where('user_id', 'like', $teamStr . '%')->select();
        $teamToShow = [];
        foreach($teamList as $team)
        {
            if(!$Solution->where('user_id', $team['user_id'])->find())
                $Users->where('user_id', $team['user_id'])->delete();
            else {
                $team['password'] = "__UNKNOWN__";
                $teamToShow[] = $team;
            }
        }
        $this->success('Team names [' . $teamStr . '%] without submissions deleted.', null, ['rows' => $teamToShow, 'type' => 'teamdel']);
    }
}