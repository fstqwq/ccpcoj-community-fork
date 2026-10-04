<?php
/**
 * 密码 / 加密 / 邮件相关函数
 *
 * 作用：
 * - 生成随机密码
 * - 密码 Hash / 验证（含历史 md5/base64 兼容）
 * - 可还原密码（AES-128-GCM，依赖 OJ_ENV.OJ_SECRET）
 * - UUID v4 生成
 * - 邮件发送（PHPMailer）
 *
 * 依赖：
 * - PHP：password_hash/password_verify, openssl_*, random_bytes
 * - ThinkPHP：`config()`
 * - 第三方：`\PHPMailer`
 *
 * 约束：
 * - 仅允许函数定义；禁止文件顶层执行任何逻辑。
 * - 由 `ojweb/application/common.php` 统一 require_once 引入。
 *
 * 导出函数：
 * - RandPass
 * - GenerateUuidV4
 * - MkPasswd, CkPasswd, RecoverPasswd, IsMd5PW, IsB64PW
 * - StrAddStar
 * - SendMail
 */

// 随机密码
function RandPass($len=8)
{
    // 去掉 0、O、I、1 容易混淆的字符，做随机字符串当密码。
    $chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    $ret = '';
    for($i = 0; $i < $len; $i ++)
        $ret .= $chars[rand() % 32];
    return $ret;
}

/**
 * 生成 UUID v4（全局公共方法）
 * @return string
 */
function GenerateUuidV4()
{
    $data = random_bytes(16);
    // version 4
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    // variant
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return sprintf(
        '%08s-%04s-%04s-%04s-%012s',
        bin2hex(substr($data, 0, 4)),
        bin2hex(substr($data, 4, 2)),
        bin2hex(substr($data, 6, 2)),
        bin2hex(substr($data, 8, 2)),
        bin2hex(substr($data, 10, 6))
    );
}

//生成加密密码
function MkPasswd($raw_passwd, $recoverable=False)
{
    if(!$recoverable) {
        $hash = password_hash($raw_passwd, PASSWORD_DEFAULT);
        return $hash;
    } else {
        // 可还原密码
        $secretKey = config('OJ_ENV.OJ_SECRET');
        $cipher = 'aes-128-gcm';
        $ivlen = openssl_cipher_iv_length($cipher);
        $iv = openssl_random_pseudo_bytes($ivlen);
        $tag = '';
        $encrypted = openssl_encrypt(
            $raw_passwd, 
            $cipher, 
            $secretKey, 
            OPENSSL_RAW_DATA, 
            $iv, 
            $tag
        );
        return base64_encode($iv.'#@#'.$tag.'#@#'.$encrypted);
    }
}

//验证密码
function CkPasswd($password, $saved, $recoverable=False)
{
    if(!$recoverable) {
        if (IsMd5PW($saved)){
            $mpw = md5($password);
            if ($mpw==$saved) return True;
            else return False;
        }
        else if(IsB64PW($saved)) {
            $svd=base64_decode($saved);
            $salt=substr($svd,20);
            $hash = base64_encode( sha1(md5($password) . $salt, true) . $salt );
            return $hash == $saved;
        }
        return password_verify($password, $saved);
    }
    else {
        return RecoverPasswd($saved) == $password;
    }
}

// 弱密码场景下可还原密码的明文还原
function RecoverPasswd($saved) {
    try {
        $secretKey = config('OJ_ENV.OJ_SECRET');
        $cipher = 'aes-128-gcm';
        $passInfoList = explode('#@#', base64_decode($saved));
        $iv = $passInfoList[0];
        $tag = $passInfoList[1];
        return openssl_decrypt($passInfoList[2], $cipher, $secretKey, OPENSSL_RAW_DATA, $iv, $tag);
    } catch (Exception $e) {
        return $saved;
    }
}

//如果密码是旧的md5
function IsMd5PW($password) {
    for ($i=strlen($password)-1;$i>=0;$i--)
    {
        $c = $password[$i];
        if ('0'<=$c && $c<='9') continue;
        if ('a'<=$c && $c<='f') continue;
        if ('A'<=$c && $c<='F') continue;
        return False;
    }
    return True;
}

//如果密码是base64转码的版本
function IsB64PW($password) {
    return $password == base64_encode(base64_decode($password)) ? true : false;
}

// 一些需要部分加密的信息加星。
function StrAddStar($str)
{
    $len = strlen($str);
    $start = intval($len / 4);
    return substr_replace($str, str_repeat('*',$start * 2), $start, $start << 1);
}

//发送邮件
// @param string|null $altBody 纯文本正文；null 时由 HTML 粗略生成（换行替代 <br>）
function SendMail($toAddr, $toUser, $subject, $content, $altBody = null)
{
    $mailConfig = config('MailConfig.');
    $mail = new \PHPMailer;

//    $mail->SMTPDebug = 3;                                   // Enable verbose debug output

    $mail->isSMTP();                                        // Set mailer to use SMTP
    $mail->Host = $mailConfig['smtp'];                         // Specify main and backup SMTP servers
    $mail->SMTPAuth = true;                                   // Enable SMTP authentication
    $mail->Username = $mailConfig['account'];                // SMTP username
    $mail->Password = $mailConfig['password'];                 // SMTP password
    $mail->SMTPSecure = $mailConfig['secure'];                // Enable TLS encryption, `ssl` also accepted
    $mail->Port = $mailConfig['port'];                        // TCP port to connect to

    $mail->setFrom($mailConfig['from'], $mailConfig['from_name']);
    $mail->addAddress($toAddr, $toUser);                    // Add a recipient
    $mail->isHTML(true);

    $mail->Subject = $subject;
    $mail->Body    = $content;
    if ($altBody !== null && $altBody !== '') {
        $mail->AltBody = $altBody;
    } else {
        $plain = preg_replace('/<br\s*\/?>/i', "\n", $content);
        $mail->AltBody = trim(strip_tags($plain)) !== '' ? trim(strip_tags($plain)) : ' ';
    }

    if(!$mail->send())
    {
        return false;
    }

    return true;
}


