<?php
namespace app\csgoj\controller;
use think\Db;
use think\Controller;
class Userrank extends Csgojbase
{
    public function index()
    {
        $this->assign(['pagetitle' => 'User Rank']);
        return $this->fetch();
    }
    public function userrank_ajax()
    {
        $offset = input('offset/d');
        $limit  = input('limit/d');
        $search = trim(input('search/s'));

        // 只查询user_id长度不少于5的用户
        $whereRaw = 'CHAR_LENGTH(user_id) >= 5';

        $ret = [];

        // 构建基准查询（注意：Query 对象是可变的，count/rows 必须使用不同实例或 clone）
        $baseQuery = db('users')->whereRaw($whereRaw);
        if(strlen($search) > 0) {
            $like = "%{$search}%";
            $baseQuery->where(function($q) use ($like) {
                // OR 条件必须包在同一个闭包里，避免污染外层 where
                $q->whereOr('user_id', 'like', $like)
                  ->whereOr('nick', 'like', $like)
                  ->whereOr('school', 'like', $like);
            });
        }

        // total：使用 clone，避免被 limit/order/cache 影响
        $countQuery = clone $baseQuery;
        $ret['total'] = $countQuery->count();

        // rows
        $userlist = $baseQuery
            ->field('user_id, nick, school, solved, submit')
            ->order(['solved' => 'desc', 'submit' => 'asc', 'user_id' => 'asc'])
            ->limit($offset, $limit)
            ->cache('userrank_'.$offset.'_'.$limit.'_'.$search, 60)
            ->select();
        
        $ret['order'] = 'desc';
        $ret['rows'] = $userlist;
        return $ret;
    }
}
