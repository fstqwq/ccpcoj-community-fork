<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-people"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                队伍信息
            </div>
            <div class="admin-page-header-title-right">
                <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                <span class="en-text">
                    Team Information
                </span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-right">
        <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="btn btn-outline-primary btn-sm">
            <span class="cn-text"><i class="bi bi-arrow-left me-1"></i>
            返回比赛</span><span class="en-text">Back to Contest</span>
        </a>
    </div>
</div>

<div class="container teaminfo-page">
    <div class="row g-3">
    <div class="col-12">
        <div class="card ti-card ti-main-card">
            <div class="card-header ti-card-header">
                <h5 class="card-title mb-0">
                    基本信息<span class="en-text text-muted">Basic Information</span>
                </h5>
            </div>
            <div class="card-body ti-card-body">
                <div class="row g-2">
                    <!-- 队伍基本信息 -->
                    <div class="col-12">
                        <div class="info-section">
                            <h6 class="info-section-title">
                                <span class="cn-text"><i class="bi bi-people me-2"></i>队伍基本信息</span><span class="en-text">Team Basic Information</span>
                                <span class="info-section-meta">
                                    <span class="badge ti-badge ti-badge-bilingual">
                                        <span class="ti-badge-cn">{$currentType.cn}</span>
                                        <span class="ti-badge-en">{$currentType.en}</span>
                                    </span>
                                    {if $teaminfo['privilege']}
                                    <span class="badge ti-badge ti-badge-warn">{$currentPrivilege.cn}</span>
                                    {/if}
                                    {if $isMultiGroup}
                                    {volist name="teamGroups" id="g"}
                                    <span class="badge ti-badge ti-badge-neutral" title="{$g.group_id}">{$g.group_name}</span>
                                    {/volist}
                                    {/if}
                                </span>
                            </h6>
                            <div class="row g-2">
                                <div class="col-md-6">
                                    <div class="info-item">
                                        <span class="info-label">队伍ID<span class="en-text">Team ID</span></span>
                                        <span class="info-value">{$teaminfo['team_id']}</span>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="info-item">
                                        <span class="info-label">学校/组织<span class="en-text">School/Organization</span></span>
                                        <span class="info-value">{$teaminfo['school'] ?: '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="info-item">
                                        <span class="info-label">队伍名称<span class="en-text">Team Name</span></span>
                                        <span class="info-value">{$teaminfo['name']}</span>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="info-item">
                                        <span class="info-label">副语言队名<span class="en-text">Secondary Language Name</span></span>
                                        <span class="info-value">{$teaminfo['name_en'] ?: '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="info-item">
                                        <span class="info-label">国家/地区<span class="en-text">Country/Region</span></span>
                                        <span class="info-value">{$teaminfo['region'] ?: '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="info-item">
                                        <span class="info-label">机房<span class="en-text">Room</span></span>
                                        <span class="info-value">{$teaminfo['room'] ?: '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 人员信息 -->
                    <div class="col-12">
                        <div class="info-section">
                            <h6 class="info-section-title">
                                <span class="cn-text"><i class="bi bi-person-lines-fill me-2"></i>
                                人员信息</span><span class="en-text">Personnel Information</span>
                            </h6>
                            <div class="row g-2">
                                <div class="col-12">
                                    <div class="info-item">
                                        <span class="info-label">队员<span class="en-text">Members</span></span>
                                        <span class="info-value">{$teaminfo['tmember'] ?: '-'}</span>
                                    </div>
                                </div>
                                <div class="col-12">
                                    <div class="info-item">
                                        <span class="info-label">教练<span class="en-text">Coach</span></span>
                                        <span class="info-value">{$teaminfo['coach'] ?: '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
</div>
</div>

<style type="text/css">
/* 2026 风格：低装饰、高信息密度、稳重层级 */
.teaminfo-page {
    --ti-border: #e8ebf0;
    --ti-text-main: #1f2937;
    --ti-text-sub: #6b7280;
    --ti-bg-soft: #f7f9fc;
}

.teaminfo-page .en-text {
    letter-spacing: 0.02em;
}

.ti-card {
    border: 1px solid var(--ti-border);
    border-radius: 12px;
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
}

.ti-card-header {
    background: #fff;
    border-bottom: 1px solid var(--ti-border);
    padding: 0.875rem 1rem;
}

.ti-card-header .card-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--ti-text-main);
}

.ti-card-body {
    padding: 0.9rem 1rem;
}

.info-section {
    margin-bottom: 0.85rem;
    padding: 0.75rem;
    background-color: var(--ti-bg-soft);
    border-radius: 10px;
    border: 1px solid var(--ti-border);
}

.info-section:last-child {
    margin-bottom: 0;
}

.info-section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--ti-text-main);
    font-weight: 600;
    margin-bottom: 0.6rem;
    padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--ti-border);
    font-size: 0.92rem;
}

.info-section-title i {
    color: #4f6fae;
}

.info-section-meta {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 5px;
    margin-left: auto;
}

.info-item {
    display: flex;
    flex-direction: column;
    gap: 0.14rem;
    padding: 0.52rem 0.58rem;
    background-color: #fff;
    border-radius: 8px;
    border: 1px solid var(--ti-border);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    min-height: 64px;
    justify-content: center;
}

.info-item:hover {
    border-color: #d9dee8;
    box-shadow: 0 3px 12px rgba(15, 23, 42, 0.06);
}

.info-label {
    font-size: 0.76rem;
    font-weight: 500;
    color: var(--ti-text-sub);
    line-height: 1.15;
    text-transform: uppercase;
}

.info-label .en-text {
    font-size: 0.66rem;
    color: #9ca3af;
    display: block;
    margin-top: 0.08rem;
}

.info-value {
    font-size: 0.94rem;
    font-weight: 600;
    color: var(--ti-text-main);
    word-break: break-word;
}

.ti-badge {
    background: #3b6dd8;
    color: #fff;
    border-radius: 999px;
    padding: 0.36rem 0.62rem;
    font-size: 0.74rem;
    font-weight: 600;
    max-width: 170px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ti-badge-warn {
    background: #9a6b00;
}

.ti-badge-neutral {
    background: #4b5563;
}

.ti-badge-bilingual {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
}

.ti-badge-bilingual .ti-badge-cn {
    font-weight: 650;
}

.ti-badge-bilingual .ti-badge-en {
    font-size: 0.67rem;
    opacity: 0.92;
    letter-spacing: 0.01em;
}

/* 响应式优化 */
@media (max-width: 768px) {
    .info-section-title {
        align-items: flex-start;
        flex-direction: column;
    }

    .info-section-meta {
        width: 100%;
        justify-content: flex-start;
        margin-left: 0;
    }

    .ti-badge {
        max-width: 120px;
        padding: 0.3rem 0.5rem;
    }

    .info-section {
        padding: 0.5rem;
    }
    
    .info-item {
        padding: 0.375rem;
    }
    
    .info-label {
        font-size: 0.75rem;
    }
    
    .info-value {
        font-size: 0.85rem;
    }
}
</style>