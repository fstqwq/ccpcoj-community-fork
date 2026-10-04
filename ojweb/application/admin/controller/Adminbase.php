<?php
namespace app\admin\controller;
use think\Controller;
use \Globalbasecontroller;
class Adminbase extends Globalbasecontroller
{
    var $privilegeName;         // 该controller对应的权限名称字符串，problem_editor
    var $privilegeStr;          // controller名字和对应权限名字一致
    var $ojAdminList;           // problem_editor 映射为网页显示的 Problem Editor 的映射表
    var $inputInfo;             // 子类会用到的输入信息
    public function initialize()
    {
        $this->OJMode();
        $this->AdminInit();
        $this->InitController();
    }
    public function AdminInit()
    {
        $this->ojAdminList    = $this->OJ_ADMIN['OJ_ADMIN_LIST'];

        $this->assign('pagetitle', 'Admin ' . ucfirst($this->request->controller()));
        $this->assign('controller', strtolower($this->request->controller()));
        $this->assign('ojAdminList', $this->ojAdminList);

        if(!IsLogin()) {
            $this->error('Please loggin first.', '/', null, 1);
        }

        // controller名字和对应权限名字一致，以后要修改admin代码结构时，这里要注意！！！
        $this->privilegeStr = strtolower($this->request->controller());

        // 支持的资源类型：problem、contest、news、course
        $supported_items = ['problem', 'contest', 'news', 'course'];
        if(in_array($this->privilegeStr, $supported_items)) {
            $this->BaseAuthentication($this->privilegeStr);
        }
//        else if(!IsAdmin('administrator') && strtolower($this->request->action()) != 'index')
//            $this->error('You are not admin', '/');
    }
    public function BaseAuthentication($privilegeStr)
    {
        // 支持的资源类型：problem、contest、news、course、ex_question
        // ex_question（考试题）本身不走 privilege_item(rightitem=ex_question)，而是归属由 course_item 维护，
        // 因此这里只做“模块级别”放通判断：用户只要拥有任意课程的 teacher/admin/super（或全局管理员/编辑权限）即可进入。
        $supported_items = ['problem', 'contest', 'news', 'course', 'ex_question'];
        if(!in_array($privilegeStr, $supported_items)) {
            $this->error('No such work like "' . $privilegeStr . '"');
        }
        
        // 对于模块级别的权限检查，需要检查用户是否有任意该类型资源的权限
        // 或者检查是否是全局管理员
        if(!IsAdmin('administrator')) {
            $user_id = session('user_id');

            // ex_question：模块级权限 = 任意课程 teacher/admin/super，或拥有全局编辑权限（problem/contest_editor）
            if($privilegeStr === 'ex_question') {
                if(IsAdmin('super_admin') || IsAdmin('problem_editor') || IsAdmin('contest_editor')) {
                    return;
                }
                $has_any_privilege = db('privilege_item')
                    ->where([
                        ['user_id', '=', $user_id],
                        ['rightitem', '=', 'course']
                    ])
                    ->where('pvrole', 'in', ['teacher', 'admin', 'super'])
                    ->count() > 0;
            } else {
                // 检查用户是否有该类型资源的任意权限（通过检查是否有任何 privilege_item 记录）
                $pvroles = ($privilegeStr === 'course') ? ['admin', 'super', 'teacher'] : ['admin'];
                $has_any_privilege = db('privilege_item')
                    ->where([
                        ['user_id', '=', $user_id],
                        ['rightitem', '=', $privilegeStr],
                    ])
                    ->where('pvrole', 'in', $pvroles)
                    ->count() > 0;
            }
            
            if(!$has_any_privilege) {
                $this->error("You don't have this privilege", '/'.$this->request->module(), '', 1);
        }
        }
    }
    /**
     * 重写 AddPrivilege 方法，使用全局函数（统一管理）
     * admin 模式使用严格模式（checkPrivilege=true），需要检查权限
     */
    public function AddPrivilege($user_id, $item, $id)
    {
        try {
            // admin 模式：严格检查权限（资源已存在，需要验证权限）
            AddPrivilege($user_id, $item, $id, true, 'admin');
        } catch (\Exception $e) {
            $this->error($e->getMessage());
        }
    }
    protected function AttachFolderCalculation($randStr = '')
    {
        //为了题目导入导出不影响附件路径，用固定文件夹名存数据库
        $day = date('y-m-d');
        $uuid = GenerateUuidV4();
        return $day . '-' . $uuid;
    }
    public function GetCooperator($item_id)
    {
        //获取 item 的合作者列表
        // 使用 PrivItem 检查权限
        if(!PrivItem($this->privilegeStr, $item_id, 'admin')) {
            $this->error('Permission denied to get cooperator');
        }
        // 直接使用资源类型（$this->privilegeStr 已经是 news/problem/contest）
        $rightitem = $this->privilegeStr;
        if(in_array($rightitem, ['news', 'problem', 'contest'])) {
            // 使用 admin 权限
            return db('privilege_item')->where([
                'rightitem' => $rightitem,
                'item_id' => $item_id,
                'pvrole' => 'admin'
            ])->column('user_id');
        }
        return [];
    }
    public function SaveCooperator($cooperator, $item_id)
    {
        //获取 item 的合作者列表
        // 使用 PrivItem 检查权限
        if(!PrivItem($this->privilegeStr, $item_id, 'admin')) {
            $this->error('Permission denied to save cooperator');
        }
        $userIdList = [];
        $insertList = [];
        $retInfo = '';
        $num = 0;
        $dictRecord = [];
        if(!IsAdmin('administrator')) {
            // 如果不是全局管理员，则默认要保留自己对该条目的权限
            $userIdList[] = session('user_id');
        }
        if(count($cooperator) > 1 || count($cooperator) == 1 && trim($cooperator[0]) != '') {
            foreach($cooperator as $user_id) {
                if($num >= 6) {
                    $retInfo .= "At most first 6 valid co-editors allowed. Others ignored.";
                    break;
                }
                $user_id = trim(strtolower($user_id));
                if(array_key_exists($user_id, $dictRecord)) {
                    continue;
                }
                $dictRecord[$user_id] = true;
                $userIdList[] = $user_id;
                $num ++;
            }
        }
        $readyUserIdList = db('users')->where('user_id', 'in', $userIdList)->column('user_id');
        
        // 直接使用资源类型（$this->privilegeStr 已经是 news/problem/contest）
        $rightitem = $this->privilegeStr;
        
        if(in_array($rightitem, ['news', 'problem', 'contest'])) {
            // 使用 privilege_item 表
            $PrivilegeItem = db('privilege_item');
            $insertList = [];
            foreach($readyUserIdList as $user_id) {
                $insertList[] = [
                    'user_id'     => $user_id,
                    'rightitem'   => $rightitem,
                    'item_id'     => $item_id,
                    'pvrole'      => 'admin'
                ];
            }
            $PrivilegeItem->where([
                'rightitem' => $rightitem,
                'item_id' => $item_id,
                'pvrole' => 'admin'
            ])->delete();
            if(!empty($insertList)) {
                $PrivilegeItem->insertAll($insertList);
            }
        } else {
            // 如果 rightitem 映射不存在，说明不支持该类型的权限管理
            $this->error('Unsupported item type for privilege management');
        }
        if(count($readyUserIdList) != count($userIdList)) {
            $retInfo .= "<br/>Users not exists are ignored.<br/>Success user list: <br/>" . implode('\n', $readyUserIdList);
        }
        return $retInfo;
    }
    
    /**
     * 钩子方法：获取查询过滤条件
     * 子类可以重写此方法来注入额外的查询条件（如 course_key）
     * @param string $tableName 表名
     * @return array 额外的查询条件数组
     */
    protected function getQueryFilter($tableName = '')
    {
        return [];  // admin 中返回空，exadmin 中返回 course_key 过滤
    }
    
    /**
     * 自动应用查询过滤条件到查询对象
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
                // 检查查询对象是否设置了别名，如果设置了，在 join 条件中使用别名
                $options = $query->getOptions();
                $joinCondition = $joinConfig[1];
                if(isset($options['alias']) && !empty($options['alias'])) {
                    // 获取表名对应的别名
                    $tableName = $tableName ?: (is_array($options['table']) ? key($options['table']) : $options['table']);
                    if(isset($options['alias'][$tableName])) {
                        $alias = $options['alias'][$tableName];
                        // 替换 join 条件中的表名为别名
                        // 例如：将 'ex_question.ex_question_id' 替换为 'eq.ex_question_id'
                        $joinCondition = preg_replace('/\b' . preg_quote($tableName, '/') . '\./', $alias . '.', $joinCondition);
                    }
                }
                $query->join($joinConfig[0], $joinCondition, $joinConfig[2] ?? 'inner');
                // 应用 filter 的 where 条件（course_item 表的条件）
                foreach($filter['where'] as $key => $value) {
                    if($value === null) {
                        // 如果字段名包含表别名（如 ci.pvrole），需要特殊处理
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
                // 不再兼容旧逻辑：getQueryFilter() 必须返回 join/where 结构或空/NULL
                throw new \think\Exception('Invalid getQueryFilter format: expected {join,where}, got ' . var_export($filter, true));
            }
        } else {
            // 没有 filter，直接应用 $map
            $query->where($map);
        }
        return $query;
    }
    
    /**
     * 自动应用查询过滤条件到 $map（兼容旧接口）
     * @param array $map 现有的查询条件
     * @param string $tableName 表名
     * @return array 合并后的查询条件（如果使用联查，返回原 map，联查条件通过 getQueryFilter 返回）
     */
    protected function applyQueryFilter($map, $tableName = '')
    {
        $filter = $this->getQueryFilter($tableName);
        if ($filter && is_array($filter)) {
            // 如果返回的是联查配置，不修改 map（调用方需要使用 applyQueryFilterToQuery）
            if(isset($filter['join']) && isset($filter['where'])) {
                return $map;
            } else {
                // 不再兼容旧逻辑：禁止返回简单 where 数组
                throw new \think\Exception('Invalid getQueryFilter format for applyQueryFilter: expected {join,where}, got ' . var_export($filter, true));
            }
        }
        return $map;
    }
    
    /**
     * 钩子方法：在插入数据前添加额外字段
     * 子类可以重写此方法来注入额外字段（如 course_key）
     * @param array $data 要插入的数据
     * @param string $tableName 表名
     * @return array 处理后的数据
     */
    protected function prepareInsertData($data, $tableName = '')
    {
        return $data;  // admin 中返回原数据，exadmin 中添加 course_key
    }
    
    /**
     * 钩子方法：在插入数据后添加 course_item 映射
     * 子类可以重写此方法来插入 course_item 映射
     * @param array $data 插入的数据
     * @param string $tableName 表名
     * @param int $insertId 插入后返回的ID
     * @return void
     */
    protected function afterInsertData($data, $tableName = '', $insertId = null)
    {
        // admin 中为空操作，exadmin 中插入 course_item 映射
    }
    
    /**
     * 钩子方法：在更新数据前添加额外字段（如果需要）
     * 子类可以重写此方法来注入额外字段
     * @param array $data 要更新的数据
     * @param string $tableName 表名
     * @return array 处理后的数据
     */
    protected function prepareUpdateData($data, $tableName = '')
    {
        return $data;
    }
    
    /**
     * 钩子方法：验证资源是否属于当前上下文
     * 子类可以重写此方法来验证资源归属（如 course_key 验证）
     * @param array $item 资源项
     * @param string $itemType 资源类型（如 'contest', 'problem', 'news'）
     */
    protected function validateItemBelong($item, $itemType = '')
    {
        // admin 中为空操作，exadmin 中验证 course_key
    }
    
    /**
     * 钩子方法：判断新闻分类是否允许当前用户设置
     * 子类可以重写此方法来控制权限
     * @param string $category 新闻分类
     * @return bool true 表示允许，false 表示不允许
     */
    protected function canSetNewsCategory($category)
    {
        // admin 中默认都允许
        return true;
    }
}