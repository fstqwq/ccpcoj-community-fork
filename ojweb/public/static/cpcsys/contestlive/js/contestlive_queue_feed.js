/**
 * 投屏「评测队列」与 HUD 左栏共用：队伍展示、时间格式、封榜客户端兜底（与 GetContestData4Rank 逻辑对齐）
 * 数据接口：GET contest_data_ajax，支持 min_solution_id 增量；定期全量拉取做核验。
 */
(function (w) {
    var TIME_MODE_KEY = 'contestlive_queue_time_mode';

    function parseMysqlLocal(s) {
        if (!s || typeof s !== 'string') {
            return NaN;
        }
        var p = s.trim().split(/[- :]/);
        if (p.length < 6) {
            return NaN;
        }
        var y = parseInt(p[0], 10);
        var mo = parseInt(p[1], 10) - 1;
        var d = parseInt(p[2], 10);
        var h = parseInt(p[3], 10);
        var mi = parseInt(p[4], 10);
        var se = parseInt(p[5], 10);
        return new Date(y, mo, d, h, mi, se).getTime();
    }

    function pad2(n) {
        var s = String(n);
        return s.length >= 2 ? s : '0' + s;
    }

    function formatDurationMs(ms) {
        if (!isFinite(ms) || ms < 0) {
            return '—';
        }
        var sec = Math.floor(ms / 1000);
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        if (h > 0) {
            return '+' + h + ':' + pad2(m) + ':' + pad2(s);
        }
        return '+' + m + ':' + pad2(s);
    }

    function closeRankMs(contest) {
        if (!contest || !contest.end_time) {
            return null;
        }
        var end = parseMysqlLocal(String(contest.end_time).replace('T', ' '));
        if (!isFinite(end)) {
            return null;
        }
        var fm = parseInt(String(contest.frozen_minute || 0), 10) || 0;
        return end - fm * 60 * 1000;
    }

    function frozenEndMs(contest) {
        if (!contest || !contest.end_time) {
            return null;
        }
        var end = parseMysqlLocal(String(contest.end_time).replace('T', ' '));
        if (!isFinite(end)) {
            return null;
        }
        var fa = parseInt(String(contest.frozen_after || 0), 10) || 0;
        return end + fa * 60 * 1000;
    }

    /** 与 ContestBaseTrait::ContestStatus 封榜段一致：公开投屏视角一律按封榜显示 */
    function clientInFreezeWindow(contest, nowMs) {
        var cr = closeRankMs(contest);
        var fe = frozenEndMs(contest);
        if (cr == null || fe == null) {
            return false;
        }
        return nowMs > cr && nowMs < fe;
    }

    function stripCpcTeamPrefix(teamId, cid) {
        var s = String(teamId || '');
        var id = parseInt(String(cid), 10);
        if (!id) {
            return s;
        }
        var re = new RegExp('^#?cpc' + id + '_', 'i');
        return s.replace(re, '') || s;
    }

    /**
     * 与榜单 / contest_data 队伍行一致：裸 team_id（用于 data-team-id、CONTEST_LIVE_HUD_RANK_BY_TEAM 查找）
     */
    function normalizeContestTeamKey(uid, cid) {
        var raw = uid != null ? String(uid) : '';
        var stripped = stripCpcTeamPrefix(raw, cid);
        return stripped || raw;
    }

    /**
     * solution 行 user_id 可能是 #cpc{cid}_{team_id}，队伍表 [1] 为裸 team_id
     */
    function resolveTeamMetaForSolution(uid, teamById, cid) {
        var raw = uid != null ? String(uid) : '';
        var stripped = stripCpcTeamPrefix(raw, cid);
        var idn = parseInt(String(cid), 10) || 0;
        var prefixed = idn && stripped ? ('#cpc' + idn + '_' + stripped) : '';
        var seen = {};
        var keys = [raw, stripped, prefixed].filter(function (k) {
            if (!k || seen[k]) {
                return false;
            }
            seen[k] = true;
            return true;
        });
        for (var i = 0; i < keys.length; i++) {
            var m = teamById[keys[i]];
            if (m) {
                return m;
            }
        }
        return { id: stripped || raw, name: '', nameEn: '', school: '' };
    }

    /**
     * @param {Array} teamRow GetContestData4Rank list 格式
     * @returns {{id:string,name:string,nameEn:string,school:string}}
     */
    function teamRowMeta(teamRow) {
        if (!teamRow || !Array.isArray(teamRow)) {
            return { id: '', name: '', nameEn: '', school: '' };
        }
        return {
            id: String(teamRow[1] != null ? teamRow[1] : ''),
            name: String(teamRow[2] != null ? teamRow[2] : ''),
            nameEn: String(teamRow[3] != null ? teamRow[3] : ''),
            school: String(teamRow[6] != null ? teamRow[6] : '')
        };
    }

    function buildTeamById(teams) {
        var map = {};
        if (!Array.isArray(teams)) {
            return map;
        }
        for (var i = 0; i < teams.length; i++) {
            var t = teams[i];
            if (!Array.isArray(t)) {
                continue;
            }
            var meta = teamRowMeta(t);
            map[meta.id] = meta;
        }
        return map;
    }

    function getTimeMode() {
        try {
            var v = w.localStorage.getItem(TIME_MODE_KEY);
            return v === 'abs' ? 'abs' : 'rel';
        } catch (e) {
            return 'rel';
        }
    }

    function setTimeMode(mode) {
        try {
            w.localStorage.setItem(TIME_MODE_KEY, mode === 'abs' ? 'abs' : 'rel');
        } catch (e) { /* ignore */ }
    }

    /**
     * @param {number[]} s solution 行
     * @param {object} contest
     * @param {number} nowMs
     * @returns {number} 展示用 result（封榜期强改为 -1）
     */
    function effectiveResultForDisplay(s, contest, nowMs) {
        var res = parseInt(String(s[4]), 10);
        if (!contest) {
            return res;
        }
        var inMs = parseMysqlLocal(String(s[5] || ''));
        var cr = closeRankMs(contest);
        if (clientInFreezeWindow(contest, nowMs) && cr != null && isFinite(inMs) && inMs > cr) {
            return -1;
        }
        return res;
    }

    function formatInDateForDisplay(inDateStr, startMs, mode) {
        if (!inDateStr) {
            return '';
        }
        if (mode === 'abs') {
            return String(inDateStr);
        }
        var t = parseMysqlLocal(String(inDateStr).replace('T', ' '));
        if (!isFinite(t) || !isFinite(startMs)) {
            return String(inDateStr);
        }
        return formatDurationMs(t - startMs);
    }

    /** 绝对时间拆成日期 + 时刻（HUD 最新过题双行用） */
    function splitMysqlDateTimeParts(inDateStr) {
        var raw = String(inDateStr || '').trim().replace('T', ' ');
        var sp = raw.indexOf(' ');
        if (sp > 0) {
            return { dateLine: raw.slice(0, sp), timeLine: raw.slice(sp + 1).trim() };
        }
        return { dateLine: '', timeLine: raw };
    }

    /**
     * 综合 HUD「最新过题」时间格：上行小字（绝对模式为日期，相对模式为占位或说明），
     * 下行主时间，避免 T 切换时列宽剧变、挤压队伍列。
     */
    function createHudAcTimeCellEl(inDateStr, startMs, mode) {
        var td = document.createElement('td');
        td.className = 'col-time';
        var wrap = document.createElement('div');
        wrap.className = 'contestlive-hud-timecell';
        var elDate = document.createElement('div');
        elDate.className = 'contestlive-hud-timecell__date';
        var elMain = document.createElement('div');
        elMain.className = 'contestlive-hud-timecell__main';
        if (mode === 'abs') {
            var parts = splitMysqlDateTimeParts(inDateStr);
            if (parts.dateLine) {
                elDate.textContent = parts.dateLine;
            } else {
                elDate.classList.add('contestlive-hud-timecell__date--reserved');
                elDate.appendChild(document.createTextNode('\u00a0'));
            }
            elMain.textContent = parts.timeLine || (parts.dateLine ? '' : String(inDateStr || ''));
        } else {
            /* 与绝对模式上行占位一致：保留双行栅格，不展示「开赛起」文案 */
            elDate.classList.add('contestlive-hud-timecell__date--reserved');
            elDate.appendChild(document.createTextNode('\u00a0'));
            var t = parseMysqlLocal(String(inDateStr || '').replace('T', ' '));
            if (!isFinite(t) || !isFinite(startMs)) {
                elMain.textContent = String(inDateStr || '');
            } else {
                elMain.textContent = formatDurationMs(t - startMs);
            }
        }
        wrap.appendChild(elDate);
        wrap.appendChild(elMain);
        wrap.setAttribute(
            'title',
            mode === 'abs'
                ? '\u5899\u949f\uff1a\u4e0a\u884c\u65e5\u671f\u3001\u4e0b\u884c\u65f6\u523b \u00b7 Wall clock: date row, time row'
                : '\u76f8\u5bf9\u5f00\u8d5b\u7528\u65f6 \u00b7 Elapsed since contest start'
        );
        td.appendChild(wrap);
        return td;
    }

    /** 与 rank_tool.js RankToolParseColor 一致：contest_problem 气球色 */
    function parseBalloonColor(colorString) {
        if (!colorString || typeof colorString !== 'string') {
            return '#6b7280';
        }
        var s = colorString.trim();
        if (/^[0-9A-F]{6}$/i.test(s)) {
            return '#' + s;
        }
        if (/^#[0-9A-F]{6}$/i.test(s)) {
            return s;
        }
        return s.toLowerCase();
    }

    /**
     * @param {Array[]} problems GetContestData4Rank 行 [pid, title, num, color, pscore]
     * @returns {{ labelByPid: Object.<string,string>, colorByPid: Object.<string,string> }}
     */
    function buildProblemMaps(problems) {
        var labelByPid = {};
        var colorByPid = {};
        if (!Array.isArray(problems)) {
            return { labelByPid: labelByPid, colorByPid: colorByPid };
        }
        for (var i = 0; i < problems.length; i++) {
            var p = problems[i];
            if (!Array.isArray(p)) {
                continue;
            }
            var pid = p[0];
            var num = parseInt(p[2], 10);
            var rawColor = p[3];
            var label;
            if (!isNaN(num) && num >= 0 && num < 26) {
                label = String.fromCharCode(65 + num);
            } else {
                label = pid != null ? String(pid) : '?';
            }
            labelByPid[pid] = label;
            colorByPid[pid] = parseBalloonColor(rawColor != null ? String(rawColor) : '');
        }
        return { labelByPid: labelByPid, colorByPid: colorByPid };
    }

    /**
     * @param {string} uid
     * @param {Object} teamById
     * @param {number} cid
     * @returns {HTMLElement}
     */
    function createTeamCellEl(uid, teamById, cid) {
        var meta = resolveTeamMetaForSolution(uid, teamById, cid);
        var shortId = stripCpcTeamPrefix(meta.id || uid, cid);
        var name = (meta.name && String(meta.name).trim()) ? String(meta.name).trim() : '';
        var nameEn = (meta.nameEn && String(meta.nameEn).trim()) ? String(meta.nameEn).trim() : '';
        var school = (meta.school && String(meta.school).trim()) ? String(meta.school).trim() : '';
        var displayName = name ? name : shortId;
        var line1Text = shortId + ' · ' + displayName;

        var wrap = document.createElement('div');
        wrap.className = 'contestlive-queue-team';
        var line1 = document.createElement('div');
        line1.className = 'contestlive-queue-team__line1';
        line1.appendChild(document.createTextNode(line1Text));
        wrap.appendChild(line1);
        if (nameEn && nameEn !== name) {
            var lineEn = document.createElement('div');
            lineEn.className = 'contestlive-queue-team__line-en';
            lineEn.appendChild(document.createTextNode(nameEn));
            wrap.appendChild(lineEn);
        }
        if (school) {
            var line2 = document.createElement('div');
            line2.className = 'contestlive-queue-team__line2';
            line2.textContent = school;
            wrap.appendChild(line2);
        }
        var tipParts = [];
        if (nameEn) {
            tipParts.push(nameEn);
        }
        if (school) {
            tipParts.push(school);
        }
        if (tipParts.length) {
            wrap.setAttribute('title', tipParts.join(' · '));
        }
        return wrap;
    }

    function appendHudMarqueeLine(wrap, text, innerClass) {
        if (!text) {
            return;
        }
        var line = document.createElement('div');
        line.className = 'contestlive-hud-mq-line' + (innerClass ? ' ' + innerClass : '');
        line.setAttribute('data-mq-plain', text);
        line.textContent = text;
        wrap.appendChild(line);
    }

    /**
     * 综合 HUD / 直播条：仅学校 + 队名（不展示队号、不重复 id·name）
     * @param {string} uid
     * @param {Object} teamById
     * @param {number} cid
     * @returns {HTMLElement}
     */
    function createBroadcastTeamCellEl(uid, teamById, cid) {
        var key = uid != null ? String(uid) : '';
        var meta = resolveTeamMetaForSolution(uid, teamById, cid);
        var school = (meta.school && String(meta.school).trim()) ? String(meta.school).trim() : '';
        var name = (meta.name && String(meta.name).trim()) ? String(meta.name).trim() : '';
        var nameEn = (meta.nameEn && String(meta.nameEn).trim()) ? String(meta.nameEn).trim() : '';
        var shortId = stripCpcTeamPrefix(meta.id || key, cid);
        var displayName = name ? name : '';

        var wrap = document.createElement('div');
        wrap.className = 'contestlive-hud-team';
        if (school && displayName) {
            appendHudMarqueeLine(wrap, school, 'contestlive-hud-team__school');
        }
        if (displayName) {
            appendHudMarqueeLine(wrap, displayName, 'contestlive-hud-team__name');
        } else if (school) {
            appendHudMarqueeLine(wrap, school, 'contestlive-hud-team__name');
        } else {
            var dash = document.createElement('div');
            dash.className = 'contestlive-hud-team__name';
            dash.appendChild(document.createTextNode('—'));
            wrap.appendChild(dash);
        }
        if (nameEn && nameEn !== name) {
            appendHudMarqueeLine(wrap, nameEn, 'contestlive-hud-team__en');
        }
        var tipParts = [];
        if (school) {
            tipParts.push(school);
        }
        if (displayName) {
            tipParts.push(displayName);
        } else if (shortId && !name) {
            tipParts.push(shortId);
        }
        if (nameEn) {
            tipParts.push(nameEn);
        }
        if (tipParts.length) {
            wrap.setAttribute('title', tipParts.join(' · '));
        }
        return wrap;
    }

    /**
     * 综合 HUD：题号左侧气球色竖条 + 字母
     * @param {string|number} pid
     * @param {Object} labelByPid
     * @param {Object} colorByPid
     * @returns {HTMLElement}
     */
    function createHudProblemCellEl(pid, labelByPid, colorByPid) {
        var lab = labelByPid[pid] != null ? String(labelByPid[pid]) : String(pid);
        var col = (colorByPid && colorByPid[pid]) ? String(colorByPid[pid]) : '#6b7280';
        var wrap = document.createElement('span');
        wrap.className = 'contestlive-hud-pr';
        wrap.style.setProperty('--contestlive-pr-color', col);
        var bar = document.createElement('span');
        bar.className = 'contestlive-hud-pr__bar';
        bar.setAttribute('aria-hidden', 'true');
        var letter = document.createElement('span');
        letter.className = 'contestlive-hud-pr__letter';
        letter.textContent = lab;
        wrap.appendChild(bar);
        wrap.appendChild(letter);
        return wrap;
    }

    /**
     * @param {string|number} pid
     * @param {Object} labelByPid
     * @param {Object} colorByPid
     * @returns {HTMLElement}
     */
    function createProblemPillEl(pid, labelByPid, colorByPid) {
        var lab = labelByPid[pid] != null ? String(labelByPid[pid]) : String(pid);
        var col = (colorByPid && colorByPid[pid]) ? String(colorByPid[pid]) : '#6b7280';
        var span = document.createElement('span');
        span.className = 'contestlive-queue-pr-pill';
        span.textContent = lab;
        span.style.setProperty('--contestlive-pr-color', col);
        return span;
    }

    w.ContestliveQueueFeed = {
        TIME_MODE_KEY: TIME_MODE_KEY,
        parseMysqlLocal: parseMysqlLocal,
        closeRankMs: closeRankMs,
        frozenEndMs: frozenEndMs,
        clientInFreezeWindow: clientInFreezeWindow,
        stripCpcTeamPrefix: stripCpcTeamPrefix,
        normalizeContestTeamKey: normalizeContestTeamKey,
        resolveTeamMetaForSolution: resolveTeamMetaForSolution,
        teamRowMeta: teamRowMeta,
        buildTeamById: buildTeamById,
        getTimeMode: getTimeMode,
        setTimeMode: setTimeMode,
        effectiveResultForDisplay: effectiveResultForDisplay,
        formatInDateForDisplay: formatInDateForDisplay,
        splitMysqlDateTimeParts: splitMysqlDateTimeParts,
        createHudAcTimeCellEl: createHudAcTimeCellEl,
        parseBalloonColor: parseBalloonColor,
        buildProblemMaps: buildProblemMaps,
        createTeamCellEl: createTeamCellEl,
        createBroadcastTeamCellEl: createBroadcastTeamCellEl,
        createHudProblemCellEl: createHudProblemCellEl,
        createProblemPillEl: createProblemPillEl
    };
})(window);
