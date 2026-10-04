<?php
namespace app\exindex\controller;
use app\index\controller\Homebase;
use app\common\traits\NewsBaseTrait;
use app\common\traits\NewsExpTrait;

/**
 * exindex 模块基类
 * 继承 Homebase，课程管理逻辑已由 Globalbasecontroller 统一处理
 * 使用 NewsBaseTrait + NewsExpTrait 提供 course_key 相关的查询过滤钩子方法
 */
class Exindexbase extends Homebase
{
    use NewsBaseTrait, NewsExpTrait;
    
    // ========== 重写钩子方法，注入 course_key 逻辑 ==========
    
    /**
     * 重写：获取查询过滤条件，使用 course_item 表联查
     * @param string $tableName 表名
     * @return array|null 返回联查配置数组 ['join' => ..., 'where' => ...] 或 null（不使用联查）
     */
    protected function getQueryFilter($tableName = '')
    {
        // 需要 course_item 过滤的表
        $courseItemTables = ['news'];
        if(!in_array($tableName, $courseItemTables) || !$this->NOW_COURSE_ID) {
            return null;
        }
        
        // 映射表名到 item 类型和主键字段名
        $itemTypeMap = [
            'news' => ['item' => 'news', 'id_field' => 'news_id']
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
     * 自动应用查询过滤条件（兼容旧接口）
     * @param array $map 现有的查询条件
     * @param string $tableName 表名
     * @return array 合并后的查询条件（如果使用联查，返回原 map，联查条件通过 getQueryFilter 返回）
     */
    protected function applyQueryFilter($map, $tableName = '')
    {
        // 新逻辑：使用 course_item 表联查，不在这里修改 map
        // 调用方需要使用 getQueryFilter 获取联查配置
        return $map;
    }
    
}


