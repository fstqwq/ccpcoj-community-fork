<?php
namespace app\exadmin\controller;
use app\admin\controller\News as AdminNews;
use app\common\traits\NewsExpTrait;

/**
 * exadmin News 控制器
 * 继承 admin/News，使用 NewsExpTrait 提供 exp 相关的 course_key 逻辑
 * 通过重写钩子方法处理 exp 相关的业务逻辑，不重写 news_list_ajax
 */
class News extends AdminNews
{
    use NewsExpTrait;
    
    /**
     * 初始化方法：考试模式下自动跳转到考题列表
     */
    public function initialize()
    {
        parent::initialize();
        // 考试模式（OJ_MODE=cpcsys，OJ_STATUS=exp）下隐藏 news 模块，自动跳转到考题列表
        if($this->OJ_MODE == 'cpcsys' && $this->OJ_STATUS == 'exp') {
            $this->redirect('/exadmin/question/question_list');
        }
    }
    
    /**
     * 重写钩子方法：获取新闻列表
     * 处理 exp 相关的业务逻辑：
     * - news 分类（系统公告）：administrator 永久可见，不受 course_key 限制
     * - 其他分类：需要 course_key 筛选
     * - 未指定分类（全部）：需要特殊处理（合并查询结果）
     */
    protected function getNewsList($map, $category_filter, $columns, $ordertype, $offset, $limit)
    {
        $News = db('news');
        $isAdministrator = IsAdmin('administrator');
        
        // 如果指定了分类
        if($category_filter != -1) {
            // news 分类：administrator 永久可见，不受 course_key 限制
            if($category_filter == 'news') {
                // administrator 可以看到所有 news，不需要 course_key 筛选
                $News->where($map);
            } else {
                // 其它所有分类：必须按当前课程过滤（不允许跨课程看到课程资源）
                $News = $this->applyQueryFilterToQuery($News, $map, 'news');
            }
            return $News
                ->field(implode(",", $columns))
                ->order($ordertype)
                ->limit($offset, $limit)
                ->select();
        } else {
            // 未指定分类（全部）：需要特殊处理
            // administrator 可以看到所有 news（系统公告），其他分类需要 course_key 筛选
            if($isAdministrator) {
                // administrator：可以看到所有 news，其他分类需要 course_key 筛选
                // 先查询 news 分类的所有记录
                $newsMap = $map;
                $newsMap[] = ['category', '=', 'news'];
                $newsListNews = db('news')
                    ->where($newsMap)
                    ->field(implode(",", $columns))
                    ->select();
                
                // 再查询其他分类的 course_key 筛选记录
                $otherMap = $map;
                $otherMap[] = ['category', '<>', 'news'];
                $otherQuery = $this->applyQueryFilterToQuery(db('news'), $otherMap, 'news');
                $newsListOther = $otherQuery
                    ->field(implode(",", $columns))
                    ->select();
                
                // 合并两个查询结果
                $newsList = array_merge($newsListNews, $newsListOther);
                
                // 手动排序和分页
                if(!empty($ordertype)) {
                    $sort = array_key_first($ordertype);
                    $order = $ordertype[$sort] ?? 'desc';
                    usort($newsList, function($a, $b) use ($sort, $order) {
                        $valA = $a[$sort] ?? '';
                        $valB = $b[$sort] ?? '';
                        if($order == 'asc') {
                            return $valA <=> $valB;
                        } else {
                            return $valB <=> $valA;
                        }
                    });
                }
                return array_slice($newsList, $offset, $limit);
            } else {
                // 非 administrator：只查询需要 course_key 筛选的分类
                $map[] = ['category', '<>', 'news'];
                $News = $this->applyQueryFilterToQuery($News, $map, 'news');
                return $News
                    ->field(implode(",", $columns))
                    ->order($ordertype)
                    ->limit($offset, $limit)
                    ->select();
            }
        }
    }
    
    /**
     * 重写钩子方法：获取新闻列表总数
     * 处理 exp 相关的业务逻辑（合并统计等）
     */
    protected function getNewsListTotal($total_map, $category_filter)
    {
        $isAdministrator = IsAdmin('administrator');
        
        // 如果指定了分类
        if($category_filter != -1) {
            // news 分类：administrator 永久可见，不受 course_key 限制
            if($category_filter == 'news') {
                // administrator 可以看到所有 news，不需要 course_key 筛选
                return db('news')->where($total_map)->count();
            } else {
                // 其它所有分类：必须按当前课程过滤（不允许跨课程看到课程资源）
                $NewsTotal = $this->applyQueryFilterToQuery(db('news'), $total_map, 'news');
                return $NewsTotal->count();
            }
        } else {
            // 未指定分类（全部）：需要特殊处理
            if($isAdministrator) {
                // administrator：可以看到所有 news，其他分类需要 course_key 筛选
                // 先统计 news 分类的数量
                $newsTotalMap = $total_map;
                $newsTotalMap[] = ['category', '=', 'news'];
                $newsCount = db('news')->where($newsTotalMap)->count();
                
                // 再统计其他分类的 course_key 筛选数量
                $otherTotalMap = $total_map;
                $otherTotalMap[] = ['category', '<>', 'news'];
                $otherNewsTotal = $this->applyQueryFilterToQuery(db('news'), $otherTotalMap, 'news');
                $otherCount = $otherNewsTotal->count();
                
                return $newsCount + $otherCount;
            } else {
                // 非 administrator：只统计需要 course_key 筛选的分类
                $total_map[] = ['category', '<>', 'news'];
                $NewsTotal = $this->applyQueryFilterToQuery(db('news'), $total_map, 'news');
                return $NewsTotal->count();
            }
        }
    }
}
