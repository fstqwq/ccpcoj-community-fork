<?php 
// 用于 Modal 的 status table，复用 status_table.php
// 设置 modal 模式标志
$is_modal = true;
// modal 模式下固定使用 contest controller
$controller = 'contest';
?>
{include file="../../csgoj/view/status/status_table" /}
<input
        type="hidden"
        id="status_page_information_modal"
        cid="{if(isset($contest))}{$contest['contest_id']}{else/}x{/if}"
        single_status_url="{if isset($single_status_url)}{$single_status_url}{else/}{/if}"
        show_code_url="{if isset($show_code_url)}{$show_code_url}{else/}{/if}"
        show_res_url="{if isset($show_res_url)}{$show_res_url}{else/}{/if}"
        user_id="{if isset($user_id)}{$user_id}{else/}{/if}"
        status_ajax_url="/{$module}/contest/status_ajax{if isset($contest)}?cid={$contest['contest_id']}{/if}"
        rejudge_url="/{$module}/admin/contest_rejudge_ajax{if isset($contest)}?cid={$contest['contest_id']}{/if}"
        status_page_where="contest"
        module="{$module}"
        OJ_MODE="{if isset($OJ_MODE)}{$OJ_MODE}{else/}cpc{/if}"
        OJ_STATUS="{if isset($OJ_STATUS)}{$OJ_STATUS}{else/}cpc{/if}"
>

