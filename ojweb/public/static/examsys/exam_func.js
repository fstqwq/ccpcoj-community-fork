/**
 * 答卷缓存（IndexedDB）
 * 依赖：全局已引入 `ojweb/public/static/js/tools/idb.js`，无需做存在性检测
 *
 * 存储策略：
 * - tableStore: tableName = 'asheet_tmp'
 * - key = { cid, user }
 * - value = asheet_tmp 对象
 */
async function SetAsheetTmp(asheet_content, cid, contest_user) {
    try {
        
        await idb.SetIdbTableByKey('asheet_tmp', { cid: String(cid), user: String(contest_user) }, asheet_content);
        
    } catch (e) {
        console.error(e);
    }
}

async function GetAsheetTmp(cid, contest_user) {
    try {
        
        const val = await idb.GetIdbTableByKey('asheet_tmp', { cid: String(cid), user: String(contest_user) });
        
        return val || {};
    } catch (e) {
        console.error(e);
        return {};
    }
}

async function ClearAsheetTmp(cid, keep_user = null) {
    try {
        const all = await idb.GetIdbTable('asheet_tmp'); // [{key,value}, ...]
        const targetCid = String(cid);
        const keepUserStr = keep_user == null ? null : String(keep_user);
        if (Array.isArray(all)) {
            for (const item of all) {
                const k = item?.key;
                if (!k) continue;
                if (String(k.cid) !== targetCid) continue;
                if (keepUserStr != null && String(k.user) === keepUserStr) continue;
                await idb.DelIdbTableByKey('asheet_tmp', { cid: String(k.cid), user: String(k.user) });
            }
        }
    } catch (e) {
        console.error(e);
    }
}
// ********************
// Common Formatters
function IndexFormatter(value, row, index) {
    return index + 1;
}
function DateFormatter(value) {
    return value.replace(' ', '<br/>');
}
function UpperCase(st) {
    return st.toLowerCase().replace(/( |^)[a-z]/g, (L) => L.toUpperCase());
}

// ********************
// Contest Clock
// 使用命名空间避免重复声明错误（支持文件被多次引入）
if (typeof window.examFuncNamespace === 'undefined') {
    window.examFuncNamespace = {
        current_time_div: null,
        time_diff_global: 0,
        domContentLoadedRegistered: false
    };
}

function get_contest_now(time_diff=null) {
    if(time_diff == null) {
        time_diff = window.examFuncNamespace.time_diff_global;
    }
    return Timestamp2Time(new Date().getTime()+time_diff);
}
function contest_clock(target_dom, time_diff) {
    target_dom.textContent = get_contest_now(time_diff);
    setTimeout(() => {
        contest_clock(target_dom, time_diff);
    }, 1000);
}

// 避免重复注册 DOMContentLoaded 事件监听器
if (!window.examFuncNamespace.domContentLoadedRegistered) {
    window.examFuncNamespace.domContentLoadedRegistered = true;
    document.addEventListener("DOMContentLoaded", function() {
        try{
            window.examFuncNamespace.current_time_div = document.getElementById('current_time_div')
            if(window.examFuncNamespace.current_time_div) {
                window.examFuncNamespace.time_diff_global = new Date(window.examFuncNamespace.current_time_div.getAttribute('time_stamp') * 1000).getTime()-new Date().getTime();
                let time_diff = new Date(window.examFuncNamespace.current_time_div.getAttribute('time_stamp') * 1000).getTime()-new Date().getTime();
                contest_clock(window.examFuncNamespace.current_time_div, time_diff);
            }
        } catch(e) {
        }
        try{
            let elements = document.getElementsByClassName("current_time_div_cls");
            for(var i = 0; i < elements.length; i++) {
                let time_diff = new Date(elements[i].getAttribute('time_stamp') * 1000).getTime()-new Date().getTime();
                contest_clock(elements[i], time_diff);
            }
        } catch(e) {
        }
    });
}