'use strict';

const SEATDRAW_IDB_DB = 'ojtool_seatdraw';
const SEATDRAW_IDB_STORE = 'v1';
const SEATDRAW_IDB_SNAPSHOT_KEY = 'snapshot';
const LS_KEY_ROOM = 'ojtool_seatdraw_data_room';
const LS_KEY_TEAM = 'ojtool_seatdraw_data_team';

/** 与队伍导入模板一致：末列独立「样例」，表头中英双行；列号与 ExcelJS row.values（自 1 起）对齐 */
const SEATDRAW_IMPORT_COLUMNS = [
  { cn: '行类型', en: 'Row type' },
  { cn: '分区名称', en: 'Zone name' },
  { cn: '起始编号', en: 'Start No.' },
  { cn: '结束编号', en: 'End No.' },
  { cn: '容量（不填起止编号时）', en: 'Seat count (when start/end blank)' },
  { cn: '队名', en: 'Team name' },
  { cn: '学校', en: 'School' },
  { cn: '成员', en: 'Members' },
  { cn: '教练', en: 'Coach' },
  { cn: '队伍类型', en: 'Team kind' },
  { cn: '标签', en: 'Tag' },
  { cn: '样例（勿删列）', en: 'Sample (keep column)' },
];

const SI = Object.freeze({
  TYPE: 1,
  ROOM: 2,
  S_START: 3,
  S_END: 4,
  CAP: 5,
  TNAME: 6,
  SCHOOL: 7,
  MEMBER: 8,
  COACH: 9,
  TKIND: 10,
  TAG: 11,
  SAMPLE: 12,
});

/** 仅分区表（无主表「行类型」列）*/
const SP_ONLY = Object.freeze({
  ZONE: 1,
  START: 2,
  END: 3,
  CAP: 4,
  SAMPLE: 5,
});

/** 仅队伍表 */
const ST_ONLY = Object.freeze({
  TNAME: 1,
  SCHOOL: 2,
  MEMBER: 3,
  COACH: 4,
  TKIND: 5,
  TAG: 6,
  SAMPLE: 7,
});

const SEATDRAW_PARTITION_TEMPLATE_COLS = [
  { cn: '分区名称', en: 'Zone name' },
  { cn: '起始编号', en: 'Start No.' },
  { cn: '结束编号', en: 'End No.' },
  { cn: '容量（不填起止编号时）', en: 'Seat count (when start/end blank)' },
  { cn: '样例（勿删列）', en: 'Sample (keep column)' },
];

const SEATDRAW_TEAM_TEMPLATE_COLS = [
  { cn: '队名', en: 'Team name' },
  { cn: '学校', en: 'School' },
  { cn: '成员', en: 'Members' },
  { cn: '教练', en: 'Coach' },
  { cn: '队伍类型', en: 'Team kind' },
  { cn: '标签', en: 'Tag' },
  { cn: '样例（勿删列）', en: 'Sample (keep column)' },
];

let data_room = null;
let data_team = null;

const seatdraw_table = $('#seatdraw_table');
const room_info_table = $('#room_info_table');
const room_input = $('#room_input');
const seatdraw_button = $('#seatdraw_button');
const team_input = $('#team_input');
const seat_num_span = $('#seat_num_span');
const seatdraw_seed = $('#seatdraw_seed');
let seat_max = 0;
let team_id_num_len;
let flag_draw = false;
let seed_draw = 1024;
let rd;
const SEED_MOD = 65536;

let _persistTimer = null;

const header_list = {
  team_id: ['team_id', 'name', 'school', 'tmember', 'coach', 'room', 'tkind', 'label'],
  school: ['idx', 'school', 'name', 'tmember', 'coach', 'room', 'tkind', 'label', 'team_id'],
};
const header_list_cn = {
  team_id: ['队号', '队名', '学校', '成员', '教练', '分区', '队伍类型', '标签'],
  school: ['序号', '学校', '队名', '成员', '教练', '分区', '队伍类型', '标签', '队号'],
};
const team_keys = ['name', 'school', 'tmember', 'coach', 'tkind', 'label'];

function idbReady() {
  return window.idb && typeof window.idb.get === 'function' && typeof window.idb.set === 'function';
}

function schedulePersist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    persistSnapshot().catch((e) => console.warn('seatdraw persist', e));
  }, 120);
}

async function persistSnapshot() {
  if (!idbReady()) return;
  syncSeedInput();
  await window.idb.set(SEATDRAW_IDB_DB, SEATDRAW_IDB_STORE, SEATDRAW_IDB_SNAPSHOT_KEY, {
    v: 2,
    data_room,
    data_team,
    seed_draw,
    saved_at: Date.now(),
  });
}

async function clearPersistedSnapshot() {
  if (!idbReady()) return;
  await window.idb.del(SEATDRAW_IDB_DB, SEATDRAW_IDB_STORE, SEATDRAW_IDB_SNAPSHOT_KEY);
}

async function loadPersistedSnapshot() {
  if (!idbReady()) return null;
  return window.idb.get(SEATDRAW_IDB_DB, SEATDRAW_IDB_STORE, SEATDRAW_IDB_SNAPSHOT_KEY);
}

/** localStorage → IndexedDB（仅在没有 idb 快照时迁入并删除旧键） */
function migrateLegacyLocalStorageIntoSnapshot() {
  try {
    const r = localStorage.getItem(LS_KEY_ROOM);
    const t = localStorage.getItem(LS_KEY_TEAM);
    if (!r && !t) return null;
    let dro = null;
    let dtm = null;
    if (r) dro = JSON.parse(r);
    if (t) dtm = JSON.parse(t);
    localStorage.removeItem(LS_KEY_ROOM);
    localStorage.removeItem(LS_KEY_TEAM);
    return { data_room: dro, data_team: dtm };
  } catch (e) {
    console.warn('seatdraw LS migrate parse', e);
    localStorage.removeItem(LS_KEY_ROOM);
    localStorage.removeItem(LS_KEY_TEAM);
    return null;
  }
}

function syncSeedInput() {
  seed_draw = parseInt('0' + seatdraw_seed.val().replace(/\D/g, '0'), 10);
  if (seed_draw > SEED_MOD) seed_draw = SEED_MOD;
  seatdraw_seed.val(seed_draw);
}

function SetSeed(seed) {
  rd = new Math.seedrandom(seed);
}

function Rand() {
  return Math.abs(rd.int32()) % SEED_MOD;
}

/** 与队伍生成页 FormatterTkind 同款；列宽 data-width，badge 等宽见 bilingual.css .csg-badge-eq */
function FormatterSeatdrawTkind(value, row, index, field) {
  const vn = typeof value === 'number' ? value : parseInt(String(value), 10);
  const vk = Number.isFinite(vn) ? vn : -1;
  const tkindMap = {
    0: '<span class="badge bg-primary csg-badge-eq csg-badge-eq--stack">正式<span class="en-text">Regular</span></span>',
    1: '<span class="badge bg-danger csg-badge-eq csg-badge-eq--stack">女队<span class="en-text">Girls</span></span>',
    2:
      '<span class="badge bg-warning csg-badge-eq csg-badge-eq--stack text-dark">打星<span class="en-text">Star</span></span>',
  };
  const inner =
    tkindMap[vk] ||
    '<span class="badge bg-secondary csg-badge-eq csg-badge-eq--stack">未知<span class="en-text">Unknown</span></span>';
  return '<div class="seatdraw-tkind-wrap">' + inner + '</div>';
}

function FormatterSeatdrawSchool(value, row, index, field) {
  const s = value != null ? String(value).trim() : '';
  let inner;
  if (typeof window.csg !== 'undefined' && csg.hashTagBadgeHtml) {
    inner = !s
      ? csg.hashTagBadgeHtml('', '', {})
      : csg.hashTagBadgeHtml(s, s, { allowWrap: true, maxWidth: '12rem' });
  } else {
    inner = s ? DomSantize(s) : '—';
  }
  return (
    '<div class="teamgen-hash-cell teamgen-hash-cell--start">' + inner + '</div>'
  );
}

function FormatterSeatdrawRoom(value, row, index, field) {
  const rm = value != null ? String(value).trim() : '';
  let inner;
  if (typeof window.csg !== 'undefined' && csg.hashTagBadgeHtml) {
    inner = !rm
      ? csg.hashTagBadgeHtml('', '', {})
      : csg.hashTagBadgeHtml(rm, rm, { allowWrap: false, maxWidth: '7rem' });
  } else {
    inner = DomSantize(rm);
  }
  return (
    '<div class="teamgen-hash-cell teamgen-hash-cell--start"><span id="room_div_' +
    index +
    '" class="d-inline-flex">' +
    inner +
    '</span></div>'
  );
}

/** 队号：普通文本（非多色 hash tag），抽签动画仍写入 `#team_div_i` */
function FormatterSeatdrawTeamId(value, row, index, field) {
  const tid = value != null ? String(value).trim() : '';
  const inner = tid ? DomSantize(tid) : DomSantize('—');
  const cls =
    'seatdraw-teamid-plain fw-semibold' +
    (tid ? '' : ' seatdraw-placeholder');
  return (
    '<span id="team_div_' + index + '" class="' + cls + '">' + inner + '</span>'
  );
}

function SeatdrawCellStyleName() {
  return {
    css: {
      fontSize: '0.8rem',
      lineHeight: '1.35',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      verticalAlign: 'middle',
      padding: '0.3rem 0.35rem',
      maxWidth: '11rem',
    },
  };
}

function SeatdrawCellStyleSchool() {
  return {
    css: {
      verticalAlign: 'middle',
      padding: '0.3rem 0.35rem',
      maxWidth: '13rem',
    },
  };
}

function SeatdrawCellStyleMembers() {
  return {
    css: {
      fontSize: '0.78rem',
      lineHeight: '1.4',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      verticalAlign: 'middle',
      padding: '0.3rem 0.35rem',
      maxWidth: '14rem',
    },
  };
}

function SeatdrawCellStyleCoach() {
  return {
    css: {
      fontSize: '0.78rem',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      verticalAlign: 'middle',
      padding: '0.3rem 0.3rem',
      maxWidth: '6rem',
    },
  };
}

function SeatdrawCellStyleTkind() {
  return {
    css: {
      verticalAlign: 'middle',
      padding: '0.28rem 0.2rem',
      textAlign: 'center',
    },
  };
}

function SeatdrawCellStyleRoom() {
  return {
    css: {
      verticalAlign: 'middle',
      padding: '0.3rem 0.35rem',
      maxWidth: '8rem',
    },
  };
}

function SeatdrawCellStyleTeamId() {
  return {
    css: {
      verticalAlign: 'middle',
      padding: '0.3rem 0.35rem',
      maxWidth: '7rem',
      fontFamily: "ui-monospace, 'Sarasa Gothic J', 'Cascadia Code', Consolas, monospace",
      fontSize: '0.82rem',
    },
  };
}

function setSeatdrawExportEnabled(on) {
  $('.seatdraw-export-dd-toggle').prop('disabled', !on);
}

function seatdrawHasDrawResult() {
  if (!data_team || !data_team.length) return false;
  return data_team.some((t) => 'team_id' in t && t.team_id !== '' && t.team_id != null);
}

/** 主表渲染后自检类型列 badge 像素宽（仅 console，便于本页联调） */
function seatdrawLogTkindBadgeWidths(_tag) {
  try {
    const badges = document.querySelectorAll(
      '#seatdraw_table tbody td[data-field="tkind"] .badge.csg-badge-eq'
    );
    if (!badges.length) return;
    const ws = Array.from(badges).map((el) =>
      Math.round(el.getBoundingClientRect().width * 100) / 100
    );
    const uniq = [...new Set(ws)];
    if (uniq.length > 1) {
      console.warn('[seatdraw tkind]', _tag || 'check', 'badge widths differ (px):', uniq, ws);
    } else {
      console.log(
        '[seatdraw tkind]',
        _tag || 'check',
        'badge width OK:',
        uniq[0],
        'px, rows=',
        badges.length
      );
    }
  } catch (_e) {
    /* ignore */
  }
}

function LoadTeam2Table(team_list) {
  team_list.sort((a, b) => {
    try {
      return a.school.localeCompare(b.school) || a.name.localeCompare(b.name);
    } catch (e) {
      return 0;
    }
  });
  seatdraw_table.bootstrapTable('load', team_list);
}

function seatdrawBadgeHtml(label, keyOpt) {
  const k = keyOpt !== undefined ? String(keyOpt).trim() : String(label || '').trim();
  const lb = label != null ? String(label).trim() : '';
  if (typeof window.csg !== 'undefined' && csg.hashTagBadgeHtml) {
    return lb
      ? csg.hashTagBadgeHtml(lb, k || lb, {
          allowWrap: false,
          maxWidth: '7rem',
        })
      : csg.hashTagBadgeHtml('', '', {});
  }
  return DomSantize(lb);
}

function applyDrawResultToDom() {
  if (!data_team) return;
  for (let i = 0; i < data_team.length; i++) {
    const tid =
      'team_id' in data_team[i] && data_team[i].team_id != null
        ? String(data_team[i].team_id)
        : '';
    const rm =
      'room' in data_team[i] && data_team[i].room != null
        ? String(data_team[i].room)
        : '';
    const $tid = $('#team_div_' + i);
    if (tid) {
      $tid.removeClass('seatdraw-placeholder').html(DomSantize(tid));
    } else {
      $tid.addClass('seatdraw-placeholder').html(DomSantize('—'));
    }
    $('#room_div_' + i).html(seatdrawBadgeHtml(rm, rm));
  }
}

function SetStorage() {
  try {
    if (data_room != null) {
      SetSeatTotal();
      setSeatdrawExportEnabled(false);
    }
    if (data_team != null) {
      setSeatdrawExportEnabled(false);
    }
  } catch (e) {
    console.error(e);
  }
  schedulePersist();
}

function ClearStorage() {
  data_room = null;
  data_team = null;
  seatdraw_table.bootstrapTable('removeAll');
  room_info_table.bootstrapTable('removeAll');
  seat_num_span.text('0');
  setSeatdrawExportEnabled(false);
  clearPersistedSnapshot().catch(() => {});
}

$('.button_fullscreen').click(function () {
  ToggleFullScreen('seatdraw_div_fullscreen');
});

// ---------- 考场 ----------
function RoomData2Str() {
  let tmp_room_str = '';
  if (data_room != null) {
    for (let i = 0; i < data_room.length; i++) {
      tmp_room_str += `${data_room[i].room_name}\t${data_room[i].seat_start}\t${data_room[i].seat_end}\n`;
    }
  }
  return tmp_room_str;
}

function ParseRoomSubmitText(raw) {
  let err_msg = '';
  const room_str_list = raw.trim().split('\n');
  const tmp_data_room = [];
  let cnt = 0;
  let last_seat = 0;
  for (let i = 0; i < room_str_list.length; i++) {
    const line = room_str_list[i].trim().split(/[#\t]/);
    let room_name;
    let seat_start;
    let seat_end;
    let seat_num;
    if (line.length < 2) {
      if (line.length && line[0].trim() != '') {
        err_msg = `数据格式不正确：${room_str_list[i]}`;
        break;
      }
      continue;
    }
    if (line.length === 2) {
      seat_start = last_seat + 1;
      seat_num = parseInt(line[1], 10);
      if (isNaN(seat_num) || seat_num < 0) {
        err_msg = `数据格式不正确：${room_str_list[i]}`;
        break;
      }
      seat_end = seat_start + seat_num - 1;
    } else {
      seat_start = parseInt(line[1], 10);
      seat_end = parseInt(line[2], 10);
      if (isNaN(seat_start) || isNaN(seat_end)) {
        err_msg = `数据格式不正确：${room_str_list[i]}`;
        break;
      }
      if (seat_end < seat_start) {
        [seat_start, seat_end] = [seat_end, seat_start];
      }
      if (seat_start <= last_seat) {
        err_msg = `机位编号有冲突：${room_str_list[i]}`;
        break;
      }
      seat_num = seat_end - seat_start + 1;
    }
    room_name = line[0].trim();
    if (room_name.length > 49) {
      err_msg = `分区名称过长：${room_str_list[i]}`;
      break;
    } else if (seat_num > 5000) {
      err_msg = `机位数过多：${room_str_list[i]}`;
      break;
    }
    tmp_data_room.push({
      room_name,
      seat_start,
      seat_end,
      seat_num,
    });
    last_seat = seat_end;
    cnt++;
  }
  return { err_msg, cnt, tmp_data_room };
}

function RoomSubmit() {
  const tmp_room_str = document.getElementById('room_input').value;
  if (tmp_room_str.trim() === '') {
    alerty.notify('什么也没有发生', 'Nothing happened');
    return;
  }
  const { err_msg, cnt, tmp_data_room } = ParseRoomSubmitText(tmp_room_str);
  if (err_msg.length > 0) {
    alerty.error(err_msg);
    return;
  }
  data_room = tmp_data_room;
  room_info_table.bootstrapTable('load', data_room);
  alerty.success(`成功读取 ${cnt} 个分区`, `Loaded ${cnt} zones`);
  SetStorage();
}
$('.room_submit').click(() => RoomSubmit());

// ---------- 队伍 ----------

function extractCell(cellValue) {
  if (cellValue === null || cellValue === undefined) return '';
  if (typeof cellValue === 'object') {
    if (cellValue.richText) {
      return cellValue.richText.map((part) => part.text || '').join('');
    }
    if (cellValue.text !== undefined && cellValue.text !== null) return String(cellValue.text);
    if (cellValue.value !== undefined) return String(cellValue.value);
  }
  return String(cellValue || '').trim();
}

function parseSeatdrawRowKind(s) {
  const raw = String(s || '').trim();
  const low = raw.toLowerCase();
  if (!raw) return null;
  if (
    raw.includes('分区') ||
    raw.includes('考场') ||
    low === 'room' ||
    low === 'zone'
  )
    return 'room';
  if (raw.includes('队伍') || low === 'team') return 'team';
  return null;
}

/** 与 contest_teamgen 逻辑对齐的简化队伍类型解析 */
function parseTkind(raw) {
  const tkindValue = extractCell(raw);
  if (!tkindValue || String(tkindValue).trim() === '') return '0';
  const rv = String(tkindValue).trim();
  const value = rv.toLowerCase();

  const headDigit = rv.match(/^\s*([012])\s*(?:$|[/／、,，\s].*)?$/);
  if (headDigit) return headDigit[1];
  if (/^[012]$/.test(value)) return value;

  if (
    value.includes('正') ||
    value.includes('常') ||
    value.includes('official') ||
    value.includes('regular')
  )
    return '0';
  if (value.includes('女') || value.includes('girl')) return '1';
  if (value.includes('打') || value.includes('星') || value.includes('star')) return '2';
  return '0';
}

function isExcelHeaderSeatdraw(values) {
  const k = extractCell(values[SI.TYPE]).replace(/\*/g, '');
  const first = k.split(/\n/)[0].trim();
  return (
    first === '行类型' ||
    /^row\s+type$/i.test(first) ||
    /^type$/i.test(first)
  );
}

/** 跳过模板中的灰色样例行（与新末列「样例」对齐；兼容旧模板末列仅占位） */
function isSeatdrawSampleExcelRow(values) {
  const s12 = extractCell(values[SI.SAMPLE]);
  if (s12 && /样例|Example/i.test(s12)) return true;
  const tname = extractCell(values[SI.TNAME]);
  if (tname && tname.startsWith('[样例')) return true;
  const s11 = extractCell(values[SI.TAG]).trim();
  if (!s12 && s11 && /^(样例(\s*[\/／]\s*Example)?)$/i.test(s11)) return true;
  return false;
}

function applySeatdrawTemplateExampleRowStyle(row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };
    cell.font = { color: { argb: 'FF808080' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
}

function applySeatdrawTemplateHeaderRowStyle(hr) {
  hr.height = 42;
  hr.font = { bold: true, size: 11 };
  hr.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
  });
}

/** 子表「队伍类型」+ 下拉区公式引用字符串 */
function seatdrawWorkbookAppendKindSheet(workbook) {
  const tkindSheet = workbook.addWorksheet('队伍类型 Types');
  tkindSheet.columns = [{ width: 7 }, { width: 38 }];
  const tkh = tkindSheet.addRow(['类型\nType', '说明 / Hint']);
  tkh.font = { bold: true };
  tkh.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F3FF' },
  };
  tkh.getCell(2).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F3FF' },
  };
  tkindSheet.addRow(['0', '正式 · Regular']);
  tkindSheet.addRow(['1', '女队 · Girls']);
  tkindSheet.addRow(['2', '打星 · Star']);
  return "'队伍类型 Types'!$A$2:$A$4";
}

function headerLeadingToken(values, colIdx) {
  const v = extractCell(values[colIdx]).replace(/\*/g, '');
  return v.split(/\n/)[0].trim().toLowerCase().replace(/\s+/g, ' ');
}

function detectSeatdrawExcelVariant(worksheet) {
  const values = worksheet.getRow(1).values;
  if (!values || values.length < 2) return 'unknown';
  const unifiedKey = headerLeadingToken(values, SI.TYPE);
  if (
    unifiedKey === '行类型' ||
    unifiedKey === 'type' ||
    unifiedKey === 'row type'
  )
    return 'unified';

  const pCell = extractCell(values[SP_ONLY.ZONE]).replace(/\*/g, '').split(/\n/)[0].trim();
  const pl = pCell.toLowerCase();
  if (/^分区/.test(pCell) || (pCell.includes('考场') && pCell.includes('名称')))
    return 'partition_only';
  if (pl.includes('zone name') || (pl.includes('zone') && pl.includes('name')))
    return 'partition_only';

  const tm = headerLeadingToken(values, ST_ONLY.TNAME);
  if (tm.includes('队名') || tm.includes('team name'))
    return 'team_only';

  const look2 = headerLeadingToken(values, 2);
  if ((!tm || tm === '') && (look2.includes('队名') || look2.includes('team')))
    return 'team_only';

  return 'unknown';
}

function isPartitionOnlyHeaderRow(values) {
  const pCell = extractCell(values[SP_ONLY.ZONE]).replace(/\*/g, '').split(/\n/)[0].trim();
  if (/^分区/.test(pCell)) return true;
  if (pCell.includes('考场') && pCell.includes('名称')) return true;
  const pl = pCell.toLowerCase();
  if (pl.includes('zone') && pl.includes('name')) return true;
  return false;
}

function isPartitionOnlySampleRow(values) {
  const s = extractCell(values[SP_ONLY.SAMPLE]);
  if (s && /样例|example/i.test(s)) return true;
  return false;
}

function isTeamOnlyHeaderRow(values) {
  const t = extractCell(values[ST_ONLY.TNAME]).replace(/\*/g, '').split(/\n/)[0].trim().toLowerCase();
  if (t.includes('队名')) return true;
  if (t.includes('team') && t.includes('name')) return true;
  return false;
}

function isTeamOnlySampleRow(values) {
  const s = extractCell(values[ST_ONLY.SAMPLE]);
  if (s && /样例|example/i.test(s)) return true;
  const tn = extractCell(values[ST_ONLY.TNAME]);
  if (tn && tn.startsWith('[样例')) return true;
  const tag = extractCell(values[ST_ONLY.TAG]).trim();
  if (!(s && s.trim()) && tag && /^(样例(\s*[\/／]\s*Example)?)$/i.test(tag))
    return true;
  return false;
}

function collectPartitionOnlyPatches(worksheet) {
  const patches = [];
  worksheet.eachRow((row, rn) => {
    try {
      const values = row.values;
      if (!values || values.length < 2) return;
      if (rn === 1 && isPartitionOnlyHeaderRow(values)) return;
      if (isPartitionOnlySampleRow(values)) return;

      const zone = extractCell(values[SP_ONLY.ZONE]).trim();
      if (!zone) return;

      const patch = {};
      patch.room_name = zone;
      const cs = extractCell(values[SP_ONLY.START]);
      const ce = extractCell(values[SP_ONLY.END]);
      const cap = extractCell(values[SP_ONLY.CAP]);
      if (cs !== '') {
        const n = parseInt(cs, 10);
        if (!isNaN(n)) patch.seat_start = n;
      }
      if (ce !== '') {
        const n = parseInt(ce, 10);
        if (!isNaN(n)) patch.seat_end = n;
      }
      if (cap !== '') {
        const n = parseInt(cap, 10);
        if (!isNaN(n)) patch.seat_capacity = n;
      }
      patches.push(patch);
    } catch (_e) {
      /* skip row */
    }
  });
  return patches;
}

function collectTeamOnlyPatches(worksheet) {
  const teamPatches = [];
  worksheet.eachRow((row, rn) => {
    try {
      const values = row.values;
      if (!values || values.length < 2) return;
      if (rn === 1 && isTeamOnlyHeaderRow(values)) return;
      if (isTeamOnlySampleRow(values)) return;

      const name = extractCell(values[ST_ONLY.TNAME]);
      const school = extractCell(values[ST_ONLY.SCHOOL]);
      const tmember = extractCell(values[ST_ONLY.MEMBER]);
      const coach = extractCell(values[ST_ONLY.COACH]);
      const tkindStr = extractCell(values[ST_ONLY.TKIND]);
      const label = extractCell(values[ST_ONLY.TAG]);
      const patch = {};
      if (name !== '') patch.name = name;
      if (school !== '') patch.school = school;
      if (tmember !== '') patch.tmember = tmember;
      if (coach !== '') patch.coach = coach;
      if (tkindStr !== '') patch.tkind = parseTkind(tkindStr);
      if (label !== '') patch.label = label;
      if (Object.keys(patch).length === 0) return;
      teamPatches.push(patch);
    } catch (_e) {
      /* skip row */
    }
  });
  return teamPatches;
}

function excelColLetter(n) {
  let s = '';
  let nn = Math.max(1, n);
  while (nn > 0) {
    const m = (nn - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    nn = Math.floor((nn - 1) / 26);
  }
  return s;
}

/** 从下表 worksheet 拆分考场 / 队伍的「按序补丁」——仅含确有内容的字段 */
function collectSeatdrawExcelPatches(worksheet) {
  const roomPatches = [];
  const teamPatches = [];
  worksheet.eachRow((row, rowNumber) => {
    try {
      const values = row.values;
      if (!values || values.length < 2) return;
      if (rowNumber === 1 && isExcelHeaderSeatdraw(values)) return;
      const kind = parseSeatdrawRowKind(values[SI.TYPE]);
      if (!kind) return;
      if (isSeatdrawSampleExcelRow(values)) return;

      if (kind === 'room') {
        const rn = extractCell(values[SI.ROOM]);
        const cs = extractCell(values[SI.S_START]);
        const ce = extractCell(values[SI.S_END]);
        const cap = extractCell(values[SI.CAP]);
        const patch = {};
        if (rn !== '') patch.room_name = rn;
        if (cs !== '') {
          const n = parseInt(cs, 10);
          if (!isNaN(n)) patch.seat_start = n;
        }
        if (ce !== '') {
          const n = parseInt(ce, 10);
          if (!isNaN(n)) patch.seat_end = n;
        }
        if (cap !== '') {
          const n = parseInt(cap, 10);
          if (!isNaN(n)) patch.seat_capacity = n;
        }
        if (Object.keys(patch).length === 0) return;
        roomPatches.push(patch);
        return;
      }

      const name = extractCell(values[SI.TNAME]);
      const school = extractCell(values[SI.SCHOOL]);
      const tmember = extractCell(values[SI.MEMBER]);
      const coach = extractCell(values[SI.COACH]);
      const tkindStr = extractCell(values[SI.TKIND]);
      const label = extractCell(values[SI.TAG]);
      const patch = {};
      if (name !== '') patch.name = name;
      if (school !== '') patch.school = school;
      if (tmember !== '') patch.tmember = tmember;
      if (coach !== '') patch.coach = coach;
      if (tkindStr !== '') patch.tkind = parseTkind(tkindStr);
      if (label !== '') patch.label = label;
      if (Object.keys(patch).length === 0) return;
      teamPatches.push(patch);
    } catch (_e) {
      /* skip row */
    }
  });
  return { roomPatches, teamPatches };
}

function existingRoomToStruct(rr) {
  if (!rr) return {};
  return {
    room_name: rr.room_name,
    seat_start: rr.seat_start,
    seat_end: rr.seat_end,
  };
}

function mergeRoomStruct(base, patch) {
  const o = Object.assign({}, base);
  ['room_name', 'seat_start', 'seat_end', 'seat_capacity'].forEach((k) => {
    if (patch[k] !== undefined) o[k] = patch[k];
  });
  return o;
}

function mergeRoomStructsIndexed(existingRooms, patches) {
  const n = Math.max(existingRooms?.length || 0, patches.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const base = existingRoomToStruct(existingRooms?.[i]);
    const p = patches[i] || {};
    out.push(mergeRoomStruct(base, p));
  }
  return out;
}

/** Excel 单行队伍 patch → 表格行（空串即清空；类型空默认 0） */
function buildTeamRowFromExcelPatch(patch) {
  const p = patch || {};
  const row = {};
  team_keys.forEach((k) => {
    if (k === 'tkind') {
      if (
        Object.prototype.hasOwnProperty.call(p, k) &&
        p[k] !== '' &&
        p[k] !== undefined &&
        p[k] !== null
      ) {
        row[k] = String(p[k]);
      } else {
        row[k] = '0';
      }
      return;
    }
    if (
      Object.prototype.hasOwnProperty.call(p, k) &&
      p[k] !== '' &&
      p[k] !== undefined &&
      p[k] !== null
    ) {
      row[k] = p[k];
    } else {
      row[k] = '';
    }
  });
  return row;
}

function finalizeRoomStructs(structs) {
  let last_seat = 0;
  const tmp_data_room = [];
  let err_msg = '';
  for (let i = 0; i < structs.length; i++) {
    const s = structs[i];
    const room_name = String(s.room_name || '').trim();
    if (!room_name) {
      err_msg = `第 ${i + 1} 条分区缺少名称`;
      break;
    }
    let seat_start = s.seat_start;
    let seat_end = s.seat_end;
    const cap = s.seat_capacity;

    let seat_num;
    if (
      seat_start != null &&
      !isNaN(seat_start) &&
      seat_end != null &&
      !isNaN(seat_end)
    ) {
      if (seat_end < seat_start) {
        [seat_start, seat_end] = [seat_end, seat_start];
      }
      if (seat_start <= last_seat) {
        err_msg = `机位编号冲突：${room_name} (${seat_start}–${seat_end})`;
        break;
      }
      seat_num = seat_end - seat_start + 1;
    } else if (cap != null && !isNaN(cap) && cap >= 0) {
      seat_start = last_seat + 1;
      seat_num = Number(cap);
      seat_end = seat_start + seat_num - 1;
    } else {
      err_msg = `「${room_name}」请填写起止编号，或只填「容量」`;
      break;
    }
    if (room_name.length > 49) {
      err_msg = `分区名称过长`;
      break;
    }
    if (seat_num > 5000) {
      err_msg = `机位数过多`;
      break;
    }
    tmp_data_room.push({
      room_name,
      seat_start,
      seat_end,
      seat_num,
    });
    last_seat = seat_end;
  }
  return { err_msg, tmp_data_room };
}

async function seatdrawApplyExcelFile(file) {
  if (!(window.ExcelJS && typeof ExcelJS.Workbook === 'function')) {
    alerty.error('表格预览暂不可用，请刷新后再试', 'Please refresh and try again');
    return;
  }
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const ws = workbook.getWorksheet(1);
    if (!ws) {
      throw new Error('无工作表');
    }
    let roomPatches = [];
    let teamPatches = [];
    const variant = detectSeatdrawExcelVariant(ws);

    if (variant === 'partition_only')
      roomPatches = collectPartitionOnlyPatches(ws);
    else if (variant === 'team_only')
      teamPatches = collectTeamOnlyPatches(ws);
    else if (variant === 'unified') {
      const u = collectSeatdrawExcelPatches(ws);
      roomPatches = u.roomPatches;
      teamPatches = u.teamPatches;
    } else {
      const u = collectSeatdrawExcelPatches(ws);
      if (u.roomPatches.length > 0 || u.teamPatches.length > 0) {
        roomPatches = u.roomPatches;
        teamPatches = u.teamPatches;
      } else {
        roomPatches = collectPartitionOnlyPatches(ws);
        teamPatches = collectTeamOnlyPatches(ws);
      }
    }

    if (roomPatches.length === 0 && teamPatches.length === 0) {
      alerty.error(
        '未能识别表格，请使用本页提供的分区或队伍模板',
        'Unrecognized sheet — download the Zones or Teams template.'
      );
      return;
    }

    let changed = false;
    const msgPartsCn = [];
    const msgPartsEn = [];

    if (roomPatches.length > 0) {
      const mergedRoomStructs = mergeRoomStructsIndexed([], roomPatches);
      const r = finalizeRoomStructs(mergedRoomStructs);
      if (r.err_msg) {
        alerty.error(r.err_msg);
        return;
      }
      data_room = r.tmp_data_room;
      room_info_table.bootstrapTable('load', data_room);
      room_input.val(RoomData2Str());
      changed = true;
      msgPartsCn.push('分区已导入');
      msgPartsEn.push('Zones imported');
    }

    if (teamPatches.length > 0) {
      data_team = teamPatches.map((p) => buildTeamRowFromExcelPatch(p));
      LoadTeam2Table(data_team);
      TeamDataToTextarea();
      changed = true;
      msgPartsCn.push('队伍已导入');
      msgPartsEn.push('Teams imported');
    }

    if (changed) {
      alerty.success(msgPartsCn.join('；'), msgPartsEn.join(' · '));
      SetStorage();
    }
    applyDrawResultToDom();
    schedulePersist();
  } catch (e) {
    console.error(e);
    alerty.error(String(e.message || '无法读取该表格'), 'Could not read that file.');
  }
}

async function seatdrawDownloadWorkbookBlob(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function seatdrawDownloadPartitionTemplate() {
  if (!(window.ExcelJS && typeof ExcelJS.Workbook === 'function')) {
    alerty.error('表格功能暂不可用', 'Spreadsheet unavailable');
    return;
  }
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('分区 Zones');
    worksheet.columns = SEATDRAW_PARTITION_TEMPLATE_COLS.map(() => ({
      width: 14,
    }));
    worksheet.getColumn(SP_ONLY.CAP).width = 26;
    worksheet.getColumn(SP_ONLY.SAMPLE).width = 16;

    const hr = worksheet.addRow(
      SEATDRAW_PARTITION_TEMPLATE_COLS.map((c) => `${c.cn}\n${c.en}`)
    );
    applySeatdrawTemplateHeaderRowStyle(hr);

    [
      ['示例分区 Alpha', '', '', '28', '样例 / Example'],
      ['示例分区 Beta', '', '', '22', '样例 / Example'],
    ].forEach((cells) => {
      applySeatdrawTemplateExampleRowStyle(worksheet.addRow(cells));
    });

    await seatdrawDownloadWorkbookBlob(workbook, '机位抽签-分区模板.xlsx');
    alerty.success('分区模板已下载', 'Zones template saved');
  } catch (e) {
    console.error(e);
    alerty.error('未能生成分区模板', 'Could not build zones template');
  }
}

async function seatdrawDownloadTeamTemplate() {
  if (!(window.ExcelJS && typeof ExcelJS.Workbook === 'function')) {
    alerty.error('表格功能暂不可用', 'Spreadsheet unavailable');
    return;
  }
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('队伍 Teams');
    worksheet.columns = SEATDRAW_TEAM_TEMPLATE_COLS.map(() => ({
      width: 13,
    }));
    worksheet.getColumn(ST_ONLY.SAMPLE).width = 15;

    const hr = worksheet.addRow(
      SEATDRAW_TEAM_TEMPLATE_COLS.map((c) => `${c.cn}\n${c.en}`)
    );
    applySeatdrawTemplateHeaderRowStyle(hr);

    [
      ['一队示意', '示意大学', '甲、乙', '', '0', '邀请赛', '样例 / Example'],
      ['二队示意', '另一学校', '', '教练示意', '2', '', '样例 / Example'],
    ].forEach((cells) => {
      applySeatdrawTemplateExampleRowStyle(worksheet.addRow(cells));
    });

    const tkindRef = seatdrawWorkbookAppendKindSheet(workbook);
    const tkindCol = excelColLetter(ST_ONLY.TKIND);
    for (let r = 2; r <= 500; r++) {
      worksheet.getCell(`${tkindCol}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [tkindRef],
        showErrorMessage: true,
        errorTitle: '队伍类型 · Team kind',
        error: '从列表选 0/1/2，也可手填「正式」「女队」等。\nPick from list or type a keyword.',
      };
    }

    await seatdrawDownloadWorkbookBlob(workbook, '机位抽签-队伍模板.xlsx');
    alerty.success('队伍模板已下载', 'Teams template saved');
  } catch (e) {
    console.error(e);
    alerty.error('未能生成队伍模板', 'Could not build teams template');
  }
}

$('#seatdraw_dl_partition').on('click', seatdrawDownloadPartitionTemplate);
$('#seatdraw_dl_team').on('click', seatdrawDownloadTeamTemplate);
$('#seatdraw_excel_pick_btn').on('click', () =>
  $('#seatdraw_excel_file_input').trigger('click')
);
$('#seatdraw_excel_file_input').on('change', function () {
  const f = this.files && this.files[0];
  if (!f) return;
  seatdrawApplyExcelFile(f).finally(() => {
    $(this).val('');
  });
});

/** 文本应用到队伍——整表替换（非单元格合并） */
function TeamDataToTextarea() {
  let tmp_team_str = '';
  if (data_team != null) {
    for (let i = 0; i < data_team.length; i++) {
      const line_item = [];
      for (let j = 0; j < team_keys.length; j++) {
        line_item.push(
          data_team[i]?.[team_keys[j]] ? data_team[i][team_keys[j]] : ''
        );
      }
      tmp_team_str += line_item.join('\t');
      tmp_team_str += '\n';
    }
  }
  document.getElementById('team_input').value = tmp_team_str;
}

function TeamSubmit() {
  let warn_msg = '';
  const tmp_team_str = document.getElementById('team_input').value;
  if (tmp_team_str.trim() === '') {
    alerty.notify('什么也没有发生', 'Nothing happened');
    return;
  }
  const team_str_list = tmp_team_str.trim().split('\n');
  const tmp_data_team = [];
  let cnt = 0;
  for (let i = 0; i < team_str_list.length; i++) {
    const line_str = team_str_list[i].trim();
    if (line_str === '') {
      continue;
    }
    const line = line_str.split(/[#\t]/);
    const team_item = {};
    const line_warn = [];
    for (let j = 0; j < team_keys.length; j++) {
      if (team_keys[j] !== 'label' && (j >= line.length || line[j].length === 0)) {
        line_warn.push(`缺少[${team_keys[j]}]`);
        team_item[team_keys[j]] = line[j];
        continue;
      }
      if (j >= line.length) {
        team_item[team_keys[j]] = '';
        break;
      }
      switch (team_keys[j]) {
        case 'name':
          if (line[j].length > 49) {
            line_warn.push('队名过长');
          }
          break;
        case 'school':
          if (line[j].length > 49) {
            line_warn.push('校名过长');
          }
          break;
        case 'tmember':
          if (
            line[j].length > 63 ||
            line[j].split('、').length > 10 ||
            line[j].split(',').length > 10
          ) {
            line_warn.push('成员过多或名字过长');
          }
          break;
        case 'coach':
          if (line[j].length > 24) {
            line_warn.push('教练信息过长');
          }
          break;
        case 'tkind': {
          const tk = parseInt(line[j], 10);
          if (isNaN(tk) || tk < 0 || tk > 4) {
            line_warn.push('队伍类型不是本系统格式');
          }
          break;
        }
      }
      team_item[team_keys[j]] = line[j];
    }
    tmp_data_team.push(team_item);
    if (line_warn.length > 0) {
      warn_msg += `<code>${DomSantize(line_str)}</code>：<br/>${line_warn.join(
        '; '
      )}<br/>`;
    }
    cnt++;
  }
  const applyTeams = () => {
    data_team = tmp_data_team;
    LoadTeam2Table(data_team);
    alerty.success(
      cnt ? `读取到${cnt}个队伍信息` : '已清空队伍',
      cnt ? `${cnt} teams loaded` : 'Teams cleared'
    );
    SetStorage();
    applyDrawResultToDom();
  };

  if (warn_msg.length > 0) {
    alerty.confirm({
      title: '提示',
      title_en: 'Warning',
      message: `存在部分数据可能有问题，请检查。<br/>抽签可能无法正常导入比赛，但仍可继续<br/>${warn_msg}`,
      message_en: `Some data may have issues, please check.<br/>${warn_msg}`,
      callback() {
        applyTeams();
      },
      callbackCancel() {},
    });
  } else {
    applyTeams();
  }
}
$('.team_submit').click(() => TeamSubmit());

function SetSeatTotal() {
  let seat_total = 0;
  seat_max = 0;
  if (data_room != null) {
    for (let i = 0; i < data_room.length; i++) {
      seat_total += data_room[i].seat_num;
      seat_max = Math.max(seat_max, data_room[i].seat_end);
    }
    seat_num_span.text(seat_total);
    team_id_num_len = parseInt(String(seat_max * 1.2), 10).toString().length;
  }
}

// **************************************************
// Draw
// **************************************************
function ResolveAdj(team_idx) {
  function d(ii) {
    return (ii + team_idx.length) % team_idx.length;
  }
  const team_idx_reverse = new Array(team_idx.length);
  for (let i = 0; i < team_idx.length; i++) {
    team_idx_reverse[team_idx[i]] = i;
  }
  const n = team_idx.length << 2;

  function AdjGetIns(i, school_same_name) {
    for (let k = 0; k < 5; k++) {
      const rdi = Rand() % team_idx.length;
      if (
        data_team[team_idx_reverse[rdi]].school !== school_same_name &&
        data_team[team_idx_reverse[d(rdi - 1)]].school !== school_same_name &&
        data_team[team_idx_reverse[d(rdi + 1)]].school !== school_same_name
      ) {
        return rdi;
      }
    }
    let j = i + 1;
    for (; j < n && data_team[team_idx_reverse[d(j)]].school === data_team[team_idx_reverse[d(i - 1)]].school; j++);
    if (j < n) {
      return d(j);
    }
    return null;
  }
  for (let i = 1; i < n; i++) {
    if (
      data_team[team_idx_reverse[d(i)]].school === data_team[team_idx_reverse[d(i - 1)]].school
    ) {
      const j = AdjGetIns(i, data_team[team_idx_reverse[d(i)]].school);
      if (j != null) {
        [team_idx_reverse[d(i)], team_idx_reverse[d(j)]] = [
          team_idx_reverse[d(j)],
          team_idx_reverse[d(i)],
        ];
      }
    }
  }
  for (let i = 0; i < team_idx.length; i++) {
    team_idx[team_idx_reverse[i]] = i;
  }
}

function TeamNum2TeamStr(team_num_id) {
  return `team${pad0left(team_num_id, team_id_num_len, 0)}`;
}

function DrawBySeed(seed) {
  if (data_team === null || data_room === null) {
    alerty.error('请录入队伍与房间/区域', 'Please enter teams and rooms/areas');
    return false;
  }
  SetSeatTotal();
  SetSeed(seed);
  const seat_list = [];
  for (let i = 0; i < data_room.length; i++) {
    for (let j = data_room[i].seat_start; j <= data_room[i].seat_end; j++) {
      seat_list.push({
        team_num_id: j,
        room_id: i,
      });
    }
  }

  function getteam(num) {
    if (num >= seat_list.length) {
      return null;
    }
    return {
      team_num_id: seat_list[num].team_num_id,
      team_id: TeamNum2TeamStr(seat_list[num].team_num_id),
      room: data_room[seat_list[num].room_id].room_name,
    };
  }

  let team_idx = [];
  for (let i = 0; i < data_team.length; i++) {
    team_idx.push(i);
  }
  for (let i = 0; i < data_team.length; i++) {
    const j = Rand() % data_team.length;
    if (i !== j) {
      [team_idx[i], team_idx[j]] = [team_idx[j], team_idx[i]];
    }
  }
  ResolveAdj(team_idx);
  for (let i = 0; i < data_team.length; i++) {
    const team = getteam(team_idx[i]);
    if (team != null) {
      data_team[i].team_num_id = team.team_num_id;
      data_team[i].team_id = team.team_id;
      data_team[i].room = team.room;
    } else if ('team_id' in data_team[i]) {
      delete data_team[i].team_num_id;
      delete data_team[i].team_id;
      delete data_team[i].room;
    }
  }
  applyDrawResultToDom();
  setSeatdrawExportEnabled(true);
  schedulePersist();
  return true;
}

function DrawNext() {
  if (flag_draw) {
    seed_draw = Rand();
    seatdraw_seed.val(seed_draw);
    DrawBySeed(seed_draw);
    setTimeout(DrawNext, Math.max(data_team.length >> 2, 100));
  }
}

function DrawStart() {
  if (data_team === null || data_room === null) {
    alerty.error('请先录入队伍和房间/区域', 'Please enter teams and rooms/areas first');
    return;
  }
  seatdraw_button.removeClass('btn-success').addClass('btn-danger');
  if (seatdraw_button.find('.cn-text').length) {
    seatdraw_button.find('.cn-text').text('停');
    seatdraw_button.find('.en-text').text('Stop');
  } else {
    seatdraw_button.text('Stop');
  }

  $('.btn-func').attr('disabled', true);
  seatdraw_seed.attr('disabled', true);
  flag_draw = true;
  SetSeed(Date.now());
  DrawNext();
}

function DrawStop() {
  seatdraw_button.removeClass('btn-danger').addClass('btn-success');
  if (seatdraw_button.find('.cn-text').length) {
    seatdraw_button.find('.cn-text').text('开始');
    seatdraw_button.find('.en-text').text('Start');
  } else {
    seatdraw_button.text('开始');
  }
  $('.btn-func').removeAttr('disabled');
  seatdraw_seed.removeAttr('disabled');
  flag_draw = false;
  schedulePersist();
}

function DrawToggle() {
  syncSeedInput();
  if (!flag_draw) DrawStart();
  else DrawStop();
}

seatdraw_seed.on('input', function () {
  seed_draw = parseInt('0' + seatdraw_seed.val().replace(/\D/g, '0'), 10);
  if (seed_draw > SEED_MOD) seed_draw = SEED_MOD;
  seatdraw_seed.val(seed_draw);
  schedulePersist();
});

seatdraw_button.click(() => DrawToggle());

$('.button_draw').click(() => {
  syncSeedInput();
  if (DrawBySeed(seed_draw)) {
    alerty.success(`按种子"${seed_draw}"生成机位执行完毕`, `Seat draw with seed "${seed_draw}" OK`);
    schedulePersist();
  }
});

function GetTeamAccordRoom() {
  const team_full = [];
  const team_map = {};
  for (let i = 0; i < data_team.length; i++) {
    if ('team_num_id' in data_team[i]) {
      team_map[data_team[i].team_num_id] = data_team[i];
    }
    data_team[i].exported = false;
  }
  for (let i = 0; i < data_room.length; i++) {
    for (let sj = data_room[i].seat_start; sj <= data_room[i].seat_end; sj++) {
      if (sj in team_map) {
        team_full.push(team_map[sj]);
        team_map[sj].exported = true;
      } else {
        team_full.push({
          team_num_id: sj,
          team_id: TeamNum2TeamStr(sj),
          room: data_room[i].room_name,
        });
      }
    }
  }
  for (let i = 0; i < data_team.length; i++) {
    if (!data_team[i].exported) {
      team_full.push(data_team[i]);
    }
  }
  return team_full;
}

async function ExportXlsx(btype) {
  if (!(window.ExcelJS && typeof ExcelJS.Workbook === 'function')) {
    alerty.error('表格导出暂不可用，请刷新后再试', 'Spreadsheet unavailable; please refresh.');
    return;
  }
  function rowValues(hl, team, idx) {
    return hl.map((field) => {
      if (field === 'idx') return idx;
      if (field in team) return team[field];
      return '';
    });
  }

  SetSeatTotal();
  let filename;
  let team_all;
  if (btype === 'school') {
    team_all = data_team;
    filename = '单位顺序';
  } else {
    team_all = GetTeamAccordRoom();
    filename = '队伍ID顺序';
  }
  const hk = header_list[btype];
  const hn = header_list_cn[btype];
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('抽签结果');
    const hdr = worksheet.addRow(hn);
    hdr.font = { bold: true };
    for (let i = 0; i < team_all.length; i++) {
      worksheet.addRow(rowValues(hk, team_all[i], i + 1));
    }
    worksheet.columns.forEach((col) => {
      col.width = 14;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `抽签结果_${filename}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
    alerty.success('已导出 Excel', 'Exported spreadsheet');
  } catch (e) {
    console.error(e);
    alerty.error('导出 Excel 失败', 'Could not export XLSX');
  }
}

function ExportCsv(btype) {
  function AddLine(hl, team, idx) {
    const team_item = [];
    for (let j = 0; j < hl.length; j++) {
      if (hl[j] === 'idx') {
        team_item.push(`${idx}`);
      } else if (hl[j] in team) {
        team_item.push(`"${team[hl[j]]}"`);
      } else {
        team_item.push('');
      }
    }
    ret.push(team_item.join(',') + '\n');
  }

  SetSeatTotal();
  const ret = [];
  ret.push(`${header_list_cn[btype].join(',')}\n`);
  let filename;
  let team_all;
  if (btype === 'school') {
    team_all = data_team;
    filename = '单位顺序';
  } else {
    team_all = GetTeamAccordRoom();
    filename = '队伍ID顺序';
  }
  for (let i = 0; i < team_all.length; i++) {
    AddLine(header_list[btype], team_all[i], i + 1);
  }
  const blob = new Blob(['\uFEFF' + ret.join('')], {
    type: 'text/plain;charset=utf-8',
  });
  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = `抽签结果_${filename}.csv`;
  downloadLink.click();
  alerty.success('已导出 CSV', 'Exported CSV');
}

function ExportSeatdrawResult(btype, fmt) {
  if (data_team === null || data_room === null) {
    alerty.error(
      '未正确录入队伍或房间/区域',
      'Teams or rooms/areas not properly entered'
    );
    return;
  }
  const f = fmt === 'xlsx' ? 'xlsx' : 'csv';
  if (f === 'csv') {
    ExportCsv(btype);
    return;
  }
  ExportXlsx(btype);
}

$(document).on('click', '.seatdraw-export-item', function (e) {
  e.preventDefault();
  ExportSeatdrawResult(
    $(this).data('btype'),
    $(this).data('exportFmt') || $(this).data('export-fmt')
  );
});

$('.button_clear').click(function () {
  alerty.confirm({
    title: '确认',
    title_en: 'Confirm',
    message: '确认清空缓存？',
    message_en: 'Are you sure to clear cache?',
    callback() {
      ClearStorage();
      alerty.success('缓存已清', 'Cache cleared');
    },
    callbackCancel() {
      alerty.notify('什么也没有发生', 'Nothing happened');
    },
  });
});

window.onkeydown = (event) => {
  if (!event || !event.isTrusted || !event.cancelable) {
    return;
  }
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (document.activeElement && document.activeElement.tagName === 'TEXTAREA')
    return;
  const key = event.key;
  if (key === 's' || key === 'S') {
    event.preventDefault();
    DrawToggle();
  }
};

function refreshRoomTextareaMirror() {
  room_input.val(RoomData2Str());
}

(async function SeatdrawBootstrap() {
  let snap = idbReady() ? await loadPersistedSnapshot() : null;
  const idbEmpty = !snap || (!snap.data_room && !snap.data_team);
  if (idbEmpty) {
    const leg = migrateLegacyLocalStorageIntoSnapshot();
    if (leg && (leg.data_room || leg.data_team)) {
      syncSeedInput();
      data_room = leg.data_room ?? null;
      data_team = leg.data_team ?? null;
      await persistSnapshot();
      snap = await loadPersistedSnapshot();
    }
  }

  // 等 Bootstrap Table 完成初始化后再灌数据；恢复场景只刷新左栏预览与下方主表，不填右侧粘贴框。
  $(function () {
    seatdraw_table.on('post-body.bs.table', function () {
      queueMicrotask(function () {
        seatdrawLogTkindBadgeWidths('post-body');
      });
    });

    if (typeof TextAllowTab === 'function') {
      TextAllowTab('room_input');
      TextAllowTab('team_input');
    }

    if (!idbReady()) {
      refreshRoomTextareaMirror();
      return;
    }

    let loaded_from = false;
    try {
      if (snap?.data_room) {
        data_room = snap.data_room;
        room_info_table.bootstrapTable('load', data_room);
        loaded_from = true;
      }
      if (snap?.data_team) {
        data_team = snap.data_team;
        LoadTeam2Table(data_team);
        loaded_from = true;
      }
      if (
        snap &&
        snap.seed_draw != null &&
        !Number.isNaN(Number(snap.seed_draw))
      ) {
        seed_draw = Number(snap.seed_draw);
        seatdraw_seed.val(seed_draw);
      }
    } catch (e) {
      console.error(e);
    }

    if (loaded_from) {
      alerty.success('已恢复本机保存的数据', 'Restored data saved on this device');
      room_input.val('');
      team_input.val('');
      SetSeatTotal();
      applyDrawResultToDom();
      setSeatdrawExportEnabled(seatdrawHasDrawResult());
    } else {
      refreshRoomTextareaMirror();
    }
  });
})();
