<?php
namespace app\exadmin\controller;
use app\admin\controller\Adminbase;
use app\common\traits\NewsBaseTrait;
use app\common\traits\NewsExpTrait;

/**
 * exadmin 模块基类
 * 继承 Adminbase，课程管理逻辑已由 Globalbasecontroller 统一处理
 * 仅重写钩子方法注入 course_item 到查询和插入操作
 */
class Exadminbase extends Adminbase
{
    use NewsBaseTrait, NewsExpTrait;
    // ========== 重写钩子方法，注入 course_item 逻辑 ==========

    /**
     * 重写：获取查询过滤条件，使用 course_item 表联查
     * @param string $tableName 表名
     * @return array|null 返回联查配置数组 ['join' => ..., 'where' => ...] 或 null（不使用联查）
     */
    protected function getQueryFilter($tableName = '')
    {
        // 需要 course_item 过滤的表
        $courseItemTables = ['contest', 'problem', 'news', 'ex_question'];
        if(!in_array($tableName, $courseItemTables) || !$this->NOW_COURSE_ID) {
            return null;
        }
        
        // 映射表名到 item 类型和主键字段名
        $itemTypeMap = [
            'contest' => ['item' => 'contest', 'id_field' => 'contest_id'],
            'problem' => ['item' => 'problem', 'id_field' => 'problem_id'],
            'news' => ['item' => 'news', 'id_field' => 'news_id'],
            'ex_question' => ['item' => 'ex_question', 'id_field' => 'ex_question_id']
        ];
        
        if(!isset($itemTypeMap[$tableName])) {
            return null;
        }
        
        $itemType = $itemTypeMap[$tableName]['item'];
        $idField = $itemTypeMap[$tableName]['id_field'];
        
        // 返回联查配置
        // 注意：join 条件使用表名，即使添加了别名，表名仍然可以用于 join 条件
        // ThinkPHP 会自动处理表名和别名的映射关系
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
     * 应用查询过滤条件（兼容旧接口）
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
    
    /**
     * 重写：判断新闻分类是否允许当前用户设置
     * news 分类仅 administrator 可设置
     */
    protected function canSetNewsCategory($category)
    {
        // news 分类仅 administrator 可设置
        if($category == 'news') {
            return IsAdmin('administrator');
        }
        // 其他分类允许有权限的用户设置
        return true;
    }
    

    /**
     * 重写：在插入数据后添加 course_item 映射
     * @param array $data 要插入的数据
     * @param string $tableName 表名
     * @param int $insertId 插入后返回的ID
     * @return void
     */
    protected function afterInsertData($data, $tableName = '', $insertId = null)
    {
        // 需要 course_item 映射的表
        $courseItemTables = ['contest', 'problem', 'news', 'ex_question'];
        if(in_array($tableName, $courseItemTables) && $this->NOW_COURSE_ID && $insertId !== null) {
            // 映射表名到 item 类型
            $itemTypeMap = [
                'contest' => 'contest',
                'problem' => 'problem',
                'news' => 'news',
                'ex_question' => 'ex_question'
            ];
            
            if(isset($itemTypeMap[$tableName])) {
                // 插入到 course_item 表
                db('course_item')->insert([
                    'course_id' => $this->NOW_COURSE_ID,
                    'item' => $itemTypeMap[$tableName],
                    'item_id' => $insertId,
                    // 新数据统一使用空字符串（历史数据可能存在 NULL）
                    'pvrole' => ''
                ]);
            }
        }
    }
    
    /**
     * 重写：验证资源是否属于当前课程组
     * @param array $item 资源项
     * @param string $itemType 资源类型（如 'contest', 'problem', 'news', 'ex_question'）
     */
    protected function validateItemBelong($item, $itemType = '')
    {
        // 需要验证 course_item 的资源类型
        $courseItemTypes = ['contest', 'problem', 'news', 'ex_question'];
        if(in_array($itemType, $courseItemTypes)) {
            $this->CourseBelongValidate($item, $itemType);
        }
    }
}
