<?php
namespace app\common\traits;

/**
 * News Exp 模式专有逻辑 Trait
 * 仅包含 exp 模式（OJ_STATUS=exp）的 course_key/course_id 相关筛选逻辑
 * 只在 exadmin 和 exindex 模块使用，确保 admin 和 index 不受影响
 */
trait NewsExpTrait
{
    // ========== exp 模式专有的 course_key 相关方法 ==========

    /**
     * 钩子方法：为 news 表注入 course_item 过滤（供 Adminbase::applyQueryFilterToQuery 使用）
     * 规则：仅 category='news'（系统公告）允许跨课程；其它 news 资源必须要求 NOW_COURSE_ID 并按 course_item 过滤
     *
     * @param string $tableName
     * @return array|null
     */
    protected function getQueryFilter($tableName = '')
    {
        if ($tableName !== 'news') {
            return null;
        }

        // 不允许任何回退：课程资源必须有 NOW_COURSE_ID
        if (!isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
            $this->error('未选择课程组', '/course');
        }

        return $this->buildNewsCourseItemJoinConfig('news');
    }
    
    /**
     * 判断新闻分类是否需要 course_key 筛选（exp 模式专有逻辑）
     * news 分类不做 course_key 筛选（仅 administrator 可设置）
     * notification, answer, cpcinfo 需要 course_key 筛选
     * 
     * @param string $category 新闻分类
     * @return bool true 表示需要 course_key 筛选，false 表示不需要
     */
    protected function needCourseKeyFilterForNewsCategory($category)
    {
        // 仅系统公告（news）不做 course 筛选；其它所有分类都必须按当前课程筛选
        return $category !== 'news';
    }
    
    /**
     * 生成 news 表的 course_item 联查配置
     * @param string $tableAlias 表别名（默认为 'news'，用于 join 条件）
     * @return array|null 返回联查配置数组 ['join' => [...], 'where' => [...]] 或 null
     */
    protected function buildNewsCourseItemJoinConfig($tableAlias = 'news')
    {
        if(!isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
            return null;
        }
        
        return [
            'join' => [
                'course_item ci',
                'ci.item_id = ' . $tableAlias . '.news_id AND ci.item = \'news\'',
                'inner'
            ],
            'where' => [
                'ci.course_id' => $this->NOW_COURSE_ID,
            ],
            // 兼容历史数据：pvrole 可能是 NULL 或空字符串
            'where_func' => function($q) {
                $q->where(function($qq) {
                    $qq->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
                });
            }
        ];
    }
    
    /**
     * 根据分类应用新闻查询过滤条件（exp 模式专有逻辑）
     * news 分类不做 course_item 筛选，其他分类需要 course_item 筛选
     * @param array $map 现有的查询条件
     * @param string $category 新闻分类
     * @return array 返回联查配置数组 ['join' => ..., 'where' => ...] 或原 $map（不使用联查）
     */
    protected function applyCategoryNewsFilter($map, $category)
    {
        // 根据分类决定是否应用 course_item 过滤
        // news 分类不做 course_item 筛选（系统公告）
        if($this->needCourseKeyFilterForNewsCategory($category)) {
            // 不允许任何回退：课程资源必须有 NOW_COURSE_ID
            if (!isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
                $this->error('未选择课程组', '/course');
            }
            $joinConfig = $this->buildNewsCourseItemJoinConfig('news');
            if($joinConfig) {
                return $joinConfig;
            }
        }
        // 返回原 map，保持与 Homebase 的兼容性
        return $map;
    }
    
    /**
     * 获取新闻信息，根据分类决定是否添加 course_item 过滤（exp 模式专有逻辑）
     */
    public function get_news_info()
    {
        $news_id = trim(input('nid'));
        $map = ['news_id' => $news_id];
        if(!IsAdmin('news', $news_id) && !IsCsgStaticPageNewsId($news_id))
            $map['defunct'] = '0';
        
        // 根据分类决定是否使用 course_item 表联查
        $category = input('category/s', '');
        if(empty($category)) {
            // 先查询获取分类
            $news_temp = db('news')->where($map)->field('category')->find();
            if($news_temp) {
                $category = $news_temp['category'];
            }
        }
        
        // 使用统一的查询方法
        $news = $this->queryNewsWithCourseFilter($map, $category);
        
        if($news == null)
        {
            $this->error('No such news.');
        }
        return $news;
    }
    
    /**
     * 统一的新闻查询方法，根据分类决定是否添加 course_item 过滤（exp 模式专有逻辑）
     * @param array $map 查询条件
     * @param string $category 新闻分类
     * @return array|null 查询结果
     */
    protected function queryNewsWithCourseFilter($map, $category)
    {
        if($this->needCourseKeyFilterForNewsCategory($category)) {
            // 不允许任何回退：课程资源必须有 NOW_COURSE_ID
            if (!isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
                $this->error('未选择课程组', '/course');
            }
            $joinConfig = $this->buildNewsCourseItemJoinConfig('n');
            if($joinConfig) {
                // 使用 course_item 表联查
                $query = db('news')->alias('n')
                    ->join($joinConfig['join'][0], $joinConfig['join'][1], $joinConfig['join'][2])
                    ->where($map);
                foreach($joinConfig['where'] as $key => $value) {
                    if($value === null) {
                        // ThinkPHP5.1：NULL 条件必须用 whereNull/whereRaw
                        if(strpos($key, '.') !== false) {
                            $query->whereRaw($key . ' IS NULL');
                        } else {
                            $query->whereNull($key);
                        }
                    } else {
                        $query->where($key, $value);
                    }
                }
                if (isset($joinConfig['where_func']) && is_callable($joinConfig['where_func'])) {
                    $func = $joinConfig['where_func'];
                    $func($query);
                }
                return $query->find();
            }
        }
        // 不使用 course_item 过滤
        return db('news')->where($map)->find();
    }
    
    /**
     * 查询新闻详情，根据分类决定是否添加 course_item 过滤（exp 模式专有逻辑）
     * @param array $map 查询条件
     * @param string $category 新闻分类
     * @return array|null 查询结果
     */
    protected function queryNewsDetail($map, $category)
    {
        // 使用统一的查询方法
        return $this->queryNewsWithCourseFilter($map, $category);
    }
}





