<?php
namespace app\exadmin\controller;
use think\Db;
require_once(__DIR__ . "/../../common/traits/ExamTrait.php");
use app\common\traits\ExamTrait;

/**
 * exadmin Question 控制器
 * 题目管理（仅考试模式 cpcsys-exp 使用）
 */
class Question extends Exadminbase
{
    use ExamTrait;

    /**
     * 题库“查看”权限：
     * - 全局管理员 / problem_editor / contest_editor
     * - 当前课程 teacher/admin/super
     */
    protected function canViewQuestionBank(): bool {
        return IsAdmin()
            || IsAdmin('problem_editor')
            || IsAdmin('contest_editor')
            || (function_exists('PrivCourse') && (
                PrivCourse('teacher', $this->NOW_COURSE_KEY)
                || PrivCourse('admin', $this->NOW_COURSE_KEY)
                || PrivCourse('super', $this->NOW_COURSE_KEY)
            ));
    }

    /**
     * 题库“写入”权限（新增/修改/导入）：
     * - 全局管理员 / problem_editor / contest_editor
     * - 当前课程 admin/super
     *
     * 约束：teacher 只能“查看”，不能直接写入题库（改用“本地出题草稿”功能）。
     */
    protected function canManageQuestionBank(): bool {
        return IsAdmin()
            || IsAdmin('problem_editor')
            || IsAdmin('contest_editor')
            || (function_exists('PrivCourse') && (
                PrivCourse('admin', $this->NOW_COURSE_KEY)
                || PrivCourse('super', $this->NOW_COURSE_KEY)
            ));
    }

    private function isUploadUrl($val) {
        return is_string($val) && strpos($val, '/upload/') === 0;
    }

    private function uploadUrlToAbsPath($url) {
        // 对齐 Filemanager：PUBLIC + '/upload/..' => 文件系统路径
        $ojPath = config('OjPath.');
        return $ojPath['PUBLIC'] . $url;
    }

    /**
     * 答案图搬运调试日志（仅用于排查线上“成功但文件未落盘”的情况）
     */
    private function dbgAnswerImg($ex_question_id, $stage, $data = []) {
        // 只在 app_debug=true 时允许执行自定义 debug
        if(!function_exists('CsgAppDebugEnabled') || !CsgAppDebugEnabled()) return;
        // 仍然需要显式开关，避免开发环境里日志被刷屏
        $flag = intval(input('debug_answer_image/d', 0));
        if($flag !== 1) return;
        CsgDebugLog('answer_image_move', [
            'qid' => intval($ex_question_id),
            'stage' => strval($stage),
            'data' => $data,
        ]);
    }

    /**
     * 题型专用正则化函数：确保存入数据库的题目描述格式完全正确，删除错误字段
     * @param int $pkind 题型
     * @param array $contentArr content 数组（引用传递，会被修改）
     * @param array $answerArr answer 数组（引用传递，会被修改）
     * @throws \Exception 如果数据格式不正确
     */
    private function normalizeQuestionData($pkind, &$contentArr, &$answerArr) {
        if($pkind == 15) {
            // 简答题：清理 content[0].image_reqs[].answer_image 字段（答案图只存在 answer 中）
            if(isset($contentArr[0]) && is_array($contentArr[0]) && isset($contentArr[0]['image_reqs']) && is_array($contentArr[0]['image_reqs'])) {
                if(count($contentArr[0]['image_reqs']) > 10) {
                    $this->error("简答题图片要求最多 10 条");
                }
                foreach($contentArr[0]['image_reqs'] as $ridx => $req) {
                    // 验证图片要求描述不能为空
                    $title = isset($req['title']) ? trim(strval($req['title'])) : '';
                    if($title === '') {
                        $this->error("简答题图片要求" . ($ridx + 1) . "描述不能为空");
                    }
                    // 删除 answer_image 字段
                    if(isset($req['answer_image'])) {
                        unset($contentArr[0]['image_reqs'][$ridx]['answer_image']);
                    }
                }
            }
            // 确保 answer[0] 格式正确（兼容旧格式：字符串 -> 新格式对象）
            if(!is_array($answerArr) || count($answerArr) === 0) {
                // 空数组或非数组，初始化为空答案
                $answerArr = [['answer' => '', 'answer_images' => []]];
            } else if(is_string($answerArr[0])) {
                // 旧格式：字符串 -> 转换为新格式
                $answerArr = [['answer' => $answerArr[0], 'answer_images' => []]];
            } else if(!is_array($answerArr[0])) {
                // 其他非数组类型，转换为字符串
                $answerArr = [['answer' => strval($answerArr[0]), 'answer_images' => []]];
            } else {
                // 已经是数组格式，确保包含必要字段
                if(!isset($answerArr[0]['answer'])) $answerArr[0]['answer'] = '';
                if(!isset($answerArr[0]['answer_images']) || !is_array($answerArr[0]['answer_images'])) {
                    $answerArr[0]['answer_images'] = [];
                }
            }
        } else if($pkind == 20) {
            // 综合题：清理每个小题的 content[].image_reqs[].answer_image 字段
            if(count($contentArr) > 10) {
                $this->error("综合题最多 10 小题");
            }
            foreach($contentArr as $sidx => $sub) {
                if(is_array($sub) && isset($sub['image_reqs']) && is_array($sub['image_reqs'])) {
                    if(count($sub['image_reqs']) > 10) {
                        $this->error("综合题第" . ($sidx + 1) . "小题图片要求最多 10 条");
                    }
                    foreach($sub['image_reqs'] as $ridx => $req) {
                        // 验证图片要求描述不能为空
                        $title = isset($req['title']) ? trim(strval($req['title'])) : '';
                        if($title === '') {
                            $this->error("综合题第" . ($sidx + 1) . "小题图片要求" . ($ridx + 1) . "描述不能为空");
                        }
                        // 删除 answer_image 字段
                        if(isset($req['answer_image'])) {
                            unset($contentArr[$sidx]['image_reqs'][$ridx]['answer_image']);
                        }
                    }
                }
            }
            // 确保 answer 格式正确（兼容旧格式：字符串数组 -> 新格式对象数组）
            if(!is_array($answerArr)) $answerArr = [];
            foreach($contentArr as $sidx => $sub) {
                if(!isset($answerArr[$sidx])) {
                    // 如果该小题没有答案，初始化为空
                    $answerArr[$sidx] = ['answer' => '', 'answer_images' => []];
                } else if(is_string($answerArr[$sidx])) {
                    // 旧格式：字符串 -> 转换为新格式
                    $answerArr[$sidx] = ['answer' => $answerArr[$sidx], 'answer_images' => []];
                } else if(!is_array($answerArr[$sidx])) {
                    // 其他非数组类型，转换为字符串
                    $answerArr[$sidx] = ['answer' => strval($answerArr[$sidx]), 'answer_images' => []];
                } else {
                    // 已经是数组格式，确保包含必要字段
                    if(!isset($answerArr[$sidx]['answer'])) $answerArr[$sidx]['answer'] = '';
                    if(!isset($answerArr[$sidx]['answer_images']) || !is_array($answerArr[$sidx]['answer_images'])) {
                        $answerArr[$sidx]['answer_images'] = [];
                    }
                }
            }
        }
        // 其他题型：留空（未来可扩展）
    }

    /**
     * 封装文件核查清理逻辑：根据当前版本的 question 数据检查 attach 目录，删除 question 数据里不存在的文件
     * @param int $ex_question_id 题目ID
     * @param array $answerArr 题目 answer 数组（已处理后的最终版本）
     * @param int $pkind 题型
     * @return array 返回 expected 文件集合（用于后续清理）
     */
    private function cleanupAnswerImageFiles($ex_question_id, $answerArr, $pkind) {
        $ojPath = config('OjPath.');
        $item = db('ex_question')->where('ex_question_id', $ex_question_id)->find();
        if(!$item) return [];
        
        $attach = $item['attach'] ?? '';
        if($attach === '') return [];
        
        $answerDir = $ojPath['PUBLIC'] . $ojPath['ex_question_ATTACH'] . '/' . $attach . '/answer_image';
        if(!is_dir($answerDir)) return [];
        
        // 收集所有应该存在的文件（从 answer 字段读取）
        $expected = [];
        $this->dbgAnswerImg($ex_question_id, 'cleanup.begin', [
            'pkind' => $pkind,
            'answerDir' => $answerDir,
            'dir_list_before' => @scandir($answerDir) ?: [],
        ]);
        
        if($pkind == 15) {
            // 简答题：从 answer[0].answer_images 读取
            if(isset($answerArr[0]) && is_array($answerArr[0]) && isset($answerArr[0]['answer_images']) && is_array($answerArr[0]['answer_images'])) {
                foreach($answerArr[0]['answer_images'] as $imgUrl) {
                    if($imgUrl && is_string($imgUrl) && trim($imgUrl) !== '') {
                        $fname = basename($imgUrl);
                        if($fname && strpos($fname, 'tmp_') !== 0) { // 排除临时文件
                            $expected[$fname] = true;
                        }
                    }
                }
            }
        } else if($pkind == 20) {
            // 综合题：从每个 answer[idx].answer_images 读取
            foreach($answerArr as $ansItem) {
                if(is_array($ansItem) && isset($ansItem['answer_images']) && is_array($ansItem['answer_images'])) {
                    foreach($ansItem['answer_images'] as $imgUrl) {
                        if($imgUrl && is_string($imgUrl) && trim($imgUrl) !== '') {
                            $fname = basename($imgUrl);
                            if($fname && strpos($fname, 'tmp_') !== 0) { // 排除临时文件
                                $expected[$fname] = true;
                            }
                        }
                    }
                }
            }
        }
        $this->dbgAnswerImg($ex_question_id, 'cleanup.expected', [
            'expected_files' => array_keys($expected),
        ]);
        
        // 删除不在 expected 集合中的文件
        $files = scandir($answerDir);
        foreach($files as $f) {
            if($f === '.' || $f === '..') continue;
            $full = $answerDir . '/' . $f;
            if(is_file($full) && !isset($expected[$f])) {
                $this->dbgAnswerImg($ex_question_id, 'cleanup.delete', [
                    'file' => $f,
                ]);
                @unlink($full);
            }
        }
        $this->dbgAnswerImg($ex_question_id, 'cleanup.end', [
            'dir_list_after' => @scandir($answerDir) ?: [],
        ]);
        
        return $expected;
    }

    // NOTE: 不做额外“归一化/兼容”逻辑，按系统统一约定：PUBLIC 为站点静态根目录（如 /var/www/public/fusion）
    public function BaseAuth() {
        if($this->OJ_MODE != 'cpcsys' || $this->OJ_STATUS != 'exp') {
            $this->error('题目管理仅适用于考试模式', '/');
        }
        if(!$this->canViewQuestionBank()) {
            $this->error('无访问权限', '/');
        }
    }
    
    public function question_list() {
        if($this->OJ_MODE != 'cpcsys' || $this->OJ_STATUS != 'exp') {
            $this->error('题目管理仅适用于考试模式', '/');
        }
        $this->assign('pagetitle', "Admin Question");
        $this->assign('can_manage_question_bank', $this->canManageQuestionBank());
        return $this->fetch();
    }
    
    public function question_list_ajax() {
        $columns = ['ex_question_id', 'title', 'pkind', 'source', 'author', 'label', 'create_at', 'update_at'];
        // 兼容两种调用方式：
        // - bootstrap-table server 端分页：会传 offset/limit
        // - 需要一次性加载全量：不传 offset/limit，则默认不分页（返回全量 rows）
        $has_offset = input('?offset');
        $has_limit = input('?limit');
        $offset = $has_offset ? input('offset/d', 0) : 0;
        $limit = $has_limit ? input('limit/d', 25) : null;
        $sort = trim(input('sort/s', ''));
        $sort = validate_item_range($sort, $columns);
        $order = input('order/s', 'desc');
        $search = trim(input('search/s', ''));
        // 题型筛选：支持数组格式（多个题型）
        $pkind = input('pkind/a', []);
        if(!is_array($pkind)) {
            $pkind = [];
        }
        // 过滤掉非数字值
        $pkind = array_filter(array_map('intval', $pkind), function($v) { return $v >= 0; });
        
        // 使用 course_item 表联查过滤课程
        $Question = db('ex_question');
        $map = [];
        
        // 如果设置了 NOW_COURSE_ID，需要添加别名（因为 applyQueryFilterToQuery 会添加 join）
        if($this->NOW_COURSE_ID) {
            $Question->alias('eq');
        }
        
        $Question = $this->applyQueryFilterToQuery($Question, $map, 'ex_question');
        
        // 题型筛选
        if(!empty($pkind)) {
            if($this->NOW_COURSE_ID) {
                $Question->where('eq.pkind', 'in', $pkind);
            } else {
                $Question->where('pkind', 'in', $pkind);
            }
        }
        
        // 搜索条件：整串模糊匹配（不做空白分词；允许搜索包含空格的内容）
        if(strlen($search) > 0) {
            if($this->NOW_COURSE_ID) {
                $Question->where(function($query) use ($search) {
                    $query->whereOr('eq.ex_question_id', 'like', "%$search%")
                        ->whereOr('eq.title', 'like', "%$search%")
                        ->whereOr('eq.source', 'like', "%$search%")
                        ->whereOr('eq.author', 'like', "%$search%")
                        ->whereOr('eq.label', 'like', "%$search%");
                });
            } else {
                $Question->where(function($query) use ($search) {
                    $query->whereOr('ex_question_id', 'like', "%$search%")
                        ->whereOr('title', 'like', "%$search%")
                        ->whereOr('source', 'like', "%$search%")
                        ->whereOr('author', 'like', "%$search%")
                        ->whereOr('label', 'like', "%$search%");
                });
            }
        }
        
        // 字段和排序
        if($this->NOW_COURSE_ID) {
            $Question->field('eq.ex_question_id,eq.title,eq.pkind,eq.source,eq.author,eq.label,eq.create_at,eq.update_at');
            if(strlen($sort) > 0) {
                $Question->order('eq.' . $sort, $order);
            } else {
                $Question->order('eq.ex_question_id', 'desc');
            }
        } else {
            $Question->field('ex_question_id,title,pkind,source,author,label,create_at,update_at');
            if(strlen($sort) > 0) {
                $Question->order($sort, $order);
            } else {
                $Question->order('ex_question_id', 'desc');
            }
        }
        
        if($limit !== null) {
            $ret = $Question->limit($offset, $limit)->select();
        } else {
            $ret = $Question->select();
        }
        
        // 确保返回的是数组格式
        if(is_object($ret) && method_exists($ret, 'toArray')) {
            $ret = $ret->toArray();
        }
        if(!is_array($ret)) {
            $ret = [];
        }
        
        // 计算总数
        $QuestionTotal = db('ex_question');
        $total_map = [];
        
        // 如果设置了 NOW_COURSE_ID，需要添加别名（因为 applyQueryFilterToQuery 会添加 join）
        if($this->NOW_COURSE_ID) {
            $QuestionTotal->alias('eq');
        }
        
        $QuestionTotal = $this->applyQueryFilterToQuery($QuestionTotal, $total_map, 'ex_question');
        
        // 题型筛选
        if(!empty($pkind)) {
            if($this->NOW_COURSE_ID) {
                $QuestionTotal->where('eq.pkind', 'in', $pkind);
            } else {
                $QuestionTotal->where('pkind', 'in', $pkind);
            }
        }
        
        // 搜索条件：与上方 rows 查询保持一致（整串模糊）
        if(strlen($search) > 0) {
            if($this->NOW_COURSE_ID) {
                $QuestionTotal->where(function($query) use ($search) {
                    $query->whereOr('eq.ex_question_id', 'like', "%$search%")
                        ->whereOr('eq.title', 'like', "%$search%")
                        ->whereOr('eq.source', 'like', "%$search%")
                        ->whereOr('eq.author', 'like', "%$search%")
                        ->whereOr('eq.label', 'like', "%$search%");
                });
            } else {
                $QuestionTotal->where(function($query) use ($search) {
                    $query->whereOr('ex_question_id', 'like', "%$search%")
                        ->whereOr('title', 'like', "%$search%")
                        ->whereOr('source', 'like', "%$search%")
                        ->whereOr('author', 'like', "%$search%")
                        ->whereOr('label', 'like', "%$search%");
                });
            }
        }
        $total = $QuestionTotal->count();
        
        $result = [
            'total' => $total,
            'rows' => $ret,
            'order' => $order
        ];
        
        // 直接返回数组，ThinkPHP 5.1 会自动处理
        return $result;
    }
    
    public function question_ajax() {
        $ex_question_id = input('ex_question_id/d');
        $question = db('ex_question')->where('ex_question_id', $ex_question_id)->find();
        if($question == null) {
            $this->error('No such question.');
        }
        $this->success('ok', null, $question);
    }

    /**
     * 获取使用指定 question 的考试列表（当前课程内）
     */
    public function question_usage_ajax() {
        $ex_question_id = input('ex_question_id/d');
        if ($ex_question_id == null) {
            $this->error('ex_question_id should be given');
        }
        // 使用 course_item 表联查过滤课程
        $usage_query = db('contest_problem')->alias('cp')
            ->join('contest c', 'cp.contest_id = c.contest_id', 'left')
            ->where('cp.problem_id', $ex_question_id);
        
        if($this->NOW_COURSE_ID) {
            $usage_query->join('course_item ci', 'ci.item_id = c.contest_id AND ci.item = \'contest\'', 'inner')
                ->where(['ci.course_id' => $this->NOW_COURSE_ID])
                // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                ->where(function($q) {
                    $q->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
                });
        }
        
        $usage = $usage_query->field('c.contest_id, c.title, c.start_time, c.end_time')
            ->select();
        $this->success('ok', null, $usage ?: []);
    }
    
    public function question_add() {
        // teacher 不允许写入题库：引导到“本地出题草稿”
        if(!$this->canManageQuestionBank()) {
            $this->redirect('/exadmin/question/question_draft_edit');
        }
        // 编程题绑定 OJ 题号：仅系统管理员 或 课程 super 可修改/绑定
        $can_edit_prog_binding = IsAdmin()
            || (function_exists('PrivCourse') && PrivCourse('super', $this->NOW_COURSE_KEY));
        $this->assign([
            'edit_mode' => false,
            'can_submit_db' => true,
            'readonly_mode' => false,
            'draft_mode' => false,
            'form_action' => '/exadmin/question/question_edit_ajax',
            'can_edit_prog_binding' => $can_edit_prog_binding,
        ]);
        return $this->fetch('question_edit');
    }
    
    public function question_edit() {
        $ex_question_id = input('ex_question_id/d');
        if($ex_question_id == null) {
            $this->error("ex_question_id should be given");
        }
        $item = db('ex_question')->where('ex_question_id', $ex_question_id)->find();
        if($item == null) {
            $this->error("No such question");
        }
        $this->CourseBelongValidate($item, 'ex_question');
        $can_manage = $this->canManageQuestionBank();
        // 编程题绑定 OJ 题号：仅系统管理员 或 课程 super 可修改/绑定
        $can_edit_prog_binding = IsAdmin()
            || (function_exists('PrivCourse') && PrivCourse('super', $this->NOW_COURSE_KEY));
        $this->assign([
            'question'  => $item,
            'pkind'     => $item['pkind'],
            'edit_mode' => true,
            'can_submit_db' => $can_manage,
            'readonly_mode' => !$can_manage,
            'draft_mode' => false,
            'form_action' => '/exadmin/question/question_edit_ajax',
            'can_edit_prog_binding' => $can_edit_prog_binding,
        ]);
        return $this->fetch('question_edit');
    }
    
    public function question_edit_ajax() {
        $ex_question_id      = input('ex_question_id/d');
        $answerExplainRaw = input('answer_explain');
        // 规范化 answer_explain：空串/NULL -> "[]", 其余必须是合法 JSON
        if ($answerExplainRaw === null || trim(strval($answerExplainRaw)) === '') {
            $answerExplainNormalized = '[]';
        } else {
            $answerExplainNormalized = trim(strval($answerExplainRaw));
            $decoded = json_decode($answerExplainNormalized, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->error("answer_explain 不是合法 JSON");
            }
            // 重新编码，避免非标准格式
            $answerExplainNormalized = json_encode($decoded, JSON_UNESCAPED_UNICODE);
        }

        $new_item = [
            'title'          => input('title/s'),
            'pkind'          => input('pkind/d'),
            'description'    => input('description/s'),
            'content'        => input('content'),
            'answer'         => input('answer'),
            'answer_explain' => $answerExplainNormalized,
            'source'         => input('source'),
            'author'         => input('author/s'),
            'label'          => input('label'),
        ];
        if($new_item['label'] == null) {
            $this->error("label should not be empty");
        }
        if($new_item['pkind'] == 25) {
            $new_item['description'] = intval($new_item['description']);
            // 使用 course_item 表验证题目是否属于当前课程
            $problemQuery = db('problem')->alias('p');
            if($this->NOW_COURSE_ID) {
                $problemQuery->join('course_item ci', 'ci.item_id = p.problem_id AND ci.item = \'problem\'', 'inner')
                    ->where(['ci.course_id' => $this->NOW_COURSE_ID])
                    // 兼容历史数据：pvrole 可能是 NULL 或空字符串
                    ->where(function($q) {
                        $q->whereNull('ci.pvrole')->whereOr('ci.pvrole', '');
                    });
            }
            $problem = $problemQuery->where('problem_id', $new_item['description'])->find();
            if(!$problem) {
                $this->error("No such problem in current course.");
            }
        }
        if($new_item['author'] == null || trim($new_item['author']) == '') {
            $new_item['author'] = session('user_id');
        }

        // 统一：资源表不再存 course_key，归属仅由 course_item 维护
        if(!$this->NOW_COURSE_ID) {
            $this->error("请在课程内操作（缺少 course 上下文）");
        }
        if(!$this->canManageQuestionBank()) {
            $this->error("无题库写入权限（教师请使用“出题草稿”功能）");
        }

        // ========== 编程题绑定 OJ 题号：更严格的鉴权 ==========
        // 规则：仅系统管理员 IsAdmin() 或 课程 super 可修改/绑定编程题的 OJ 题号（description 字段）
        $can_edit_prog_binding = IsAdmin()
            || (function_exists('PrivCourse') && PrivCourse('super', $this->NOW_COURSE_KEY));
        if(intval($new_item['pkind']) === 25) {
            // 新增：不允许非授权用户创建/绑定编程题（避免绕过前端直接提交）
            if(!$ex_question_id && !$can_edit_prog_binding) {
                $this->error("无权限绑定编程题的 OJ 题号（仅系统管理员/课程超级管理员可修改）");
            }
            // 修改：仅当“绑定题号发生变化”时才拦截，允许编辑其他字段
            if($ex_question_id && !$can_edit_prog_binding) {
                $old = db('ex_question')->where('ex_question_id', intval($ex_question_id))->field('ex_question_id,pkind,description')->find();
                if($old && intval($old['pkind']) === 25) {
                    $oldPid = intval($old['description']);
                    $newPid = intval($new_item['description']);
                    if($oldPid !== $newPid) {
                        $this->error("无权限修改编程题绑定的 OJ 题号（仅系统管理员/课程超级管理员可修改）");
                    }
                } else {
                    // 从非编程题切换为编程题：也视为“绑定”，需要授权
                    $this->error("无权限绑定编程题的 OJ 题号（仅系统管理员/课程超级管理员可修改）");
                }
            }
        }

        if($ex_question_id == null) {
            $uni_id = input('uni_id/s');
            if($uni_id != null) {
                $new_item['attach'] = input('attach/s');
                $question_exist = db('ex_question')->where('uni_id', $uni_id)->find();
                if($question_exist != null) {
                    $question_exist = array_merge($question_exist, $new_item);
                    db('ex_question')->update($question_exist);
                    $this->success("Question exists, Updated.", null, ["ex_question_id"=> $question_exist['ex_question_id']]);
                }
            }
            // 普通新增：生成并写库 attach（附件目录名），后续 filemanager 直接读库
            if(!isset($new_item['attach']) || $new_item['attach'] === null || trim(strval($new_item['attach'])) === '') {
                $new_item['attach'] = $this->AttachFolderCalculation(session('user_id'));
            }
            if($uni_id == null || $uni_id == '') {
                $uni_id = uniqid();
            }
            $new_item['uni_id'] = $uni_id;
            $item_id = db('ex_question')->insertGetId($new_item);
            
            // 插入到 course_item 表
            $this->afterInsertData($new_item, 'ex_question', $item_id);

            // 新增：简答/综合题支持"先上传答案图到 /tmp，再新建题目后搬运到 attach 目录"
            if($new_item['pkind'] == 15 || $new_item['pkind'] == 20) {
                $tmp_uuid = trim(input('tmp_uuid/s', ''));
                // 注意：不能用 /s，否则会对 JSON 做 htmlspecialchars，导致引号变成 &quot;，json_decode 失败，从而静默跳过搬运
                $tmpAnswerImagesJson = trim(strval(input('tmp_answer_images', '')));
                $contentArr = json_decode(strval($new_item['content']), true);
                if(!is_array($contentArr)) $contentArr = [];
                $answerArr = json_decode(strval($new_item['answer']), true);
                if(!is_array($answerArr)) $answerArr = [];
                
                // 正则化数据格式
                $this->normalizeQuestionData($new_item['pkind'], $contentArr, $answerArr);
                
                // 处理临时图片：从 tmp_answer_images 读取，移动到 attach 目录，更新 answer 字段
                $tmpAnswerImages = [];
                if($tmpAnswerImagesJson !== '') {
                    $tmpAnswerImages = json_decode($tmpAnswerImagesJson, true);
                    if(!is_array($tmpAnswerImages)) {
                        $this->error("临时答案图数据格式错误（tmp_answer_images 不是合法 JSON）");
                    }
                }
                
                if(count($tmpAnswerImages) > 0) {
                    if(!$this->validateTmpUuid($tmp_uuid)) {
                        $this->error("临时文件标识无效");
                    }
                    $tmpDir = $this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid . '/answer_image';
                    if(!is_dir($tmpDir)) {
                        $this->error("临时答案图目录不存在（请重新上传答案图）");
                    }
                    
                    $maxDim = intval(config('CsgojConfig.OJ_IMAGE_MAX_DIM'));
                    if($maxDim <= 0) $maxDim = 1024;
                    $ojPath = config('OjPath.');
                    $attach = $new_item['attach'] ?? '';
                    if($attach === '') $this->error('Question attach not found');
                    $answerDir = $ojPath['PUBLIC'] . $ojPath['ex_question_ATTACH'] . '/' . $attach . '/answer_image';
                    if(!MakeDirs($answerDir)) $this->error('Folder permission denied.');
                    $urlBase = $ojPath['ex_question_ATTACH'] . '/' . $attach . '/answer_image';
                    
                    // 处理每个临时图片
                    foreach($tmpAnswerImages as $tmpImg) {
                        $subIdx = isset($tmpImg['sub_idx']) ? intval($tmpImg['sub_idx']) : 0;
                        $reqIdx = isset($tmpImg['req_idx']) ? intval($tmpImg['req_idx']) : 0;
                        $fileName = isset($tmpImg['file_name']) ? trim(strval($tmpImg['file_name'])) : '';
                        
                        if($fileName === '' || strpos($fileName, 'tmp_') !== 0) continue;
                        
                        $src = $tmpDir . '/' . $fileName;
                        if(!is_file($src)) {
                            $this->error("临时答案图文件不存在：{$fileName}（请重新上传）");
                        }
                        
                        // 生成最终文件名
                        if($new_item['pkind'] == 15) {
                            $dstName = $this->makeAnswerImageFilename($item_id, 1, $reqIdx + 1);
                        } else {
                            $dstName = $this->makeAnswerImageFilename($item_id, $subIdx + 1, $reqIdx + 1);
                        }
                        $dst = $answerDir . '/' . $dstName;
                        if(is_file($dst)) @unlink($dst);
                        
                        if(!$this->moveFile($src, $dst)) {
                            $this->error("搬运答案图失败：{$fileName}");
                        }
                        
                        $info = @getimagesize($dst);
                        if(!$info || intval($info[0]) > $maxDim || intval($info[1]) > $maxDim) {
                            $this->error("答案图尺寸不合法：{$dstName}（要求长宽均不超过 {$maxDim}px）");
                        }
                        if(isset($info[2]) && intval($info[2]) !== $this->getWebpImageType()) {
                            $this->error("答案图格式不合法：{$dstName}（仅允许 WebP）");
                        }
                        
                        // 更新 answer 字段中的图片路径
                        $finalUrl = $urlBase . '/' . $dstName;
                        if($new_item['pkind'] == 15) {
                            if(!isset($answerArr[0]) || !is_array($answerArr[0])) {
                                $answerArr[0] = ['answer' => '', 'answer_images' => []];
                            }
                            if(!isset($answerArr[0]['answer_images']) || !is_array($answerArr[0]['answer_images'])) {
                                $answerArr[0]['answer_images'] = [];
                            }
                            while(count($answerArr[0]['answer_images']) <= $reqIdx) {
                                $answerArr[0]['answer_images'][] = '';
                            }
                            $answerArr[0]['answer_images'][$reqIdx] = $finalUrl;
                        } else {
                            while(count($answerArr) <= $subIdx) {
                                $answerArr[] = ['answer' => '', 'answer_images' => []];
                            }
                            if(!isset($answerArr[$subIdx]) || !is_array($answerArr[$subIdx])) {
                                $answerArr[$subIdx] = ['answer' => '', 'answer_images' => []];
                            }
                            if(!isset($answerArr[$subIdx]['answer_images']) || !is_array($answerArr[$subIdx]['answer_images'])) {
                                $answerArr[$subIdx]['answer_images'] = [];
                            }
                            while(count($answerArr[$subIdx]['answer_images']) <= $reqIdx) {
                                $answerArr[$subIdx]['answer_images'][] = '';
                            }
                            $answerArr[$subIdx]['answer_images'][$reqIdx] = $finalUrl;
                        }
                    }
                    
                    // 清理临时目录
                    DelWhatever($this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid);
                    
                    // 更新数据库
                    db('ex_question')->where('ex_question_id', $item_id)->update([
                        'content' => json_encode($contentArr, JSON_UNESCAPED_UNICODE),
                        'answer' => json_encode($answerArr, JSON_UNESCAPED_UNICODE),
                        'update_at' => date('Y-m-d H:i:s')
                    ]);
                    
                    // 使用封装的清理方法：根据当前版本的 question 数据检查 attach 目录，删除不存在的文件
                    $this->cleanupAnswerImageFiles($item_id, $answerArr, $new_item['pkind']);
                } else {
                    // 未定义图片要求：若存在 tmp_uuid，清理临时目录避免 /tmp 堆积
                    if($this->validateTmpUuid($tmp_uuid)) {
                        DelWhatever($this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid);
                    }
                    // 正则化后更新数据库
                    db('ex_question')->where('ex_question_id', $item_id)->update([
                        'content' => json_encode($contentArr, JSON_UNESCAPED_UNICODE),
                        'answer' => json_encode($answerArr, JSON_UNESCAPED_UNICODE),
                        'update_at' => date('Y-m-d H:i:s')
                    ]);
                }
            }
            
            $this->success("Add success", "question_edit", ["ex_question_id"=> $item_id]);
        } else {
            $item = db('ex_question')->where('ex_question_id', $ex_question_id)->find();
            if($item == null) {
                $this->error("No such question.");
            } else if($item['pkind'] != $new_item['pkind']) {
                $doneCnt = db('ex_asheet')->where('ex_question_id', $ex_question_id)->count();
                if($doneCnt > 0) {
                    $this->error("题目已存在作答记录，禁止修改题型。");
                }
            }
            // 必须属于当前课程（course_item）
            $this->CourseBelongValidate($item, 'ex_question');
            if($item['uni_id'] == null || $item['uni_id'] == '') {
                $new_item['uni_id'] = uniqid();
            }
            $item = array_merge($item, $new_item);
            $item['update_at'] = date('Y-m-d H:i:s');

            // 简答/综合题：统一从 /tmp 移动到 attach 目录，并清理 answer_image 目录野文件
            if($item['pkind'] == 15 || $item['pkind'] == 20) {
                $tmp_uuid = trim(input('tmp_uuid/s', ''));
                // 注意：不能用 /s，否则会对 JSON 做 htmlspecialchars，导致引号变成 &quot;，json_decode 失败，从而静默跳过搬运
                $tmpAnswerImagesJson = trim(strval(input('tmp_answer_images', '')));
                $this->dbgAnswerImg($ex_question_id, 'modify.begin', [
                    'tmp_uuid' => $tmp_uuid,
                    'tmp_answer_images_len' => strlen($tmpAnswerImagesJson),
                    'tmp_answer_images_head' => substr($tmpAnswerImagesJson, 0, 200),
                ]);
                $contentArr = json_decode(strval($item['content']), true);
                if(!is_array($contentArr)) $contentArr = [];
                $answerArr = json_decode(strval($item['answer']), true);
                if(!is_array($answerArr)) $answerArr = [];
                
                // 正则化数据格式
                $this->normalizeQuestionData($item['pkind'], $contentArr, $answerArr);
                
                // 处理临时图片：从 tmp_answer_images 读取，移动到 attach 目录，更新 answer 字段
                $tmpAnswerImages = [];
                if($tmpAnswerImagesJson !== '') {
                    $tmpAnswerImages = json_decode($tmpAnswerImagesJson, true);
                    if(!is_array($tmpAnswerImages)) {
                        $this->error("临时答案图数据格式错误（tmp_answer_images 不是合法 JSON）");
                    }
                }
                $this->dbgAnswerImg($ex_question_id, 'modify.parsed', [
                    'tmp_images_count' => count($tmpAnswerImages),
                    'tmp_images' => $tmpAnswerImages,
                ]);
                
                if(count($tmpAnswerImages) > 0) {
                    if(!$this->validateTmpUuid($tmp_uuid)) {
                        $this->error("临时文件标识无效");
                    }
                    $tmpDir = $this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid . '/answer_image';
                    if(!is_dir($tmpDir)) {
                        $this->error("临时答案图目录不存在（请重新上传答案图）");
                    }
                    $this->dbgAnswerImg($ex_question_id, 'modify.tmpdir', [
                        'tmpDir' => $tmpDir,
                        'tmpDir_exists' => is_dir($tmpDir),
                    ]);
                    
                    $maxDim = intval(config('CsgojConfig.OJ_IMAGE_MAX_DIM'));
                    if($maxDim <= 0) $maxDim = 1024;
                    $ojPath = config('OjPath.');
                    $attach = $item['attach'] ?? '';
                    if($attach === '') $this->error('Question attach not found');
                    $answerDir = $ojPath['PUBLIC'] . $ojPath['ex_question_ATTACH'] . '/' . $attach . '/answer_image';
                    if(!MakeDirs($answerDir)) $this->error('Folder permission denied.');
                    $urlBase = $ojPath['ex_question_ATTACH'] . '/' . $attach . '/answer_image';
                    
                    // 处理每个临时图片
                    foreach($tmpAnswerImages as $tmpImg) {
                        $subIdx = isset($tmpImg['sub_idx']) ? intval($tmpImg['sub_idx']) : 0;
                        $reqIdx = isset($tmpImg['req_idx']) ? intval($tmpImg['req_idx']) : 0;
                        $fileName = isset($tmpImg['file_name']) ? trim(strval($tmpImg['file_name'])) : '';
                        
                        if($fileName === '' || strpos($fileName, 'tmp_') !== 0) continue;
                        
                        $src = $tmpDir . '/' . $fileName;
                        if(!is_file($src)) {
                            $this->error("临时答案图文件不存在：{$fileName}（请重新上传）");
                        }
                        $this->dbgAnswerImg($ex_question_id, 'modify.move.before', [
                            'src' => $src,
                            'src_size' => @filesize($src),
                            'subIdx' => $subIdx,
                            'reqIdx' => $reqIdx,
                            'fileName' => $fileName,
                        ]);
                        
                        // 生成最终文件名
                        if($item['pkind'] == 15) {
                            $dstName = $this->makeAnswerImageFilename($ex_question_id, 1, $reqIdx + 1);
                        } else {
                            $dstName = $this->makeAnswerImageFilename($ex_question_id, $subIdx + 1, $reqIdx + 1);
                        }
                        $dst = $answerDir . '/' . $dstName;
                        if(is_file($dst)) @unlink($dst);
                        
                        if(!$this->moveFile($src, $dst)) {
                            $this->error("搬运答案图失败：{$fileName}");
                        }
                        $this->dbgAnswerImg($ex_question_id, 'modify.move.after', [
                            'dst' => $dst,
                            'dst_is_file' => is_file($dst),
                            'dst_size' => @filesize($dst),
                        ]);
                        
                        $info = @getimagesize($dst);
                        if(!$info || intval($info[0]) > $maxDim || intval($info[1]) > $maxDim) {
                            $this->error("答案图尺寸不合法：{$dstName}（要求长宽均不超过 {$maxDim}px）");
                        }
                        if(isset($info[2]) && intval($info[2]) !== $this->getWebpImageType()) {
                            $this->error("答案图格式不合法：{$dstName}（仅允许 WebP）");
                        }
                        
                        // 更新 answer 字段中的图片路径
                        $finalUrl = $urlBase . '/' . $dstName;
                        if($item['pkind'] == 15) {
                            if(!isset($answerArr[0]) || !is_array($answerArr[0])) {
                                $answerArr[0] = ['answer' => '', 'answer_images' => []];
                            }
                            if(!isset($answerArr[0]['answer_images']) || !is_array($answerArr[0]['answer_images'])) {
                                $answerArr[0]['answer_images'] = [];
                            }
                            while(count($answerArr[0]['answer_images']) <= $reqIdx) {
                                $answerArr[0]['answer_images'][] = '';
                            }
                            $answerArr[0]['answer_images'][$reqIdx] = $finalUrl;
                        } else {
                            while(count($answerArr) <= $subIdx) {
                                $answerArr[] = ['answer' => '', 'answer_images' => []];
                            }
                            if(!isset($answerArr[$subIdx]) || !is_array($answerArr[$subIdx])) {
                                $answerArr[$subIdx] = ['answer' => '', 'answer_images' => []];
                            }
                            if(!isset($answerArr[$subIdx]['answer_images']) || !is_array($answerArr[$subIdx]['answer_images'])) {
                                $answerArr[$subIdx]['answer_images'] = [];
                            }
                            while(count($answerArr[$subIdx]['answer_images']) <= $reqIdx) {
                                $answerArr[$subIdx]['answer_images'][] = '';
                            }
                            $answerArr[$subIdx]['answer_images'][$reqIdx] = $finalUrl;
                        }
                    }
                    
                    // 清理临时目录
                    DelWhatever($this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid);
                    $this->dbgAnswerImg($ex_question_id, 'modify.tmp.cleaned', [
                        'tmp_base' => $this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid,
                    ]);
                    
                    // 更新数据库
                    $item['content'] = json_encode($contentArr, JSON_UNESCAPED_UNICODE);
                    $item['answer'] = json_encode($answerArr, JSON_UNESCAPED_UNICODE);
                    
                    // 使用封装的清理方法：根据当前版本的 question 数据检查 attach 目录，删除不存在的文件
                    $this->cleanupAnswerImageFiles($ex_question_id, $answerArr, $item['pkind']);
                    $this->dbgAnswerImg($ex_question_id, 'modify.cleanup.done', [
                        'answerDir' => $answerDir,
                        'answerDir_list' => @scandir($answerDir) ?: [],
                    ]);
                } else {
                    // 未定义图片要求：若存在 tmp_uuid，清理临时目录避免 /tmp 堆积
                    if($this->validateTmpUuid($tmp_uuid)) {
                        DelWhatever($this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid);
                    }
                    // 正则化后更新数据库
                    $item['content'] = json_encode($contentArr, JSON_UNESCAPED_UNICODE);
                    $item['answer'] = json_encode($answerArr, JSON_UNESCAPED_UNICODE);
                    
                    // 即使没有新上传图片，也要根据 answer 引用清理 attach 目录野文件（例如：删除图片要求/调整答案图引用）
                    $this->cleanupAnswerImageFiles($ex_question_id, $answerArr, $item['pkind']);
                    $this->dbgAnswerImg($ex_question_id, 'modify.cleanup.no_new.done', [
                        'answerDir' => isset($answerDir) ? $answerDir : '',
                    ]);
                }
            }

            db('ex_question')->update($item);
            $this->success("Modify success");
        }
    }

    /**
     * 统一上传简答/综合题“答案图”（必须为 webp，且长宽都不超过 OJ_IMAGE_MAX_DIM）
     * 统一逻辑：无论新增还是修改，都先上传到 /tmp 目录，保存时才移动到 attach 目录
     */
    public function answer_image_upload_ajax() {
        $ex_question_id = input('ex_question_id/d', 0);
        $sub_idx = input('sub_idx/d', 0);
        $req_idx = input('req_idx/d', 0);
        if($sub_idx < 0 || $req_idx < 0) $this->error('idx not valid');
        if(!IsAdmin('problem_editor') && !IsAdmin('contest_editor') && !PrivCourse('teacher', $this->NOW_COURSE_KEY)) {
            $this->error("无课程管理权限");
        }

        $file = request()->file('upload_file');
        if(!$file) $this->error('No file uploaded');

        $maxDim = intval(config('CsgojConfig.OJ_IMAGE_MAX_DIM'));
        if($maxDim <= 0) $maxDim = 1024;
        $ojPath = config('OjPath.');
        $tmp_uuid = trim(input('tmp_uuid/s', ''));

        // ========== 统一逻辑：无论新增还是修改，都上传到 /tmp 目录 ==========
        // 如果 tmp_uuid 为空，生成新的（新增题目或首次上传）
        if($tmp_uuid === '') {
            $tmp_uuid = GenerateUuidV4();
        }
        if(!$this->validateTmpUuid($tmp_uuid)) {
            $this->error('tmp_uuid not valid');
        }

        // 如果是修改题目，验证题目存在性和权限
        if($ex_question_id > 0) {
            $item = db('ex_question')->where('ex_question_id', $ex_question_id)->find();
            if(!$item) $this->error('No such question');
            $this->CourseBelongValidate($item, 'ex_question');
        }

        // 统一上传到临时目录
        $answerDir = $this->getAnswerImageTmpBaseDir() . '/' . $tmp_uuid . '/answer_image';
        if(!MakeDirs($answerDir)) $this->error('Folder permission denied.');

        $fname = $this->makeTmpAnswerImageFilename(($sub_idx + 1), ($req_idx + 1));
        $dest = $answerDir . '/' . $fname;
        if(is_file($dest)) @unlink($dest);

        $info = $file->validate([
            'size' => config('CsgojConfig.OJ_UPLOAD_ATTACH_MAXSIZE'),
            'ext'  => 'webp'
        ])->move($answerDir, $fname, true);
        if(!$info) {
            $this->error("Upload failed: " . ($file->getError()));
        }

        $finalPath = $answerDir . '/' . $fname;
        if(!is_file($finalPath)) {
            $this->error("Upload failed: file not saved to {$finalPath}");
        }
        $imgInfo = @getimagesize($finalPath);
        if(!$imgInfo) {
            @unlink($finalPath);
            $this->error('Invalid image');
        }
        if(intval($imgInfo[0]) > $maxDim || intval($imgInfo[1]) > $maxDim) {
            @unlink($finalPath);
            $this->error("Image too large: {$imgInfo[0]}x{$imgInfo[1]} (max {$maxDim}px)");
        }
        if(isset($imgInfo[2]) && intval($imgInfo[2]) !== $this->getWebpImageType()) {
            @unlink($finalPath);
            $this->error('Only WebP allowed');
        }

        $retData = [
            'tmp_uuid'  => $tmp_uuid,
            'file_name' => $fname,
            'file_url'  => '',  // 临时文件，不返回 URL
        ];
        // debug 信息仅在 app_debug=true 时由统一口子注入
        if(function_exists('CsgAppendDebugData')) {
            CsgAppendDebugData($retData, [
                'PUBLIC' => $ojPath['PUBLIC'] ?? null,
                'ex_question_ATTACH' => $ojPath['ex_question_ATTACH'] ?? null,
                'tmp_answer_dir' => $answerDir,
                'final_path' => $finalPath,
            ]);
        }
        $this->success('ok', null, $retData);
    }
    
    public function question_export() {
        if(!$this->canManageQuestionBank()) {
            $this->error("无题库导出权限");
        }
        return $this->fetch();
    }
    
    public function question_import() {
        if(!$this->canManageQuestionBank()) {
            $this->error("无题库导入权限");
        }
        return $this->fetch();
    }

    /**
     * 本地出题草稿：列表页（基于浏览器 IndexedDB）
     * - teacher 可用（不落库）
     */
    public function question_draft_list() {
        if($this->OJ_MODE != 'cpcsys' || $this->OJ_STATUS != 'exp') {
            $this->error('题目管理仅适用于考试模式', '/');
        }
        if(!$this->canViewQuestionBank()) {
            $this->error('无访问权限', '/');
        }
        $this->assign([
            'pagetitle' => '出题草稿',
            'NOW_COURSE_KEY' => $this->NOW_COURSE_KEY,
        ]);
        return $this->fetch('question_draft_list');
    }

    /**
     * 本地出题草稿：编辑页（复用 question_edit 视图 + question_edit.js 渲染）
     * - 不提交数据库；只允许保存到本地 idb / 导出 JSON
     */
    public function question_draft_edit() {
        if($this->OJ_MODE != 'cpcsys' || $this->OJ_STATUS != 'exp') {
            $this->error('题目管理仅适用于考试模式', '/');
        }
        if(!$this->canViewQuestionBank()) {
            $this->error('无访问权限', '/');
        }
        $draft_id = trim(input('draft_id/s', ''));
        $this->assign([
            'edit_mode' => false,
            'can_submit_db' => false,
            'readonly_mode' => false,
            'draft_mode' => true,
            'draft_id' => $draft_id,
            'form_action' => 'javascript:void(0);',
            'NOW_COURSE_KEY' => $this->NOW_COURSE_KEY,
        ]);
        return $this->fetch('question_edit');
    }
    
    public function question_list_get() {
        if(!$this->NOW_COURSE_ID) {
            $this->error("请在课程内操作（缺少 course 上下文）");
        }

        $qids = input('qids/a', []);
        if(!is_array($qids)) $qids = [];
        $qids = array_values(array_filter(array_map('intval', $qids), function($v){ return $v > 0; }));
        $query_type = trim(strtolower(input('query_type/s', '')));

        // 生成“请求集合”（用于 missing 检测）
        $requested_ids = [];
        $a = null; $b = null;
        if($query_type === 'range') {
            if(count($qids) < 2) {
                $this->error("ID range not right.");
            }
            $a = intval($qids[0]);
            $b = intval($qids[1]);
            if($a > $b) { $tmp = $a; $a = $b; $b = $tmp; }
            if(($b - $a) > 255){
                $this->error("Don't export more than 256 questions once");
            }
            $requested_ids = range($a, $b);
        } else {
            if(count($qids) > 256) {
                $this->error("Don't export more than 256 questions once");
            }
            $requested_ids = $qids;
        }

        // ====== 查询：一次拿“存在于 DB 的 id”，一次拿“属于本 course 的 rows” ======
        // （不逐个查，避免 O(n) DB 往返）
        $existQuery = db('ex_question');
        if($query_type === 'range') {
            $existQuery->where('ex_question_id', 'between', [$a, $b]);
        } else {
            $existQuery->where('ex_question_id', 'in', $requested_ids);
        }
        $existing_ids = array_values(array_unique(array_map('intval', $existQuery->column('ex_question_id'))));
        sort($existing_ids);

        // 本 course rows：使用 course_item 联查过滤（Exadminbase hook）
        $Q = db('ex_question');
        $Q = $this->applyQueryFilterToQuery($Q, [], 'ex_question');
        if($query_type === 'range') {
            $Q->where('ex_question_id', 'between', [$a, $b]);
        } else {
            $Q->where('ex_question_id', 'in', $requested_ids);
        }
        $rows = $Q->select();
        if(is_object($rows) && method_exists($rows, 'toArray')) {
            $rows = $rows->toArray();
        }
        if(!is_array($rows)) $rows = [];

        $in_course_ids = array_values(array_unique(array_map('intval', array_column($rows, 'ex_question_id'))));
        sort($in_course_ids);

        $out_of_course_ids = array_values(array_diff($existing_ids, $in_course_ids));
        sort($out_of_course_ids);

        $missing_ids = array_values(array_diff(array_map('intval', $requested_ids), $existing_ids));
        sort($missing_ids);

        $meta = [
            'course_id' => intval($this->NOW_COURSE_ID),
            'course_key' => strval($this->NOW_COURSE_KEY),
            'query_type' => $query_type,
            'requested_ids' => $requested_ids,
            'existing_ids' => $existing_ids,
            'in_course_ids' => $in_course_ids,
            'out_of_course_ids' => $out_of_course_ids,
            'missing_ids' => $missing_ids,
        ];

        $this->success("OK", null, [
            'rows' => $rows,
            'meta' => $meta,
        ]);
    }
    
    public function problem_attach_list_get() {
        $pids = input('pids/a');
        return db('problem')->where('problem_id', 'in', $pids)->field(['problem_id', 'attach'])->select();
    }

    /**
     * 专用：导入题目时上传附件（支持相对子目录，如 answer_image）
     * 参数：
     * - ex_question_id
     * - rel_path（可选，相对路径，包含子目录但不得包含 ..）
     * - upload_file[] 文件
     */
    public function question_attach_upload_ajax() {
        $qid = intval(input('ex_question_id/d'));
        if ($qid <= 0) {
            $this->error('invalid id');
        }
        if (!IsAdmin('ex_question', $qid)) {
            $this->error("You don't own this item.");
        }
        $question = db('ex_question')->where('ex_question_id', $qid)->field(['ex_question_id','attach'])->find();
        if (!$question || !isset($question['attach']) || $question['attach'] === '') {
            $this->error('no attach directory');
        }
        $this->CourseBelongValidate($question, 'ex_question');

        $relPath = trim(strval(input('rel_path/s', '')));
        $relPath = str_replace(['\\'], '/', $relPath);
        // 安全检查：禁止 ..，禁止绝对路径
        if (strpos($relPath, '..') !== false || strpos($relPath, ':') !== false) {
            $this->error('invalid rel_path');
        }
        $relDir = '';
        $finalName = '';
        if ($relPath !== '') {
            $parts = explode('/', $relPath);
            $finalName = array_pop($parts);
            $relDir = implode('/', $parts);
        }

        if (!$finalName) {
            // 如果未提供文件名，用上传文件名
            $files = request()->file("upload_file");
            if (!$files || count($files) == 0) {
                $this->error('no file');
            }
            $finalName = $files[0]->getInfo('name');
        }

        $ojPath = config('OjPath.');
        $baseDisk = rtrim($ojPath['PUBLIC'], '/') . rtrim($ojPath['ex_question_ATTACH'], '/') . '/' . $question['attach'];
        $targetDir = $baseDisk;
        if ($relDir !== '') {
            $targetDir .= '/' . $relDir;
        }
        if (!MakeDirs($targetDir)) {
            $this->error('Folder permission denied.');
        }

        $files = request()->file("upload_file");
        if (!$files || count($files) == 0) {
            $this->error('no file');
        }
        $file = $files[0];
        $info = $file->move($targetDir, $finalName, true);
        if (!$info) {
            $this->error($file->getError());
        }
        $this->success('ok', '', [
            'file_name' => $finalName,
            'rel_path'  => ($relDir ? ($relDir . '/') : '') . $finalName,
        ]);
    }

    /**
     * 列出题目附件（限定白名单子目录），用于导出打包
     * - 只递归根目录与 answer_image，避免扫描无关复杂子目录
     */
    public function question_attach_list_ajax() {
        $qid = intval(input('ex_question_id/d'));
        if ($qid <= 0) {
            $this->error('invalid id');
        }
        // 权限：题库管理/课程归属校验
        if (!IsAdmin('ex_question', $qid)) {
            $this->error("You don't own this item.");
        }
        $question = db('ex_question')->where('ex_question_id', $qid)->field(['ex_question_id','attach'])->find();
        if (!$question || !isset($question['attach']) || $question['attach'] === '') {
            $this->success('ok', '', []);
        }
        // 课程归属校验
        $this->CourseBelongValidate($question, 'ex_question');

        $ojPath = config('OjPath.');
        $baseDisk = realpath(rtrim($ojPath['PUBLIC'], '/') . rtrim($ojPath['ex_question_ATTACH'], '/') . '/' . $question['attach']);
        if ($baseDisk === false || !is_dir($baseDisk)) {
            $this->success('ok', '', []);
        }
        $baseUrl = rtrim($ojPath['ex_question_ATTACH'], '/') . '/' . $question['attach'];
        // 只允许递归这些目录（相对路径）
        $allowed = ['', 'answer_image'];
        $files = ListFilesWithAllowlist($baseDisk, $baseUrl, $allowed);
        $this->success('ok', '', $files);
    }
    
    /**
     * 删除考题（AJAX）
     */
    public function question_delete_ajax() {
        $ex_question_id = intval(request()->post('ex_question_id', 0));
        
        if ($ex_question_id <= 0) {
            return json(['code' => 0, 'msg' => '无效的考题ID']);
        }
        
        // 权限检查：只有题库管理员可以删除
        if (!$this->canManageQuestionBank()) {
            return json(['code' => 0, 'msg' => '您没有权限删除考题']);
        }
        
        // 检查该考题是否存在
        $question = db('ex_question')->where('ex_question_id', $ex_question_id)->find();
        if (!$question) {
            return json(['code' => 0, 'msg' => '考题不存在']);
        }
        
        // 课程归属校验
        try {
            $this->CourseBelongValidate($question, 'ex_question');
        } catch (\Exception $e) {
            return json(['code' => 0, 'msg' => '权限验证失败：' . $e->getMessage()]);
        }
        
        // 检查该考题是否有答卷记录（ex_asheet）
        $asheet_count = db('ex_asheet')->where('ex_question_id', $ex_question_id)->count();
        if ($asheet_count > 0) {
            return json(['code' => 0, 'msg' => '该考题有答卷记录，无法删除']);
        }
        
        // 检查该考题是否被考试引用（contest_problem 表中 problem_id 对应 ex_question.ex_question_id）
        $contest_problem_count = db('contest_problem')->where('problem_id', $ex_question_id)->count();
        if ($contest_problem_count > 0) {
            return json(['code' => 0, 'msg' => '该考题已被考试引用，无法删除']);
        }
        
        // 所有检查通过，执行删除
        // 开启事务
        Db::startTrans();
        try {
            // 删除 ex_question 表中的记录
            db('ex_question')->where('ex_question_id', $ex_question_id)->delete();
            
            // 删除 privilege_item 表中的关联记录（如果有）
            db('privilege_item')
                ->where('rightitem', 'ex_question')
                ->where('item_id', $ex_question_id)
                ->delete();
            
            // 删除 course_item 表中的关联记录（如果有）
            db('course_item')
                ->where('item', 'ex_question')
                ->where('item_id', $ex_question_id)
                ->delete();
            
            // 提交事务
            Db::commit();
            
            // 删除 attach 目录（在事务提交后执行，避免文件系统错误导致事务回滚）
            if (!empty($question['attach'])) {
                $ojPath = config('OjPath.');
                $attachDir = rtrim($ojPath['PUBLIC'], '/') . rtrim($ojPath['ex_question_ATTACH'], '/') . '/' . $question['attach'];
                if (is_dir($attachDir) && function_exists('DelWhatever')) {
                    @DelWhatever($attachDir);
                }
            }
            
            return json(['code' => 1, 'msg' => '删除成功']);
        } catch (\Exception $e) {
            // 回滚事务
            Db::rollback();
            return json(['code' => 0, 'msg' => '删除失败：' . $e->getMessage()]);
        }
    }
}

