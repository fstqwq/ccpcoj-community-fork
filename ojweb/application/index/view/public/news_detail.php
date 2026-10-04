{css href="__STATIC__/csgoj/news/news.css" /}

{/* 检查是否为文章未找到的情况 */}
{if isset($news_not_found) && $news_not_found}
<div class="container-fluid">
    <div class="row justify-content-center">
        <div class="col-lg-8 col-xl-6">
            <div class="card shadow-sm border-0 mt-4">
                <div class="card-body text-center py-5">
                    <div class="mb-4">
                        <i class="bi bi-file-earmark-text fs-1 text-muted opacity-50"></i>
                    </div>
                    <h2 class="page-title mb-3">
                        {if isset($page_title_cn)}{$page_title_cn}{else/}页面<span class="en-text">Page</span>{/if}
                    </h2>
                    <div class="alert alert-info border-0 shadow-sm mb-4">
                        <div class="d-flex align-items-center justify-content-center mb-2">
                            <i class="bi bi-info-circle me-2 fs-5"></i>
                            <h5 class="mb-0">
                                内容待编辑<span class="en-text">Content Pending</span>
                            </h5>
                        </div>
                        <p class="mb-0 text-muted">
                            该页面内容尚未编辑，请等待管理员编辑后查看。
                            <br>
                            <span class="en-text">This page content has not been edited yet. Please wait for the administrator to edit it.</span>
                        </p>
                    </div>
                    <div class="text-muted small">
                        <i class="bi bi-clock-history me-1"></i>
                        请稍后再来查看<span class="en-text">Please check back later</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
{else/}
{/* FAQ 多语言切换标签 */}
{if isset($has_other_lang) && $has_other_lang}
<div class="page-title-container faq-title-row">
    <h1 class="page-title news-title">
        {if isset($news['news_id']) && $news['news_id'] > 100}#{$news['news_id']}{/if} {$news['title']}
    </h1>
    <div class="page-title-actions">
        <div class="faq-lang-switcher">
            <span class="faq-lang-label bilingual-inline">语言<span class="en-text">Language</span></span>
            <div class="btn-group" role="group">
                <a href="/{$module}/faqs?lang=cn" class="btn btn-sm {if isset($current_lang) && $current_lang == 'cn'}btn-primary{else/}btn-outline-secondary{/if}" style="min-width: 60px;">
                    中文
                </a>
                <a href="/{$module}/faqs?lang=other" class="btn btn-sm {if isset($current_lang) && $current_lang == 'other'}btn-primary{else/}btn-outline-secondary{/if}" style="min-width: 60px;">
                    <span class="en-text">Other</span>
                </a>
            </div>
        </div>
    </div>
</div>
{else/}
<h1 class="page-title news-title">
    {if isset($news['news_id']) && $news['news_id'] > 100}#{$news['news_id']}{/if} {$news['title']}
</h1>
{/if}

<div class="problem-header-row">
    <div class="problem-info-inline">
        <span class="info-item">
            <span class="info-label">分类<span class="en-text">Category</span></span>
            <span class="info-value">
                {if $news['category'] == 'news'}
                    <span class="badge bg-info">{if isset($OJ_STATUS) && $OJ_STATUS == 'cpc'}团队新闻<span class="en-text">Team News</span>{else /}系统公告<span class="en-text">System Announcement</span>{/if}</span>
                {elseif $news['category'] == 'notification' /}
                    <span class="badge bg-warning">{if isset($OJ_STATUS) && $OJ_STATUS == 'cpc'}通知公告<span class="en-text">Notice</span>{else /}课程公告<span class="en-text">Course Notice</span>{/if}</span>
                {elseif $news['category'] == 'answer' /}
                    <span class="badge bg-success">{if isset($OJ_STATUS) && $OJ_STATUS == 'cpc'}解题报告<span class="en-text">Solution Report</span>{else /}题目详解<span class="en-text">Problem Solution</span>{/if}</span>
                {elseif $news['category'] == 'cpcinfo' /}
                    <span class="badge bg-primary">{if isset($OJ_STATUS) && $OJ_STATUS == 'cpc'}竞赛周边<span class="en-text">Contest Info</span>{else /}课程资源<span class="en-text">Course Resource</span>{/if}</span>
                {else /}
                    <span class="badge bg-secondary">{$news['category']}<span class="en-text">{$news['category']}</span></span>
                {/if}
            </span>
        </span>
        {if isset($news['tags']) && !empty($news['tags'])}
        <span class="info-item">
            <span class="info-label">标签<span class="en-text">Tags</span></span>
            <span class="info-value">
                <?php 
                $tags = explode(';', $news['tags']);
                foreach($tags as $tag) {
                    $tag = trim($tag);
                    if(!empty($tag)) {
                        echo '<span class="badge bg-secondary me-1">' . htmlspecialchars($tag) . '</span>';
                    }
                }
                ?>
            </span>
        </span>
        {/if}
        <span class="info-item">
            <span class="info-label">创建时间<span class="en-text">Create Time</span></span>
            <span class="info-value text-muted">{$news['time']}</span>
        </span>
        <span class="info-item">
            <span class="info-label">更新时间<span class="en-text">Update Time</span></span>
            <span class="info-value text-danger">{if isset($news['modify_time']) && $news['modify_time']}{$news['modify_time']}{else/}{$news['time']}{/if}</span>
        </span>
        <span class="info-item">
            <span class="info-label">创建者<span class="en-text">Creator</span></span>
            <span class="info-value">
                <a href="/csgoj/user/userinfo?user_id={$news['user_id']}" class="text-decoration-none text-info">{$news['user_id']}</a>
            </span>
        </span>
        {if isset($news['modify_user_id']) && $news['modify_user_id'] != $news['user_id']}
        <span class="info-item">
            <span class="info-label">最近编辑<span class="en-text">Recent Editor</span></span>
            <span class="info-value">
                <a href="/csgoj/user/userinfo?user_id={$news['modify_user_id']}" class="text-decoration-none text-info">{$news['modify_user_id']}</a>
            </span>
        </span>
        {/if}
    </div>
</div>
<hr/>

<div class="md_display_div">
    {$news['content']}
</div>

{include file="../../csgoj/view/public/pkg_code_highlight" /}
{/if}
