<div class="teaminfo-profile-header">
    <div class="section-header">
        <div class="user-avatar">
            <i class="bi bi-person-badge"></i>
        </div>
        <div>
            <h1 class="user-title">{$teaminfo['team_id']}</h1>
            <div class="user-subtitle text-muted">{$teaminfo['name']|htmlspecialchars}</div>
        </div>
    </div>
    <hr class="my-4" />

    <div class="teaminfo-basic-info">
        <!-- 考生基本信息卡片 -->
        <div class="row g-3">
            <div class="col-md-6 col-lg-4">
                <div class="stat-card">
                    <div class="stat-label">考生ID<span class="en-text">Examinee ID</span></div>
                    <div class="stat-value">{$teaminfo['team_id']}</div>
                </div>
            </div>
            <div class="col-md-6 col-lg-4">
                <div class="stat-card">
                    <div class="stat-label">姓名<span class="en-text">Name</span></div>
                    <div class="stat-value">{$teaminfo['name']|htmlspecialchars}</div>
                </div>
            </div>
            <div class="col-md-6 col-lg-4">
                <div class="stat-card">
                    <div class="stat-label">单位<span class="en-text">School</span></div>
                    <div class="stat-value">{$teaminfo['school']|htmlspecialchars}</div>
                </div>
            </div>
            <div class="col-md-6 col-lg-4">
                <div class="stat-card">
                    <div class="stat-label">考场<span class="en-text">Room</span></div>
                    <div class="stat-value">{$teaminfo['room']|htmlspecialchars}</div>
                </div>
            </div>
            <div class="col-md-6 col-lg-4">
                <div class="stat-card">
                    <div class="stat-label">状态<span class="en-text">Status</span></div>
                    <div class="stat-value">
                        <?php if ($teaminfo['defunct'] == 'Y'): ?>
                            <span class="badge bg-success">已交卷<span class="en-text">Submitted</span></span>
                        <?php else: ?>
                            <span class="badge bg-warning">考试中<span class="en-text">In Progress</span></span>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

{if $teaminfo['team_id'] == $contest_user  || $proctorAdmin}
<div class="login-log-section">
    <div class="section-header">
        <h4 class="section-title">
            登录日志<span class="en-text">Login Log</span>
        </h4>
    </div>
    <table
        class="table table-sm table-hover"
        id="teaminfo_contest_loginlog"
        data-toggle="table"
        data-url="contest_loginlog_ajax?cid={$teaminfo['contest_id']}&team_id={$teaminfo['team_id']}"
        data-pagination="false"
        data-side-pagination="client"
        data-method="get"
        data-search="false"
        data-sortable="true"
        data-classes="table table-hover"
        data-pagination-h-align="left"
        data-pagination-detail-h-align="right"
        data-search-align="center"
    >
        <thead class="table-light">
            <tr>
                <th data-field="index" data-align="center" data-valign="middle" data-sortable="false" data-width="60" data-formatter="FormatterIdx">序号<span class="en-text">Idx</span></th>
                <th data-field="time" data-align="left" data-valign="middle" data-sortable="true" data-width="200" data-formatter="FormatterDate">时间<span class="en-text">Time</span></th>
                <th data-field="ip" data-align="left" data-valign="middle" data-sortable="true">IP地址<span class="en-text">IP Address</span></th>
            </tr>
        </thead>
    </table>
</div>
{/if}

<style type="text/css">
    /* 考生信息页面样式 - 参考 userinfo.php */
    .teaminfo-profile-header {
        background: white;
        border: 1px solid #e9ecef;
        padding: 1.5rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .user-title {
        color: #495057;
        font-weight: 600;
        margin-bottom: 0.25rem;
        font-size: 1.5rem;
    }

    .user-subtitle {
        font-size: 0.95rem;
        margin-bottom: 0;
    }

    .user-avatar {
        font-size: 2.5rem;
        color: #6c757d;
        margin-right: 0.75rem;
    }

    .section-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .teaminfo-basic-info {
        margin-top: 1rem;
    }

    /* 统计卡片样式 */
    .stat-card {
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 1rem;
        text-align: center;
        transition: all 0.3s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        height: 100%;
    }

    .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .stat-label {
        color: #6c757d;
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
    }

    .stat-value {
        font-size: 1.1rem;
        font-weight: 600;
        color: #495057;
    }

    /* 登录日志样式 */
    .login-log-section {
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 1.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .section-title {
        color: #495057;
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0;
    }

    /* 响应式设计 */
    @media (max-width: 768px) {
        .teaminfo-profile-header {
            padding: 1rem;
        }

        .user-title {
            font-size: 1.25rem;
        }

        .user-avatar {
            font-size: 2rem;
        }

        .stat-card {
            padding: 0.75rem;
        }

        .stat-label {
            font-size: 0.8rem;
        }

        .stat-value {
            font-size: 1rem;
        }

        .login-log-section {
            padding: 1rem;
        }
    }
</style>
