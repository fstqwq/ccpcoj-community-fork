<?php
/**
 * HTTP 请求相关函数
 *
 * 作用：
 * - 简单 GET 请求封装（HttpGet）
 * - cURL 请求封装（RequestSend），支持 form/json
 *
 * 依赖：
 * - PHP：file_get_contents, curl_*
 *
 * 约束：
 * - 仅允许函数定义；禁止文件顶层执行任何逻辑。
 * - 由 `ojweb/application/common.php` 统一 require_once 引入。
 *
 * 导出函数：
 * - HttpGet
 * - RequestSend
 */

function HttpGet($url, $data, $json=true) {
    $datainfo = [];
    foreach($data as $k=>$v) {
        $datainfo[] = $k . "=" . $v;
    }
    $url .= "?" . implode("&", $datainfo);
    $html = file_get_contents($url);
    if($json) return json_decode($html, true);
    return $html;
}

function RequestSend($url, $data, $header=['Content-type: application/x-www-form-urlencoded', 'X-Requested-With: XMLHttpRequest'], $post=1, $json=0) {
    // 安全验证：只允许 http/https 协议，防止 SSRF 攻击
    $parsed_url = parse_url($url);
    if(!$parsed_url || !isset($parsed_url['scheme'])) {
        return [
            'status_code' => 400,
            'detail' => 'Invalid URL format'
        ];
    }
    $scheme = strtolower($parsed_url['scheme']);
    if($scheme !== 'http' && $scheme !== 'https') {
        return [
            'status_code' => 400,
            'detail' => 'Only HTTP and HTTPS protocols are allowed'
        ];
    }
    
    if($json == 1) {
        $header[] = 'Content-Type: application/json';
    }
    if($post) {
        $options = [
            CURLOPT_URL             => $url,
            CURLOPT_POST            => 1,
            CURLOPT_RETURNTRANSFER  => true,
            CURLOPT_HTTPHEADER      => $header,
            CURLOPT_POSTFIELDS      => $json == 1 ? json_encode($data): http_build_query($data),
            // 安全设置：防止 SSRF 攻击
            CURLOPT_FOLLOWLOCATION  => false,  // 禁用自动重定向，防止重定向到内网
            CURLOPT_MAXREDIRS       => 0,      // 不允许重定向
            CURLOPT_CONNECTTIMEOUT   => 10,     // 连接超时 10 秒
            CURLOPT_TIMEOUT          => 30,     // 总超时 30 秒
            CURLOPT_SSL_VERIFYPEER  => true,   // 验证 SSL 证书
            CURLOPT_SSL_VERIFYHOST  => 2,       // 验证 SSL 主机名
        ];
    } else {
        $options = [
            CURLOPT_URL             => $url,
            CURLOPT_RETURNTRANSFER  => true,
            CURLOPT_HTTPHEADER      => $header,
            // 安全设置：防止 SSRF 攻击
            CURLOPT_FOLLOWLOCATION  => false,  // 禁用自动重定向，防止重定向到内网
            CURLOPT_MAXREDIRS       => 0,      // 不允许重定向
            CURLOPT_CONNECTTIMEOUT   => 10,     // 连接超时 10 秒
            CURLOPT_TIMEOUT          => 30,     // 总超时 30 秒
            CURLOPT_SSL_VERIFYPEER  => true,   // 验证 SSL 证书
            CURLOPT_SSL_VERIFYHOST  => 2,       // 验证 SSL 主机名
        ];
    }
    $ch = curl_init();
    curl_setopt_array($ch, $options);
    $result = curl_exec($ch);
    $ret = json_decode($result, true);
    if($ret == null) {
        $ret = [
            'status_code'   => 500,
            'detail'        => "数据请求失败"
        ];
    } else if(!array_key_exists('status_code', $ret)) {
        $ret['status_code'] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    }
    curl_close($ch);
    return $ret;
}


