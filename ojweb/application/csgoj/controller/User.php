<?php
namespace app\csgoj\controller;
use think\Controller;
use think\Validate;
use think\Db;

class User extends Csgojbase
{
    public function index()
    {
        $this->assign(['pagetitle' => 'User']);
        return $this->fetch();
    }
    public function login_ajax() {
        $this->assertFlgAllowNewLoginSession();
        if(session('?user_id')) {
            $this->error('用户已登录，可尝试刷新页面');
        }
        $user_id = trim(input('user_id/s'));
        $password = trim(input('password/s'));
        if($user_id == null || strlen($user_id) == 0) {
            $this->error('请求数据不合法');
        }
        $userinfo = null;
        $map = array(
            'user_id' => $user_id
        );
        $userinfo = db('users')->where($map)->find();
        if($userinfo == null)
            $this->error('No such user');
        if(!CkPasswd($password, $userinfo['password'])) {
            $this->add_loginlog($userinfo['user_id'], 0);
            $this->error('Password Error!');
        }
        $userinfo['password'] = '';
        $privileges = $this->login_oper($userinfo);
        $this->add_loginlog($userinfo['user_id'], 1);
        //在登录这种相对低频操作时更新用户资料的ac数和submit数，用于显示总用户rank
        $this->update_user_solved_submit($user_id);

        $this->success('Login successful!<br/>Reloading data.', null, ['userinfo'=>$userinfo, 'privileges'=>$privileges]);
    }
    public function login_oper($userinfo) {
        return LoginOper($userinfo);
    }
    public function add_loginlog($user_id, $success){
        AddLoginlog($user_id, $success);
    }
    public function logout_ajax()
    {
        if(!session('?user_id')) {
            $this->error('User already logged out.');
        }
        $this->update_user_solved_submit(session('user_id'));
        LogoutOper();
        // PHP 7.3 不支持命名参数，使用 ThinkPHP 的标准 success($msg, $url, $data, $wait) 形式
        $this->success('Logout Successful!<br/>Reloading data.');
    }
    public function userinfo()
    {
        // 用户信息页
        $user_id = trim(input('user_id'));
        if($user_id == null || strlen($user_id) == 0) {
            $user_id = session('user_id');
        }
        if($user_id == null || strlen($user_id) == 0) {
            $this->error('You find a 404 ^_^');
        }
        $userinfo = $this->get_userinfo($user_id, false);
        if(!$userinfo)
        {
            $this->error('No such user', null, '', 1);
        }
        if($this->OJ_MODE == 'cpcsys' || session('?user_id') && session('user_id') == $userinfo['baseinfo']['user_id'] || IsAdmin('administrator'))
        {
            //只有用户本人或管理员可以看登录日志
            $loginlog = db('loginlog')->where('user_id', $userinfo['baseinfo']['user_id'])->order('time', 'desc')->limit(10)->select();
            $this->assign('loginlog', $loginlog);
        }
        $this->assign($userinfo);
        return $this->fetch();
    }
    public function get_userinfo($user_id, $simple=true)
    {
        // 用户信息页要显示的用户数据
        $userinfo = [];
        $userinfo['baseinfo'] = db('users')
            ->where('user_id', $user_id)
            ->field('user_id, email, submit, solved, ip, accesstime, reg_time, nick, school, volume')
            ->find();
        if(!$userinfo['baseinfo']) {
            return null;
        }
        if(!$simple)
        {
            // 获取更多数据
            $userinfo = array_merge($userinfo, $this->update_user_solved_submit($user_id));
            // solved/tried 列表的统计口径应与 update_user_solved_submit 保持一致：
            // - 非竞赛题目（contest_id 为 null 或 0）
            // - 练习类型的 contest（contest.private % 10 == 4）
            $applyContestFilter = function($query, $tableAlias = '') {
                $cidField = ($tableAlias ? $tableAlias . '.' : '') . 'contest_id';
                // 与 update_user_solved_submit 保持一致：普通竞赛不计入，但练习类型的 contest 计入
                $query->where(function($q) use ($cidField) {
                    $q->whereNull($cidField)->whereOr($cidField, 0);
                })->whereOr(function($q) use ($cidField) {
                    $q->where($cidField, '>', 0)
                      ->whereRaw("EXISTS (SELECT 1 FROM contest WHERE contest.contest_id = {$cidField} AND contest.private % 10 = 4)");
                });
            };

            // 注意：ThinkPHP Query 是有状态的，不要复用同一个 Query 对象做多次独立查询
            $userinfo['solvedlist'] = db('solution')
                ->alias('s')
                ->where([
                    's.user_id'    => $user_id,
                    's.result'     => 4,
                ])
                ->where('s.problem_id', '>', 0)
                ->where(function($query) use ($applyContestFilter) {
                    $applyContestFilter($query, 's');
                })
                ->field('s.problem_id problem_id')
                ->distinct(true)
                ->order('s.problem_id asc')
                ->select();

            $tmpTriedlist = db('solution')
                ->alias('s')
                ->where([
                    's.user_id'    => $user_id,
                ])
                ->where('s.problem_id', '>', 0)
                ->where(function($query) use ($applyContestFilter) {
                    $applyContestFilter($query, 's');
                })
                ->field('s.problem_id problem_id')
                ->distinct(true)
                ->order('s.problem_id asc')
                ->select();

            $i = 0;
            $j = 0;
            $solvedCnt = count($userinfo['solvedlist']);
            $triedCnt = count($tmpTriedlist);
            $userinfo['triedlist'] = [];
            for(; $j < $triedCnt; $j ++)
            {
                while($i < $solvedCnt && $userinfo['solvedlist'][$i]['problem_id'] < $tmpTriedlist[$j]['problem_id'])
                    $i ++;
                if($i < $solvedCnt && $userinfo['solvedlist'][$i]['problem_id'] == $tmpTriedlist[$j]['problem_id'])
                    continue;
                $userinfo['triedlist'][] = $tmpTriedlist[$j];
            }
            // 注意：ThinkPHP5.1 Query 有状态，这里必须使用独立查询对象计算 rank
            $userinfo['rank'] = db('users')
                ->where('solved', '>', $userinfo['solved'])
                ->whereOr(function($query)use ($userinfo) {
                    $query->where('solved', '=', $userinfo['solved'])
                          ->where('submit', '<', $userinfo['submit']);
                })  //ThinkPHP的 and or 条件也是神烦。
                ->count() + 1;
        }
        return $userinfo;

    }
    public function update_user_solved_submit($user_id)
    {
        // 更新数据库用户条目里的ac题数和提交数，这个在用户总rank里会使用，不可能每次调rank都更新全部用户。碎片化更新。
        // 统计规则：非竞赛题目 + 练习类型的竞赛题目（private % 10 == 4）
        $userinfo = [];
        
        // 统计 AC 题目数：非竞赛题目 + 练习类型的竞赛题目
        // 使用 EXISTS 子查询避免 JOIN 冲突
        $userinfo['solved'] = db('solution')
            ->alias('s')
            ->where([
                's.user_id'     => $user_id,
                's.result'      => 4,
            ])
            ->where(function($query){
                // 非竞赛题目（contest_id 为 null 或 0）
                // 或者练习类型的竞赛题目（private % 10 == 4）
                $query->where(function($q){
                    $q->whereNull('s.contest_id')
                      ->whereOr('s.contest_id', 0);
                })->whereOr(function($q){
                    $q->where('s.contest_id', '>', 0)
                      ->whereRaw('EXISTS (SELECT 1 FROM contest WHERE contest.contest_id = s.contest_id AND contest.private % 10 = 4)');
                });
            })
            // ThinkPHP 5.1：聚合查询支持 count('DISTINCT field') 生成 COUNT(DISTINCT field)
            ->count('DISTINCT s.problem_id');

        // 统计提交数：非竞赛题目 + 练习类型的竞赛题目
        $userinfo['submit'] = db('solution')
            ->alias('s')
            ->where([
                's.user_id' => $user_id,
            ])
            ->where('s.problem_id', '>', 0)
            ->where(function($query){
                // 非竞赛题目（contest_id 为 null 或 0）
                // 或者练习类型的竞赛题目（private % 10 == 4）
                $query->where(function($q){
                    $q->whereNull('s.contest_id')
                      ->whereOr('s.contest_id', 0);
                })->whereOr(function($q){
                    $q->where('s.contest_id', '>', 0)
                      ->whereRaw('EXISTS (SELECT 1 FROM contest WHERE contest.contest_id = s.contest_id AND contest.private % 10 = 4)');
                });
            })
            ->field('s.solution_id')
            ->count();
        db('users')
            ->where('user_id', $user_id)
            ->update(['solved'=>$userinfo['solved'], 'submit'=>$userinfo['submit']]);

        return $userinfo;
    }

    public function modify()
    {
        $userinfo = $this->modify_func();
        if($userinfo['baseinfo']['user_id'] != session('user_id') && !IsAdmin('password_setter'))
            $this->error('Powerless');
        $this->assign([
            'is_self'           => $userinfo['baseinfo']['user_id'] == session('user_id'),
            'target_user_id'    => $userinfo['baseinfo']['user_id'],
            'is_password_setter'=> IsAdmin('password_setter')
        ]);
        return $this->fetch();
    }
    public function modify_func()
    {
        // 修改用户信息
        $user_id = trim(input('user_id'));
        if($user_id == null || strlen($user_id) == 0)
            $user_id = session('user_id');
        else if(!session('?user_id'))
            $this->error('Please login before modify your information');
        if($user_id == null || strlen($user_id) == 0)
        {
            $this->error('Who are you?');
        }
        $userinfo = $this->get_userinfo($user_id);
        if(!$userinfo)
        {
            $this->error('No such user');
        }
        $this->assign($userinfo);
        return $userinfo;
    }
    public function modify_ajax() {
        $this->modify_ajax_func(input('post.'));
    }
    public function modify_permission($target_user_id) {

        // TP5.1：避免 where(['field'=>['in', $arr]]) 这种 TP5.0 风格数组写法，统一使用显式 where
        $userprivilege = db('privilege')
            ->where('user_id', '=', $target_user_id)
            ->where('pvrole', 'in', array_keys($this->OJ_ADMIN['OJ_ADMIN_LIST']))
            ->select();
        // administrator可以改其他管理员密码，super_admin可以改administrator密码
        if (!count($userprivilege)) {
            return true;
        }
        foreach ($userprivilege as $privilege) {
            if (
                //password_setter不可改任何有权限的帐号密码
                !IsAdmin('administrator') ||
                //非super_admin不可改administrator密码
                ($privilege['pvrole'] == 'administrator' && !IsAdmin('super_admin')) ||
                //谁都不可以在这里改super_admin密码
                $privilege['pvrole'] == 'super_admin'
            ) {
                return false;
            }
        }
    }
    public function modify_ajax_func($inputInfo)
    {
        if(!IsAdmin('password_setter')) {
            if(!captcha_check(Dget($inputInfo, 'vcode', '')))
                $this->error('Verification Code Error');
        }
        $user_id = trim(Dget($inputInfo, 'user_id', ''));
        $password = trim(Dget($inputInfo, 'password', ''));
        if(Dget($inputInfo, 'user_id') == null) {
            $this->error('User ID needed.');
        }
        else if($user_id != session('user_id')) {
            // 只有 'password_setter' 以上管理员才能修改他人信息
            if (IsAdmin('password_setter')) {
                if(!$this->modify_permission($user_id)) {
                    $this->error('You cannot change the information of an administrator.');
                }
            }
            else {
                $this->error('You have no permission to modify this user.');
            }
        }
        $userinfo = db('users')->where('user_id', $user_id)->find();
        if($userinfo == null)
            $this->error('No such user');

        if ((!IsAdmin('password_setter') || $user_id == session('user_id')) && !CkPasswd($password, $userinfo['password'])) {
            // 如果既{不是管理员 或 修改的是自己}，又无法正确验证自己的密码，则无法修改信息
            $this->error('Verify password failed');
        }
                
        if(!$this->OJ_STATUS=='exp') {
            $userinfo['nick'] = trim(Dget($inputInfo, 'nick', $userinfo['nick']));
            $userinfo['school'] = trim(Dget($inputInfo, 'school', $userinfo['school']));
        }
        // exp模式下仅能修改email
        $userinfo['email'] = trim(Dget($inputInfo, 'email', $userinfo['email']));
        if($this->OJ_STATUS=='exp') {
            $configName = 'ExpsysConfig';
        }
        else {
            $configName = 'CsgojConfig';
        }
        $validate = new Validate(config($configName . '.userinfo_rule'), config($configName . '.userinfo_msg'));
        // 资料修改不改 user_id；userinfo_rule 中 user_id 长度与注册一致（如 5～20），勿对库内旧短账号再验 user_id
        if ($this->OJ_STATUS == 'exp') {
            $validate->only(['email']);
        } else {
            $validate->only(['nick', 'school', 'email', 'password']);
        }
        if(!$validate->check($userinfo))
            $this->error($validate->getError());

        $new_password = trim(Dget($inputInfo, 'new_password', ''));
        $confirm_new_password = trim(Dget($inputInfo, 'confirm_new_password', ''));
        if($new_password != null && strlen($new_password) > 0) {
            if($new_password != $confirm_new_password) {
                $this->error('New password not confirmed right.');
            }
            if(strlen($new_password) < 6 || strlen($new_password) > 255) {
                $this->error('Password should in 6~255 characters.');
            }
            $userinfo['password'] = MkPasswd($new_password);
        }
        db('users')->where('user_id', $user_id)->update($userinfo);

        $this->success('Successfully updated<br/>Redirecting to User Infomation Page.', '', ['user_id' => $userinfo['user_id']]);
    }
    public function register()
    {
        if($this->OJ_MODE != 'online') {
            $this->error('Registration is prohibited.');
        }
        //用户注册
        if(session('?user_id'))
            $this->error('User already logged in.', null, '', 1);
        if ($this->FLG_ALLOW_REGISTER === false) {
            $this->assign('pagetitle', '注册不可用 Registration unavailable');
        } else {
            $this->assign('pagetitle', '用户注册 Register');
        }
        return $this->fetch();
    }
    public function register_ajax()
    {
        if($this->OJ_MODE != 'online') {
            $this->error('Registration is prohibited.');
        }
        $this->assertFlgAllowSelfRegister();
        if (!captcha_check(trim(input('vcode/s', '')))) {
            $this->errorBilingual('验证码错误或已过期，请重新输入。', 'The verification code is wrong or has expired. Please try again.');
        }
        $user_id = trim(input('user_id'));
        if(session('?user_id'))
        {
            $this->error('Please logout first.');
            return;
        }
        if(input('user_id') == null)
        {
            $this->error('User ID needed.');
            return;
        }
        $userinfo = db('users')->where('user_id', $user_id)->find();
        if($userinfo != null)
        {
            $this->error('User ID already exists.');
            return;
        }
        $userinfo = [
            'user_id'     => $user_id,
            'nick'         => trim(input('nick')),
            'school'     => trim(input('school')),
            'email'        => trim(input('email')),
            'password'    => trim(input('password')),
            'reg_time'    => date('Y-m-d H:i:s'),
            'accesstime'=> date('Y-m-d H:i:s'),
        ];
        $validate = new Validate(config('CsgojConfig.userinfo_rule'), config('CsgojConfig.userinfo_msg'));
        if(!$validate->check($userinfo))
        {
            $data['userinfo'] = $userinfo;
            $this->error($validate->getError(), null, $data);
            return;
        }
        $confirm_password = trim(input('confirm_password'));
        if($userinfo['password'] != $confirm_password)
        {
            $this->error('Two password not same.');
            return;
        }
        $userinfo['password'] = MkPasswd($userinfo['password']);
        $userinfo['ip'] = GetRealIp();
        db('users')->insert($userinfo);
        $this->login_oper($userinfo);
        $this->add_loginlog($userinfo['user_id'], 1);
        $this->successBilingual(
            '注册成功，正在跳转到个人资料页…',
            'Registered successfully. Redirecting to your profile…',
            '',
            ['user_id' => $userinfo['user_id']]
        );
    }

    /**************************************************/
    //Pass Back
    /**************************************************/
    public function passback()
    {
        if(session('?user_id'))
        {
            $this->error('您已登录，无需使用找回密码。 / You are already logged in; password recovery is not needed.');
        }
        return $this->fetch();
    }

    public function passback_ajax()
    {
        if(!captcha_check(input('vcode')))
            $this->errorBilingual('验证码错误。', 'Verification code error.');
        if(session('?user_id'))
        {
            $this->errorBilingual('您已登录，无需找回密码。如需修改密码请从个人中心操作。', 'You are already logged in. Change your password from your profile if needed.');
        }
        // 仅按 user_id 查库发信；长度与 users.user_id（varchar(64)）及注册最短用户名一致（原 5～20 会误拒 3～4 位合法账号）
        $user_id = trim(input('user_id/s', ''));
        if($user_id === '')
            $this->errorBilingual('请填写用户名。', 'User ID is required.');
        $len = strlen($user_id);
        if($len < 3 || $len > 64)
            $this->errorBilingual('用户名长度无效（3～64 个字符）。', 'User ID length is invalid (3–64 characters).');
        $userinfo = db('users')->where('user_id', $user_id)->find();
        if(!$userinfo)
            $this->errorBilingual('用户不存在。', 'No such user.');

        // TP5.1：cache(配置数组) 只会 connect，不会切换后续 Cache::get/set 的默认句柄；须显式传入过期秒数
        $passExpire = (int)(config('CsgojConfig.OJ_PASSBACK_CACHE_OPTION')['expire'] ?? 1200);
        $passKey = '_passback_' . $userinfo['user_id'];
        $passbackInfo = cache($passKey);
        $now = time();
        if($passbackInfo)
        {
            $waitSec = $passExpire - ($now - $passbackInfo['time']);
            $waitMin = max(0, (int)floor($waitSec / 60));
            if($waitMin < 1 && $waitSec > 0)
            {
                $this->errorBilingual(
                    '重置邮件已发送，请查收邮箱。<br/>请稍后再试（约 1 分钟内可再次申请）。',
                    'A password reset email has already been sent.<br/>Please try again in about a minute.'
                );
            }
            else
            {
                $this->errorBilingual(
                    '重置邮件已发送，请查收邮箱。<br/>请在 <strong>' . $waitMin . '</strong> 分钟后再申请发送。',
                    'A password reset email has already been sent.<br/>You can request another one after <strong>' . $waitMin . '</strong> minutes.'
                );
            }
        }

        $mailConfig = config('MailConfig.');
        if(!filter_var($userinfo['email'], FILTER_VALIDATE_EMAIL))
            $this->errorBilingual('该账号绑定的邮箱无效，无法发送重置邮件。', 'The email on file is invalid; we cannot send a reset message.');
        $passbackInfo = [
            'time'     => $now,
            'token'    => md5($now . $userinfo['user_id'] . rand()),
        ];
        $retrieveQs = http_build_query([
            'user_id' => $userinfo['user_id'],
            'token'   => $passbackInfo['token'],
        ]);
        $passbackBase = $mailConfig['passback_url'];
        $retrieveUrl = $passbackBase . (strpos($passbackBase, '?') === false ? '?' : '&') . $retrieveQs;
        $href = htmlspecialchars($retrieveUrl, ENT_QUOTES, 'UTF-8');
        $uidEsc = htmlspecialchars($userinfo['user_id'], ENT_QUOTES, 'UTF-8');
        $validMinutes = max(1, (int)ceil($passExpire / 60));
        $ojName = (string)($this->OJ_NAME ?? 'Online Judge');
        $subject = $ojName . ' 密码重置 / Password Retrieve';

        $content = '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.55;color:#1e293b;font-size:15px;">'
            . '<p style="margin:0 0 10px;"><strong>中文</strong></p>'
            . '<p style="margin:0 0 8px;">您好，用户 <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">' . $uidEsc . '</code>：</p>'
            . '<p style="margin:0 0 14px;">我们收到了您的<strong>密码找回</strong>请求。请在 <strong>' . $validMinutes . '</strong> 分钟内点击下方链接重置登录密码。若您未发起此请求，请忽略本邮件。</p>'
            . '<p style="margin:0 0 20px;"><a href="' . $href . '" style="color:#2563eb;">重置密码</a></p>'
            . '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />'
            . '<p style="margin:0 0 10px;"><strong>English</strong></p>'
            . '<p style="margin:0 0 8px;">Hello, user <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">' . $uidEsc . '</code>:</p>'
            . '<p style="margin:0 0 14px;">We received a request to <strong>reset your password</strong> for the online judge. The link below is valid for <strong>' . $validMinutes . '</strong> minutes. If you did not request this, please ignore this email.</p>'
            . '<p style="margin:0;"><a href="' . $href . '" style="color:#2563eb;">Reset password</a></p>'
            . '</div>';

        $altBody = "【中文】\r\n"
            . "您好，用户 {$userinfo['user_id']}：\r\n"
            . "我们收到了您的密码找回请求。请在 {$validMinutes} 分钟内访问下列链接重置登录密码。若您未发起此请求，请忽略本邮件。\r\n"
            . "{$retrieveUrl}\r\n\r\n"
            . "---\r\n\r\n"
            . "English\r\n"
            . "Hello, user {$userinfo['user_id']}:\r\n"
            . "We received a request to reset your password. The link below is valid for {$validMinutes} minutes. If you did not request this, please ignore this email.\r\n"
            . $retrieveUrl;

        if(!SendMail($userinfo['email'], $userinfo['user_id'], $subject, $content, $altBody))
            $this->errorBilingual(
                '邮件发送失败。您可加入 QQ 群 <strong>1065953958</strong> 在群内说明情况（请勿私聊管理员），在线管理员可协助处理。',
                'Mail delivery failed. Join QQ group <strong>1065953958</strong> and ask in the group (do not DM admins); an online admin may help.'
            );

        cache($passKey, $passbackInfo, $passExpire);
        $accEsc = htmlspecialchars((string)$mailConfig['account'], ENT_QUOTES, 'UTF-8');
        $emailEsc = htmlspecialchars((string)$userinfo['email'], ENT_QUOTES, 'UTF-8');
        $msgCn = '重置邮件已由 <code>' . $accEsc . '</code> 发出，请到邮箱 <code>' . $emailEsc . '</code> 查收。';
        $msgEn = 'Passback mail sent by <code>' . $accEsc . '</code>. Please check it in your email (<code>' . $emailEsc . '</code>).';
        $this->successBilingual($msgCn, $msgEn, null, []);
    }
    public function passback_retrieve()
    {
        if(session('?user_id'))
        {
            $this->error('您已登录，无需使用此重置链接。 / You are already logged in; this reset link is not needed.');
        }
        $user_id = trim(input('user_id/s', ''));
        $userinfo = db('users')->where('user_id', $user_id)->find();
        if(!$userinfo)
            $this->error('用户不存在。 / No such user.');

        $token = trim(input('token', ''));
        $passKey = '_passback_' . $userinfo['user_id'];
        $passbackInfo = cache($passKey);
        $authOk = false;
        if($passbackInfo && $token == $passbackInfo['token'])
            $authOk = true;
        $this->assign('authOk', $authOk);
        $this->assign('user_id', $userinfo['user_id']);
        // 失效/已用时 $passbackInfo 可能为空，禁止访问 ['token']（PHP8+ 致命）
        $this->assign('token', ($authOk && is_array($passbackInfo) && isset($passbackInfo['token'])) ? $passbackInfo['token'] : '');
        return $this->fetch();
    }
    public function passback_retrieve_ajax()
    {
        if(session('?user_id'))
        {
            $this->errorBilingual('您已登录，无需使用此链接。', 'You are already logged in; this link is not needed.');
        }
        $user_id = trim(input('user_id/s', ''));
        $userinfo = db('users')->where('user_id', $user_id)->find();
        if(!$userinfo)
            $this->errorBilingual('用户不存在。', 'No such user.');

        $token = trim(input('token', ''));
        $passKey = '_passback_' . $userinfo['user_id'];
        $passbackInfo = cache($passKey);
        if(!$passbackInfo || $token != $passbackInfo['token'])
            $this->errorBilingual(
                '链接无效或已失效，请返回找回密码页重新申请。',
                'This link is invalid or has expired. Please request password recovery again.'
            );
        $password = trim(input('password'));
        if(strlen($password) < 6)
            $this->errorBilingual('密码过短（至少 6 位）。', 'Password is too short (at least 6 characters).');
        else if(strlen($password) > 64)
            $this->errorBilingual('密码过长（至多 64 位）。', 'Password is too long (at most 64 characters).');
        $confirm_password = trim(input('confirm_password'));
        if($password != $confirm_password)
            $this->errorBilingual('两次输入的密码不一致。', 'The two passwords do not match.');
        $password = MkPasswd($password);
        db('users')->where('user_id', $userinfo['user_id'])->setField('password', $password);
        cache($passKey, null);
        $this->successBilingual('密码已重置，请使用新密码登录。', 'Your password has been reset. Please sign in with the new password.', null, []);
    }

    /**************************************************/
    //Mail
    /**************************************************/
    public function MailAuth()
    {
        if($this->OJ_MODE != 'online')
        {
            $this->error('Module not allowed');
        }
        if(!session('?user_id'))
            $this->error("Please login first.", '/');
        $this->assign('user_id', session('user_id'));
        if($this->OJ_MODE != 'online')
        {
            $this->error('Module not allowed');
        }
    }
    public function mail_inbox()
    {
        $this->MailAuth();
        $this->assign('type', 'inbox');
        return $this->fetch();

    }
    public function mail_outbox()
    {
        $this->MailAuth();
        $this->assign('type', 'outbox');
        return $this->fetch();

    }
    public function mail_add()
    {
        $this->MailAuth();
        return $this->fetch();
    }
    public function mail_add_ajax()
    {
        $this->MailAuth();
        if(!captcha_check(input('vcode')))
            $this->error('Verification Code Error');
        $user_id = session('user_id');
        $to_user = trim(input('user_id', ''));
        if(strlen($to_user) > 32)
        {
            $this->error('User ID too long');
        }
        $to_userinfo = db('users')->where('user_id', $to_user)->field('user_id')->find();
//        if(strtolower($user_id) == strtolower($to_userinfo['user_id']))
//            $this->error('You cannot send mail to your self');
        if(!$to_userinfo)
            $this->error('No such user');
        $title = trim(input('title', ''));
        if(strlen($title) < 1)
            $this->error('Title needed');
        else if(strlen($title) > 64)
            $this->error('Title too long');
        $content = trim(input('content', ''));
        if(strlen($content) > 16384)
            $this->error('Content too long');
        $mail_add = [
            'from_user' => $user_id,
            'to_user'    => $to_userinfo['user_id'],
            'title'        => $title,
            'content'    => $content,
            'reply'        => -1,
            'in_date'    => date("Y-m-d H:i:s"),
            'defunct'    => '0',
            'new_mail'    => 01,
        ];
        $mail_id = db('mail')->insertGetId($mail_add);
        // ThinkPHP 5.1：success($msg, $url, $data, $wait)
        $this->success('Mail sent!', null, ['mail_id' => $mail_id]);
    }
}
