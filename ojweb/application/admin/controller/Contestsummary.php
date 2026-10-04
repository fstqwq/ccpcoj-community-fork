<?php
namespace app\admin\controller;

use app\common\funcs\CsgOjWireInstant;
use think\Controller;
use think\db\Expression;
use think\response\Jsonp;

class Contestsummary extends Adminbase
{
    /** @var array */
    var $ojPath;
    var $ojResults;
    var $ojLang;
    var $userDict;
    /** @var array */
    var $synScore;
    var $taskName;
    var $dirToZip;
    var $levelScore;    // 等级分差
    var $contest;

    public function initialize()
    {
        parent::initialize();
        $this->GetConfigs();
    }
    public function GetConfigs() {
        $this->ojResults = config('CsgojConfig.OJ_RESULTS');
        $this->ojLang = config('CsgojConfig.OJ_LANGUAGE');
        $this->ojPath = config('OjPath.');
        // 归档目录按课程隔离
        $this->ojPath['summary_contest'] = rtrim(strval($this->ojPath['summary_contest']), "/\\") . DIRECTORY_SEPARATOR . strval($this->NOW_COURSE_KEY);
        $this->userDict = [];
        $this->taskName = "Summary-" . date('Y-m-d-H-i-s') . "-" . session("user_id");
        if(($task_name_prefix = input('task_name_prefix/s')) != null) {
            $this->taskName = $task_name_prefix . '-' . $this->taskName;
        }
        $this->dirToZip = [];
        $this->levelScore = $this->EXP_LEVEL_SCORE;
    }
    public function contest_summary() {
        return $this->fetch();
    }
    public function contest_summary_ajax() {
        $cidList = explode("\n", trim(input('cid_list/s')));
        if(count($cidList) > 64) {
            $this->error("Too many contests.");
        }
        // TP5.1：避免 where(['field'=>['in', $arr]]) 这种 TP5.0 风格数组写法，统一使用显式 where
        $contestList = db('contest')
            ->where('contest_id', 'in', $cidList)
            ->where('private', 'in', [0,1,4,10,11,14])
            ->select();
        $this->synScore = [];
        $this->GetConfigs();
        set_time_limit(180); // 有些数据比较大，可能需要压缩久一点，php默认30秒超时，所以这里改一下

        // ====== 导出包总览文件（README / manifest / contest_list / index）======
        $this->WriteExportMetaFiles($contestList);

        foreach($contestList as $contest) {
            $this->SummaryOneContest($contest);
        }
        $totalSynScoreStr = $this->SummarySynScore($contestList);
        $this->WriteMd("", $totalSynScoreStr, "total_syn_score", true);
        $this->ZipContestFiles();
        $this->success("ok", "/admin/contestsummary/download?file=" . $this->taskName . ".zip");
    }

    /**
     * 生成 contest 目录名（与 SummaryOneContest 逻辑保持一致）
     */
    protected function GetContestSummaryBaseFolder($contest) {
        return $contest['contest_id'] . "-" . trim(preg_replace('/\s+|\.|\\\|\\/|\:|\*|\?|\"|\<|\>|\|/', '_', $contest['title']));
    }

    /**
     * 写入导出包的顶层元信息文件
     */
    protected function WriteExportMetaFiles($contestList) {
        $generatedAt = date('Y-m-d H:i:s');
        $courseKey = strval($this->NOW_COURSE_KEY);
        $userId = strval(session('user_id'));

        $manifest = [
            'schema_version' => 1,
            'task_name' => $this->taskName,
            'generated_at' => $generatedAt,
            'course_key' => $courseKey,
            'generated_by' => $userId,
            'contest_count' => is_array($contestList) ? count($contestList) : 0,
            'contests' => []
        ];

        $csv = "contest_id,title,start_time,end_time,clss_id,private,defunct,folder\n";

        $indexMd = "# 归档目录（Archive Index）\n\n";
        $indexMd .= "> 生成时间（Generated At）: {$generatedAt}\n\n";
        $indexMd .= "| Contest ID | Title | Start | End | Class | Folder |\n";
        $indexMd .= "|:--:|:--|:--|:--|:--:|:--|\n";

        if(is_array($contestList)) {
            foreach($contestList as $c) {
                $folder = $this->GetContestSummaryBaseFolder($c);
                $row = [
                    'contest_id' => intval($c['contest_id']),
                    'title' => strval($c['title']),
                    'start_time' => strval($c['start_time'] ?? ''),
                    'end_time' => strval($c['end_time'] ?? ''),
                    'clss_id' => intval($c['clss_id'] ?? 0),
                    'private' => intval($c['private'] ?? 0),
                    'defunct' => strval($c['defunct'] ?? ''),
                    'folder' => $folder
                ];
                $manifest['contests'][] = $row;

                $titleCsv = str_replace('"', '""', $row['title']);
                $folderCsv = str_replace('"', '""', $folder);
                $csv .= $row['contest_id'] . ",\"" . $titleCsv . "\"," . $row['start_time'] . "," . $row['end_time'] . "," . $row['clss_id'] . "," . $row['private'] . "," . $row['defunct'] . ",\"" . $folderCsv . "\"\n";

                $safeTitle = str_replace('|', '\\|', $row['title']);
                $indexMd .= "| {$row['contest_id']} | {$safeTitle} | {$row['start_time']} | {$row['end_time']} | {$row['clss_id']} | [{$folder}]({$folder}/README.md) |\n";
            }
        }

        $readme = "# 练习/考试归档包（Contest Summary Archive）\n\n";
        $readme .= "- 课程组（Course Key）：`{$courseKey}`\n";
        $readme .= "- 导出人（Generated By）：`{$userId}`\n";
        $readme .= "- 生成时间（Generated At）：`{$generatedAt}`\n\n";
        $readme .= "## 建议阅读顺序（Recommended Order）\n\n";
        $readme .= "1. `contest_index.md`（目录导航）\n";
        $readme .= "2. 进入每个 contest 目录阅读 `README.md` / `problemset.md` / `rank.md` / `solution.md`\n\n";
        $readme .= "## 内容结构（Structure）\n\n";
        $readme .= "- `contest_index.md`：目录导航（入口）\n";
        $readme .= "- `contest_list.csv`：可用 Excel 打开查看的 contest 列表\n";
        $readme .= "- `manifest.json`：机器可读元信息（便于二次加工）\n";
        $readme .= "- `系统参数(System_Parameter).json`：导出时的课程配置快照\n";
        $readme .= "- `<contest_id>-<title>/`：每场 contest 的归档目录\n\n";

        $this->WriteFile("", "README.md", $readme, true);
        $this->WriteFile("", "contest_index.md", $indexMd, true);
        $this->WriteFile("", "contest_list.csv", $csv, true);
        $this->WriteFile("", "manifest.json", json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), true);
    }
    public function WriteMd($baseFolder, $content, $filename, $addToZip=false) {
        $baseFolder = trim(strval($baseFolder), '/');
        $tmpFolder = $this->ojPath['summary_contest_temp'] . '/' . $this->taskName . ($baseFolder !== '' ? '/' . $baseFolder : '');
        if(!MakeDirs($tmpFolder)) {
            $this->error('Folder permission denied.');
        }
        file_put_contents($tmpFolder . '/' . $filename . '.md', $content);
        // file_put_contents($tmpFolder . '/' . $filename . '.html', ParseMarkdown($content, true, 4, $filename));
        if($addToZip) {
            $zipPath = ($baseFolder !== '' ? ($baseFolder . '/') : '') . $filename . '.md';
            $this->dirToZip[$zipPath] = $tmpFolder . '/' . $filename . '.md';
            // $this->dirToZip[$baseFolder . '/' . $filename . '.html'] = $tmpFolder . '/' . $filename . '.html';
        }
    }

    /**
     * 写入任意文件（支持 md/json/csv 等），并按相对路径加入 zip
     */
    protected function WriteFile($baseFolder, $filenameWithExt, $content, $addToZip=false) {
        $baseFolder = trim(strval($baseFolder), '/');
        $tmpFolder = $this->ojPath['summary_contest_temp'] . '/' . $this->taskName . ($baseFolder !== '' ? '/' . $baseFolder : '');
        if(!MakeDirs($tmpFolder)) {
            $this->error('Folder permission denied.');
        }
        file_put_contents($tmpFolder . '/' . $filenameWithExt, $content);
        if($addToZip) {
            $zipPath = ($baseFolder !== '' ? ($baseFolder . '/') : '') . $filenameWithExt;
            $this->dirToZip[$zipPath] = $tmpFolder . '/' . $filenameWithExt;
        }
    }
    public function SummarySynScore(&$contestList) {
        $ret_content = "# 实验综合成绩（Comprehensive Score）\n\n";
        $ret_content .= "| Idx | User ID | Nick | Syn Score |";
        foreach($contestList as $contest){
            $ret_content .= $contest['contest_id'] . " | ";
        }
        $ret_content .= "\n";
        $ret_content .= "|:----|:--------|:-----|:----------|";
        foreach($contestList as $contest){
            $ret_content .= ":-----|";
        }
        $ret_content .= "\n";
        ksort($this->userDict);
        $contestNum = count($contestList);
        $i = 1;
        foreach($this->userDict as $user_id=>$userinfo) {
            if(array_key_exists($user_id, $this->synScore)) {
                /** @var array $scu */
                $scu = &$this->synScore[$user_id];
                $ret_content .= "| " . $i . " | " . $userinfo['user_id'] . " | " . $userinfo['nick'] . " | ";
                $scu['total_aver'] = 0;
                $scoreStr = "";
                foreach($contestList as $contest) {
                    $cid = $contest['contest_id'];
                    if(array_key_exists($cid, $scu)) {
                        /** @var array $scContest */
                        $scContest = $scu[$cid];
                        $aver = $scContest['aver'];
                        $scoreStr .= intval(round($aver)) . " | ";
                        $scu['total_aver'] += $aver / $contestNum;
                    } else {
                        $scoreStr .= 0 . " | ";
                    }
                }
                $ret_content .= intval(round($scu['total_aver'])) . " | " . $scoreStr . "\n";
                $i ++;
            }
        }
        return $ret_content;
    }
    public function SummaryOneContest($contest) {
        $contestSummaryBaseFolder = $this->GetContestSummaryBaseFolder($contest);
        $this->dirToZip[$contestSummaryBaseFolder] = $this->ojPath['summary_contest_temp'] . '/' . $this->taskName . '/' . $contestSummaryBaseFolder;

        // meta.json + README.md（目录导航）
        $meta = [
            'contest_id' => intval($contest['contest_id']),
            'title' => strval($contest['title']),
            'start_time' => strval($contest['start_time'] ?? ''),
            'end_time' => strval($contest['end_time'] ?? ''),
            'clss_id' => intval($contest['clss_id'] ?? 0),
            'private' => intval($contest['private'] ?? 0),
            'defunct' => strval($contest['defunct'] ?? ''),
            'folder' => $contestSummaryBaseFolder,
        ];
        $this->WriteFile($contestSummaryBaseFolder, "meta.json", json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), true);
        $cReadme = "# Contest 归档目录（Contest Folder）\n\n";
        $cReadme .= "- Contest ID：`" . intval($contest['contest_id']) . "`\n";
        $cReadme .= "- 标题（Title）：`" . strval($contest['title']) . "`\n\n";
        $cReadme .= "## 文件（Files）\n\n";
        $cReadme .= "- `problemset.md`：题面（Problemset）\n";
        $cReadme .= "- `solution.md`：提交代码（Solutions）\n";
        $cReadme .= "- `rank.md`：排名（Rank）\n";
        $cReadme .= "- `sample_good.md / sample_medium.md / sample_bad.md`：质量示例（Samples）\n";
        $cReadme .= "- `meta.json`：元信息（Metadata）\n";
        $this->WriteFile($contestSummaryBaseFolder, "README.md", $cReadme, true);
        // *************************
        // problems
        $problem = $this->ContestProblem($contest);
        // $problem['md'] = preg_replace('/!\[.*?\]\(\/upload/', '![](upload', $problem['md']);
        $problem['md'] = preg_replace('/(["\'\[=\(])\/upload\//', '$1upload/', $problem['md']); // 替换OJ路径为导出目录的相对路径
        $this->WriteMd($contestSummaryBaseFolder, $problem['md'], 'problemset');
        foreach($problem['info'] as $pro) {
            $problemAttachPath = $this->ojPath['PUBLIC'] . $this->ojPath['problem_ATTACH'] . '/' . $pro['attach'];
            if(is_dir($problemAttachPath)) {
                $this->dirToZip[$contestSummaryBaseFolder . $this->ojPath['problem_ATTACH'] . '/' . $pro['attach']] = $problemAttachPath;
            }
        }
        
        // *************************
        // submission
        $solution = $this->ContestSolution($contest, false);
        $solutionList = $solution['info'];
        $this->WriteMd($contestSummaryBaseFolder, $solution['md'], 'solution');

        // *************************
        // rank
        $rank = $this->GetRank($contest, $solutionList);
        $this->WriteMd($contestSummaryBaseFolder, $rank['md'], 'rank');
        
        // *************************
        // Quality Classification
        $quality = $this->QualityClassification($contest);
        foreach($quality['md'] as $key=>$qc) {
            $this->WriteMd($contestSummaryBaseFolder, $qc, 'sample_' . $key);
        }

        // *************************
        // syn score
        $this->SynScore($contest, $solutionList);
    }
    public function sec2str($sec) {
        // 训练类比赛可能超过100小时，多于二位数了。
        if($sec < 360000)
            $sec = sprintf("%02d:%02d:%02d", $sec / 3600, $sec % 3600 / 60, $sec % 60);
        else
            $sec = sprintf("%d:%02d:%02d", $sec / 3600, $sec % 3600 / 60, $sec % 60);
        return $sec;
    }
    public function ContestProblemId($ith)
    {
        //比赛题目编号计算, 0是A, 1是B，26是AA，类似Excel横轴命名规则
        $ret = '';
        $ith = intval($ith) + 1;
        while($ith > 0)
        {
            $ret = chr(($ith - 1) % 26 + ord('A')) . $ret;
            $ith = intval(($ith - 1) / 26);
        }
        return $ret;
    }
    public function ProblemIdMap($contest)
    {
        // 题号1xxx、ABCD、num的0123 题号的对应关系
        //[
        //    'abc2id'=>//ABC->10xx题号映射,
        //     'id2abc'=>//10xx->ABC题号映射,
        //     'id2num'=>//10xx->0、1、2(num)
        //]
        $problemIdList = db('contest_problem')
            ->where('contest_id', $contest['contest_id'])
            ->field([
                'problem_id',
                'num'
            ])
            ->order('num', 'asc')
            ->cache(60)
            ->select();

        $problemIdMap = [
            'abc2id' => [],
            'id2abc' => [],
            'id2num' => []
        ];
        if($problemIdList == null) {
            //这种情况一般不会发生，如果真的有，那是管理员操作不当，页面出问题也难免
            $this->error('No problem found in contest ' . $contest['contest_id'] . ' ' . $contest['title']);
        }
        foreach($problemIdList as $problemId)
        {
            $alphabetId = $this->ContestProblemId($problemId['num']);
            $problemIdMap['abc2id'][$alphabetId] = $problemId['problem_id'];
            $problemIdMap['id2abc'][$problemId['problem_id']] = $alphabetId;
            $problemIdMap['id2num'][$problemId['problem_id']] = $problemId['num'];
        }
        return $problemIdMap;
    }
    public function ContestProblem($contest) {
        // 获取一场比赛的Problem信息，返回 problem 数据与 markdown 文本
        $ret_content = "";
        $problem_list_export = [];
        $problemIdMap = $this->ProblemIdMap($contest);
        foreach($problemIdMap['id2abc'] as $key=>$val){
            $problem_list_export[] = intval($key);
        }
        $problem_list_export = array_unique($problem_list_export);
        if(count($problem_list_export) == 0)
            $this->error("Cannot find problems for contest ". $contest['contest_id']);
        // ThinkPHP 5.1：避免 whereMap 里 in 条件被错误嵌套成 ['IN', ['in', [...]]]，改用显式 whereIn
        $orderMap = new Expression("field(p.problem_id,". implode(",", $problem_list_export) .")");
        
        $Problem = db('problem');
        $problemList = $Problem->alias('p')
            ->join([problem_md_join_default_subquery_sql() => 'pmd'], 'p.problem_id = pmd.problem_id', 'left')
            ->whereIn('p.problem_id', $problem_list_export)
            ->order($orderMap)
            ->field([
                'p.problem_id problem_id',
                'p.title title',
                'p.attach attach',
                'p.sample_input sample_input',
                'p.sample_output sample_output',
                'p.spj spj',
                'p.time_limit time_limit',
                'p.memory_limit memory_limit',
                'pmd.description description_md',
                'pmd.input input_md',
                'pmd.output output_md',
                'pmd.hint hint_md',
                'pmd.source source_md',
                'pmd.author author_md',
            ])
            ->select();
        $ret_content .= "# 题目\n\n";
        foreach($problemList as $pro){
            $ret_content .= "## " . $problemIdMap['id2abc'][$pro['problem_id']] . "(" . $pro['problem_id'] . ")：" . $pro['title'] . "\n\n";
            $ret_content .= "> Time Limit: " . $pro['time_limit'] . "s    \t Memory Limit: " . $pro['memory_limit'] . "MB    \t Special Judge: " . ($pro['spj']=='0' ? "False" : "True") . "\n\n";            
            $ret_content .= $pro['description_md'] . "\n\n";
            $ret_content .= "### Input\n\n" . $pro['input_md'] . "\n\n";
            $ret_content .= "### Output\n\n" . $pro['output_md'] . "\n\n";
            $ret_content .= "### Sample Input\n\n````txt\n" . $pro['sample_input'] . "\n````\n\n";
            $ret_content .= "### Sample Output\n\n````txt\n" . $pro['sample_output'] . "\n````\n\n";
            if(strlen(trim($pro['hint_md'])) > 0)
                $ret_content .= "### Hint\n\n" . $pro['hint_md'] . "\n\n";
            if(strlen(trim($pro['source_md'])) > 0)
                $ret_content .= "### Source\n\n" . $pro['source_md'] . "\n\n";
            if(strlen(trim($pro['author_md'])) > 0)
                $ret_content .= "### Author\n\n" . $pro['author_md'] . "\n\n";
        }
        return [
            'info'  => $problemList,
            'md'    => $ret_content
        ];
    }
    public function ContestUser($contest) {
        // 基于solution表获取一场比赛的用户信息
        // standard 格式的 contest 暂不处理
        if($contest['private'] % 10 == 0) {
            // Public Contest
            $userList = db('solution')->alias('s')
            ->join('users u', 'u.user_id = s.user_id', 'left')
            ->where('s.contest_id', $contest['contest_id'])
            ->group('s.user_id,u.nick,u.school,u.email')
            ->field([
                's.user_id user_id',
                'u.nick nick',
                'u.school school',
                'u.email tmember',
                '"" coach',
            ])
            ->cache(60)
            ->select();
        } else if($contest['private'] % 10 == 4) {
            // 班级练习：使用新权限体系 privilege_item（rightitem='clss'）
            $clss_id = intval($contest['clss_id'] ?? 0);
            if($clss_id <= 0) {
                $this->error("Contest {$contest['contest_id']} is clss-mode but clss_id is invalid");
            }
            $pvrole_member_roles = GetPvroleConfig('clss_member_roles', ['student', 'ta']);
            if(!is_array($pvrole_member_roles) || count($pvrole_member_roles) === 0) {
                $pvrole_member_roles = ['student', 'ta'];
            }
            $user_id_list = db('privilege_item')->where([
                'rightitem' => 'clss',
                'item_id' => $clss_id,
                'defunct' => '0'
            ])->where('pvrole', 'in', $pvrole_member_roles)->column('user_id');
            $user_id_list = array_values(array_unique(array_filter($user_id_list)));
            $userList = count($user_id_list) > 0
                ? db('users')->where('user_id', 'in', $user_id_list)->cache(60)->select()
                : [];
        }
        else {
            // Private Contest
            // 新权限体系：privilege_item.rightitem='contest', pvrole='' 表示参赛（见 PrivilegeRole.contest_participant；查询兼容 NULL）
            $contest_id = intval($contest['contest_id']);
            $userList = db('privilege_item')->alias('pi')
                ->join('users u', 'u.user_id = pi.user_id', 'left')
                ->where([
                    'pi.rightitem' => 'contest',
                    'pi.item_id' => $contest_id,
                    'pi.defunct' => '0',
                ])->whereNull('pi.pvrole')
                ->group('u.user_id,u.nick,u.school,u.email')
                ->field([
                    'u.user_id user_id',
                    'u.nick nick',
                    'u.school school',
                    'u.email tmember',
                    '"" coach',
                ])
                ->cache(60)
                ->select();
        }
        foreach($userList as $val) {
            if(!array_key_exists($val['user_id'], $this->userDict)) {
                $this->userDict[$val['user_id']] = $val;
            }
        }
        return $userList;
    }
    
    public function GetRankData($contest, &$solutionList) {
        $rankDataList = [];
        //把所有solution整理为以user_id为键的一条条成绩信息
        $firstBlood = [];
        
        // 先获取用户列表，Online版只需要nick，比赛里需要只计算比赛账号的rank，以免 fb 计算错误
        // 解释：对于比赛系统，生成账号交题后，重新生成账号去掉了已交题账号，避免这个交题记录被作为fb，造成rank实际用户fb无信息
        $userList = $this->ContestUser($contest);
        $problemIdMap = $this->ProblemIdMap($contest);
        // 获取solution信息计算rank数据
        foreach($solutionList as $s)
        {
            if(!array_key_exists($s['problem_id'], $problemIdMap['id2abc']))
                continue;
            if(!array_key_exists($s['user_id'], $this->userDict))
                continue;
            if(!array_key_exists($s['user_id'], $rankDataList))
                $rankDataList[$s['user_id']] = [
                    //solved和penalty放在前两个，sort的时候就很方便不需要额外写comp函数了。
                    'solved'  => 0,         // AC题数
                    'penalty' => 0,         // 罚时（分钟, minutes）
                    'pass_rate' => [],      // 各题 pass_rate，取最大值
                    'wa_num' => [],         // 在AC之前错了几次，AC之后的数据忽略
                    'ac_sec' => [],         // 第一次AC距离比赛开始时间（秒，seconds），之后的数据忽略
                    'tr_num' => [],         // 封榜后尝试次数
                ];
            $rankData = &$rankDataList[$s['user_id']];
            if(array_key_exists($s['problem_id'], $rankData['ac_sec']))
                continue;
    
            if($s['result'] == 4)
            {
                $rankData['ac_sec'][$s['problem_id']] = strtotime($s['in_date']) - strtotime($contest['start_time']);
                $rankData['solved'] ++;
                //用负数，sort的时候就很方便了。
                $rankData['penalty'] -= $rankData['ac_sec'][$s['problem_id']] + (array_key_exists($s['problem_id'], $rankData['wa_num']) ? (1200 * $rankData['wa_num'][$s['problem_id']]) : 0);

                //添加first blood标记，多个人同一秒出题则都是fb
                if(!array_key_exists($s['problem_id'], $firstBlood))
                    $firstBlood[$s['problem_id']] = [
                        'userlist' => [],
                        'time'    => $rankData['ac_sec'][$s['problem_id']]
                    ];
                if($firstBlood[$s['problem_id']]['time'] == $rankData['ac_sec'][$s['problem_id']])
                    $firstBlood[$s['problem_id']]['userlist'][] = $s['user_id'];
            }
            else
            {
                $rankData['wa_num'][$s['problem_id']] = array_key_exists($s['problem_id'], $rankData['wa_num']) ? $rankData['wa_num'][$s['problem_id']] + 1 : 1;
            }
            if(!array_key_exists($s['problem_id'], $rankData['pass_rate']) || $s['pass_rate'] > $rankData['pass_rate'][$s['problem_id']]){
                $rankData['pass_rate'][$s['problem_id']] = $s['pass_rate'];
            }
        }
        foreach($userList as $user)
        {
            foreach($user as $key=>&$value)
            {
                if ($value == null || trim($value) == '') {
                    $value = '-';
                }
            }
            $user['school'] = strtoupper($user['school']);
            // 如果比赛开始后管理员删除了题目，这里也要避免只交了删除题目的用户进入榜单数据里，否则会因为缺少预处理部分
            // 的数据（比如'solved'等）而报错
            if(!array_key_exists($user['user_id'], $rankDataList))
                continue;
            $rankDataList[$user['user_id']]['userinfo'] = $user;
        }
        // #####################排序在此处，就一行。此时各时间数据还是秒的int格式#######################
        arsort($rankDataList);
        return [$firstBlood, $rankDataList];
    }
    public function GetRankList($contest, &$solutionList)
    {
        // 计算一场比赛的 rank，以数据形式返回（而非html）
        $data = $this->GetRankData($contest, $solutionList);
        $rankDataList = &$data[1];
        $retList = [];
        $i = 0;
        $lastSolved = -1;
        $lastPenalty = -1;
        $problemIdMap = $this->ProblemIdMap($contest);
        foreach($rankDataList as $key=>&$rankData)
        {
            if(!isset($rankData['userinfo'])) {
                // 没有 userinfo，不合法数据
                continue;
            }
            $star_team = strlen($rankData['userinfo']['nick']) > 0 && $rankData['userinfo']['nick'][0] == '*';
            if(!$star_team && ($rankData['solved'] != $lastSolved || $rankData['solved'] == $lastSolved && $rankData['penalty'] != $lastPenalty))
            {
                $i ++;
                $lastPenalty = $rankData['penalty'];
                $lastSolved = $rankData['solved'];
            }
            $row = [
                'rank'        => $star_team ? "*" : $i,
                'nick'        => htmlspecialchars($rankData['userinfo']['nick']),    //要转换html标签，以防用户使用特殊标签做nick
                'solved'      => $rankData['solved'],
                'penalty'     => $this->sec2str(-$rankData['penalty']), //前面用负数方便sort，此时反过来
                'school'        => htmlspecialchars($rankData['userinfo']['school']),    //要转换html标签，以防用户使用特殊标签做nick
            ];
            $row['user_id'] = $key;
            // 每道题的显示内容
            foreach($problemIdMap['id2abc'] as $pid => $apid)
            {
                if(array_key_exists($pid, $rankData['ac_sec'])) {
                    $row[$apid] = $this->sec2str($rankData['ac_sec'][$pid]);
                } 
                if(!array_key_exists($apid, $row)) {
                    $row[$apid] = "";
                }
                $row[$apid] .= array_key_exists($pid, $rankData['wa_num']) ? ('(-' . $rankData['wa_num'][$pid].')') : '';
            }
            $retList[] = $row;
        }
        return $retList;
    }
    public function GetRank($contest, &$solutionList) {
        // 获取用于归档的 rank
        $ret_content = "# 排名（Rank List）\n\n";
        $problemIdMap = $this->ProblemIdMap($contest);
        $rank = $this->GetRankList($contest, $solutionList);
        // header
        $ret_content .= "| Rank | User ID | Nick | School | Member | Solved | Penalty | ";
        foreach($problemIdMap['id2abc'] as $key=>$val){
            $ret_content .= $val . "     | ";
        }
        $ret_content .= "\n";
        $ret_content .= "|:-----|:--------|:-----|:-------|:-------|:-------|:--------|";
        foreach($problemIdMap['id2abc'] as $key=>$val){
            $ret_content .= ":------|";
        }
        $ret_content .= "\n";
        // table body
        foreach($rank as $item) {
            // user info
            $ret_content .= "| " . $item['rank'] . " | " . $item['user_id'] . " | " . $item['nick'] . " | " . $item['school'] . " | " .
                (array_key_exists('tmember', $item) ? $item['tmember'] : "") . " | " . $item['solved'] . " | " . $item['penalty'] . " | ";
            // each problem score
            foreach($problemIdMap['id2abc'] as $key=>$val){
                $ret_content .= (array_key_exists($val, $item) && strlen(trim($item[$val])) > 0 ? $item[$val] : "") . " | ";
            }
            $ret_content .= "\n";
        }
        return [
            'info'  => $rank,
            'md'    => $ret_content
        ];
    }
    public function SolContent($sol, $ith=null) {
        $heading = ($ith !== null && $ith !== '') ? '###' : '##';
        $title = $heading . " " . ($ith ? $ith . "--" : "") . $sol['solution_id'] . ": pro[" . $sol['problem_id'] . "] user[" . $sol['user_id'] . "][" . 
        (array_key_exists($sol['user_id'], $this->userDict) ? $this->userDict[$sol['user_id']]['nick'] : "") . "] result[" . $this->ojResults[$sol['result']] . "]\n\n";

        if(array_key_exists($sol['language'], $this->ojLang))
            $language = $this->ojLang[$sol['language']];
        else
            $language = "Unknown";
        $solContent = "````" . ($language == "Unknown" ? "" : $language);
        $solContent .= "\n/**********************************************************************\n".
            "\tProblem: ".$sol['problem_id']."\n\tUser: ".$sol['user_id']."\n".
            "\tLanguage: ".$language ."\n\tResult: ".$this->ojResults[$sol['result']]."\n";
        if ($sol['result']==4)
            $solContent .= "\tTime:".$sol['time']." ms\n"."\tMemory:".$sol['memory']." kb\n";
        if($this->Plagiarize($sol)) {
            // 抄袭情况录入代码信息
            $solContent .= "\tSimilar:".$sol['sim']."% to solution " . $sol['sim_s_id'] . "\n";
        }
        $solContent .= "**********************************************************************/\n\n";
        $solContent .= str_replace("\n\r","\n", $sol['source']);

        $solContent .= "\n````\n\n";
        return $title . $solContent;
    }
    public function ContestSolution($contest, $onlyAC=false) {
        // 获取一场比赛所有的提交信息
        // $userList = $this->ContestUser($contest);
        $ret_content = "# 代码归档\n\n";
        $Solution = db('solution');
        $map = ['contest_id' => $contest['contest_id']];
        if($onlyAC) {
            $map['result'] = 4;
        }
        $slmap = [];
        foreach($map as $key=>$val) {
            $slmap["sl." . $key] = $val;
        }
        $map = $slmap;
        $fields = [
            'sl.solution_id solution_id',
            'sl.problem_id problem_id',
            'sl.user_id user_id',
            'sl.time time',
            'sl.memory memory',
            'sl.result result',
            'sl.language language',
            'sl.code_length code_length',
            'sl.pass_rate pass_rate',
            'sl.in_date in_date',
            'sr.solution_id sim_s_id', 
            'sr.user_id sim_user_id',       // 增加被雷同的用户id
            'sr.in_date sim_in_date',       // 增加被雷同用户提交日期
            'si.sim sim',
            'sc.source source',
            'si.sim sim',
        ];
        $solutionList = $Solution->alias('sl')
            ->join('source_code sc', 'sl.solution_id = sc.solution_id', 'left')
            ->join('sim si', 'si.s_id=sl.solution_id', 'left')
            ->join('solution sr', 'sr.solution_id=si.sim_s_id', 'left')
            ->where($map)
            ->order(['sl.in_date' => 'ASC'])
            ->field($fields)
            ->cache(60)
            ->select();
        $problemIdMap = $this->ProblemIdMap($contest);
        foreach($solutionList as $sol) {
            if(!array_key_exists($sol['problem_id'], $problemIdMap['id2abc'])) {
                continue;
            }
            $ret_content .= $this->SolContent($sol);
        }
        return [
            'info'  => $solutionList,
            'md'    => $ret_content
        ];
    }
    public function ProScore($contest, $sol) {
        $start = strtotime($contest['start_time']);
        $solve = strtotime($sol['in_date']);
        $hours = ($solve - $start) / 3600;
        if($hours < 5) {
            return 100;
        } else if($hours < 24) {
            return 100 - $this->levelScore;
        } else if($hours < 168) {
            return 100 - $this->levelScore * 2;
        } else if($hours < 720) {
            return 100 - $this->levelScore * 3;
        }
        return 100 - $this->levelScore * 4;
    }

    /**
     * Bad 样本：未 AC 用户失败结果的入选优先级（越小越优先：RE > TLE > WA）
     * @return int|null
     */
    protected function QualityBadFailResultPriority($result) {
        static $prio = [10 => 0, 7 => 1, 6 => 2];
        $r = intval($result);
        return array_key_exists($r, $prio) ? $prio[$r] : null;
    }

    /**
     * 每未 AC 用户选一代表失败提交（RE > TLE > WA；同档取最后一次提交）
     * @param array $allSolList
     * @param array $acUserSet user_id => true
     * @return array
     */
    protected function QualityPickNonAcBadCandidates($allSolList, $acUserSet) {
        $byUser = [];
        foreach($allSolList as $sol) {
            if(array_key_exists($sol['user_id'], $acUserSet)) {
                continue;
            }
            $prio = $this->QualityBadFailResultPriority($sol['result']);
            if($prio === null) {
                continue;
            }
            $uid = $sol['user_id'];
            if(!array_key_exists($uid, $byUser)) {
                $byUser[$uid] = ['prio' => $prio, 'sol' => $sol];
                continue;
            }
            $cur = $byUser[$uid];
            if($prio < $cur['prio']
                || ($prio === $cur['prio'] && strcmp(strval($sol['in_date']), strval($cur['sol']['in_date'])) > 0)) {
                $byUser[$uid] = ['prio' => $prio, 'sol' => $sol];
            }
        }
        $candidates = [];
        foreach($byUser as $row) {
            $candidates[] = $row['sol'];
        }
        usort($candidates, function($a, $b) {
            $pa = $this->QualityBadFailResultPriority($a['result']);
            $pb = $this->QualityBadFailResultPriority($b['result']);
            if($pa !== $pb) {
                return $pa - $pb;
            }
            if(strcmp(strval($a['in_date']), strval($b['in_date'])) < 0) {
                return 1;
            }
            if(strcmp(strval($a['in_date']), strval($b['in_date'])) > 0) {
                return -1;
            }
            return 0;
        });
        return $candidates;
    }

    public function QualityClassification($contest) {
        // 代码质量分数，按 运行时长、内存、代码长度 排序后，返回优/中/差各至多 5 条（去重用户、跳过雷同后向后补足）
        $ordercmp = function($x, $y) {
            if($x['time'] < $y['time']) {
                return -1;
            } else if($x['time'] > $y['time']) {
                return 1;
            } else if($x['memory'] < $y['memory']) {
                return -1;
            } else if($x['memory'] > $y['memory']) {
                return 1;
            } else if($x['code_length'] < $y['code_length']) {
                return -1;
            } else if($x['code_length'] > $y['code_length']) {
                return 1;
            } else if($x['in_date'] < $y['in_date']) {
                return -1;
            } else if($x['in_date'] > $y['in_date']) {
                return 1;
            }
            return 0;
        };
        $problemIdMap = $this->ProblemIdMap($contest);
        $solution = $this->ContestSolution($contest, true); // only AC
        $solutionList = $solution['info'];
        $allSolution = $this->ContestSolution($contest, false);
        $allSolutionList = $allSolution['info'];
        $proSolOrder = [];
        $proAllOrder = [];
        $pushSol = function($sol, &$bucket) {
            $sol['time'] = intval($sol['time'] / 20) * 20;
            $sol['memory'] = intval($sol['memory'] / 200) * 200;
            $sol['code_length'] = intval($sol['code_length'] / 100) * 100;
            $bucket[] = $sol;
        };
        foreach($solutionList as $sol) {
            if(!array_key_exists($sol['problem_id'], $problemIdMap['id2abc'])) {
                continue;
            }
            $abcpid = $problemIdMap['id2abc'][$sol['problem_id']];
            if(!array_key_exists($abcpid, $proSolOrder)) {
                $proSolOrder[$abcpid] = [];
            }
            $pushSol($sol, $proSolOrder[$abcpid]);
        }
        foreach($allSolutionList as $sol) {
            if(!array_key_exists($sol['problem_id'], $problemIdMap['id2abc'])) {
                continue;
            }
            $abcpid = $problemIdMap['id2abc'][$sol['problem_id']];
            if(!array_key_exists($abcpid, $proAllOrder)) {
                $proAllOrder[$abcpid] = [];
            }
            $pushSol($sol, $proAllOrder[$abcpid]);
        }
        $pidOrder = array_keys($problemIdMap['abc2id']);
        usort($pidOrder, function($pidA, $pidB) use ($problemIdMap) {
            $numA = $problemIdMap['id2num'][$problemIdMap['abc2id'][$pidA]] ?? 0;
            $numB = $problemIdMap['id2num'][$problemIdMap['abc2id'][$pidB]] ?? 0;
            if($numA === $numB) {
                return strcmp($pidA, $pidB);
            }
            return $numA - $numB;
        });
        $good = [];
        $medium = [];
        $bad = [];
        $good_md = "# 较好示例（Good Samples）\n\n> 评价标准： AC->运行效率->占用内存->代码长度\n\n";
        $medium_md = "# 中等示例（Medium Samples）\n\n> 评价标准： AC->运行效率->占用内存->代码长度\n\n";
        $bad_md = "# 较差示例（Bad Samples）\n\n> 评价标准： 未 AC 优先（RE > TLE > WA），不足时取 AC 末位（效率/内存/代码长度）\n\n";
        $classifyNum = 5;
        foreach($pidOrder as $pid) {
            $solList = array_key_exists($pid, $proSolOrder) ? $proSolOrder[$pid] : [];
            $allSolList = array_key_exists($pid, $proAllOrder) ? $proAllOrder[$pid] : [];
            if(count($solList) === 0 && count($allSolList) === 0) {
                continue;
            }
            uasort($solList, $ordercmp);
            $ranked = [];
            $seenUser = [];
            foreach($solList as $sol) {
                if(array_key_exists($sol['user_id'], $seenUser)) {
                    continue;
                }
                $seenUser[$sol['user_id']] = true;
                $ranked[] = $sol;
            }
            $realAcNum = count($ranked);
            $acUserSet = [];
            foreach($allSolList as $sol) {
                if(intval($sol['result']) === 4) {
                    $acUserSet[$sol['user_id']] = true;
                }
            }

            $pickedUser = [];
            $appendQuality = function($sol, &$bucket, &$sectionMd, &$seq) use ($contest, $pid, &$pickedUser) {
                KeyAdd($sol['user_id'], $this->synScore);
                KeyAdd($contest['contest_id'], $this->synScore[$sol['user_id']]);
                KeyAdd($pid, $bucket);
                $bucket[$pid] = $sol;
                $sectionMd .= $this->SolContent($sol, $seq);
                $seq ++;
                $pickedUser[$sol['user_id']] = true;
            };

            $goodSection = '';
            $ig = 1;
            foreach($ranked as $sol) {
                if($ig > $classifyNum) {
                    break;
                }
                if($this->Plagiarize($sol)) {
                    continue;
                }
                $appendQuality($sol, $good, $goodSection, $ig);
            }
            if($ig > 1) {
                $good_md .= "\n## " . $pid . "\n\n" . $goodSection;
            }

            $mediumSection = '';
            $im = 1;
            if($realAcNum > $classifyNum * 2) {
                foreach($ranked as $idx => $sol) {
                    if($im > $classifyNum) {
                        break;
                    }
                    $rank = $idx + 1;
                    if($rank <= $classifyNum) {
                        continue;
                    }
                    if($realAcNum - $rank < $classifyNum) {
                        continue;
                    }
                    if($rank <= $realAcNum / 3 || $rank > $realAcNum * 2 / 3) {
                        continue;
                    }
                    if($this->Plagiarize($sol)) {
                        continue;
                    }
                    if(array_key_exists($sol['user_id'], $pickedUser)) {
                        continue;
                    }
                    $appendQuality($sol, $medium, $mediumSection, $im);
                }
            }
            if($im > 1) {
                $medium_md .= "\n## " . $pid . "\n\n" . $mediumSection;
            }

            $badSection = '';
            $ib = 1;
            $nonAcBad = $this->QualityPickNonAcBadCandidates($allSolList, $acUserSet);
            foreach($nonAcBad as $sol) {
                if($ib > $classifyNum) {
                    break;
                }
                if($this->Plagiarize($sol)) {
                    continue;
                }
                if(array_key_exists($sol['user_id'], $pickedUser)) {
                    continue;
                }
                $appendQuality($sol, $bad, $badSection, $ib);
            }
            if($realAcNum > $classifyNum) {
                for($idx = $realAcNum - 1; $idx >= 0 && $ib <= $classifyNum; $idx--) {
                    $rank = $idx + 1;
                    if($rank <= $classifyNum) {
                        break;
                    }
                    $sol = $ranked[$idx];
                    if($this->Plagiarize($sol)) {
                        continue;
                    }
                    if(array_key_exists($sol['user_id'], $pickedUser)) {
                        continue;
                    }
                    $appendQuality($sol, $bad, $badSection, $ib);
                }
            }
            if($ib > 1) {
                $bad_md .= "\n## " . $pid . "\n\n" . $badSection;
            }
        }
        return [
            'info'  => [
                'good'      => $good,
                'medium'    => $medium,
                'bad'       => $bad,
            ],
            'md'    => [
                'good'      => $good_md,
                'medium'    => $medium_md,
                'bad'       => $bad_md,
            ]
        ];
    }
    public function SynScore($contest, &$solutionList) {
        // 评分规则：5小时内、24小时内、7*24小时内、其它 四档，基准分递减 $this->levelScore 分
        // 分数区间内由代码 时间、内存、长度 三者排序设置高低
        // [
        //     'user_id' => [
        //         'contest_id' => [
        //             'A'     => 100,
        //             // ...,
        //             'total' => 500,
        //             'aver'  => 100
        //         ]
        //         'total' => 2000,
        //         'aver'  => 100
        //     ],
        //     // ...
        // ]
        $problemIdMap = $this->ProblemIdMap($contest);
        // $proNum = count($problemIdMap['abc2id']);
        // 去掉附加题分数统计（如有）
        // private 的十位用于“附加题”标记：用纯整数运算避免 / 导致 float
        $proNum = count($problemIdMap['abc2id']) - intdiv((int)$contest['private'], 10);

        foreach($solutionList as $sol) {
            if(!array_key_exists($sol['user_id'], $this->synScore)) {
                $this->synScore[$sol['user_id']] = [];
            }
            $scu = &$this->synScore[$sol['user_id']];
            KeyAdd($contest['contest_id'], $scu);
            if(!array_key_exists('aver', $scu[$contest['contest_id']])) {
                KeyAdd('aver', $scu[$contest['contest_id']], 0);
                KeyAdd('plagiarize', $scu[$contest['contest_id']], []);  // 标记抄袭
                foreach($problemIdMap['id2abc'] as $pid=>$apid) {
                    KeyAdd($apid, $scu[$contest['contest_id']], 0);
                }
            }
            if(!array_key_exists($sol['problem_id'], $problemIdMap['id2abc'])) {
                continue;
            }
            $proabc = $problemIdMap['id2abc'][$sol['problem_id']];
            // // if($sol['result'] == 4 && $scu[$contest['contest_id']][$proabc] <= 0) {   // 改为取最高分：
            if($sol['result'] == 4) {
                $tmpScore = $this->ProScore($contest, $sol);
                if($this->Plagiarize($sol)){
                    // 如果抄袭，则记录抄袭分数和被抄袭代码id
                    KeyAdd($proabc, $scu[$contest['contest_id']]['plagiarize']);
                    $scu[$contest['contest_id']]['plagiarize'][$proabc][] = [
                        'score'=> $tmpScore,
                        'sim'=> $sol['sim_s_id']
                    ];
                    // 抄袭则分数打折扣
                    $tmpScore = intval($tmpScore * $this->PLAGIARISM_SCORE);
                }
                if($problemIdMap['id2num'][$sol['problem_id']] < $proNum && $tmpScore > $scu[$contest['contest_id']][$proabc]){
                    // 不是附加题才计入总分
                    // 如果有没抄袭的提交，取最高的计算
                    $scu[$contest['contest_id']]['aver'] += $tmpScore / $proNum - $scu[$contest['contest_id']][$proabc] / $proNum;
                }
                if($tmpScore > $scu[$contest['contest_id']][$proabc]) {
                    $scu[$contest['contest_id']][$proabc] = $tmpScore;
                }
            }
        }
    }
    protected function SolutionUserRmv($user_id) {
        // 针对 cpcsys 的 solution 用户名前缀去除
        if($user_id && $user_id != '' && $user_id[0] == '#') $user_id = substr(strrchr($user_id, "_"), 1);
        return $user_id;
    }
    public function Plagiarize($sol) {
        // 判定是否抄袭扣分
        if($sol['sim'] === null || $sol['sim'] < $this->PLAGIARISM_THRESHOLD || $sol['code_length'] < $this->PLAGIARISM_MIN_LEN) {
            return false;
        }
        $sim_is_teacher = $sol['sim_user_id'] !== null && strlen($sol['sim_user_id']) <= 8; // 【临时性处理】，认为账号长度不大于8为教师
        $time_gap_s = 0;
        if($sim_is_teacher) {
            $time_late = new \DateTime($sol['in_date']);
            $time_early = new \DateTime($sol['sim_in_date']);
            $time_gap_s = $time_late->getTimestamp() - $time_early->getTimestamp();
        }
        $sim_is_self = $this->SolutionUserRmv($sol['sim_user_id']) == $this->SolutionUserRmv($sol['user_id']);
        return !$sim_is_self && (!$sim_is_teacher || $time_gap_s > 21 * 24 * 60 * 60);
    }
    public function ZipContestFiles() {
        $exportTempRoot = $this->ojPath['summary_contest_temp'];
		$exportRoot = $this->ojPath['summary_contest'];
        //在建立新的临时文件夹之前，删除旧的因为程序崩溃导致的未删除的临时文件夹。
        DelTimeExpireFolders($exportTempRoot, $this->ojPath['export_temp_keep_time']);

		//临时放置打包文件的文件夹
		$date = date('Y-m-d-H-i-s');
		$exportMakeFolder = $exportTempRoot . '/' . $date . '-' . session('user_id');
        if(!MakeDirs($exportMakeFolder))
            $this->error('Folder permission denied.');
        if(!MakeDirs($exportRoot))
            $this->error('Folder permission denied.');

        $fileName = $this->taskName . ".zip";
        //这种情况基本不会有，不过为防止建立zip失败
        if(file_exists($exportMakeFolder . '/' . $fileName))
            unlink($exportMakeFolder . '/' . $fileName);
        // 增加系统参数备案
        $jsonFilePath = $exportMakeFolder . '/系统参数.json';
        $jsonContent = json_encode($this->OJ_COURSE_NOW['course_config'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        file_put_contents($jsonFilePath, $jsonContent);

        // 将系统参数.json 文件添加到要打包的文件列表中
        $this->dirToZip['系统参数(System_Parameter).json'] = $jsonFilePath;

        $tzSidecarPath = $exportMakeFolder . '/' . CsgOjWireInstant::EXPORT_TIMEZONE_FILENAME;
        file_put_contents($tzSidecarPath, CsgOjWireInstant::exportSidecarJson());
        $this->dirToZip[CsgOjWireInstant::EXPORT_TIMEZONE_FILENAME] = $tzSidecarPath;

        // 使用全局 GetZippy()（带适配与缓存，兼容容器环境与 proc_open 限制）
        $zippy = GetZippy();
        $archive = $zippy->create(
            $exportMakeFolder . '/' . $fileName,
            $this->dirToZip,
            true
        );
        rename($exportMakeFolder . '/' . $fileName, $exportRoot . '/' . $fileName);
        //文件移动到正规目录后删除临时文件夹
        DelDirs($exportMakeFolder);
        return true;
    }
    public function summary_file_list_ajax() {
        $dirPath = $this->ojPath['summary_contest'];
		DelTimeExpireFolders($dirPath, $this->ojPath['export_keep_time']);
		$filelist = [];
		if(is_dir($dirPath) && ($handle = opendir($dirPath)))
		{
			$i = 1;
			while (($file = readdir($handle)) !== false)
			{
				if ($file!="." && $file!="..")
				{
					$filetime = filemtime($dirPath . '/' . $file);
					$filelist[] = [
						'file_lastmodify' => date("Y-m-d h:i:s", $filetime),
						'file_name'       => $file,
						'file_size'       => round(filesize($dirPath . '/' . $file) / 1024, 2),
					];
					$i ++;
				}
			}
			rsort($filelist);
			//关闭句柄
			closedir ( $handle );
		}
		return $filelist;
    }
    public function download() {
        $dirPath = $this->ojPath['summary_contest'];
        downloads($dirPath, input('file/s'));
    }
    public function delete() {
        $dirPath = $this->ojPath['summary_contest'];
        $file = trim(preg_replace('/\\\|\\/|\:|\*|\?|\"|\<|\>|\|/', '', input('file/s')));
        if($file == "" || !is_file($dirPath . "/" . $file)) {
            $this->error("No such file");
        }
        if(!DelWhatever($dirPath . '/' . $file)) {
            $this->error("Failed");
        }
        $this->success("Deleted");
    }
}