<?php
/**
 * 提交状态 AJAX Trait
 * 提供 status_ajax 和 single_status_ajax 方法的公共实现
 * 用于比赛内和全局状态页面的代码复用
 * 
 * 支持：
 * - 比赛内和全局状态页面的兼容
 * - OJ_MODE=cpcsys/online、OJ_STATUS=cpc/exp 的兼容
 * - 查重功能（sim 表查询）
 * - EXP 模式（实验/考试）的特殊处理
 * 
 * 使用方式：
 * 1. 在控制器中使用此 trait
 * 2. 实现必要的钩子方法
 * 3. 调用 status_ajax() 和 single_status_ajax() 方法
 */
namespace app\common\traits;

use think\db\Expression;

trait StatusAjaxTrait
{
    /**
     * 为 solutionlist 补齐查重信息（sim 表）
     * - 用于“未传 similar 参数（不筛选）但仍需展示查重数据”的场景
     * - 仅对当前页（limit 条）做补齐，避免额外压力
     *
     * @param array $solutionlist
     * @return array
     */
    protected function attachStatusAjaxSimilarData($solutionlist)
    {
        if (empty($solutionlist)) {
            return $solutionlist;
        }

        // 收集 solution_id
        $sIds = [];
        foreach ($solutionlist as $s) {
            if (isset($s['solution_id']) && intval($s['solution_id']) > 0) {
                $sIds[] = intval($s['solution_id']);
            }
        }
        $sIds = array_values(array_unique($sIds));
        if (empty($sIds)) {
            return $solutionlist;
        }

        // 批量查 sim（按 sim 值降序，若同一 s_id 有多条，取第一条视为“最高相似”）
        $simRows = db('sim')->alias('si')
            ->join('solution sr', 'sr.solution_id=si.sim_s_id', 'left')
            ->where('si.s_id', 'in', $sIds)
            ->field([
                'si.s_id',
                'si.sim',
                'si.sim_s_id',
                'sr.user_id sim_user_id',
                'sr.in_date sim_in_date'
            ])
            ->order(['si.sim' => 'desc'])
            ->select();

        $simMap = [];
        $simUserIdsNormal = [];
        foreach ($simRows as $row) {
            $sid = intval($row['s_id'] ?? 0);
            if ($sid <= 0) {
                continue;
            }
            // 只保留第一条（最高 sim）
            if (isset($simMap[$sid])) {
                continue;
            }
            $simMap[$sid] = [
                'sim' => isset($row['sim']) ? intval($row['sim']) : null,
                'sim_s_id' => isset($row['sim_s_id']) ? intval($row['sim_s_id']) : null,
                'sim_user_id' => $row['sim_user_id'] ?? null,
                'sim_in_date' => $row['sim_in_date'] ?? null,
            ];
            $uid = $row['sim_user_id'] ?? null;
            if ($uid && (strlen($uid) < 4 || substr($uid, 0, 4) !== '#cpc')) {
                $simUserIdsNormal[] = $uid;
            }
        }

        // 批量查被相似对象的用户名（仅常规 users）
        $simUserNameMap = [];
        if (!empty($simUserIdsNormal)) {
            $simUserIdsNormal = array_values(array_unique($simUserIdsNormal));
            $simUserIdsNormal = array_slice($simUserIdsNormal, 0, 50);
            $users = db('users')
                ->where('user_id', 'in', $simUserIdsNormal)
                ->field(['user_id', 'nick'])
                ->select();
            foreach ($users as $u) {
                $simUserNameMap[$u['user_id']] = $u['nick'] ?: $u['user_id'];
            }
        }

        // 回填到 solutionlist
        foreach ($solutionlist as &$solution) {
            $sid = intval($solution['solution_id'] ?? 0);
            $solution['sim'] = null;
            $solution['sim_s_id'] = null;
            $solution['sim_user_id'] = null;
            $solution['sim_in_date'] = null;
            $solution['sim_user_name'] = null;

            if ($sid > 0 && isset($simMap[$sid])) {
                // 自己与自己的代码不显示查重信息
                $simUid = $simMap[$sid]['sim_user_id'] ?? null;
                if ($simUid && $simUid == ($solution['user_id'] ?? '')) {
                    continue;
                }
                
                $solution['sim'] = $simMap[$sid]['sim'];
                $solution['sim_s_id'] = $simMap[$sid]['sim_s_id'];
                $solution['sim_user_id'] = $simMap[$sid]['sim_user_id'];
                $solution['sim_in_date'] = $simMap[$sid]['sim_in_date'];
                $uid = $simMap[$sid]['sim_user_id'];
                if ($uid && isset($simUserNameMap[$uid])) {
                    $solution['sim_user_name'] = $simUserNameMap[$uid];
                }
            }
        }

        return $solutionlist;
    }

    /**
     * 提交状态列表数据 AJAX
     * 公共实现，通过钩子方法支持定制
     */
    public function status_ajax()
    {
        // 获取基础参数
        $params = $this->getStatusAjaxParams();
        $offset = $params['offset'];
        $limit = $params['limit'];
        $sort = $params['sort'];
        $order = $params['order'];
        $solution_id_list = $params['solution_id_list'];
        
        // 构建查询条件
        $map = $this->buildStatusAjaxMap($params);
        
        // 处理 solution_id 列表查询
        $needSolutionIdIn = false;
        $solutionIdInValues = [];
        if (isset($map['solution_id']) && $map['solution_id'] !== null && $map['solution_id'] !== '') {
            // 单个 solution_id，保留在 map 中
        } else if ($solution_id_list != null) {
            $needSolutionIdIn = true;
            $solutionIdInValues = array_slice($solution_id_list, 0, 25);
            unset($map['solution_id']); // 移除单个 solution_id，使用 IN 查询
        } else {
            unset($map['solution_id']); // 没有 solution_id 条件
        }
        
        // 处理 language IN 查询（比赛内需要）
        $needLanguageIn = false;
        $languageInValues = [];
        if (isset($map['language']) && $map['language'] === null) {
            unset($map['language']);
            $needLanguageIn = true;
            $languageInValues = $this->getStatusAjaxAllowedLanguages();
        }
        
        // 构建排序
        $ordertype = [];
        if (strlen($sort) > 0) {
            $ordertype = [$sort => $order];
        }
        
        // 获取字段列表
        $columns = $this->getStatusAjaxColumns();
        
        // 构建查询
        $Solution = db('solution');
        
        // 处理查重相关逻辑：
        // - similar > 0：筛选查重阈值（由 buildStatusAjaxQueryWithSimilar 实现）
        // - 未传 similar（或 similar<=0）：不筛选，但仍补齐 sim 字段用于展示
        // 注意：similar = 0 时相当于不查重，使用普通查询
        // 只有当 similar > 0 时才使用“筛选模式”查询；否则用普通查询 + 后处理补齐 sim
        $totalFromSimilar = null;
        $similarParam = $params['similar'];
        if ($this->isStatusAjaxSimilarEnabled() && $similarParam !== null && $similarParam !== '' && intval($similarParam) > 0) {
            $similarResult = $this->buildStatusAjaxQueryWithSimilar($Solution, $map, $columns, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $ordertype, $params, $offset, $limit);
            $solutionlist = $similarResult['rows'];
            $totalFromSimilar = isset($similarResult['total']) ? $similarResult['total'] : count($solutionlist);
        } else {
            // 普通查询（无查重）
            $query = $this->buildStatusAjaxQuery($Solution, $map, $columns, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $ordertype);
            
            // 执行查询
            $solutionlist = $this->executeStatusAjaxQuery($query, $offset, $limit, $ordertype);
        }
        
        // 处理用户信息
        $solutionlist = $this->processStatusAjaxUserInfo($solutionlist);
        
        // ========== EXP 模式：处理 contest 信息（与 ACMOJ 逻辑解耦） ==========
        // 全局状态页面且 OJ_STATUS=exp 时，需要批量查询 contest 信息
        $solutionlist = $this->processStatusAjaxExpContestInfo($solutionlist);
        // ========== EXP 模式：contest 信息处理结束 ==========

        // ========== 查重展示模式：未传 similar 时也补齐 sim 字段 ==========
        if ($totalFromSimilar === null && $this->isStatusAjaxSimilarEnabled() && (intval($similarParam) <= 0)) {
            $solutionlist = $this->attachStatusAjaxSimilarData($solutionlist);
        }
        // ========== 查重展示模式结束 ==========
        
        // 处理每条 solution 数据（包括设置 res_short、res_text、res_color、res_show 等字段）
        foreach ($solutionlist as &$solution) {
            $this->processStatusAjaxSolution($solution);
        }
        
        // 获取总数
        $ret = [];
        if ($totalFromSimilar !== null) {
            // 查重查询已经返回了总数
            $ret['total'] = $totalFromSimilar;
        } else {
            // 普通查询需要计算总数
            $ret['total'] = $this->getStatusAjaxTotal($map, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues);
        }
        
        $ret['order'] = $order;
        $ret['rows'] = $solutionlist;
        return $ret;
    }
    
    /**
     * 获取单个提交状态（用于实时更新）
     * 公共实现，通过钩子方法支持定制
     */
    public function single_status_ajax()
    {
        $solution_id = trim(input('solution_id'));
        $solution = $this->getSingleStatusAjaxSolution($solution_id);
        
        if ($solution == null) {
            $this->error('No such solution.');
            return;
        }
        
        // 权限检查
        if (!$this->canSeeSingleStatusAjax($solution)) {
            $this->error('Permission denied.');
            return;
        }
        
        // 处理 solution 数据
        $this->processSingleStatusAjaxSolution($solution);
        
        $this->success('ok', null, $solution);
    }
    
    // ========== 钩子方法：由使用该 trait 的类实现 ==========
    
    /**
     * 获取基础参数
     * @return array ['offset', 'limit', 'sort', 'order', 'solution_id_list', 'problem_id', 'user_id', 'solution_id', 'language', 'result', 'similar']
     */
    protected function getStatusAjaxParams()
    {
        // 获取排序字段，处理前端可能传递的虚拟字段名
        $sort = input('sort', 'solution_id');
        return [
            'offset' => intval(input('offset')),
            'limit' => 15,
            'sort' => $sort,
            'order' => input('order', 'desc'),
            'solution_id_list' => input('solution_id_list/a'),
            'problem_id' => trim(input('problem_id')),
            'user_id' => trim(input('user_id')),
            'solution_id' => trim(input('solution_id')),
            'language' => input('language'),
            'result' => input('result'),
            'similar' => input('similar/d'),
        ];
    }
    
    /**
     * 构建查询条件 map
     * @param array $params 参数数组
     * @return array 查询条件
     */
    protected function buildStatusAjaxMap($params)
    {
        $map = [];
        
        // problem_id 处理（比赛内需要转换，全局直接使用）
        if ($params['problem_id'] != null && strlen($params['problem_id']) > 0) {
            $converted = $this->convertStatusAjaxProblemId($params['problem_id']);
            if ($converted !== null && $converted !== '') {
                $map['problem_id'] = $converted;
            }
        }
        
        // user_id 处理（比赛内需要转换，全局直接使用）
        if ($params['user_id'] != null && strlen($params['user_id']) > 0) {
            $map['user_id'] = $this->convertStatusAjaxUserId($params['user_id'], true);
        }
        
        // solution_id 处理
        if ($params['solution_id'] != null && strlen($params['solution_id']) > 0) {
            $map['solution_id'] = $params['solution_id'];
        }
        
        // language 处理：统一为整型以便与 solution 表字段匹配，避免 ThinkPHP 5.1 字典式条件歧义
        // 注意：当 OJ_LANGUAGE 配置为空时，不写入 language 条件，否则会误设为 null 导致 WHERE language IS NULL 从而无结果
        if ($params['language'] !== null && $params['language'] !== '' && (string)$params['language'] !== '-1') {
            $allowedLanguages = $this->getStatusAjaxAllowedLanguages();
            if (!is_array($allowedLanguages) || empty($allowedLanguages)) {
                // 配置为空时不加 language 条件，避免误用 null
            } else {
                $langKey = is_numeric($params['language']) ? intval($params['language']) : $params['language'];
                if (array_key_exists($langKey, $allowedLanguages)) {
                    $map['language'] = is_numeric($langKey) ? intval($langKey) : $langKey;
                } else {
                    // 比赛内：如果不在允许列表中，设置为 null 以便后续使用 IN 查询
                    $map['language'] = null;
                }
            }
        }
        
        // result 处理
        if ($params['result'] != null && $params['result'] != -1) {
            $map['result'] = $params['result'];
            // 比赛内可能需要处理封榜逻辑
            $this->applyStatusAjaxResultFilter($map, $params);
        }
        
        // contest_id 处理（比赛内固定，全局需要筛选）
        $this->applyStatusAjaxContestFilter($map);
        
        return $map;
    }
    
    /**
     * 转换 problem_id（比赛内：字母转数字；全局：直接返回）
     * @param string $problem_id
     * @return mixed
     */
    protected function convertStatusAjaxProblemId($problem_id)
    {
        return $problem_id; // 默认直接返回，比赛内需要重写
    }
    
    /**
     * 转换 user_id（比赛内：需要转换格式；全局：直接返回）
     * @param string $user_id
     * @param bool $toDbFormat 是否转换为数据库格式
     * @return string
     */
    protected function convertStatusAjaxUserId($user_id, $toDbFormat = true)
    {
        return $user_id; // 默认直接返回，比赛内需要重写
    }
    
    /**
     * 应用 result 筛选条件（比赛内可能需要处理封榜）
     * @param array &$map 查询条件（引用）
     * @param array $params 参数
     */
    protected function applyStatusAjaxResultFilter(&$map, $params)
    {
        // 默认不处理，比赛内需要重写
    }
    
    /**
     * 应用 contest_id 筛选条件（全局需要筛选非比赛提交）
     * @param array &$map 查询条件（引用）
     */
    protected function applyStatusAjaxContestFilter(&$map)
    {
        // 默认不处理，全局需要重写
    }
    
    /**
     * 获取允许的语言列表
     * @return array
     */
    protected function getStatusAjaxAllowedLanguages()
    {
        // 注意：ThinkPHP config() 第二参数为“设置值”，非默认值；传 [] 会覆盖为空数组
        $v = config('CsgojConfig.OJ_LANGUAGE');
        return is_array($v) ? $v : [];
    }
    
    /**
     * 获取查询字段列表
     * @return array
     */
    protected function getStatusAjaxColumns()
    {
        $columns = ['solution_id', 'user_id', 'problem_id', 'contest_id', 'result', 'memory', 'time', 'language', 'code_length', 'pass_rate', 'in_date'];
        if (IsAdmin('source_browser')) {
            $columns[] = 'judger';
        }
        return $columns;
    }
    
    /**
     * 构建查询对象（普通查询，无查重）
     * @param \think\db\Query $Solution
     * @param array $map 查询条件
     * @param array $columns 字段列表
     * @param bool $needSolutionIdIn
     * @param array $solutionIdInValues
     * @param bool $needLanguageIn
     * @param array $languageInValues
     * @param array $ordertype 排序
     * @return \think\db\Query
     */
    protected function buildStatusAjaxQuery($Solution, $map, $columns, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $ordertype)
    {
        // 单个 language 条件用显式 where，避免 ThinkPHP 5.1 字典式条件歧义
        $languageValue = null;
        if (isset($map['language']) && !$needLanguageIn) {
            $languageValue = $map['language'];
            unset($map['language']);
        }
        $query = $Solution->field($columns)->where($map);
        if ($languageValue !== null) {
            $query->where('language', '=', $languageValue);
        }
        if ($needSolutionIdIn) {
            $query->where('solution_id', 'in', $solutionIdInValues);
        }
        if ($needLanguageIn && !empty($languageInValues)) {
            $query->where('language', 'in', $languageInValues);
        }
        return $query;
    }
    
    /**
     * 构建带查重的查询对象
     * @param \think\db\Query $Solution
     * @param array $map 查询条件
     * @param array $columns 字段列表
     * @param bool $needSolutionIdIn
     * @param array $solutionIdInValues
     * @param bool $needLanguageIn
     * @param array $languageInValues
     * @param array $ordertype 排序
     * @param array $params 参数
     * @param int $offset
     * @param int $limit
     * @return array ['rows' => [], 'total' => int]
     */
    protected function buildStatusAjaxQueryWithSimilar($Solution, $map, $columns, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues, $ordertype, $params, $offset, $limit)
    {
        // 默认实现：不处理查重，返回空结果
        // 比赛内和全局需要重写此方法
        return ['rows' => [], 'total' => 0];
    }
    
    /**
     * 执行查询
     * @param \think\db\Query $query
     * @param int $offset
     * @param int $limit
     * @param array $ordertype 排序
     * @return array
     */
    protected function executeStatusAjaxQuery($query, $offset, $limit, $ordertype = [])
    {
        return $query->order($ordertype)->limit($offset, $limit)->select();
    }
    
    /**
     * 是否启用查重功能
     * @return bool
     */
    protected function isStatusAjaxSimilarEnabled()
    {
        // 基础放行：全局管理员或源码浏览权限
        if (IsAdmin() || IsAdmin('source_browser')) {
            return true;
        }
        // 其他场景交给可选钩子（例如：比赛管理员、课程教师等）
        // 注意：此处不能在 Trait 内声明默认空实现，否则会与其他 Trait 的同名方法产生冲突（Trait collision）
        if (method_exists($this, 'statusAjaxSimilarExtraPermission')) {
            return (bool)$this->statusAjaxSimilarExtraPermission();
        }
        return false;
    }
    
    /**
     * 处理用户信息（批量查询 users 表或 cpc_team 表）
     * @param array $solutionlist
     * @return array
     */
    protected function processStatusAjaxUserInfo($solutionlist)
    {
        // 提取所有 user_id
        $userIdsToQuery = [];
        foreach ($solutionlist as $solution) {
            $uid = $solution['user_id'];
            // 比赛内的 user_id 格式：以 #cpc 开头，不需要查询 users 表
            if ($uid && (strlen($uid) < 4 || substr($uid, 0, 4) !== '#cpc')) {
                $userIdsToQuery[] = $uid;
            }
        }
        
        // 批量查询 users 表
        $userNickMap = [];
        if (!empty($userIdsToQuery)) {
            $userIdsToQuery = array_unique($userIdsToQuery);
            $userIdsToQuery = array_slice($userIdsToQuery, 0, 20);
            
            $users = db('users')
                ->where('user_id', 'in', $userIdsToQuery)
                ->field('user_id, nick')
                ->select();
            
            foreach ($users as $user) {
                $userNickMap[$user['user_id']] = $user['nick'];
            }
        }
        
        // 添加到 solution 数据中
        foreach ($solutionlist as &$solution) {
            if (isset($userNickMap[$solution['user_id']])) {
                $solution['name'] = $userNickMap[$solution['user_id']];
            } else {
                $solution['name'] = null; // 比赛内的 user_id 或未找到的 user_id
            }
        }
        
        return $solutionlist;
    }
    
    /**
     * ========== EXP 模式：处理 contest 信息（与 ACMOJ 逻辑解耦） ==========
     * 全局状态页面且 OJ_STATUS=exp 时，需要批量查询 contest 信息
     * @param array $solutionlist
     * @return array
     */
    protected function processStatusAjaxExpContestInfo($solutionlist)
    {
        // 默认不处理，全局状态页面需要重写
        return $solutionlist;
    }
    
    /**
     * 处理每条 solution 数据
     * @param array &$solution 解决方案数据（引用）
     */
    protected function processStatusAjaxSolution(&$solution)
    {
        // 转换 language
        $oj_language = config('CsgojConfig.OJ_LANGUAGE');
        if (array_key_exists($solution['language'], $oj_language)) {
            $solution['language'] = $oj_language[$solution['language']];
        } else {
            $solution['language'] = "Unknown";
        }
        
        // 设置 code_show
        $solution['code_show'] = $this->IfCanSeeInfo($solution);
        
        // 获取结果显示
        $this->GetResultShow($solution);
    }
    
    /**
     * 获取总数
     * @param array $map
     * @param bool $needSolutionIdIn
     * @param array $solutionIdInValues
     * @param bool $needLanguageIn
     * @param array $languageInValues
     * @return int
     */
    protected function getStatusAjaxTotal($map, $needSolutionIdIn, $solutionIdInValues, $needLanguageIn, $languageInValues)
    {
        $languageValue = null;
        if (isset($map['language']) && !$needLanguageIn) {
            $languageValue = $map['language'];
            unset($map['language']);
        }
        $Solution = db('solution');
        $countQuery = $Solution->where($map);
        if ($languageValue !== null) {
            $countQuery->where('language', '=', $languageValue);
        }
        if ($needSolutionIdIn) {
            $countQuery->where('solution_id', 'in', $solutionIdInValues);
        }
        if ($needLanguageIn && !empty($languageInValues)) {
            $countQuery->where('language', 'in', $languageInValues);
        }
        return $countQuery->count();
    }
    
    /**
     * 获取单个提交状态数据
     * @param string $solution_id
     * @return array|null
     */
    protected function getSingleStatusAjaxSolution($solution_id)
    {
        $map = ['solution_id' => $solution_id];
        $query = db('solution')->where($map);
        
        // 应用 contest_id 筛选（全局需要）
        $this->applySingleStatusAjaxContestFilter($query);
        
        return $query->field(['solution_id', 'user_id', 'memory', 'time', 'result', 'contest_id', 'pass_rate'])->find();
    }
    
    /**
     * 应用单个提交状态的 contest_id 筛选
     * @param \think\db\Query &$query 查询对象（引用）
     */
    protected function applySingleStatusAjaxContestFilter(&$query)
    {
        // 默认不处理，全局需要重写
    }
    
    /**
     * 检查是否可以查看单个提交状态
     * @param array $solution
     * @return bool
     */
    protected function canSeeSingleStatusAjax($solution)
    {
        // 比赛内需要检查比赛权限
        if (isset($solution['contest_id']) && $solution['contest_id'] != null && $solution['contest_id'] > 0) {
            if (!$this->canSeeContestSolution($solution['contest_id'])) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * 检查是否可以查看比赛提交（比赛内需要重写）
     * @param int $contest_id
     * @return bool
     */
    protected function canSeeContestSolution($contest_id)
    {
        return IsAdmin('contest', $contest_id); // 默认只有比赛管理员可以查看
    }
    
    /**
     * 处理单个提交状态数据
     * @param array &$solution 解决方案数据（引用）
     */
    protected function processSingleStatusAjaxSolution(&$solution)
    {
        // 转换 user_id（比赛内需要）
        $solution['user_id'] = $this->convertStatusAjaxUserId($solution['user_id'], false);
        
        // 权限检查：隐藏非自己的 memory、time 等
        if (!$this->canSeeSolutionDetails($solution)) {
            $solution['memory'] = '-';
            $solution['time'] = '-';
            $solution['pass_rate'] = '-';
            $solution['code_length'] = '-';
        }
        
        // 封榜处理（比赛内需要）
        if ($this->shouldHideResultForFrozen($solution)) {
            $solution['result'] = '-';
            $solution['result_show'] = '-';
            return;
        }
        
        // 获取结果显示
        $this->GetResultShow($solution);
    }
    
    /**
     * 检查是否可以查看解决方案详情
     * @param array $solution
     * @return bool
     */
    protected function canSeeSolutionDetails($solution)
    {
        // 默认实现：自己、管理员、源码浏览权限可以查看
        $user_id = session('user_id');
        if ($user_id == $solution['user_id']) {
            return true;
        }
        if (IsAdmin('source_browser')) {
            return true;
        }
        // 比赛内需要额外检查
        return $this->canSeeContestSolutionDetails($solution);
    }
    
    /**
     * 检查是否可以查看比赛解决方案详情（比赛内需要重写）
     * @param array $solution
     * @return bool
     */
    protected function canSeeContestSolutionDetails($solution)
    {
        return false; // 默认不允许，比赛内需要重写
    }
    
    /**
     * 是否应该隐藏结果（封榜处理）
     * @param array $solution
     * @return bool
     */
    protected function shouldHideResultForFrozen($solution)
    {
        return false; // 默认不隐藏，比赛内需要重写
    }
    
    /**
     * 代码对比页面（兼容全局状态页面和比赛内）
     */
    public function status_code_compare()
    {
        // 权限检查
        if (!$this->canAccessStatusCodeCompare()) {
            $this->error('Powerless');
        }
        
        $sid = [];
        $sid[0] = input('sid0', '0');
        $sid[1] = input('sid1', '0');
        $code = [];
        
        // 获取两个提交的代码
        for ($i = 0; $i < 2; $i++) {
            $code[$i] = db('source_code')
                ->alias('so')
                ->join('solution sl', 'so.solution_id=sl.solution_id', 'left')
                ->where('so.solution_id', $sid[$i])
                ->field([
                    'so.solution_id solution_id',
                    'so.source source',
                    'sl.user_id user_id',
                    'sl.contest_id contest_id',
                    'sl.problem_id problem_id',
                    'sl.language language',
                ])
                ->find();

            if (!$code[$i]) {
                $this->error('Code ' . $sid[$i] . ' not exists');
            }

            // 处理用户ID显示
            if (!isset($code[$i]['user_id']) || $code[$i]['user_id'] == null) {
                $code[$i]['user_id'] = '-null-';
            }
            
            // 转换用户ID（比赛内需要转换格式，全局直接使用）
            $code[$i]['user_id'] = $this->convertStatusCodeCompareUserId($code[$i]['user_id']);
            
            // 转义代码
            $code[$i]['source'] = htmlentities(str_replace("\r\n", "\n", $code[$i]['source']), ENT_QUOTES, "utf-8");
        }
        
        $this->assign('code', $code);
        
        // 设置用户信息URL前缀（视图会拼接 user_id）
        $contest_id = $this->getStatusCodeCompareContestId();
        $this->assign('userInfoUrl', $this->getStatusCodeCompareUserInfoUrl('', $contest_id, true));
        
        // 获取视图路径
        $viewPath = $this->getStatusCodeCompareViewPath();
        return $this->fetch($viewPath);
    }
    
    /**
     * 检查是否可以访问代码对比页面
     * @return bool
     */
    protected function canAccessStatusCodeCompare()
    {
        // 默认：只有管理员或有源码浏览权限的用户可以查看
        // 比赛内需要重写此方法，检查比赛管理员权限
        return IsAdmin('source_browser');
    }
    
    /**
     * 转换用户ID（比赛内需要转换格式，全局直接返回）
     * @param string $user_id
     * @return string
     */
    protected function convertStatusCodeCompareUserId($user_id)
    {
        // 默认直接返回，比赛内需要重写
        return $user_id;
    }
    
    /**
     * 获取比赛ID（比赛内返回 contest_id，全局返回 0）
     * @return int
     */
    protected function getStatusCodeCompareContestId()
    {
        // 默认返回 0（全局状态页面）
        return 0;
    }
    
    /**
     * 获取用户信息URL
     * @param string $user_id 用户ID
     * @param int $contest_id 比赛ID
     * @param bool $only_prefix 是否只返回前缀
     * @return string
     */
    protected function getStatusCodeCompareUserInfoUrl($user_id, $contest_id=0, $only_prefix=false)
    {
        // 默认实现：全局状态页面使用 user/userinfo
        // 比赛内需要重写此方法
        if ($only_prefix) {
            return '/' . $this->request->module() . '/user/userinfo?user_id=';
        } else {
            return '/' . $this->request->module() . '/user/userinfo?user_id=' . $user_id;
        }
    }
    
    /**
     * 获取视图路径
     * @return string
     */
    protected function getStatusCodeCompareViewPath()
    {
        // 默认：全局状态页面使用 status/status_code_compare
        // 比赛内需要重写，使用 contest/status_code_compare
        return 'status/status_code_compare';
    }
    
    /**
     * 注意：IfCanSeeInfo 和 GetResultShow 方法应该由使用该 trait 的类实现
     * 或者从其他 trait（如 ContestBaseTrait）中继承
     * 这些方法不在 StatusAjaxTrait 中定义，以避免与其他 trait 的方法冲突
     */
}

