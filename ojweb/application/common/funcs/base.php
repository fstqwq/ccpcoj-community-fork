<?php
/**
 * 基础工具函数（最底层）
 *
 * 作用：
 * - 提供无业务依赖的通用小工具（数组/字符串/语言掩码等）。
 *
 * 依赖：
 * - ThinkPHP：`config()`（用于语言配置读取）
 *
 * 约束：
 * - 仅允许函数定义；禁止文件顶层执行任何逻辑。
 * - 由 `ojweb/application/common.php` 统一 require_once 引入。
 *
 * 导出函数：
 * - Swap, Dget, KeyAdd, validate_item_range
 * - Alphabet2Num
 * - LangList2LangMask, LangMask2LangList
 */

function Swap(&$a, &$b) {
    $tmp = $a; $a = $b; $b = $tmp;
}

function Dget($dct, $key, $defaultVal=null) {
    return isset($dct[$key]) ? $dct[$key] : $defaultVal;
}

function KeyAdd($key, &$arr, $defaultVal=[]) {
    if(!is_array($arr)) return;
    if(!array_key_exists($key, $arr)) {
        $arr[$key] = $defaultVal;
    }
}

function validate_item_range($sort, $allow_list) {
    // 不知道ThinkPHP的 order([$sort => $order])对$sort是否有注入，干脆手动过滤一下$sort
    if(!in_array($sort, $allow_list))
        return $allow_list[0];
    return $sort;
}

function Alphabet2Num($al)
{
    $ret = 0;
    $al = strtoupper($al);
    for($i = 0; $i < strlen($al); $i ++)
    {
        $ret = $ret * 26 + ord($al[$i]) - ord('A') + 1;
    }
    return $ret - 1;
}

function LangList2LangMask($languages)
{
    if(!isset($languages) || count($languages) == 0)
        return -1; //('Please select at least 1 language.');
    $ojLang = config('CsgojConfig.OJ_LANGUAGE');
    $langMask = 0;
    foreach($languages as $la)
    {
        $la = intval($la);
        if(!array_key_exists($la, $ojLang))
            return -2; //error('Some languages are not allowed for this OJ.'
        $langMask |= 1 << $la;
    }
    return $langMask;
}

function LangMask2LangList($langMask, $flg_type='origin'){
    if($langMask < 0) return [];
    
    $ojLang = config('CsgojConfig.OJ_LANGUAGE');
    $langList = [];
    
    // 遍历所有可能的语言位
    for($i = 0; $i < 32; $i++) {
        if($langMask & (1 << $i)) {
            if(array_key_exists($i, $ojLang)) {
                $langName = $ojLang[$i];
                if($flg_type == 'lowercase') {
                    $langName = strtolower($langName);
                } else if($flg_type == 'id') {
                    $langName = $i;
                }
                $langList[] = $langName;
            } else {
                $langList[] = $flg_type == 'id' ? -1 : 'UNKNOWN';
            }
        }
    }
    return $langList;
}


