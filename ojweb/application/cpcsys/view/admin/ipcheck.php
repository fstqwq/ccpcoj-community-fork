<div class="container-fluid py-3">
    <!-- 页面标题 -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h4 class="mb-1">
                <i class="bi bi-shield-check text-primary me-2"></i>
                <span class="bilingual-inline">
                    IP检查
                    <span class="en-text">IP Check</span>
                </span>
            </h4>
            <div class="text-muted small">
                <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="text-decoration-none">
                    <i class="bi bi-hash"></i>{$contest['contest_id']}
                </a>
                <span class="ms-2">检查时间范围：考试前1小时至考试结束后10分钟</span>
            </div>
        </div>
        <button type="button" class="btn btn-outline-primary" onclick="RefreshResults()">
            <i class="bi bi-arrow-clockwise me-1"></i>
            <span class="bilingual-inline">刷新<span class="en-text">Refresh</span></span>
        </button>
    </div>

    <!-- IP检查内容 -->
    <div class="row g-3">
        {for start="0" end="2"}
        <?php
        if($i == 0) {
            $colorClass = 'danger';
            $iconClass = 'bi-person-x';
            $checktype = '单用户多IP登录';
            $checktypeEn = 'Single User with Multiple IPs';
            $description = '同一个用户从不同IP地址登录';
            $descriptionEn = 'Same user logged in from different IP addresses';
        } else {
            $colorClass = 'warning';
            $iconClass = 'bi-people';
            $checktype = '多用户同IP登录';
            $checktypeEn = 'Multiple Users from Same IP';
            $description = '多个用户从同一个IP地址登录';
            $descriptionEn = 'Multiple users logged in from the same IP address';
        }
        ?>
        <div class="col-lg-6">
            <div class="card h-100 border-0 shadow-sm">
                <div class="card-header bg-white border-0 border-bottom border-2 border-{$colorClass} pb-3">
                    <div class="d-flex align-items-center">
                        <div class="me-3">
                            <div class="icon-circle bg-{$colorClass} bg-opacity-10 text-{$colorClass}">
                                <i class="bi {$iconClass}"></i>
                            </div>
                        </div>
                        <div class="flex-grow-1">
                            <h5 class="card-title mb-1 bilingual-inline">
                                {$checktype}
                                <span class="en-text">{$checktypeEn}</span>
                            </h5>
                            <p class="card-text text-muted small mb-0 bilingual-inline">
                                {$description}
                                <span class="en-text">{$descriptionEn}</span>
                            </p>
                        </div>
                        <div>
                            <span class="badge bg-{$colorClass} bg-opacity-10 text-{$colorClass}" id="count{$i}">
                                <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                                加载中...
                            </span>
                        </div>
                    </div>
                </div>
                <div class="card-body p-0" id="checktype{$i}" style="overflow-y: auto; max-height: 500px;">
                    <div class="text-center py-5 text-muted">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">加载中...</span>
                        </div>
                        <p class="mt-2 mb-0">正在加载数据...</p>
                    </div>
                </div>
            </div>
        </div>
        {/for}
    </div>
</div>

<input type="hidden" name="cid" id="contest_id_input" value="{$contest['contest_id']}">

<style>
/* 图标圆圈 */
.icon-circle {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
}

/* IP检查卡片样式 */
.ipcheck-table {
    margin: 0;
}

.ipcheck-table thead th {
    position: sticky;
    top: 0;
    background: #f8f9fa;
    z-index: 1;
    font-weight: 600;
    font-size: 0.85rem;
    padding: 0.75rem 1rem;
    border-bottom: 2px solid #dee2e6;
}

.ipcheck-table tbody tr {
    transition: background-color 0.15s ease;
}

.ipcheck-table tbody tr:hover {
    background-color: #f8f9fa;
}

.ipcheck-table td {
    padding: 0.75rem 1rem;
    vertical-align: middle;
    font-size: 0.85rem;
}

.ipcheck-table .user-id {
    font-weight: 600;
    color: #212529;
}

.ipcheck-table .user-name {
    color: #6c757d;
    margin-left: 0.5rem;
}

.ipcheck-table .ip-address {
    font-family: 'Courier New', monospace;
    background: #f8f9fa;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    color: #495057;
    border: 1px solid #e9ecef;
}

.ipcheck-table .time-text {
    color: #6c757d;
    font-size: 0.8rem;
}

/* 空状态 */
.empty-state {
    padding: 3rem 1rem;
    text-align: center;
    color: #6c757d;
}

.empty-state i {
    font-size: 3rem;
    opacity: 0.3;
    margin-bottom: 1rem;
}

.empty-state p {
    margin: 0;
    font-size: 0.9rem;
}

/* 分组标题 */
.group-header {
    background: linear-gradient(to right, #f8f9fa 0%, #ffffff 100%);
    border-bottom: 2px solid #dee2e6;
}

.group-header th {
    font-weight: 600;
    color: #212529;
    padding: 0.75rem 1rem;
}

/* 徽章样式 */
.badge {
    font-weight: 500;
    padding: 0.375rem 0.75rem;
}
</style>

<script>
let checktype0 = $('#checktype0');
let checktype1 = $('#checktype1');
let cid = $('#contest_id_input').val();

function RefreshResults() {
    // 显示加载状态
    checktype0.html('<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 mb-0 text-muted">正在加载数据...</p></div>');
    checktype1.html('<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 mb-0 text-muted">正在加载数据...</p></div>');
    
    $.get('ipcheck_ajax', { 'cid': cid }, function(ret) {
        if(ret['code'] == 1) {
            let data = ret['data'];
            let userIps = data['userIps'];
            let ipUsers = data['ipUsers'];
            
            // 处理单用户多IP登录
            let userIpsCount = Object.keys(userIps).length;
            $('#count0').html(userIpsCount + ' 个异常');
            
            if(userIpsCount === 0) {
                checktype0.html('<div class="empty-state"><i class="bi bi-check-circle-fill text-success"></i><p class="bilingual-inline">未发现异常<span class="en-text">No anomalies detected</span></p></div>');
            } else {
                let content = '<table class="table table-hover ipcheck-table mb-0">';
                for(let userId in userIps) {
                    let user = userIps[userId];
                    content += '<thead class="group-header"><tr><th colspan="2">';
                    content += '<span class="user-id">' + userId + '</span>';
                    content += '<span class="user-name">' + user['name'] + '</span>';
                    content += '</th></tr></thead><tbody>';
                    
                    for(let ipIdx in user['ips']) {
                        let ipInfo = user['ips'][ipIdx];
                        content += '<tr>';
                        content += '<td><span class="ip-address">' + ipInfo['ip'] + '</span></td>';
                        content += '<td class="text-end"><span class="time-text">' + ipInfo['time'] + '</span></td>';
                        content += '</tr>';
                    }
                    content += '</tbody>';
                }
                content += '</table>';
                checktype0.html(content);
            }
            
            // 处理多用户同IP登录
            let ipUsersCount = Object.keys(ipUsers).length;
            $('#count1').html(ipUsersCount + ' 个异常');
            
            if(ipUsersCount === 0) {
                checktype1.html('<div class="empty-state"><i class="bi bi-check-circle-fill text-success"></i><p class="bilingual-inline">未发现异常<span class="en-text">No anomalies detected</span></p></div>');
            } else {
                let content = '<table class="table table-hover ipcheck-table mb-0">';
                for(let ip in ipUsers) {
                    let users = ipUsers[ip];
                    content += '<thead class="group-header"><tr><th colspan="2">';
                    content += '<span class="ip-address">' + ip + '</span>';
                    content += '</th></tr></thead><tbody>';
                    
                    for(let userIdx in users) {
                        let userInfo = users[userIdx];
                        content += '<tr>';
                        content += '<td>';
                        content += '<span class="user-id">' + userInfo['team_id'] + '</span>';
                        content += '<span class="user-name">' + userInfo['name'] + '</span>';
                        content += '</td>';
                        content += '<td class="text-end"><span class="time-text">' + userInfo['time'] + '</span></td>';
                        content += '</tr>';
                    }
                    content += '</tbody>';
                }
                content += '</table>';
                checktype1.html(content);
            }
        } else {
            checktype0.html('<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p class="text-danger">加载失败</p></div>');
            checktype1.html('<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p class="text-danger">加载失败</p></div>');
            if(window.alerty) {
                alerty.error('加载IP检查数据失败', ret['msg']);
            }
        }
    }, 'json').fail(function() {
        checktype0.html('<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p class="text-danger">网络请求失败</p></div>');
        checktype1.html('<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p class="text-danger">网络请求失败</p></div>');
        if(window.alerty) {
            alerty.error('网络请求失败', 'Failed to load data');
        }
    });
}

$(document).ready(function() {
    RefreshResults();
});
</script>
