<?php
/**
 * 题目评测模式（与 problem.spj、题目编辑页 judge-type 一致）
 *
 * 单一数据源供题包转换等页注入 JSON；题目编辑模板若需完全去重可后续改为读此列表生成 UI。
 *
 * @return list<array{value:string,label_cn:string,label_en:string}>
 */
function problem_judge_type_options_list()
{
    return [
        ['value' => '0', 'label_cn' => '标准评测', 'label_en' => 'Standard Judge'],
        ['value' => '1', 'label_cn' => '特判评测', 'label_en' => 'Test Program Judge'],
        ['value' => '2', 'label_cn' => '交互评测', 'label_en' => 'Interactive Judge'],
    ];
}
