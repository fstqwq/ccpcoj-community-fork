<?php
/**
 * Created by PhpStorm.
 * User: CSGrandeur
 * Date: 2017/3/3
 * Time: 21:15
 */
namespace app\index\controller;
use think\Controller;
use \Globalbasecontroller;
class Homebase extends Globalbasecontroller
{
    var $staticPage;
    var $maxTag;
    var $tagLength;
    var $category;
    var $pagetitle;

    public function initialize()
    {
        $this->OJMode();
        $this->BaseInit();
    }
    public function MakePageTitle()
    {
        $this->assign('pagetitle', $this->pagetitle = $this->OJ_NAME . ' Home Page');
    }
    public function BaseInit()
    {
        $this->staticPage         = config('CsgcpcConst.STATIC_PAGE');
        $this->maxTag             = config('CsgcpcConst.MAX_TAG');
        $this->tagLength         = config('CsgcpcConst.TAG_LENGTH');
        $this->category            = strtolower($this->request->controller());
        $this->assign([
            'staticPage'     => $this->staticPage,
            'maxTag'        => $this->maxTag,
            'tagLengh'        => $this->tagLength,
            'category'        => $this->category,
        ]);
        $this->MakePageTitle();
    }
    public function index()
    {
        return $this->fetch('public/news_list');
    }
    public function get_news_info()
    {
        $news_id = trim(input('nid'));
        $map = ['news_id' => $news_id];
        if(!IsAdmin('news', $news_id) && !IsCsgStaticPageNewsId($news_id))
            $map['defunct'] = '0';
        $news = db('news')->where($map)->find();
        if($news == null)
        {
            $this->error('No such news.');
        }
        return $news;
    }
    public function category_news_list_ajax()
    {
        $News = db('news');
        $category = strtolower($this->category);
        $map = [
            'category' => $category,
            'defunct'  => '0'
        ];
        // 应用查询过滤钩子（exindex 模块会重写此方法应用 course_key 筛选）
        $filterResult = $this->applyCategoryNewsFilter($map, $category);
        
        // 处理过滤结果：可能是配置数组（包含 join 和 where）或普通数组
        if (is_array($filterResult) && isset($filterResult['join']) && isset($filterResult['where'])) {
            // 返回的是联查配置数组
            $joinConfig = $filterResult['join'];
            $whereConditions = $filterResult['where'];
            $whereFunc = $filterResult['where_func'] ?? null;
            
            // 设置别名并应用 join
            $News = $News->alias('news')
                ->join($joinConfig[0], $joinConfig[1], $joinConfig[2]);
        } else {
            // 返回的是普通数组（原 map 或处理后的 map），直接使用
            $map = $filterResult;
        }
        
        // ThinkPHP5.1：NULL 条件不能用 ['field'=>null] 合并进 map，需要 whereNull/whereRaw
        $News = $News->where($map);
        if (isset($whereConditions) && is_array($whereConditions)) {
            foreach($whereConditions as $key => $value) {
                if($value === null) {
                    if(strpos($key, '.') !== false) {
                        $News->whereRaw($key . ' IS NULL');
                    } else {
                        $News->whereNull($key);
                    }
                } else {
                    $News->where($key, $value);
                }
            }
        }
        if (isset($whereFunc) && is_callable($whereFunc)) {
            $whereFunc($News);
        }
        
        $newsList = $News
            ->order('news_id', 'desc')
            ->field('content', true)
            ->select();
        return $newsList;
    }
    
    /**
     * 钩子方法：根据分类应用新闻查询过滤条件
     * exindex 模块会通过 NewsExpTrait 重写此方法，对特定分类应用 course_key 筛选
     * @param array $map 现有的查询条件
     * @param string $category 新闻分类
     * @return array 处理后的查询条件
     */
    protected function applyCategoryNewsFilter($map, $category)
    {
        // index 模块：默认不应用 course_key 筛选
        // exindex 模块：通过 NewsExpTrait 对特定分类应用 course_key 筛选
        return $map;
    }
    public function detail()
    {
        $nid = input('nid/d');
        $category = strtolower($this->category);
        $map = [
            'news_id' => $nid,
            'category' => $category
        ];
        if(!IsAdmin('news', $nid) && !IsCsgStaticPageNewsId($nid))
            $map['defunct'] = '0';
        
        // 使用统一的查询方法（如果子类提供了的话）
        $news = $this->queryNewsDetail($map, $category);
        
        if(!$news)
            $this->error('No such article of id ' . $nid);
        $this->assign('news', $news);
        $this->assign('pagetitle', $this->pagetitle . "-$nid-" . $news['title']);
        return $this->fetch('public/news_detail');
    }
    
    /**
     * 查询新闻详情（钩子方法，子类可重写）
     * @param array $map 查询条件
     * @param string $category 新闻分类
     * @return array|null 查询结果
     */
    protected function queryNewsDetail($map, $category)
    {
        // 默认查询方式（兼容旧逻辑）
        $map = $this->applyQueryFilter($map, 'news');
        return db('news')->where($map)->find();
    }
    
    /**
     * 钩子方法：获取查询过滤条件
     * exindex 模块会通过 Exindexbase 重写此方法注入 course_key 过滤
     * @param string $tableName 表名
     * @return array 额外的查询条件数组
     */
    protected function getQueryFilter($tableName = '')
    {
        return [];  // index 中返回空，exindex 中通过 Exindexbase 返回 course_key 过滤
    }
    
    /**
     * 自动应用查询过滤条件到 $map
     * @param array $map 现有的查询条件
     * @param string $tableName 表名
     * @return array 合并后的查询条件
     */
    protected function applyQueryFilter($map, $tableName = '')
    {
        $filter = $this->getQueryFilter($tableName);
        if (!empty($filter)) {
            $map = array_merge($map, $filter);
        }
        return $map;
    }
    
    
    /**
     * 新闻列表 AJAX 接口（基类方法，子类可重写）
     * 返回原始数据，title 的链接由前端 formatter 生成
     */
    public function news_list_ajax()
    {
        $data     = [];
        $limit    = input('limit', 10);
        $offset    = input('offset', 0);
        $sort    = input('sort', 'news_id');
        $sort = validate_item_range($sort, ['news_id']);
        $order    = input('order', 'desc');
        $search    = input('search', '');

        // exindex 规则：
        // - 仅系统公告（category='news'）不按课程过滤，所有课程都可见
        // - 其它所有分类必须按当前课程（NOW_COURSE_ID）过滤，不允许跨课程看到“课程资源”
        if ($this->request->module() === 'exindex') {
            if (!isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
                $this->error('未选择课程组', '/course');
            }

            // 公告（news）不做 course 过滤
            $newsQuery = db('news')
                ->where('defunct', '=', '0')
                ->where('news_id', '>', 1000)
                ->where('category', '=', 'news');

            // 其它分类：做 course_item 过滤（通过 exindex 的 getQueryFilter('news') 注入）
            $otherQuery = db('news')->alias('news')
                ->where('news.defunct', '=', '0')
                ->where('news.news_id', '>', 1000)
                ->where('news.category', '<>', 'news');

            $filter = method_exists($this, 'getQueryFilter') ? $this->getQueryFilter('news') : null;
            if (is_array($filter) && isset($filter['join']) && isset($filter['where'])) {
                $joinConfig = $filter['join'];
                $otherQuery->join($joinConfig[0], $joinConfig[1], $joinConfig[2] ?? 'inner');
                foreach ($filter['where'] as $key => $value) {
                    if ($value === null) {
                        if (strpos($key, '.') !== false) {
                            $otherQuery->whereRaw($key . ' IS NULL');
                        } else {
                            $otherQuery->whereNull($key);
                        }
                    } else {
                        $otherQuery->where($key, $value);
                    }
                }
                if (isset($filter['where_func']) && is_callable($filter['where_func'])) {
                    $func = $filter['where_func'];
                    $func($otherQuery);
                }
            }

            // 搜索条件：对两个子查询都生效
            if (strlen(trim($search)) > 0) {
                $like = "%$search%";
                $newsQuery->where(function($q) use ($search, $like) {
                    $q->where('title', 'like', $like)
                      ->whereOr('user_id', 'like', $like)
                      ->whereOr('news_id', '=', $search);
                });
                $otherQuery->where(function($q) use ($search, $like) {
                    $q->where('news.title', 'like', $like)
                      ->whereOr('news.user_id', 'like', $like)
                      ->whereOr('news.news_id', '=', $search);
                });
            }

            // 拉取数据：先合并再排序分页（数据量通常不大；避免构造 UNION 兼容问题）
            $newsList = $newsQuery->field(true)->select();
            $otherList = $otherQuery->field('news.*')->select();
            $list = array_merge($newsList ?: [], $otherList ?: []);

            // 排序
            usort($list, function($a, $b) use ($sort, $order) {
                $va = $a[$sort] ?? null;
                $vb = $b[$sort] ?? null;
                $cmp = ($va <=> $vb);
                return strtolower($order) === 'asc' ? $cmp : -$cmp;
            });

            // 分页
            $list = array_slice($list, intval($offset), intval($limit));

            // 总数：公告全量 + 课程内其它分类
            $total = intval($newsQuery->count()) + intval($otherQuery->count('news.news_id'));
            $data["total"] = $total;
        } else {
            // index 模块：保持原逻辑（不过滤）
            // ThinkPHP 5.1 Query 有状态：不要复用同一个 Query 对象做 list 和 total 两次独立查询
            $buildQuery = function() use ($search) {
                $q = db('news')
                    ->where('defunct', '=', '0')
                    ->where('news_id', '>', 1000);
                if (strlen(trim($search)) > 0) {
                    $q->where(function($query) use ($search) {
                        $like = "%$search%";
                        $query->where('title', 'like', $like)
                              ->whereOr('user_id', 'like', $like)
                              ->whereOr('news_id', '=', $search);
                    });
                }
                return $q;
            };

            $list = $buildQuery()
                ->order([$sort=>$order])
                ->limit("$offset,$limit")
                ->select();

            // 计算总数（与列表筛选条件保持一致）
            $data["total"] = $buildQuery()->count();
        }
        
        // 不再在后端生成 title 的 <a> 标签，由前端 formatter 处理
        // 但保留原始 title 数据，供前端使用
        
        $data['recordsFiltered'] = count($list);
        $data['order'] = $order;
        $data["rows"] = $list;
        return $data;
    }
}