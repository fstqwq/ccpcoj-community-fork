{include file="../../csgoj/view/public/base_csg_switch" /}

{css href="__STATIC__/css/bilingual.css" /}

<div class="admin-page-header">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-images"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                队伍照片管理
            </div>
            <div class="admin-page-header-title-right">
                <a href="__CPC__/contest/contest?cid={$contest['contest_id']}" class="admin-page-header-id">
                    <i class="bi bi-hash"></i> {$contest['contest_id']}
                </a>
                <span class="en-text">Team Photo Management</span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-right">
        <button type="button" class="btn btn-outline-info btn-sm" data-bs-toggle="collapse" data-bs-target="#team_image_help_div" aria-expanded="false" aria-controls="team_image_help_div">
            <span class="cn-text"><i class="bi bi-question-circle me-1"></i>帮助</span><span class="en-text">Help</span>
        </button>
        <div class="input-group input-group-sm team-image-header-search" title="搜索表格：队号、队名、学校等 / Search: team ID, name, school">
            <span class="input-group-text" aria-hidden="true"><i class="bi bi-search"></i></span>
            <input type="search" id="team_image_search_input" class="form-control" autocomplete="off" aria-label="搜索表格 / Search table" placeholder="全队表内搜索 / Search in table">
        </div>
        <button type="button" id="team_image_batch_btn" class="btn btn-primary bilingual-button btn-sm">
            <span><i class="bi bi-cloud-upload me-1"></i>批量上传</span>
            <span class="en-text">Batch Upload</span>
        </button>
        <input class="d-none" type="file" id="team_image_batch" multiple accept="image/webp,image/jpg,image/png,image/jpeg,image/bmp">
    </div>
</div>

<div class="container admin-import-container">
    <article id="team_image_help_div" class="alert alert-info collapse mb-4">
        <h5 class="bilingual-inline">
            上传说明
            <span class="en-text">Upload Notes</span>
        </h5>
        <p class="mb-1">批量上传文件名需与<strong>队伍账号（team_id）</strong>一一对应，扩展名可为 <code>.webp</code> 或 <code>.jpg</code>；服务端统一压缩为 <strong>WebP</strong>（不支持 WebP 的旧浏览器回传 JPEG 时则存为 JPG）。图片建议长:宽＝3:2。更换后若仍见旧图，请<strong>清理缓存</strong>或强制刷新。</p>
        <p class="mb-0"><span class="en-text">Batch file names must match team IDs; use .webp or .jpg extension. Server stores WebP by default (JPEG fallback for old browsers). Ratio 3:2 recommended. Hard-refresh if cached.</span></p>
    </article>

    <div class="table-responsive team-image-table-wrap">
    <table
        id="team_image_table"
        class="bootstraptable_refresh_local table table-striped table-hover team-image-main-table"
        data-toggle="table"
        data-buttons-align="left"
        data-sort-name="team_id"
        data-sort-order="asc"
        data-pagination="false"
        data-method="get"
        data-search="true"
        data-search-selector="#team_image_search_input"
        data-search-align="right"
        data-show-refresh="false"
        data-show-columns="false"
        data-unique-id="team_id"
        style="table-layout: auto; width: 100%;"
    >
        <thead>
            <tr>
                <th data-field="idx" data-align="center" data-valign="middle" data-sortable="true" data-width="52" data-formatter="IndexFormatter" title="# / Idx">
                    <span class="teamgen-th-stack"><span class="teamgen-th-cn">#</span><span class="teamgen-th-en en-text">Idx</span></span>
                </th>
                <th data-field="team_id" data-align="center" data-valign="middle" data-sortable="true" data-width="96" title="账号 / ID">
                    <span class="teamgen-th-stack"><span class="teamgen-th-cn">账号</span><span class="teamgen-th-en en-text">ID</span></span>
                </th>
                <th data-field="school" data-align="left" data-valign="middle" data-sortable="true" data-width="200" data-formatter="FormatterTeamImageSchool" title="学校/组织 / School">
                    <span class="teamgen-th-stack"><span class="teamgen-th-cn">学校/组织</span><span class="teamgen-th-en en-text">School</span></span>
                </th>
                <th data-field="name" data-align="left" data-valign="middle" data-sortable="true" data-width="200" title="队名 / Name">
                    <span class="teamgen-th-stack"><span class="teamgen-th-cn">队名</span><span class="teamgen-th-en en-text">Name</span></span>
                </th>
                <th data-field="tmember" data-align="left" data-valign="middle" data-sortable="true" data-width="150" title="队员 / Members">
                    <span class="teamgen-th-stack"><span class="teamgen-th-cn">队员</span><span class="teamgen-th-en en-text">Members</span></span>
                </th>
                <th data-field="coach" data-align="left" data-valign="middle" data-sortable="true" data-width="100" title="教练 / Coach">
                    <span class="teamgen-th-stack"><span class="teamgen-th-cn">教练</span><span class="teamgen-th-en en-text">Coach</span></span>
                </th>
                <th data-field="tkind" data-align="center" data-valign="middle" data-sortable="true" data-width="112" data-formatter="FormatterTkind" title="类型 / Type">
                    <span class="teamgen-th-stack"><span class="teamgen-th-cn">类型</span><span class="teamgen-th-en en-text">Type</span></span>
                </th>
                {if isset($contestGroupContext) && intval($contestGroupContext['is_multi_group']) == 1}
                <th data-field="groups" data-align="center" data-valign="middle" data-sortable="true" data-width="100" data-formatter="FormatterContestGroupAffiliationColumn" data-cell-style="FormatterContestGroupAffiliationColumnCellStyle" title="分组 / Groups">
                    <span class="teamgen-th-stack"><span class="teamgen-th-cn">分组</span><span class="teamgen-th-en en-text">Groups</span></span>
                </th>
                {/if}
                <th data-field="room" data-align="left" data-valign="middle" data-sortable="true" data-width="100" data-formatter="FormatterTeamImageRoom" title="分区 / Zone">
                    <span class="teamgen-th-stack"><span class="teamgen-th-cn">分区</span><span class="teamgen-th-en en-text">Zone</span></span>
                </th>
                <th data-field="team_photo" data-align="center" data-valign="middle" data-formatter="TeamPhotoFormatter" data-width="250" title="照片 / Photo">
                    <span class="teamgen-th-stack"><span class="teamgen-th-cn">照片</span><span class="teamgen-th-en en-text">Photo</span></span>
                </th>
            </tr>
        </thead>
    </table>
    </div>
</div>

{js href="__JS__/overlay.js" /}
{js href="__STATIC__/js/bilingual.js" /}

<script type="text/javascript">
// 后端变量配置（使用 PHP 原生方式）
var RANK_TEAM_CONFIG = {
    cid: <?php echo intval($contest['contest_id']); ?>,
    contest_attach: <?php echo json_encode($contest['attach']); ?>,
    upload_url: 'team_image_upload_ajax',
    delete_url: 'team_image_del_ajax',
    list_url: 'team_image_list_ajax',
    contest_data_url: 'contest_data_ajax',
    contest_groups: <?php echo json_encode(isset($contestGroupContext['groups']) ? $contestGroupContext['groups'] : [], JSON_UNESCAPED_UNICODE); ?>
};

// 全局变量
let team_image_table = $('#team_image_table');
let team_list = [];
let team_map = {};
let team_photo_map = {};
let flag_ready_cnt = 0;
let batch_file_list = [];
let batch_error_list = [];
let batch_ith = 0;
let cnt_success = 0;

/** 目录列表里的文件名 → team_id（兼容历史 .jpg / 新 .webp） */
function RankTeamImageFileNameToTeamId(file_name) {
    const s = String(file_name || '').trim();
    const base = (s.indexOf('/') >= 0) ? s.split('/').pop() : s;
    return String(base).replace(/\.(webp|jpg|jpeg|png)$/i, '');
}

// 表格格式化函数
function IndexFormatter(value, row, index) {
    return index + 1;
}

/** 与队伍生成页 FormatterTkind 一致（badge + 中英上下） */
function FormatterTkind(value, row, index, field) {
    const v = value === null || value === undefined ? 0 : parseInt(value, 10);
    const tkindMap = {
        0: '<span class="badge bg-primary csg-badge-eq csg-badge-eq--stack">正式<span class="en-text">Regular</span></span>',
        1: '<span class="badge bg-danger csg-badge-eq csg-badge-eq--stack">女队<span class="en-text">Girls</span></span>',
        2: '<span class="badge bg-warning csg-badge-eq csg-badge-eq--stack text-dark">打星<span class="en-text">Star</span></span>',
    };
    return (
        tkindMap[v] ||
        '<span class="badge bg-secondary csg-badge-eq csg-badge-eq--stack">未知<span class="en-text">Unknown</span></span>'
    );
}

/** 与队伍生成页一致：学校/组织列彩色 hash tag */
function FormatterTeamImageSchool(value, row, index, field) {
    if (typeof csg === "undefined" || !csg.hashTagBadgeHtml) {
        const s = value != null ? String(value) : "";
        return s ? $("<div>").text(s).html() : "—";
    }
    const s = value != null ? String(value).trim() : "";
    const inner = !s
        ? csg.hashTagBadgeHtml("", "", {})
        : csg.hashTagBadgeHtml(s, s, { allowWrap: true, maxWidth: "12rem" });
    return '<div class="teamgen-hash-cell teamgen-hash-cell--start">' + inner + "</div>";
}

/** 与队伍生成页一致：分区列彩色 hash tag */
function FormatterTeamImageRoom(value, row, index, field) {
    if (typeof csg === "undefined" || !csg.hashTagBadgeHtml) {
        const s = value != null ? String(value) : "";
        return s ? $("<div>").text(s).html() : "—";
    }
    const s = value != null ? String(value).trim() : "";
    const inner = !s
        ? csg.hashTagBadgeHtml("", "", {})
        : csg.hashTagBadgeHtml(s, s, { allowWrap: false, maxWidth: "7rem" });
    return '<div class="teamgen-hash-cell teamgen-hash-cell--start">' + inner + "</div>";
}

function TeamImageButtonHtml(team_id) {
    const imageUrlWebp = `/upload/contest_attach/${RANK_TEAM_CONFIG.contest_attach}/team_photo/${team_id}.webp`;
    const imageUrlJpg = `/upload/contest_attach/${RANK_TEAM_CONFIG.contest_attach}/team_photo/${team_id}.jpg`;
    return `
        <div class="d-flex flex-column gap-1 align-items-center">
            <div class="btn-group btn-group-sm" role="group">
                <button id="team_btn_preview_${team_id}" class="btn btn-outline-primary btn-sm" 
                        dclass="team_image_preview" 
                        team_id="${team_id}" 
                        url="${imageUrlWebp}"
                        data-photo-fallback="${imageUrlJpg}"
                        title="预览图片 Preview Image">
                    <i class="bi bi-eye"></i>
                </button>
                <button id="team_btn_upload_${team_id}" class="btn btn-outline-secondary btn-sm" 
                        dclass="team_image_reupload" 
                        team_id="${team_id}" 
                        title="重新上传 Re-upload">
                    <i class="bi bi-arrow-clockwise"></i>
                </button>
                <button id="team_btn_del_${team_id}" class="btn btn-outline-danger btn-sm" 
                        dclass="team_image_del" 
                        team_id="${team_id}" 
                        title="双击删除 Double click to delete">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
            <input class="form-control form-control-sm d-none team_image_upload_input" 
                   type="file" 
                   accept="image/webp,image/jpg,image/png,image/jpeg,image/bmp" 
                   dclass="team_image_upload_input" 
                   name="${team_id}.webp" 
                   id="team_image_input_${team_id}" 
                   team_id="${team_id}">
        </div>
    `;
}

function TeamUploadButtonHtml(team_id) {
    return `
        <div class="d-flex flex-column gap-1 align-items-center">
            <input class="form-control form-control-sm team_image_upload_input" 
                   type="file" 
                   accept="image/webp,image/jpg,image/png,image/jpeg,image/bmp" 
                   dclass="team_image_upload_input" 
                   name="${team_id}.webp" 
                   id="team_image_input_${team_id}" 
                   team_id="${team_id}"
                   style="width: 120px;">
        </div>
    `;
}

function TeamPhotoFormatter(value, row, index) {
    let info_dom = '';
    if (row.team_id in team_photo_map) {
        info_dom = TeamImageButtonHtml(row.team_id);
    } else {
        info_dom = TeamUploadButtonHtml(row.team_id);
    }
    return `<div id="team_image_container_${row.team_id}">${info_dom}</div>`;
}

// 数据加载完成检查
function LoadReady() {
    flag_ready_cnt++;
    if (flag_ready_cnt >= 2) {
        // 转换 team 数据格式为对象
        const team_list_obj = team_list.map(team => {
            if (Array.isArray(team)) {
                const gidArr = Array.isArray(team[12]) ? team[12] : [];
                const groupsStr = gidArr.length ? gidArr.map((g) => String(g).trim()).filter(Boolean).join(",") : "";
                return {
                    contest_id: team[0] || '',
                    team_id: team[1] || '',
                    name: team[2] || '',
                    name_en: team[3] || '',
                    coach: team[4] || '',
                    tmember: team[5] || '',
                    school: team[6] || '',
                    region: team[7] || '',
                    tkind: team[8] || 0,
                    room: team[9] || '',
                    privilege: team[10] || '',
                    team_global_code: team[11] || '',
                    groups: groupsStr,
                    group_ids: gidArr,
                };
            }
            return team;
        });
        
        team_image_table.bootstrapTable('load', team_list_obj);
        
        // 刷新 tooltip
        if (window.autoTooltips) {
            window.autoTooltips.refresh();
        }
    }
}

// 初始化数据
$(document).ready(function() {
    flag_ready_cnt = 0;
    
    // 加载队伍数据
    $.get(RANK_TEAM_CONFIG.contest_data_url + '?without_solution=1&cid=' + RANK_TEAM_CONFIG.cid, function(ret) {
        if (ret.code == 1) {
            // 过滤掉管理员、气球员、打印员
            team_list = ret.data.team.filter((a) => {
                if (Array.isArray(a)) {
                    // 数组格式：[0]contest_id, [1]team_id, [2]name, ..., [10]privilege
                    const privilege = a[10] || '';
                    return !(privilege in {'admin': true, 'balloon': true, 'printer': true});
                } else {
                    // 对象格式
                    const privilege = a.privilege || '';
                    return !(privilege in {'admin': true, 'balloon': true, 'printer': true});
                }
            });
            
            // 构建 team_map
            team_map = {};
            for (let i in team_list) {
                const team = team_list[i];
                const team_id = Array.isArray(team) ? team[1] : team.team_id;
                if (team_id) {
                    team_map[team_id] = team;
                }
            }
            
            LoadReady();
        } else {
            alerty.error(ret.msg || '加载队伍数据失败', ret.msg_en || 'Failed to load team data');
        }
    }).fail(function(xhr, status, error) {
        alerty.error('网络错误，无法加载队伍数据', 'Network error, unable to load team data');
        console.error('Failed to load team data:', error);
    });
    
    // 加载图片列表
    $.get(RANK_TEAM_CONFIG.list_url + '?cid=' + RANK_TEAM_CONFIG.cid, function(ret) {
        if (ret.code == 1) {
            team_photo_map = {};
            for (let i in ret.data) {
                const file_name = ret.data[i].file_name || ret.data[i];
                const team_id = RankTeamImageFileNameToTeamId(file_name);
                team_photo_map[team_id] = ret.data[i];
            }
            LoadReady();
        } else {
            alerty.error(ret.msg || '加载图片列表失败', ret.msg_en || 'Failed to load image list');
        }
    }).fail(function() {
        alerty.error('网络错误，无法加载图片列表', 'Network error, unable to load image list');
    });
});

// 文件处理函数
function FileProcess(file, team_id, loading_show = true) {
    if (!file || !file.type) {
        alerty.error('文件无效', 'Invalid file');
        return;
    }
    
    if (!file.type.startsWith("image/")) {
        alerty.alert({
            message: '请选择图片文件！',
            message_en: 'Please select an image file!'
        });
        return;
    }
    
    if (loading_show) {
        showOverlay({
            message: '上传中...',
            message_en: 'Uploading...',
            type: 'text'
        });
    }
    
    let reader = new FileReader();
    reader.addEventListener("load", function(e) {
        let data = e.target.result;
        let image = new Image();
        image.addEventListener("load", function(e) {
            let width = e.target.width;
            let height = e.target.height;
            let targetWidth = 1080;
            let ratio = width > targetWidth ? targetWidth / width : 1;
            let targetHeight = parseInt(Math.min(720, height * ratio));
            let mapping_height = targetHeight / ratio;
            let canvas = document.createElement("canvas");
            canvas.width = width * ratio;
            canvas.height = targetHeight;
            let context = canvas.getContext("2d");
            let sy = mapping_height < height ? Math.floor((height - mapping_height) * 0.5) : 0;
            context.drawImage(image, 0, sy, width, targetHeight / ratio, 0, 0, width * ratio, targetHeight);
            let outDataUrl = '';
            try {
                outDataUrl = canvas.toDataURL('image/webp', 0.92);
            } catch (e1) { /* empty */ }
            if (!outDataUrl || outDataUrl.length < 40 || outDataUrl.indexOf('image/webp') < 0) {
                outDataUrl = canvas.toDataURL('image/jpeg', 0.92);
            }
            
            $.ajax({
                url: RANK_TEAM_CONFIG.upload_url,
                type: 'post',
                data: {
                    'team_photo': outDataUrl,
                    'cid': RANK_TEAM_CONFIG.cid,
                    'team_id': team_id
                },
                success: function(ret) {
                    if (ret.code == 1) {
                        let ext = 'webp';
                        const fu = (ret.data && ret.data.file_url) ? String(ret.data.file_url) : '';
                        const mm = fu.match(/\.(webp|jpg)$/i);
                        if (mm) ext = mm[1].toLowerCase();
                        team_photo_map[team_id] = { file_name: team_id + '.' + ext };
                        
                        // 刷新表格中该行的照片列，触发 formatter 重新渲染
                        team_image_table.bootstrapTable('updateCellByUniqueId', {
                            id: team_id,
                            field: 'team_photo',
                            value: '',  // 值不重要，formatter 会根据 team_photo_map 渲染
                            reinit: false
                        });
                        
                        cnt_success++;
                        
                        if (loading_show) {
                            hideOverlay();
                            alerty.success('队伍图片已更新', 'Team photo updated successfully');
                        }
                        
                        // 刷新 tooltip
                        if (window.autoTooltips) {
                            window.autoTooltips.refresh();
                        }
                    } else {
                        if (loading_show) {
                            hideOverlay();
                            alerty.error(ret.msg || '上传失败', ret.msg_en || 'Upload failed');
                        } else {
                            batch_error_list.push(`${file.name}: ${ret.msg || '上传失败'}`);
                        }
                    }
                    
                    // 只有批量上传时才继续处理下一个文件
                    if (!loading_show) {
                        batch_ith++;
                        BatchProcessIth();
                    }
                },
                error: function(xhr, status, error) {
                    const errorMsg = xhr.responseJSON?.msg || xhr.statusText || '网络错误';
                    if (loading_show) {
                        hideOverlay();
                        alerty.error(errorMsg, 'Network error');
                    } else {
                        batch_error_list.push(`${file.name}: ${errorMsg}`);
                        batch_ith++;
                        BatchProcessIth();
                    }
                }
            });
        });
        
        image.addEventListener("error", function() {
            if (loading_show) {
                hideOverlay();
                alerty.error('图片加载失败', 'Failed to load image');
            } else {
                batch_error_list.push(`${file.name}: 图片加载失败`);
                batch_ith++;
                BatchProcessIth();
            }
        });
        
        image.src = data;
    });
    
        reader.addEventListener("error", function() {
            if (loading_show) {
                hideOverlay();
                alerty.error('文件读取失败', 'Failed to read file');
            } else {
                batch_error_list.push(`${file.name}: 文件读取失败`);
                batch_ith++;
                BatchProcessIth();
            }
        });
    
    reader.readAsDataURL(file);
}

// 图片预览
function TeamImagePreview(btn_obj) {
    const team_id = btn_obj.getAttribute('team_id');
    let image_url = btn_obj.getAttribute('url');
    const fallback_url = btn_obj.getAttribute('data-photo-fallback') || '';
    const tparam = `?t=${new Date().getTime()}`; // 是否允许缓存图片
    
    // 确保 URL 是绝对路径
    if (image_url && !image_url.startsWith('http://') && !image_url.startsWith('https://') && !image_url.startsWith('/')) {
        image_url = '/' + image_url;
    }
    let fb = fallback_url;
    if (fb && !fb.startsWith('http://') && !fb.startsWith('https://') && !fb.startsWith('/')) {
        fb = '/' + fb;
    }
    
    const full_url = image_url + tparam;
    const timestamp = Date.now();
    const imgDivId = 'img_preview_div_' + timestamp;
    const imgId = 'img_preview_img_' + timestamp;
    
    // 转义 URL 中的特殊字符用于 HTML 属性
    const escapedUrl = full_url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    
    alerty.alert({
        title: `队伍图片预览：${team_id}<span class="en-text">Team Photo Preview: ${team_id}</span>`,
        message: `<div id="${imgDivId}" style="width:100%;max-width:720px;height:480px;overflow:hidden;margin:auto;text-align:center;background:#f8f9fa;display:flex;align-items:center;justify-content:center;">
            <img id="${imgId}" style="max-width:100%;max-height:100%;height:auto;object-fit:contain;" 
                 src="${escapedUrl}" 
                 alt="Team Photo">
        </div>`,
        width: '900px',
        callback: function() {
            // 等待模态框完全显示后再绑定错误处理
            setTimeout(function() {
                const img = document.getElementById(imgId);
                const imgDiv = document.getElementById(imgDivId);
                
                if (img && imgDiv) {
                    let triedFb = false;
                    // 绑定错误处理：先 WebP，再尝试历史 JPG
                    img.onerror = function() {
                        if (!triedFb && fb) {
                            triedFb = true;
                            img.src = fb + tparam;
                            return;
                        }
                        console.error('Image load error:', full_url);
                        imgDiv.innerHTML = `
                            <p class="text-danger">图片加载失败<span class="en-text">Image load failed</span></p>
                            <p style="word-break:break-all;font-size:0.8rem;">${image_url}</p>
                        `;
                    };
                    
                    // 如果图片已经加载失败，触发错误处理
                    if (img.complete && img.naturalHeight === 0) {
                        img.onerror();
                    }
                }
            }, 100);
        }
    });
}

// 删除图片
function TeamImageDel(btn_obj) {
    const team_id = btn_obj.getAttribute('team_id');
    
    alerty.confirm({
        message: `确定要删除队伍 ${team_id} 的图片吗？`,
        message_en: `Are you sure you want to delete the photo for team ${team_id}?`,
        callback: function() {
            $.post(RANK_TEAM_CONFIG.delete_url, {
                'cid': RANK_TEAM_CONFIG.cid,
                'team_id': team_id
            }, function(ret) {
                if (ret.code == 1) {
                    // 从映射中移除
                    delete team_photo_map[team_id];
                    
                    // 刷新表格中该行的照片列，触发 formatter 重新渲染
                    team_image_table.bootstrapTable('updateCellByUniqueId', {
                        id: team_id,
                        field: 'team_photo',
                        value: '',  // 值不重要，formatter 会根据 team_photo_map 渲染
                        reinit: false
                    });
                    
                    alerty.success(`队伍 ${team_id} 图片已删除`, `Team ${team_id} photo deleted successfully`);
                    
                    // 刷新 tooltip
                    if (window.autoTooltips) {
                        window.autoTooltips.refresh();
                    }
                } else {
                    alerty.error(ret.msg || '删除失败', ret.msg_en || 'Delete failed');
                }
            }).fail(function() {
                alerty.error('网络错误，删除失败', 'Network error, delete failed');
            });
        }
    });
}

// 批量处理
function BatchProcessIth() {
    if (batch_ith >= batch_file_list.length) {
        hideOverlay();
        
        if (batch_error_list.length > 0) {
            const success_count = cnt_success;
            const fail_count = batch_file_list.length - cnt_success;
            alerty.alert({
                title: '上传情况<span class="en-text">Upload Summary</span>',
                message: `成功: ${success_count}，失败: ${fail_count}<span class="en-text">Success: ${success_count}, Failed: ${fail_count}</span><br/><br/>${batch_error_list.join('<br/>')}`,
                width: '600px'
            });
        } else if (cnt_success > 0) {
            alerty.success(`批量上传完成，共成功 ${cnt_success} 个`, `Batch upload completed, ${cnt_success} files uploaded successfully`);
            // 重新加载图片列表并刷新表格
            $.get(RANK_TEAM_CONFIG.list_url + '?cid=' + RANK_TEAM_CONFIG.cid, function(ret) {
                if (ret.code == 1) {
                    team_photo_map = {};
                    for (let i in ret.data) {
                        const file_name = ret.data[i].file_name || ret.data[i];
                        const team_id = RankTeamImageFileNameToTeamId(file_name);
                        team_photo_map[team_id] = ret.data[i];
                    }
                    // 刷新表格
                    team_image_table.bootstrapTable('refresh');
                }
            });
        }
        
        // 重置状态
        $('#team_image_batch').val('');
        $('#team_image_batch_btn').html('<span><i class="bi bi-cloud-upload me-1"></i>批量上传</span><span class="en-text">Batch Upload</span>');
        batch_file_list = [];
        batch_error_list = [];
        batch_ith = 0;
        cnt_success = 0;
        
        return;
    }
    
    const file = batch_file_list[batch_ith];
    const filename = file.name;
    const team_id = filename.substring(0, filename.lastIndexOf('.'));
    const progress = parseInt((batch_ith / batch_file_list.length) * 100);
    const percentage = parseInt((batch_ith * 100 / batch_file_list.length));
    
    updateOverlay({
        message: `${percentage}%. 正在处理：${filename}`,
        message_en: `Processing: ${filename}`,
        type: 'text'
    }, progress);
    
    if (!(team_id in team_map)) {
        batch_error_list.push(`${filename}: 文件名不在队伍ID中<span class="en-text">File name not in team IDs</span>`);
        batch_ith++;
        BatchProcessIth();
    } else {
        FileProcess(file, team_id, false);
    }
}


// 使用事件委托处理所有事件
$(document).ready(function() {
    // 单文件上传
    $(document).on('change', '.team_image_upload_input', function(e) {
        const team_id = $(this).attr('team_id');
        const file = this.files[0];
        
        if (file) {
            // 不在这里显示 overlay，让 FileProcess 统一处理
            batch_file_list = [];
            batch_error_list = [];
            batch_ith = 0;
            cnt_success = 0;
            FileProcess(file, team_id, true);
        }
        
        // 清空 input，允许重复上传同一文件
        this.value = '';
    });
    
    // 预览按钮
    $(document).on('click', '[dclass="team_image_preview"]', function(e) {
        e.preventDefault();
        TeamImagePreview(this);
    });
    
    // 重新上传按钮
    $(document).on('click', '[dclass="team_image_reupload"]', function(e) {
        e.preventDefault();
        const team_id = $(this).attr('team_id');
        $(`#team_image_input_${team_id}`).click();
    });
    
    // 删除按钮（双击）
    $(document).on('dblclick', '[dclass="team_image_del"]', function(e) {
        e.preventDefault();
        TeamImageDel(this);
    });
    
    // 批量上传按钮点击处理 - 只触发文件选择
    $('#team_image_batch_btn').on('click', function(e) {
        e.preventDefault();
        // 直接触发文件选择
        $('#team_image_batch').click();
    });
    
    // 批量上传文件选择 - 选择后自动开始上传
    $('#team_image_batch').on('change', function() {
        const files = this.files;
        if (files && files.length > 0) {
            // 自动开始批量上传
            batch_file_list = Array.from(files);
            batch_error_list = [];
            batch_ith = 0;
            cnt_success = 0;
            
            // 更新按钮文字显示文件数量
            $('#team_image_batch_btn').html(`<span><i class="bi bi-cloud-upload me-1"></i>批量上传 (${files.length})</span><span class="en-text">Batch Upload (${files.length})</span>`);
            
            // 开始处理
            showOverlay({
                message: '开始处理...',
                message_en: 'Starting...',
                type: 'text'
            });
            BatchProcessIth();
        } else {
            // 恢复默认文字
            $('#team_image_batch_btn').html('<span><i class="bi bi-cloud-upload me-1"></i>批量上传</span><span class="en-text">Batch Upload</span>');
        }
    });
});
</script>

<style type="text/css">
    #team_image_help_div {
        border: 0;
        border-radius: 0.75rem;
        color: var(--bs-body-color);
        background: var(--bs-body-bg);
        box-shadow: 0 0.4rem 1.2rem rgba(15, 23, 42, 0.08);
        padding: 1rem 1.1rem;
    }
    #team_image_help_div h5 {
        margin-top: 0.35rem;
        margin-bottom: 0.55rem;
        font-weight: 700;
    }
    #team_image_help_div p {
        margin-bottom: 0.45rem;
        line-height: 1.55;
    }

    .team-image-table-wrap {
        max-width: 100%;
    }

    .team-image-header-search {
        width: 12rem;
        max-width: min(12rem, 38vw);
        flex-shrink: 1;
    }
    .team-image-header-search .form-control {
        min-width: 0;
    }

    .fixed-table-toolbar {
        margin: 0 !important;
        padding: 0 !important;
    }
    .fixed-table-toolbar .bs-bars {
        float: none !important;
        display: block !important;
        width: 100% !important;
    }
    .fixed-table-toolbar .bs-bars.float-right {
        float: none !important;
    }

    #team_image_table.team-image-main-table {
        font-family: 'Simsun', 'Microsoft Yahei Mono', 'Lato', "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: 0.8125rem;
        word-wrap: break-word;
    }
    #team_image_table.team-image-main-table tbody td {
        vertical-align: middle;
    }
    #team_image_table.team-image-main-table thead th {
        font-size: 0.72rem;
        font-weight: 600;
        white-space: normal !important;
        word-break: keep-all;
        vertical-align: bottom !important;
        line-height: 1.12;
        padding: 0.32rem 0.28rem !important;
    }
    #team_image_table.team-image-main-table .teamgen-th-stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        text-align: center;
        gap: 0.1rem;
        min-height: 2.1rem;
    }
    #team_image_table.team-image-main-table .teamgen-th-cn {
        display: block;
        line-height: 1.1;
    }
    #team_image_table.team-image-main-table .teamgen-th-en {
        display: block !important;
        font-size: 0.62rem !important;
        font-weight: 500 !important;
        opacity: 0.86;
        line-height: 1.05;
    }
    #team_image_table.team-image-main-table thead th[data-field="school"] .teamgen-th-stack,
    #team_image_table.team-image-main-table thead th[data-field="name"] .teamgen-th-stack,
    #team_image_table.team-image-main-table thead th[data-field="tmember"] .teamgen-th-stack,
    #team_image_table.team-image-main-table thead th[data-field="coach"] .teamgen-th-stack,
    #team_image_table.team-image-main-table thead th[data-field="room"] .teamgen-th-stack {
        align-items: flex-start;
        text-align: left;
    }
    #team_image_table.team-image-main-table thead th[data-field="groups"] .teamgen-th-stack {
        align-items: center;
        text-align: center;
    }

    /* 学校/组织、分区：与 teamgen 相同的 hash 单元 flex */
    #team_image_table.team-image-main-table tbody td[data-field="school"] .teamgen-hash-cell,
    #team_image_table.team-image-main-table tbody td[data-field="room"] .teamgen-hash-cell {
        display: flex;
        align-items: center;
        box-sizing: border-box;
        width: 100%;
    }
    #team_image_table.team-image-main-table tbody td[data-field="school"] .teamgen-hash-cell--start,
    #team_image_table.team-image-main-table tbody td[data-field="room"] .teamgen-hash-cell--start {
        justify-content: flex-start;
    }

    #team_image_table.team-image-main-table tbody td[data-field="groups"] {
        text-align: center;
    }
    #team_image_table.team-image-main-table tbody td[data-field="groups"] .teamgen-hash-cell {
        display: flex;
        align-items: center;
        box-sizing: border-box;
        width: 100%;
    }
    #team_image_table.team-image-main-table tbody td[data-field="groups"] .teamgen-hash-cell--center {
        justify-content: center;
    }

    /* 类型列 badge：见 bilingual.css .csg-badge-eq（避免下文 #team_image_table .badge 盖掉 padding） */
    #team_image_table.team-image-main-table .csg-hash-tag-list {
        gap: 0.2rem !important;
    }

    .team_image_container {
        min-width: 180px;
    }

    #team_image_table .badge:not(.csg-badge-eq) {
        font-size: 0.75rem;
        padding: 0.35em 0.65em;
        font-weight: 500;
    }
    #team_image_table .badge:not(.csg-badge-eq) .en-text {
        font-size: 0.85em;
        margin-left: 4px;
    }

    .team_image_upload_input {
        cursor: pointer;
        font-size: 0.875rem;
    }
    .team_image_upload_input:not(.d-none) {
        border: 1px dashed #6c757d;
        border-radius: 0.375rem;
        padding: 0.375rem 0.5rem;
        transition: all 0.2s ease;
    }
    .team_image_upload_input:not(.d-none):hover {
        border-color: #0d6efd;
        background-color: rgba(13, 110, 253, 0.05);
    }

    @media (max-width: 768px) {
        .admin-page-header-right {
            width: 100%;
            justify-content: flex-start;
        }
        .team-image-header-search {
            width: 100%;
            max-width: 100%;
        }
        .btn-group {
            flex-direction: column;
        }
        .btn-group .btn {
            width: 100%;
            margin-bottom: 0.25rem;
        }
    }
</style>
