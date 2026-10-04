<?php
/**
 * 自定义 Debug 工具（统一口子）
 *
 * 作用：
 * - 控制是否输出自定义 debug 信息（统一开关）
 * - 统一注入返回 JSON 的 debug 字段（仅开发模式）
 * - 统一写入 runtime 日志（仅开发模式）
 *
 * 依赖：
 * - ThinkPHP：`config('app_debug')`, `\think\facade\Log`
 *
 * 约束：
 * - 仅允许函数定义；禁止文件顶层执行任何逻辑。
 * - 由 `ojweb/application/common.php` 统一 require_once 引入。
 *
 * 导出函数：
 * - CsgAppDebugEnabled
 * - CsgAppendDebugData
 * - CsgDebugLog
 */

/**
 * 是否开启应用调试模式（ThinkPHP 5.1）
 * 统一口子：所有“返回给前端/写日志”的自定义 debug 行为都必须先过这里
 */
function CsgAppDebugEnabled() {
    try {
        return config('app_debug') ? true : false;
    } catch (\Throwable $e) {
        return false;
    }
}

/**
 * 向返回给前端的 data 中附加 debug 信息（仅 app_debug=true 时生效）
 * @param array $data 返回结构里的 data 数组（引用）
 * @param array $debugKv 需要附加的 debug 键值
 */
function CsgAppendDebugData(&$data, $debugKv) {
    if(!CsgAppDebugEnabled()) return;
    if(!is_array($data)) $data = [];
    if(!isset($data['debug']) || !is_array($data['debug'])) $data['debug'] = [];
    if(is_array($debugKv)) {
        foreach($debugKv as $k => $v) {
            $data['debug'][$k] = $v;
        }
    }
}

/**
 * 记录自定义 debug 日志（仅 app_debug=true 时生效）
 * @param string $tag
 * @param array $payload
 */
function CsgDebugLog($tag, $payload=[]) {
    if(!CsgAppDebugEnabled()) return;
    try {
        \think\facade\Log::info('[CSGOJ_DEBUG][' . $tag . '] ' . json_encode($payload, JSON_UNESCAPED_UNICODE));
    } catch (\Throwable $e) {
        // 忽略日志异常，避免影响主流程
    }
}


