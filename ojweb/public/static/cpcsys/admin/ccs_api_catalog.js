/**
 * ICPC CCS Contest API — 端点说明与检索文案（与 docs/guide/07.ICPC与CCS比赛API.md 对齐，随规范演进时改此文件即可）
 * @version 2026-04-05
 */
(function (g) {
    'use strict';
    /** A–Z，与常见题号一致 */
    var CCS_SUB_OPTIONS_PROBLEM_LETTERS = [];
    for (var _pi = 0; _pi < 26; _pi++) {
        var _L = String.fromCharCode(65 + _pi);
        CCS_SUB_OPTIONS_PROBLEM_LETTERS.push({ value: _L, label: _L });
    }
    /** 与 IcpcCcsHelper::icpc_judgement_type_map 一致 */
    var CCS_SUB_OPTIONS_JUDGEMENT_TYPES = [
        { value: 'AC', label: 'AC' },
        { value: 'PE', label: 'PE' },
        { value: 'WA', label: 'WA' },
        { value: 'TLE', label: 'TLE' },
        { value: 'MLE', label: 'MLE' },
        { value: 'OLE', label: 'OLE' },
        { value: 'RE', label: 'RE' },
        { value: 'CE', label: 'CE' },
        { value: 'JE', label: 'JE' }
    ];
    /** 与 config/CsgojConfig.php OJ_LANGUAGE_NORMALIZED 一致（API 语言 id） */
    var CCS_SUB_OPTIONS_LANGUAGES = [
        { value: 'c', label: 'c (C)' },
        { value: 'cpp', label: 'cpp (C++)' },
        { value: 'java', label: 'java' },
        { value: 'python', label: 'python (Python3)' },
        { value: 'go', label: 'go' }
    ];
    g.CCS_API_CATALOG_VERSION = '2026-04-05';
    /**
     * @typedef {Object} CcsCatalogEntry
     * @property {string} id
     * @property {'GET'} method
     * @property {string} pathTpl 含 {cid} 或固定路径
     * @property {boolean} [subOptional] 可选路径段 /{subId}
     * @property {boolean} [subRequired]
     * @property {string} [subLabelCn] [subLabelEn]
     * @property {{value:string,label?:string}[]} [subSelectOptions] 有则控制台渲染为 select（subOptional 时含空选项）
     * @property {string} [subPlaceholder] 无 subSelectOptions 时的 text placeholder
     * @property {'json'|'ndjson'|'blob'} [responseKind]
     * @property {string} titleCn titleEn descCn descEn
     * @property {{key:string,cn:string,en:string}[]} [queryDoc]
     * @property {string} authNoteCn authNoteEn
     */
    g.CCS_API_CATALOG = [
        {
            id: 'api_root',
            method: 'GET',
            pathTpl: '/api/',
            titleCn: 'API 根',
            titleEn: 'API root',
            descCn: '返回本服务实现的 CCS Contest API 版本信息（规范要求必须提供）。',
            descEn: 'Returns implemented CCS Contest API version (required by spec).',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'contests_list',
            method: 'GET',
            pathTpl: '/api/contests',
            titleCn: '比赛列表',
            titleEn: 'Contests list',
            descCn: '返回当前站点上的 Standard 模式比赛（contest.private%10==2）。',
            descEn: 'Lists Standard-mode contests on this site.',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'contest_one',
            method: 'GET',
            pathTpl: '/api/contests/{cid}',
            titleCn: '单场比赛',
            titleEn: 'Single contest',
            descCn: '返回指定比赛的元数据；非 Standard 模式返回 404。',
            descEn: 'Contest metadata; 404 if not Standard.',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'access',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/access',
            titleCn: '能力与端点声明',
            titleEn: 'Capabilities & access',
            descCn: '返回 capabilities 与 endpoints 列表，含各端点 properties；第三方客户端应据此判断可用字段。列表中含 account（当前 Basic 对应账号）；特权另含 accounts。提交源码 zip 路径见 submissions 列表项中的 files（非单独 type）。',
            descEn: 'Capabilities and endpoint declarations. Includes account (current Basic user); privileged responses also list accounts. Submission zip is linked from submissions[].files, not a separate endpoint type.',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'state',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/state',
            titleCn: '比赛状态',
            titleEn: 'Contest state',
            descCn: '当前比赛状态（开始/进行/结束等，与实现序列化一致）。',
            descEn: 'Current contest state object.',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'judgement_types',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/judgement-types',
            subOptional: true,
            subLabelCn: '判定类型 id（可选）',
            subLabelEn: 'Judgement type id (optional)',
            subSelectOptions: CCS_SUB_OPTIONS_JUDGEMENT_TYPES,
            titleCn: '判定类型',
            titleEn: 'Judgement types',
            descCn: '判定类型集合或单个资源 GET。',
            descEn: 'Collection or single judgement type.',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'languages',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/languages',
            subOptional: true,
            subLabelCn: '语言 id（可选）',
            subLabelEn: 'Language id (optional)',
            subSelectOptions: CCS_SUB_OPTIONS_LANGUAGES,
            titleCn: '语言',
            titleEn: 'Languages',
            descCn: '语言列表；含 compiler、runner 等信息型字段。',
            descEn: 'Languages with compiler/runner info.',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'problems',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/problems',
            subOptional: true,
            subLabelCn: '题目 id（可选，如 A）',
            subLabelEn: 'Problem id (optional, e.g. A)',
            subSelectOptions: CCS_SUB_OPTIONS_PROBLEM_LETTERS,
            titleCn: '题目',
            titleEn: 'Problems',
            descCn: '题目列表或单个题目；支持查询参数过滤。赛前匿名访问返回空数组。',
            descEn: 'Problems; filters via query. Anonymous before start: empty array.',
            queryDoc: [
                { key: 'id', cn: '按题目 id', en: 'Filter by problem id' },
                { key: 'label', cn: '按题目标签', en: 'Filter by label' }
            ],
            authNoteCn: '匿名可访问（赛前题目列表为空）。',
            authNoteEn: 'Anonymous OK (empty before start).'
        },
        {
            id: 'groups',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/groups',
            subOptional: true,
            subLabelCn: '分组 id（可选）',
            subLabelEn: 'Group id (optional)',
            subPlaceholder: 'region-a1b2c3d4',
            titleCn: '分组（赛区）',
            titleEn: 'Groups (regions)',
            descCn: '分组/赛区信息。',
            descEn: 'Region/group objects.',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'organizations',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/organizations',
            subOptional: true,
            subLabelCn: '组织 id（可选）',
            subLabelEn: 'Organization id (optional)',
            subPlaceholder: 'org-0123456789ab',
            titleCn: '组织（学校）',
            titleEn: 'Organizations',
            descCn: '学校/组织列表。',
            descEn: 'School/organization list.',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'teams',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/teams',
            subOptional: true,
            subLabelCn: '队伍 id（可选，如 team01）',
            subLabelEn: 'Team id (optional)',
            subPlaceholder: 'team01',
            titleCn: '参赛队',
            titleEn: 'Teams',
            descCn: '队伍列表或单个队伍；支持 id、organization_id 过滤。',
            descEn: 'Teams; filter by id, organization_id.',
            queryDoc: [
                { key: 'id', cn: '队伍 id', en: 'Team id' },
                { key: 'organization_id', cn: '组织 id', en: 'Organization id' }
            ],
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'submissions',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/submissions',
            subOptional: true,
            subLabelCn: '提交 id（可选，数字 solution_id）',
            subLabelEn: 'Submission id (optional)',
            subPlaceholder: '10001',
            titleCn: '提交',
            titleEn: 'Submissions',
            descCn: '提交列表或单条；队伍账号仅可见本队。特权账号含 entry_point、files。',
            descEn: 'Submissions; team sees own only. Privileged: entry_point, files.',
            queryDoc: [
                { key: 'id', cn: '提交 id', en: 'Submission id' },
                { key: 'language_id', cn: '语言 id', en: 'Language id' },
                { key: 'problem_id', cn: '题目 id', en: 'Problem id' },
                { key: 'team_id', cn: '队伍 id', en: 'Team id' }
            ],
            authNoteCn: '匿名可读全部提交（无源码字段）；队伍账号限本队。',
            authNoteEn: 'Anonymous: all without source fields; team: own only.'
        },
        {
            id: 'judgements',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/judgements',
            subOptional: true,
            subLabelCn: '判定 id（可选，如 j123）',
            subLabelEn: 'Judgement id (optional)',
            subPlaceholder: 'j10001',
            titleCn: '判定',
            titleEn: 'Judgements',
            descCn: '判定结果（规范：对提交的裁决；集合 GET 或单资源 GET）。路径后缀须为列表 JSON 中的 judgement id；本实现为「j + solution_id」。按提交/类型筛选用查询串 ?submission_id=数字 / ?judgement_type_id=AC 等，勿把队伍 id、题号当作路径参数。冻结期内非特权用户看不到封榜后的判定。',
            descEn: 'Judgements per CCS (verdicts for submissions; list or single GET). Path segment must be the judgement id from JSON (here: j + numeric solution_id). Filter by submission or type via query (?submission_id=, ?judgement_type_id=), not team_id or problem label in the path. Freeze hides post-freeze for non-privileged.',
            queryDoc: [
                { key: 'id', cn: '判定 id', en: 'Judgement id' },
                { key: 'submission_id', cn: '提交 id', en: 'Submission id' },
                { key: 'judgement_type_id', cn: '判定类型 id', en: 'Judgement type id' }
            ],
            authNoteCn: '匿名可见冻结前部分；队伍限本队；特权可见全部。',
            authNoteEn: 'Anonymous: pre-freeze subset; team: own; staff: all.'
        },
        {
            id: 'runs',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/runs',
            subOptional: true,
            subLabelCn: 'run id（可选，如 r123）',
            subLabelEn: 'Run id (optional)',
            subPlaceholder: 'r10001',
            titleCn: 'Runs（评测进度）',
            titleEn: 'Runs',
            descCn: '本实现为每条已判定提交合成一条 run，便于 event-feed 与 REST 对齐进度类工具。',
            descEn: 'Synthetic one run per judged submission for tooling compatibility.',
            queryDoc: [
                { key: 'id', cn: 'run id（如 r10001）', en: 'Run id' },
                { key: 'judgement_id', cn: '判定 id', en: 'Judgement id' },
                { key: 'judgement_type_id', cn: '判定类型 id', en: 'Judgement type id' }
            ],
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'scoreboard',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/scoreboard',
            titleCn: '榜单',
            titleEn: 'Scoreboard',
            descCn: '排行榜；冻结期非特权为冻结视图。',
            descEn: 'Scoreboard; frozen view for non-privileged during freeze.',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'awards',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/awards',
            subOptional: true,
            subLabelCn: '奖项 id（可选）',
            subLabelEn: 'Award id (optional)',
            subPlaceholder: 'gold-medal（另有 first-to-solve-题号 等动态 id）',
            titleCn: '奖项',
            titleEn: 'Awards',
            descCn: '奖项列表或单个奖项。',
            descEn: 'Awards collection or single.',
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'event_feed',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/event-feed',
            responseKind: 'ndjson',
            titleCn: '事件流（NDJSON）',
            titleEn: 'Event feed (NDJSON)',
            descCn: 'application/x-ndjson 长流；支持 since_token 断线重连（令牌约 15 分钟有效；非法或过期返回 400）。主循环约每 1.5s 输出空行 flush，满足规范 120s 内须有换行。服务端快照逐条写出；生产环境须 PHP-FPM request_terminate_timeout=0，并注意反向代理读超时（详见文档 §10）。本页仅预览前若干字节/行；完整长测可用「EventFeedUtil」导出命令。',
            descEn: 'NDJSON stream; since_token reconnect (~15 min validity; invalid/expired → 400). ~1.5s keepalive newlines. Incremental snapshot flush; production needs PHP-FPM request_terminate_timeout=0 and adequate proxy timeouts (see doc §10). Preview only here; EventFeedUtil export for CLI long-run.',
            queryDoc: [
                { key: 'since_token', cn: '断线重连令牌；错误或过期为 400', en: 'Reconnect token; bad/expired → 400' }
            ],
            authNoteCn: '匿名可访问。',
            authNoteEn: 'Anonymous OK.'
        },
        {
            id: 'submission_files',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/submissions/{subId}/files',
            subRequired: true,
            subLabelCn: '提交 id（必填）',
            subLabelEn: 'Submission id (required)',
            subPlaceholder: '与「提交」列表里每条记录的 id 相同，如 10001',
            responseKind: 'blob',
            titleCn: '提交源码 zip',
            titleEn: 'Submission source zip',
            descCn: '返回源码压缩包；仅 staff/judge/admin 可用，依赖 zip 扩展与 source_code 表。',
            descEn: 'Zip of sources; staff/judge/admin only.',
            authNoteCn: '需特权账号（HTTP Basic）。',
            authNoteEn: 'Privileged Basic Auth required.'
        },
        {
            id: 'accounts',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/accounts',
            subOptional: true,
            subLabelCn: '账号 id（可选）',
            subLabelEn: 'Account id (optional)',
            subPlaceholder: 'team01',
            titleCn: '账号列表',
            titleEn: 'Accounts',
            descCn: 'CCS 账号对象列表；仅特权可见。',
            descEn: 'Account objects; privileged only.',
            queryDoc: [
                { key: 'id', cn: '账号 id', en: 'Account id' },
                { key: 'username', cn: '用户名', en: 'Username' },
                { key: 'type', cn: '类型 team/admin/...', en: 'Type' },
                { key: 'team_id', cn: '队伍 id', en: 'Team id' }
            ],
            authNoteCn: '需特权账号。',
            authNoteEn: 'Privileged only.'
        },
        {
            id: 'account_me',
            method: 'GET',
            pathTpl: '/api/contests/{cid}/account',
            titleCn: '当前账号',
            titleEn: 'Current account',
            descCn: '根据 Basic 认证返回当前 CCS 账号信息；匿名无认证时行为以服务端为准。',
            descEn: 'Current account from Basic Auth.',
            authNoteCn: '建议带 Basic；匿名可能 401。',
            authNoteEn: 'Prefer Basic Auth; anonymous may 401.'
        }
    ];
})(typeof window !== 'undefined' ? window : this);
