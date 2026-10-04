<?php
/**
 * Created by PhpStorm.
 * User: CSGrandeur
 * Date: 2017/3/17
 * Time: 12:58
 */
namespace app\ojtool\controller;
use think\Controller;
use \Globalbasecontroller;
class Ojtoolbase extends Globalbasecontroller {

    protected function response($success = true, $message = '', $data = null, $status_code = null)
    {
        // 检查是否为浏览器访问（非 AJAX 请求）
        // 排除调试请求：如果请求包含 json_data 参数，说明是调试工具的 POST 请求
        $is_debug_request = $this->request->has('json_data', 'post');
        // $this->request->isAjax() 是ThinkPHP的判断方法，对应 x-requested-with=XMLHttpRequest 请求头
        $is_browser_request = !$this->request->isAjax() && !$this->request->isPost() && !$is_debug_request;
        
        if ($is_browser_request ) {
            // 浏览器访问且为super_admin时使用HTML模板显示
            $status_class = $success ? 'success' : 'error';
            $status_icon = $success ? 'fa-check-circle' : 'fa-times-circle';
            
            // 传递原始数据给模板，让前端统一处理
            $raw_data = $data;
            
            // 获取JSON body数据
            $json_body = '';
            if ($this->request->isPost()) {
                $raw_data = $this->request->getContent();
                if (!empty($raw_data)) {
                    // 尝试解析JSON
                    $json_data = json_decode($raw_data, true);
                    if ($json_data !== null) {
                        $json_body = json_encode($json_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                    } else {
                        $json_body = $raw_data;
                    }
                }
            }
            
            // 分配模板变量
            $this->assign([
                'success' => $success,
                'status_class' => $status_class,
                'status_icon' => $status_icon,
                'message' => $message,
                'data' => $raw_data,
                'status_code' => $status_code,
                'action' => $this->request->action(),
                'timestamp' => date('Y-m-d H:i:s'),
                'current_time' => date('Y-m-d H:i:s'),
                'json_body' => $json_body
            ]);
            
            // 渲染模板
            return $this->fetch('public/response');
        } else {
            // AJAX请求直接返回JSON格式，避免使用 success/error 方法可能的问题
            // 统一返回值格式：code 只用 1（成功）/ 0（失败），额外信息用 status_code 传递
            header('Content-Type: application/json; charset=utf-8');
            $response = [
                'code' => $success ? 1 : 0,
                'msg' => $message,
                'data' => $data
            ];
            // 如果有 status_code，添加到响应中
            if ($status_code) {
                $response['status_code'] = $status_code;
            }
            echo json_encode($response, JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}