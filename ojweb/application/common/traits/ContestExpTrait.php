<?php
/**
 * 实验考试系统 Trait
 * 提供 expsys 和 examsys 模块的特化逻辑，主要是 course 筛选逻辑
 * 
 * 使用 ContestBaseTrait，重载 hook 方法实现 course_key 相关的查询过滤和插入逻辑
 * 用于 expsys、examsys、exadmin 模块
 */
namespace app\common\traits;

trait ContestExpTrait
{
    // 使用 ContestBaseTrait，自动包含所有基础方法
    // 并为“子类覆写策略”提供一个稳定的父实现入口（避免在子类里误用 parent:: 指向 Controller/Base）
    use ContestBaseTrait {
        getContestAccessPolicy as protected baseGetContestAccessPolicy;
    }
    
    /**
     * 实验考试系统特有的初始化
     * 在 ContestInit 之后调用
     */
    public function ContestInitExp()
    {
        // 初始化 teamSessionName（如果已获取 contest 信息）
        if(isset($this->contest) && isset($this->contest['contest_id'])) {
            $this->teamSessionName = '#cpcteam' . $this->contest['contest_id'];
        }
    }
    
    // ========== 重载 Hook 方法，实现 course 筛选逻辑 ==========
    
    /**
     * 重载：获取查询过滤条件，使用 course_item 表联查
     * @param string $tableName 表名
     * @return array|null 返回联查配置数组 ['join' => ..., 'where' => ...] 或 null（不使用联查）
     */
    protected function getQueryFilter($tableName = '')
    {
        // 需要 course_item 过滤的表
        $courseItemTables = ['contest'];
        if(!in_array($tableName, $courseItemTables) || !isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
            return null;
        }
        
        // 映射表名到 item 类型和主键字段名
        $itemTypeMap = [
            'contest' => ['item' => 'contest', 'id_field' => 'contest_id']
        ];
        
        if(!isset($itemTypeMap[$tableName])) {
            return null;
        }
        
        $itemType = $itemTypeMap[$tableName]['item'];
        $idField = $itemTypeMap[$tableName]['id_field'];
        
        // 返回联查配置
        return [
            'join' => [
                'course_item ci',
                'ci.item_id = ' . $tableName . '.' . $idField . ' AND ci.item = \'' . $itemType . '\'',
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
     * 重载：自动应用查询过滤条件到查询对象
     * @param \think\db\Query $query 查询对象
     * @param array $map 现有的查询条件
     * @param string $tableName 表名
     * @return \think\db\Query 处理后的查询对象
     */
    protected function applyQueryFilterToQuery($query, $map, $tableName = '')
    {
        $filter = $this->getQueryFilter($tableName);
        if ($filter && is_array($filter)) {
            // 如果返回的是联查配置
            if(isset($filter['join']) && isset($filter['where'])) {
                // 先应用 $map 中的查询条件（包含 ThinkPHP 查询语法）
                $query->where($map);
                // 应用联查
                $joinConfig = $filter['join'];
                $query->join($joinConfig[0], $joinConfig[1], $joinConfig[2] ?? 'inner');
                // 应用 filter 的 where 条件（course_item 表的条件）
                foreach($filter['where'] as $key => $value) {
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
                // 支持额外闭包条件（例如：pvrole 兼容 NULL 或空字符串）
                if (isset($filter['where_func']) && is_callable($filter['where_func'])) {
                    $func = $filter['where_func'];
                    $func($query);
                }
            } else {
                // 兼容旧逻辑：简单的 where 条件
                $map = array_merge($map, $filter);
                $query->where($map);
            }
        } else {
            // 没有 filter，直接应用 $map
            $query->where($map);
        }
        return $query;
    }
    
    /**
     * 重载：在插入数据前添加额外字段
     * exp 系统：注入 course_key 等字段
     * @param array $data 要插入的数据
     * @param string $tableName 表名
     * @return array 处理后的数据
     */
    protected function prepareInsertData($data, $tableName = '')
    {
        // exp 系统：如果需要 course_key，在这里注入
        // 注意：contest 表不直接存储 course_key，而是通过 course_item 表关联
        // 所以这里可能不需要修改，具体取决于业务需求
        return $data;
    }
    
    /**
     * 重载：在插入数据后添加 course_item 映射
     * exp 系统：插入 course_item 映射
     * @param array $data 插入的数据
     * @param string $tableName 表名
     * @param int $insertId 插入后返回的ID
     * @return void
     */
    protected function afterInsertData($data, $tableName = '', $insertId = null)
    {
        // 需要 course_item 映射的表
        $courseItemTables = ['contest'];
        if(!in_array($tableName, $courseItemTables) || !isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
            return;
        }
        
        // 映射表名到 item 类型和主键字段名
        $itemTypeMap = [
            'contest' => ['item' => 'contest', 'id_field' => 'contest_id']
        ];
        
        if(!isset($itemTypeMap[$tableName])) {
            return;
        }
        
        $itemType = $itemTypeMap[$tableName]['item'];
        $idField = $itemTypeMap[$tableName]['id_field'];
        
        // 获取插入的ID（优先使用参数，否则从数据中获取）
        $itemId = $insertId;
        if($itemId === null && isset($data[$idField])) {
            $itemId = $data[$idField];
        }
        
        if($itemId === null) {
            return;
        }
        
        // 插入 course_item 映射
        db('course_item')->insert([
            'course_id' => $this->NOW_COURSE_ID,
            'item' => $itemType,
            'item_id' => $itemId,
            'pvrole' => null
        ]);
    }
    
    /**
     * 重载：在更新数据前添加额外字段（如果需要）
     * exp 系统：可能需要验证 course_key
     * @param array $data 要更新的数据
     * @param string $tableName 表名
     * @return array 处理后的数据
     */
    protected function prepareUpdateData($data, $tableName = '')
    {
        // exp 系统：如果需要验证 course_key，在这里处理
        return $data;
    }
    
    /**
     * 重载：验证资源归属（用于验证 course_key 等）
     * exp 系统：验证 course_key
     * @param array $item 资源数据
     * @param string $itemType 资源类型
     * @return void
     */
    protected function validateItemBelong($item, $itemType = '')
    {
        // exp 系统：验证资源是否属于当前课程
        if(!isset($this->NOW_COURSE_ID) || !$this->NOW_COURSE_ID) {
            return;
        }
        
        $courseItemTables = ['contest'];
        if(!in_array($itemType, $courseItemTables)) {
            return;
        }
        
        $itemTypeMap = [
            'contest' => ['item' => 'contest', 'id_field' => 'contest_id']
        ];
        
        if(!isset($itemTypeMap[$itemType])) {
            return;
        }
        
        $itemTypeName = $itemTypeMap[$itemType]['item'];
        $idField = $itemTypeMap[$itemType]['id_field'];
        
        if(!isset($item[$idField])) {
            return;
        }
        
        // 检查 course_item 映射是否存在
        $courseItem = db('course_item')->where([
            'course_id' => $this->NOW_COURSE_ID,
            'item' => $itemTypeName,
            'item_id' => $item[$idField],
        ])->where(function($q) {
            $q->whereNull('pvrole')->whereOr('pvrole', '');
        })->find();
        
        if(!$courseItem) {
            $this->error('资源不属于当前课程 / Resource does not belong to current course');
        }
    }
}
