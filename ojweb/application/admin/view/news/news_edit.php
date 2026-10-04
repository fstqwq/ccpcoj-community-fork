<?php $edit_mode = isset($news); ?>
<script type="text/javascript" src="__STATIC__/js/form_validate_tip.js"></script>

<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-newspaper"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                {if $edit_mode }
                    {if $copy_mode}复制文章{else /}编辑文章{/if}
                {else /}
                    添加文章
                {/if}
            </div>
            <div class="admin-page-header-title-right">
                {if $edit_mode }
                <a href="__HOME__/{$news['category']}/detail?nid={$news['news_id']}" target="_blank" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$news['news_id']}
                </a>
                {/if}
                {if $edit_mode }
                    {if $copy_mode}<span class="en-text">Copy Article</span>{else /}<span class="en-text">Edit Article</span>{/if}
                {else /}
                    <span class="en-text">Add Article</span>
                {/if}
            </div>
        </h1>
    </div>
    
    {if $edit_mode }
    <div class="admin-page-header-actions">
        <button type="button" class="btn btn-success btn-sm" 
                data-modal-url="/{$module}/filemanager/filemanager?item={$controller}&id={$news['news_id']}" 
                data-modal-title="附件管理 - 文章 #{$news['news_id']} - {$news['title']|mb_substr=0,150,'utf-8'}..."
                title="附件管理 (File Manager)">
            <span class="cn-text"><i class="bi bi-paperclip"></i> 附件</span><span class="en-text">Attach</span>
        </button>
        <?php $defunct = $news['defunct']; $item_id = $news['news_id']; ?>
        {include file="../../admin/view/admin/changestatus_button" /}
    </div>
    {/if}
</div>

{if(!isset($special_page))}
{include file="../../admin/view/news/category_explain" /}
{/if}

{/* FAQ 多语言切换标签 */}
{if isset($is_faq_page) && $is_faq_page}
<div class="container mb-3">
    <div class="faq-lang-switcher" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; padding: 0.75rem; background: #f8f9fa; border-radius: 6px;">
        <span class="text-muted small me-2">编辑语言<span class="en-text">Edit Language</span></span>
        <div class="btn-group" role="group">
            <a href="/{$module}/news/oj_faq?lang=cn" class="btn btn-sm {if isset($current_lang) && $current_lang == 'cn'}btn-primary{else/}btn-outline-secondary{/if}" style="min-width: 70px;">
                中文
            </a>
            <a href="/{$module}/news/oj_faq?lang=other" class="btn btn-sm {if isset($current_lang) && $current_lang == 'other'}btn-primary{else/}btn-outline-secondary{/if}" style="min-width: 70px;">
                <span class="en-text">English</span>
            </a>
        </div>
        
        {if isset($other_news) && $other_news}
        <span class="text-muted small ms-2">外文版本显示/隐藏<span class="en-text">Other Version Visibility</span></span>
        <?php 
            // 直接对 other 语言对应的 news_id 执行 defunct 切换（无需依赖列表页过滤）
            $defunct = $other_news['defunct'] ?? '1';
            $item_id = $other_news['news_id'] ?? 0;
            $item_name = 'news';
        ?>
        {include file="../../admin/view/admin/changestatus_button" /}
        {/if}
        
        {if isset($other_news) && $other_news}
        <span class="text-muted small ms-2" style="font-size: 0.85em;">
            {if isset($current_lang) && $current_lang == 'cn'}另一语言版本已存在<span class="en-text">Other language version exists</span>{else/}另一语言版本已存在<span class="en-text">Other language version exists</span>{/if}
        </span>
        {/if}
    </div>
</div>
{/if}

<div class="container">
    <?php 
    // 获取当前模块名（$module 已在 Globalbasecontroller 中 assign）
    $action_url = '/' . $module . '/news/';
    if(isset($special_page) && $special_page) {
        $action_url .= 'news_edit_ajax';
    } else {
        $action_url .= ($edit_mode ? 'news_edit_ajax' : 'news_add_ajax');
    }
    ?>
    <form id="news_edit_form" class="admin-form" method='post' action="{$action_url}">
        
        <div class="form-group mb-3">
            <label for="title" class="bilingual-label">文章标题：<span class="en-text">Article Title</span></label>
            {if(isset($special_page) && $special_page)}
            <input type="hidden" name="title" value="{if $edit_mode}{$news['title']}{/if}">
            <input type="text" class="form-control" id="title" placeholder="文章标题..." value="{if $edit_mode}{$news['title']}{/if}" disabled>
            {else/}
            <input type="text" class="form-control" id="title" placeholder="文章标题..." name="title" value="{if $edit_mode}{$news['title']}{/if}">
            {/if}
        </div>
        
        {if(!isset($special_page) || !$special_page)}
        <div class="form-group mb-3">
            <label for="category" class="bilingual-label">分类：<span class="en-text">Category</span></label>
            <select name="category" class="form-select" id="category_select">
                {if isset($OJ_STATUS) && $OJ_STATUS == 'cpc'}
                <option value="news" {if $edit_mode && $news['category'] == 'news'} selected {/if} {if !IsAdmin('administrator')} disabled {/if}>团队新闻<span class="en-text">Team News</span></option>
                <option value="notification" {if $edit_mode && $news['category'] == 'notification'} selected {/if}>通知公告<span class="en-text">Notice</span></option>
                <option value="answer" {if $edit_mode && $news['category'] == 'answer'} selected {/if}>解题报告<span class="en-text">Solution Report</span></option>
                <option value="cpcinfo" {if $edit_mode && $news['category'] == 'cpcinfo'} selected {/if}>竞赛周边<span class="en-text">Contest Info</span></option>
                {else/}
                <option value="news" {if $edit_mode && $news['category'] == 'news'} selected {/if} {if !IsAdmin('administrator')} disabled {/if}>系统公告<span class="en-text">System Announcement</span></option>
                <option value="notification" {if $edit_mode && $news['category'] == 'notification'} selected {/if}>课程公告<span class="en-text">Course Notice</span></option>
                <option value="answer" {if $edit_mode && $news['category'] == 'answer'} selected {/if}>题目详解<span class="en-text">Problem Solution</span></option>
                <option value="cpcinfo" {if $edit_mode && $news['category'] == 'cpcinfo'} selected {/if}>课程资源<span class="en-text">Course Resource</span></option>
                {/if}
            </select>
            {if !IsAdmin('administrator')}
            <div class="form-text text-warning">
                系统公告仅超级管理员可设置<span class="en-text">System Announcement can only be set by administrator</span>
            </div>
            {/if}
        </div>
        
        <div class="form-group mb-3">
            <label for="tags" class="bilingual-label">标签：<span class="en-text">Tags</span></label>
            <input type="text" class="form-control" id="tags" placeholder="Contest;Solution;Changsha..." name="tags" value="{if $edit_mode}{$news['tags']}{/if}">
            <div class="form-text">
                用分号分隔，最多5个标签，每个不超过32个字符
                <span class="en-text">Separated by semicolons, max 5 tags, each no more than 32 characters</span>
            </div>
        </div>
        {/if}
        
        <div class="form-group mb-3">
            <label for="content" class="bilingual-label">内容 (支持 Markdown)：<span class="en-text">Content (Markdown supported)</span></label>
            <textarea id="news_content" class="form-control" placeholder="内容..." rows="15" name="content">{if $edit_mode}{$news['content']|htmlspecialchars}{/if}</textarea>
        </div>
        
        <input type="hidden" id='id_input' value="{if $edit_mode}{$news['news_id']}{/if}" name="news_id">
        
        <div class="admin-form-actions">
            <button type="submit" id="submit_button" class="btn btn-primary bilingual-button">
                <span><i class="bi bi-check-circle"></i>
                {if $edit_mode}
                修改文章</span><span class="en-text">Modify Article</span>
                {else}
                添加文章</span><span class="en-text">Add Article</span>
                {/if}
            </button>
        </div>
    </form>
</div>

<input type="hidden" id='page_info' edit_mode="{if $edit_mode}1{else/}0{/if}">

{css href="__STATIC__/csgoj/news/news.css" /}
{js href="__STATIC__/csgoj/news/news.js" /}