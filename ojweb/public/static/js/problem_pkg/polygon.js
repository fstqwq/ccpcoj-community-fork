/**
 * Polygon 题包解析与打包（独立来源脚本）。
 * 依赖：global.js（alerty 等）、overlay.js、js_zip、pack_core.js、Bootstrap Table、页面内 Formatter*。
 */
let map_contest_problem = new Map();
let list_other_problem = [];
let list_problem = [];
let polygon_pid = 1;
/** 批量解析题目时不在 FetchProblem 内单独刷新 overlay（由外层按题更新进度） */
let polygonParseBatchMode = false;

/** Polygon 页 overlay：固定卡片宽度、有进度条时不显示顶部转圈（需显式传入，非全局默认） */
function polygonOverlayOpts(extra) {
    return Object.assign(
        {
            cardWidth: "min(440px, 92vw)",
            overlayProgressSpinnerPolicy: "progress_only",
            cardClass: "pkg-polygon-overlay-card",
        },
        extra || {}
    );
}

/**
 * Polygon 遮罩大标题：宜短、在阶段内保持不变；细进度放在 subtitle / detail。
 * （scan → problems → tests → pack）
 */
const POLYGON_OVERLAY_HEAD = {
    scan: { message: "扫描题包", message_en: "Scanning package" },
    problems: { message: "逐题解析", message_en: "Parsing problems" },
    tests: { message: "整理测例", message_en: "Preparing tests" },
    pack: { message: "打包题目", message_en: "Packing problems" },
};

function polygonEllipsis(text, maxLen) {
    const s = String(text || "")
        .replace(/\s+/g, " ")
        .trim();
    if (!s) {
        return "";
    }
    const n = typeof maxLen === "number" && maxLen > 4 ? maxLen : 28;
    if (s.length <= n) {
        return s;
    }
    return s.slice(0, n - 1) + "…";
}

/** 与当前阶段一致的大标题（双语），供物化测例等复用，避免 overlay 主文案过长 */
var polygonScanMain = Object.assign({}, POLYGON_OVERLAY_HEAD.scan);

function sumPolygonTestFileCounts() {
    let s = 0;
    for (const p of map_contest_problem.values()) {
        s += p.testData && typeof p.testData.fileCount === "number" ? p.testData.fileCount : 0;
    }
    for (const p of list_other_problem) {
        s += p.testData && typeof p.testData.fileCount === "number" ? p.testData.fileCount : 0;
    }
    return s;
}

const SplitPath = (filename) => {
    return filename.split(/[/\\]/);
};

/**
 * 是否将 zip 条目作为嵌套压缩包递归解析。
 * macOS 在 zip 内写入的 __MACOSX/._*.zip 为 AppleDouble 资源叉，扩展名虽为 .zip 但并非 zip，
 * zip.js 会报 “End of central directory not found”；须跳过。
 */
function polygonNestedZipRecursible(filename) {
    const f = String(filename || "");
    const lower = f.toLowerCase();
    if (!lower.endsWith(".zip")) {
        return false;
    }
    if (f.indexOf("__MACOSX/") !== -1 || f.indexOf("\\__MACOSX\\") !== -1) {
        return false;
    }
    const base = SplitPath(f).pop() || "";
    if (base.startsWith("._")) {
        return false;
    }
    return true;
}

function normText(s) {
    if (s == null) return "";
    return String(s).replace(/^\ufeff/, "").replace(/\r\n/g, "\n").trim();
}

async function sha256Hex(data) {
    let u8;
    if (typeof data === "string") {
        u8 = new TextEncoder().encode(data);
    } else if (data instanceof ArrayBuffer) {
        u8 = new Uint8Array(data);
    } else {
        u8 = new Uint8Array(data);
    }
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (subtle && typeof subtle.digest === "function") {
        try {
            const hash = await subtle.digest("SHA-256", u8);
            return Array.from(new Uint8Array(hash))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
        } catch (e) {
            console.warn("crypto.subtle.digest failed, using software SHA-256", e);
        }
    }
    // 非安全上下文（如局域网 http://192.168.x.x）无 crypto.subtle；依赖 vendor js-sha256（MIT）
    if (typeof globalThis.sha256 === "function") {
        const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
        return globalThis.sha256(ab);
    }
    throw new Error(
        "SHA-256 unavailable: use HTTPS/localhost, or include __STATIC__/js/vendor/sha256-0.9.0.min.js before polygon.js"
    );
}

var POLYGON_TAG_TO_OJ_RESULT = {
    "main": 4, "accepted": 4,
    "wrong-answer": 6, "time-limit-exceeded": 7,
    "memory-limit-exceeded": 8, "time-limit-exceeded-or-accepted": 7,
    "presentation-error": 5, "rejected": 6,
};
var POLYGON_TYPE_TO_OJ_LANG = {};
(function () {
    var map = POLYGON_TYPE_TO_OJ_LANG;
    ["cpp.g++17","cpp.gcc13-64-winlibs-g++20","cpp.gcc14-64-msys2-g++23","cpp.g++14","cpp.g++11","cpp.ms2017",
     "cpp.msys2-mingw64-9-g++17"].forEach(function(k){ map[k] = 1; });
    map["c.gcc"] = 0; map["c.gcc11-64"] = 0;
    map["python.3"] = 6; map["python.pypy3"] = 6;
    ["java8","java11","java17","java21"].forEach(function(k){ map["java." + k] = 3; map[k] = 3; });
})();

function _guessLangFromExt(path) {
    var p = String(path || "").toLowerCase();
    if (p.endsWith(".py")) return 6;
    if (p.endsWith(".java")) return 3;
    if (p.endsWith(".c") && !p.endsWith(".cc")) return 0;
    return 1; // default C++
}

function parseProblemXml(xmlText) {
    const out = { shortName: "", timeLimitMs: null, memoryBytes: null, xmlAuthor: "", xmlSolutions: [] };
    if (!xmlText || !normText(xmlText)) return out;
    try {
        const doc = new DOMParser().parseFromString(xmlText, "application/xml");
        if (doc.querySelector("parsererror")) return out;
        let nameEl = doc.querySelector("names name");
        if (nameEl && normText(nameEl.textContent)) {
            out.shortName = normText(nameEl.textContent);
        }
        if (!out.shortName) {
            const all = doc.querySelectorAll("name");
            for (let i = 0; i < all.length; i++) {
                const t = normText(all[i].textContent);
                if (t) {
                    out.shortName = t;
                    break;
                }
            }
        }
        const ts = doc.querySelector("test-set");
        if (ts) {
            const tl = ts.getAttribute("time-limit") || ts.getAttribute("timeLimit");
            if (tl != null && tl !== "") {
                const v = parseInt(tl, 10);
                if (!Number.isNaN(v)) out.timeLimitMs = v;
            }
            const ml = ts.getAttribute("memory-limit") || ts.getAttribute("memoryLimit");
            if (ml != null && ml !== "") {
                let v = parseInt(ml, 10);
                if (!Number.isNaN(v)) {
                    if (v > 0 && v < 524288) v = v * 1024 * 1024;
                    out.memoryBytes = v;
                }
            }
        }
        const props = doc.querySelectorAll("property");
        for (let i = 0; i < props.length; i++) {
            const pr = props[i];
            const n = normText(pr.getAttribute("name") || "").toLowerCase();
            if (!n) continue;
            if (n !== "author" && n !== "developer" && n !== "writer") continue;
            const v = normText(pr.getAttribute("value") != null ? pr.getAttribute("value") : pr.textContent);
            if (v) {
                out.xmlAuthor = v;
                break;
            }
        }
        const solEls = doc.querySelectorAll("assets solutions solution");
        for (let i = 0; i < solEls.length; i++) {
            const sel = solEls[i];
            const tag = (sel.getAttribute("tag") || "").toLowerCase();
            const srcEl = sel.querySelector("source");
            if (!srcEl) continue;
            const path = srcEl.getAttribute("path") || "";
            const stype = (srcEl.getAttribute("type") || "").toLowerCase();
            if (!path) continue;
            out.xmlSolutions.push({ tag, path, type: stype });
        }
    } catch (e) { /* ignore */ }
    return out;
}

/** problem.xml 短名 + 题面目录名 → 题目标题回退（不再使用字面 NO TITLE） */
function polygonTitleFallback(shortNameXml, dirShortName) {
    const a = normText(shortNameXml);
    const b = normText(dirShortName);
    return a || b || "（未命名题）";
}

function sanitizeLocaleKey(folder) {
    let k = normText(folder).toLowerCase().replace(/\s+/g, "_");
    if (!k || k === "main") return null;
    if (/[\x00-\x1f\\/:*?"<>|]/.test(k)) return null;
    return k.length > 64 ? k.slice(0, 64) : k;
}

/** Polygon 语言目录名规范化（小写、_→-、去空白），用于识别与排序 */
function polygonLangFolderNormalized(folder) {
    return normText(folder).toLowerCase().replace(/_/g, "-").replace(/\s+/g, "");
}

/**
 * 可识别为**简体向**中文题面目录（用于排序与主语言优先）。
 * 不含 zh-tw / zh-hant / traditional：避免简体目录名未识别时把繁体目录误作「中文主语言」。
 */
function isPolygonChineseLangFolder(folder) {
    const f = polygonLangFolderNormalized(folder);
    if (!f) return false;
    if (f === "chinese") return true;
    if (f === "simpchinese") return true;
    if (f === "zhcn" || f === "zh-cn") return true;
    if (f.startsWith("zh-cn")) return true;
    if (f === "zh-hans" || f.startsWith("zh-hans")) return true;
    if (f === "zh") return true;
    return false;
}

/**
 * 可识别为英文题面目录：english、en、en-*（避免误伤如 entropy 等目录名）。
 */
function isPolygonEnglishLangFolder(folder) {
    const f = polygonLangFolderNormalized(folder);
    if (!f) return false;
    if (f === "english") return true;
    if (f === "en") return true;
    if (f.startsWith("en-")) return true;
    return false;
}

/** 排序档位：0 中文、1 英文、2 其它（按目录名字母序，与 Polygon 多语言并存时的常规默认一致） */
function polygonStatementLangTier(folder) {
    if (isPolygonChineseLangFolder(folder)) return 0;
    if (isPolygonEnglishLangFolder(folder)) return 1;
    return 2;
}

function comparePolygonStatementLangFolders(folderA, folderB) {
    const ta = polygonStatementLangTier(folderA);
    const tb = polygonStatementLangTier(folderB);
    if (ta !== tb) return ta - tb;
    return normText(folderA).toLowerCase().localeCompare(normText(folderB).toLowerCase());
}

function localeLabelForFolder(folder) {
    if (isPolygonEnglishLangFolder(folder)) return "English";
    if (isPolygonChineseLangFolder(folder)) return "中文";
    const f = normText(folder).toLowerCase();
    return folder || f;
}

function statementJsonHasContent(j) {
    if (!j) return false;
    const parts = [j.legend, j.input, j.output, j.notes, j.name].map(normText);
    return parts.some((p) => p.length > 0);
}

/** 与 problem-properties.json 结构兼容的空壳（tex / 分段补全用） */
function emptyStatementJsonShell() {
    return {
        name: "",
        legend: "",
        input: "",
        output: "",
        notes: "",
        sampleTests: [],
        timeLimit: 1000,
        memoryLimit: 268435456,
        authorName: "",
        authorLogin: "",
    };
}

function findEntryRel(problem_entries, problemDir, relPath) {
    const full = problemDir ? `${problemDir}/${relPath}` : relPath;
    return problem_entries.find((e) => e.filename === full);
}

/** Polygon 导出常见路径：statements/.pdf/&lt;语言目录&gt;/problem.pdf */
function findPolygonStatementPdfPath(problem_entries, problemDir, langFolder) {
    const L = normText(langFolder);
    if (!L) return null;
    const rel = `statements/.pdf/${L}/problem.pdf`;
    const full = problemDir ? `${problemDir}/${rel}` : rel;
    const ent = problem_entries.find((e) => e.filename === full);
    return ent ? full : null;
}

function mergeAuthorFromAllParsedLanguages(target, parsedList) {
    if (!target || !Array.isArray(parsedList)) return;
    const has = () => normText(target.authorName) || normText(target.authorLogin);
    if (has()) return;
    for (let i = 0; i < parsedList.length; i++) {
        const p = parsedList[i];
        const j = p && p.json;
        if (!j) continue;
        const n = normText(j.authorName) || normText(j.authorLogin);
        if (n) {
            target.authorName = j.authorName != null ? String(j.authorName) : "";
            target.authorLogin = j.authorLogin != null ? String(j.authorLogin) : "";
            break;
        }
    }
}

async function collectPolygonPdfDigests(problem_entries, mainPath, localePaths) {
    const out = [];
    const pairs = [];
    if (mainPath) pairs.push(["main", mainPath]);
    const keys = Object.keys(localePaths || {}).sort();
    for (let i = 0; i < keys.length; i++) {
        pairs.push([keys[i], localePaths[keys[i]]]);
    }
    for (let i = 0; i < pairs.length; i++) {
        const label = pairs[i][0];
        const zp = pairs[i][1];
        const ent = problem_entries.find((e) => e.filename === zp);
        if (!ent) continue;
        try {
            const blob = await ent.getData(new zip.BlobWriter());
            const hex = await sha256Hex(await blob.arrayBuffer());
            out.push(`pdf\t${label}\t${hex}`);
        } catch (e) {
            console.warn("collectPolygonPdfDigests fail", zp, e);
        }
    }
    return out;
}

async function MakePdfDescZipFiles(problem_entries, mainPath, localePaths) {
    const out = [];
    if (mainPath) {
        const ent = problem_entries.find((e) => e.filename === mainPath);
        if (ent) {
            try {
                const blob = await ent.getData(new zip.BlobWriter());
                out.push({ filename: "pdf_desc/main.pdf", content: blob });
            } catch (e) {
                console.warn("MakePdfDescZipFiles main", e);
            }
        }
    }
    const keys = Object.keys(localePaths || {}).sort();
    for (let i = 0; i < keys.length; i++) {
        const lk = keys[i];
        const zp = localePaths[lk];
        const ent = problem_entries.find((e) => e.filename === zp);
        if (!ent) continue;
        try {
            const blob = await ent.getData(new zip.BlobWriter());
            out.push({ filename: `pdf_desc/${lk}.pdf`, content: blob });
        } catch (e) {
            console.warn("MakePdfDescZipFiles locale", lk, e);
        }
    }
    return out;
}

/**
 * 写入 ATTACH_*（插图）与 TEST_* 下的 pdf_desc（题面 PDF 在评测数据目录，与 problem_import_executor / PHP 一致）。
 */
async function addPolygonAttachToZipWriter(zipWriter, attachDir, testDir, problem, abortSignal) {
    const entries = problem.testData && problem.testData.entries;
    if (!entries) return false;
    let added = false;
    if (problem.attach_files && problem.attach_files.length > 0) {
        if (typeof window.overlayThrowIfAborted === "function") {
            window.overlayThrowIfAborted(abortSignal);
        }
        const imgs = await MakeAttachFiles(entries, problem.statement_entry, problem.attach_files);
        for (let i = 0; i < imgs.length; i++) {
            if (typeof window.overlayThrowIfAborted === "function") {
                window.overlayThrowIfAborted(abortSignal);
            }
            const file = imgs[i];
            await zipWriter.add(`${attachDir}/${file.filename}`, new zip.BlobReader(file.content));
            added = true;
        }
    }
    if (typeof window.overlayThrowIfAborted === "function") {
        window.overlayThrowIfAborted(abortSignal);
    }
    const pdfs = await MakePdfDescZipFiles(
        entries,
        problem.polygon_pdf_main_path || null,
        problem.polygon_pdf_locale_paths || null
    );
    for (let i = 0; i < pdfs.length; i++) {
        if (typeof window.overlayThrowIfAborted === "function") {
            window.overlayThrowIfAborted(abortSignal);
        }
        const file = pdfs[i];
        await zipWriter.add(`${testDir}/${file.filename}`, new zip.BlobReader(file.content));
        added = true;
    }
    return added;
}

function polygonRowHasAnyPdf(row) {
    if (!row) return false;
    if (row.polygon_pdf_main_path) return true;
    const m = row.polygon_pdf_locale_paths;
    return m && typeof m === "object" && Object.keys(m).length > 0;
}

/**
 * @param {"latex"|"pdf"} mode — pdf：仅对包内确有 PDF 的语言将 use_pdf 置 1（首条语言对 polygon_pdf_main_path）。
 */
function applyPolygonPdfMode(row, mode) {
    if (!row || !row.problemJson) return;
    row.polygon_pdf_mode = mode;
    const pj = row.problemJson;
    const wantPdf = mode === "pdf";
    const map = row.polygon_pdf_locale_paths || {};
    const locs = pj.problem_locales || [];
    for (let i = 0; i < locs.length; i++) {
        if (!wantPdf) {
            locs[i].use_pdf = 0;
            continue;
        }
        if (i === 0) {
            locs[i].use_pdf = row.polygon_pdf_main_path ? 1 : 0;
        } else {
            const lk = locs[i].locale_key;
            locs[i].use_pdf = lk && map[lk] ? 1 : 0;
        }
    }
}

function relativeToProblemDir(filename, problemDir) {
    const pd = normText(problemDir);
    if (!pd) return filename;
    const prefix = pd + "/";
    if (!filename.startsWith(prefix)) return null;
    return filename.slice(prefix.length);
}

/** 从 statements/*、statement-sections/* 发现语言目录名（排除 .html 等） */
function discoverPolygonStatementLanguages(problem_entries, problemDir) {
    const langs = new Set();
    for (const e of problem_entries) {
        const rel = relativeToProblemDir(e.filename, problemDir);
        if (rel == null) continue;
        const norm = rel.replace(/\\/g, "/");
        let m = norm.match(/^statements\/([^/]+)\//);
        if (m && m[1] && !m[1].startsWith(".")) langs.add(m[1]);
        m = norm.match(/^statement-sections\/([^/]+)\//);
        if (m && m[1] && !m[1].startsWith(".")) langs.add(m[1]);
    }
    return [...langs];
}

/** problem-properties.json 里 sampleTests 是否已有非空 input/output */
function polygonJsonSampleTestsHaveContent(sampleTests) {
    if (!Array.isArray(sampleTests) || sampleTests.length === 0) return false;
    return sampleTests.some((t) => {
        if (!t || typeof t !== "object") return false;
        const a = normText(t.input != null ? t.input : t.in);
        const b = normText(t.output != null ? t.output : t.out);
        return a.length > 0 || b.length > 0;
    });
}

function normalizeSampleTestRow(t) {
    if (!t || typeof t !== "object") return { input: "", output: "" };
    const input = String(t.input != null ? t.input : t.in != null ? t.in : "");
    const output = String(t.output != null ? t.output : t.out != null ? t.out : "");
    return { input, output };
}

/** Polygon 包内 example.01 / example.01.a（多在 statement-sections 或 statements 下） */
function listExampleBaseNamesInLang(problem_entries, problemDir, lang) {
    if (!lang) return [];
    const dirs = [`statement-sections/${lang}/`, `statements/${lang}/`];
    const bases = new Set();
    for (const d of dirs) {
        const prefix = problemDir ? `${problemDir}/${d}` : d;
        for (const e of problem_entries) {
            if (e.directory) continue;
            if (!e.filename.startsWith(prefix)) continue;
            const leaf = e.filename.slice(prefix.length);
            if (!/^example\.\d+$/.test(leaf)) continue;
            bases.add(leaf);
        }
    }
    return [...bases].sort((a, b) => {
        const na = parseInt(a.replace(/^example\./, ""), 10);
        const nb = parseInt(b.replace(/^example\./, ""), 10);
        return na - nb;
    });
}

async function readExamplePairForBase(problem_entries, problemDir, lang, base) {
    const dirs = [`statement-sections/${lang}/`, `statements/${lang}/`];
    for (const d of dirs) {
        const pIn = problemDir ? `${problemDir}/${d}${base}` : `${d}${base}`;
        const pOut = problemDir ? `${problemDir}/${d}${base}.a` : `${d}${base}.a`;
        const inEnt = problem_entries.find((e) => e.filename === pIn);
        const outEnt = problem_entries.find((e) => e.filename === pOut);
        if (inEnt && outEnt) {
            try {
                const input = normText(await inEnt.getData(new zip.TextWriter()));
                const output = normText(await outEnt.getData(new zip.TextWriter()));
                return { input, output };
            } catch (e) {
                console.warn("example pair read fail", pIn, e);
            }
        }
    }
    return null;
}

function parseExmpfilePairsFromTex(tex) {
    const out = [];
    const t = String(tex || "");
    const re = /\\exmpfile\s*\{([^}]*)\}\s*\{([^}]*)\}/gi;
    let m;
    while ((m = re.exec(t)) !== null) {
        const a = normText(m[1]);
        const b = normText(m[2]);
        if (a || b) out.push({ inF: a, outF: b });
    }
    return out;
}

async function resolveExmpfilePairFiles(problem_entries, problemDir, lang, inF, outF) {
    const relPairs = [
        [`statements/${lang}/${inF}`, `statements/${lang}/${outF}`],
        [`statement-sections/${lang}/${inF}`, `statement-sections/${lang}/${outF}`],
    ];
    for (const [ri, ro] of relPairs) {
        const ie = findEntryRel(problem_entries, problemDir, ri);
        const oe = findEntryRel(problem_entries, problemDir, ro);
        if (ie && oe) {
            try {
                const input = normText(await ie.getData(new zip.TextWriter()));
                const output = normText(await oe.getData(new zip.TextWriter()));
                return { input, output };
            } catch (e) {
                console.warn("exmpfile read fail", ri, ro, e);
            }
        }
    }
    return null;
}

/**
 * 填充 proPrimary.sampleTests：优先 JSON 非空；否则 example.NN + .a；再否则 problem.tex 的 \\exmpfile。
 */
async function hydratePolygonSampleTests(problem_entries, problemDir, proPrimary, primaryLang) {
    if (!proPrimary) return;
    if (polygonJsonSampleTestsHaveContent(proPrimary.sampleTests)) {
        proPrimary.sampleTests = proPrimary.sampleTests.map(normalizeSampleTestRow);
        return;
    }
    const seen = new Set();
    const langOrder = [];
    function pushLang(L) {
        if (!L || seen.has(L)) return;
        seen.add(L);
        langOrder.push(L);
    }
    pushLang(primaryLang);
    pushLang("english");
    pushLang("chinese");
    for (const L of discoverPolygonStatementLanguages(problem_entries, problemDir)) {
        pushLang(L);
    }

    for (const lang of langOrder) {
        const bases = listExampleBaseNamesInLang(problem_entries, problemDir, lang);
        if (!bases.length) continue;
        const rows = [];
        for (const b of bases) {
            const row = await readExamplePairForBase(problem_entries, problemDir, lang, b);
            if (row && (normText(row.input) || normText(row.output))) rows.push(row);
        }
        if (rows.length) {
            proPrimary.sampleTests = rows;
            return;
        }
    }

    for (const lang of langOrder) {
        const texEnt = findEntryRel(problem_entries, problemDir, `statements/${lang}/problem.tex`);
        if (!texEnt) continue;
        let tex = "";
        try {
            tex = await texEnt.getData(new zip.TextWriter());
        } catch (e) {
            continue;
        }
        const pairs = parseExmpfilePairsFromTex(tex);
        if (!pairs.length) continue;
        const rows = [];
        for (const { inF, outF } of pairs) {
            const row = await resolveExmpfilePairFiles(problem_entries, problemDir, lang, inF, outF);
            if (row && (normText(row.input) || normText(row.output))) rows.push(row);
        }
        if (rows.length) {
            proPrimary.sampleTests = rows;
            return;
        }
    }

    proPrimary.sampleTests = [];
}

/**
 * 由题面指纹 SHA-256（hex）派生附件目录名：形态接近后台 ``yy-mm-dd-uuid``，同指纹同名字；极短 hex 时回退 ``poly_`` + 64 hex。
 */
function formatDeterministicAttachFolderFromSha256Hex(hex64) {
    const h = String(hex64 || "")
        .replace(/[^a-fA-F0-9]/g, "")
        .toLowerCase();
    if (h.length < 38) {
        return `poly_${h.padEnd(64, "0").slice(0, 64)}`;
    }
    const day = `${h.slice(0, 2)}-${h.slice(2, 4)}-${h.slice(4, 6)}`;
    const u32 = h.slice(6, 38);
    const u = `${u32.slice(0, 8)}-${u32.slice(8, 12)}-${u32.slice(12, 16)}-${u32.slice(16, 20)}-${u32.slice(20, 32)}`;
    return `${day}-${u}`;
}

function parseBraceGroupAt(s, openBraceIndex) {
    if (!s || openBraceIndex < 0 || s[openBraceIndex] !== "{") return null;
    let depth = 1;
    let i = openBraceIndex + 1;
    const start = i;
    while (i < s.length && depth > 0) {
        const c = s[i];
        if (c === "\\") {
            i += i + 1 < s.length ? 2 : 1;
            continue;
        }
        if (c === "{") depth++;
        else if (c === "}") depth--;
        i++;
    }
    if (depth !== 0) return null;
    return { content: s.slice(start, i - 1), next: i };
}

/**
 * 解析 Polygon statements 下各语言目录中的 problem.tex
 *（\\begin{problem}、多组括号元数据、\\InputFile / \\OutputFile）。
 * 仅作 JSON 缺省时的补全，不假设单一导出形态。
 */
function parsePolygonProblemTex(tex) {
    const t = String(tex || "").replace(/\r\n/g, "\n");
    const beginRe = /\\begin\s*\{\s*problem\s*\}/;
    const bm = t.match(beginRe);
    if (!bm || bm.index === undefined) return null;
    let pos = bm.index + bm[0].length;
    let name = "";
    let firstBraceGroup = true;
    while (pos < t.length) {
        let j = pos;
        while (j < t.length && /\s/.test(t[j])) j++;
        if (t[j] !== "{") break;
        const g = parseBraceGroupAt(t, j);
        if (!g) break;
        if (firstBraceGroup) {
            name = normText(g.content);
            firstBraceGroup = false;
        }
        pos = g.next;
    }
    const inputM = t.slice(pos).match(/\\InputFile\b\s*/i);
    if (!inputM || inputM.index === undefined) return null;
    const inputStart = pos + inputM.index + inputM[0].length;
    const tailFromInput = t.slice(inputStart);
    const outputM = tailFromInput.match(/\\OutputFile\b\s*/i);
    if (!outputM || outputM.index === undefined) return null;
    const inputPart = tailFromInput.slice(0, outputM.index).trim();
    const outCmdStart = inputStart + outputM.index + outputM[0].length;
    const tailOut = t.slice(outCmdStart);
    const stopM = tailOut.match(
        /\\(?:Examples|begin\s*\{\s*example\s*\}|Scoring|Note|end\s*\{\s*problem\s*\})/i
    );
    const outputPart = (stopM ? tailOut.slice(0, stopM.index) : tailOut).trim();
    const legend = t.slice(pos, pos + inputM.index).trim();
    return {
        name,
        legend,
        input: inputPart,
        output: outputPart,
        notes: "",
    };
}

async function loadPolygonStatementSections(problem_entries, problemDir, lang) {
    const keys = [
        ["name", "name.tex"],
        ["legend", "legend.tex"],
        ["input", "input.tex"],
        ["output", "output.tex"],
        ["notes", "notes.tex"],
    ];
    const out = emptyStatementJsonShell();
    for (const [key, fn] of keys) {
        const e = findEntryRel(problem_entries, problemDir, `statement-sections/${lang}/${fn}`);
        if (!e) continue;
        try {
            const raw = await e.getData(new zip.TextWriter());
            out[key] = normText(raw);
        } catch (e) {
            console.warn("statement-section read fail", fn, e);
        }
    }
    return statementJsonHasContent(out) ? out : null;
}

function mergeStatementFieldsPreferEmpty(target, patch) {
    if (!target || !patch) return;
    for (const k of ["name", "legend", "input", "output", "notes"]) {
        if (patch[k] == null) continue;
        const pt = normText(patch[k]);
        if (!pt) continue;
        if (!normText(target[k])) target[k] = patch[k];
    }
}

function isStatementPropsEntry(entry) {
    return (
        entry &&
        entry.filename.includes("/statements/") &&
        entry.filename.endsWith("problem-properties.json")
    );
}

/** 用于 \\includegraphics 相对路径解析的锚点文件（同目录找图） */
function resolveStatementAnchorEntry(problem_entries, problemDir, lang) {
    const candidates = [
        `statements/${lang}/problem-properties.json`,
        `statements/${lang}/problem.tex`,
        `statement-sections/${lang}/legend.tex`,
        `statement-sections/${lang}/name.tex`,
    ];
    for (const rel of candidates) {
        const e = findEntryRel(problem_entries, problemDir, rel);
        if (e) return e;
    }
    return null;
}

/**
 * 在 JSON 基础上用 statement-sections 与 problem.tex 补全空字段；无 JSON 时也可纯 tex/分段建 locale。
 */
async function enrichPolygonStatements(problem_entries, problemDir, parsedList) {
    const byLang = new Map(parsedList.map((p) => [p.langFolder, p]));
    const langs = discoverPolygonStatementLanguages(problem_entries, problemDir);
    for (const lang of langs) {
        let item = byLang.get(lang);
        const sec = await loadPolygonStatementSections(problem_entries, problemDir, lang);
        const texEntry = findEntryRel(problem_entries, problemDir, `statements/${lang}/problem.tex`);
        if (!item && !sec && !texEntry) continue;
        if (!item) {
            item = { entry: null, langFolder: lang, json: emptyStatementJsonShell() };
            parsedList.push(item);
            byLang.set(lang, item);
        }
        if (sec) mergeStatementFieldsPreferEmpty(item.json, sec);
        if (texEntry) {
            try {
                const tex = await texEntry.getData(new zip.TextWriter());
                const parsed = parsePolygonProblemTex(tex);
                if (parsed) mergeStatementFieldsPreferEmpty(item.json, parsed);
            } catch (e) {
                console.warn("problem.tex read/parse fail", texEntry.filename, e);
            }
        }
        if (!item.entry) item.entry = resolveStatementAnchorEntry(problem_entries, problemDir, lang);
        else if (!isStatementPropsEntry(item.entry)) {
            const anchor = resolveStatementAnchorEntry(problem_entries, problemDir, lang);
            if (anchor && isStatementPropsEntry(anchor)) item.entry = anchor;
        }
    }
    for (let i = parsedList.length - 1; i >= 0; i--) {
        const p = parsedList[i];
        if (statementJsonHasContent(p.json)) continue;
        if (!isStatementPropsEntry(p.entry)) parsedList.splice(i, 1);
    }
    parsedList.sort((a, b) => comparePolygonStatementLangFolders(a.langFolder, b.langFolder));
}

function extractGraphicsNames(legend, input, output, notes) {
    const s = [legend || "", input || "", output || "", notes || ""].join("\n");
    const names = [];
    s.replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g, (m, p1) => {
        if (p1.startsWith("http")) return m;
        const trimmedPath = p1.replace(/^(\.\/|\\)+|(\.\/|\\)+$/g, "");
        if (!trimmedPath.includes("/") && !trimmedPath.includes("\\")) {
            names.push(trimmedPath);
        }
        return m;
    });
    return [...new Set(names)];
}

async function collectImageDigests(problem_entries, primaryEntry, projson) {
    const names = extractGraphicsNames(projson.legend, projson.input, projson.output, projson.notes);
    if (!names.length || !primaryEntry) return [];
    const dir = primaryEntry.filename.substring(0, primaryEntry.filename.lastIndexOf("/") + 1);
    const out = [];
    for (const n of names) {
        const ent = problem_entries.find((e) => e.filename === dir + n);
        if (!ent) continue;
        const blob = await ent.getData(new zip.BlobWriter());
        out.push(`${n}\t${await sha256Hex(await blob.arrayBuffer())}`);
    }
    out.sort();
    return out;
}

/**
 * 测例打包预览：文件名与体积（含 tpj.cc）均来自 zip 元数据，与 MakeTestData 遍历顺序一致。
 */
function summarizePolygonTestPackMeta(problem_entries, problem_xml_entry, spjType) {
    const problemDir = GetDirPath(problem_xml_entry.filename);
    const testsDir = problem_entries.filter((entry) => {
        const fn = normZipEntryPath(entry.filename);
        if (problemDir === "") {
            return fn.startsWith("tests/");
        }
        return fn.startsWith(`${problemDir}/tests/`);
    });
    let fileCount = 0;
    let totalSize = 0;
    const packedFileNames = [];
    for (const entry of testsDir) {
        const nfn = normZipEntryPath(entry.filename);
        if (!nfn.endsWith(".a")) continue;
        const inFile = findPolygonTestInputForAnswer(problem_entries, entry.filename);
        if (!inFile) continue;
        const inSz = Number(inFile.uncompressedSize) || 0;
        const outSz = Number(entry.uncompressedSize) || 0;
        totalSize += inSz + outSz;
        const baseNorm = nfn.slice(0, -2);
        const baseSeg = baseNorm.substring(baseNorm.lastIndexOf("/") + 1);
        packedFileNames.push(`${baseSeg}.in`, `${baseSeg}.out`);
        fileCount++;
    }
    if (spjType === "1") {
        const spjEntry = FindChecker(problem_entries, problemDir);
        if (spjEntry) {
            packedFileNames.push("tpj.cc");
            totalSize += Number(spjEntry.uncompressedSize) || 0;
        }
    } else if (spjType === "2") {
        const interactorEntry = FindInteractor(problem_entries, problemDir);
        if (interactorEntry) {
            packedFileNames.push("tpj.cc");
            totalSize += Number(interactorEntry.uncompressedSize) || 0;
        }
    }
    return { fileCount, totalSize, packedFileNames };
}

/**
 * 用户选择的 File/Blob 可多次读取；此处缓存测例包，避免重复 MakeTestData。
 * - zipContent：供「下载测例 ZIP」等单文件场景。
 * - packedBlobs：与 zip 内文件名一致的 { name, blob } 列表，供「打包所选题目」直接写入外层 zip，
 *   避免再次 arrayBuffer + 解压内层 zip（重复打包仍慢的问题）。
 * 切换 spj 时须清空物化缓存：`ProblemPkg.packCore.invalidateTestDataMaterialization`（由 table_formatters 委托）。
 */
async function ensurePolygonTestDataZip(problemRec, tip_info = "Packing", abortSignal) {
    const td = problemRec && problemRec.testData;
    if (!td) {
        throw new Error("ensurePolygonTestDataZip: missing testData");
    }
    if (td.zipContent) {
        return td;
    }
    if (td._materializePromise) {
        return td._materializePromise;
    }
    const spjType = String(problemRec.spjType || problemRec.spj || "0");
    td._materializePromise = (async () => {
        try {
            const fresh = await MakeTestData(
                problemRec.problemJson.title,
                td.entries,
                td.problem_xml_entry,
                spjType,
                tip_info,
                abortSignal
            );
            td.zipContent = fresh.zipContent;
            td.packedBlobs = fresh.packedBlobs || null;
            td.totalSize = fresh.totalSize;
            td.fileCount = fresh.fileCount;
            td.packedFileNames = fresh.packedFileNames || td.packedFileNames;
            return td;
        } finally {
            delete td._materializePromise;
        }
    })();
    return td._materializePromise;
}

/**
 * 题面附件目录指纹：不含 tests 下评测数据内容；不对测例文件做 SHA-256。
 * 仅题面/XML/时限内存/spj、多语言摘要行、题面插图（collectImageDigests）参与哈希。
 */
async function computePolyAttachFingerprint(parts) {
    const lines = ["polyfp3"];
    lines.push(normText(parts.dirShortName || ""));
    lines.push(normText(parts.xmlText || "").slice(0, 12000));
    lines.push(String(parts.spjType || "0"));
    lines.push(String(parts.tlMs ?? ""));
    lines.push(String(parts.memBytes ?? ""));
    lines.push(normText(parts.primaryName || ""));
    for (const k of ["authorName", "authorLogin", "legend", "input", "output", "notes"]) {
        lines.push(k + "\t" + normText(parts.primaryTexts?.[k] || ""));
    }
    for (const loc of (parts.localeLines || []).slice().sort()) {
        lines.push(loc);
    }
    for (const im of (parts.imageDigests || []).slice().sort()) {
        lines.push(im);
    }
    for (const pd of (parts.pdfDigests || []).slice().sort()) {
        lines.push(pd);
    }
    const h = await sha256Hex(lines.join("\n"));
    return formatDeterministicAttachFolderFromSha256Hex(h);
}

function applyReplaceGraphics(projson, attach_hash, attach_files) {
    const prefix = `/upload/problem_attach/${attach_hash}/`;
    const replaceGraphicsPath = (content) => {
        return (content || "").replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g, (match, p1) => {
            if (!p1.startsWith("http")) {
                const trimmedPath = p1.replace(/^(\.\/|\\)+|(\.\/|\\)+$/g, "");
                if (!trimmedPath.includes("/") && !trimmedPath.includes("\\")) {
                    attach_files.push(trimmedPath);
                    return match.replace(p1, `${prefix}${trimmedPath}`);
                }
            }
            return match;
        });
    };
    projson.legend = replaceGraphicsPath(projson.legend || "");
    projson.notes = replaceGraphicsPath(projson.notes || "");
    projson.input = replaceGraphicsPath(projson.input || "");
    projson.output = replaceGraphicsPath(projson.output || "");
}

function buildProblemRecord(
    proPrimary,
    pid,
    attach_hash,
    attach_files,
    problemLocales,
    tlMs,
    memBytes,
    spjTypeChar
) {
    const st = Array.isArray(proPrimary.sampleTests) ? proPrimary.sampleTests : [];
    const locs = (Array.isArray(problemLocales) ? problemLocales : []).map((loc, idx) =>
        Object.assign({}, loc, { sort_order: idx + 1 })
    );
    const problem = {
        accepted: 0,
        attach: attach_hash,
        author: "",
        author_md: proPrimary.authorName || proPrimary.authorLogin || "",
        description: "",
        hint: "",
        in_date: CsgAppWallNaiveSqlNow(),
        input: "",
        output: "",
        time_limit: (tlMs / 1000).toFixed(1),
        memory_limit: Math.round(memBytes / 1024 / 1024),
        problem_id: 0,
        problem_new_id: pid,
        sample_input: JSON.stringify({
            data_type: "json",
            data: st.map((test) => (test.input || "").replace(/\r\n/g, "\n")),
        }),
        sample_output: JSON.stringify({
            data_type: "json",
            data: st.map((test) => (test.output || "").replace(/\r\n/g, "\n")),
        }),
        solved: 0,
        source: "",
        spj: spjTypeChar,
        submit: 0,
        title: normText(proPrimary.name) || "（未命名题）",
        problem_locales: locs,
    };
    return { problem, attach_files };
}

/**
 * 切换 Polygon 解析行的主题面语言（多语言包）；重算附件指纹与 problemJson / problem_locales。
 * @returns {Promise<boolean>}
 */
async function applyPolygonPrimaryLangSwitch(row, newPrimaryFolder) {
    if (!row || row.__pkg_source !== "polygon") return false;
    const snap = row.polygon_parsed_locales_snapshot;
    if (!Array.isArray(snap) || snap.length < 2) return false;
    const L = normText(newPrimaryFolder);
    if (!L) return false;
    if (L === row.polygon_primary_lang_folder) return true;

    const priItem = snap.find((s) => s.langFolder === L);
    if (!priItem || !statementJsonHasContent(priItem.json)) return false;

    const entries = row.testData && row.testData.entries;
    const xml_entry = row.testData && row.testData.problem_xml_entry;
    if (!entries || !xml_entry) return false;

    const problemDir = GetDirPath(xml_entry.filename);
    const xmlMeta = row.polygon_xml_meta || {
        shortName: "",
        timeLimitMs: null,
        memoryBytes: null,
        xmlAuthor: "",
    };
    const dirShortName = row.polygon_dir_short_name || "";

    let xmlText = "";
    try {
        xmlText = await xml_entry.getData(new zip.TextWriter());
    } catch (e) {
        /* ignore */
    }

    const proPrimary = { ...priItem.json };
    const fallbackTitle = polygonTitleFallback(xmlMeta.shortName, dirShortName);
    if (!normText(proPrimary.name)) {
        proPrimary.name = fallbackTitle;
    } else {
        proPrimary.name = normText(proPrimary.name);
    }

    mergeAuthorFromAllParsedLanguages(
        proPrimary,
        snap.map((s) => ({ json: s.json }))
    );
    if (!normText(proPrimary.authorName) && !normText(proPrimary.authorLogin) && normText(xmlMeta.xmlAuthor)) {
        proPrimary.authorName = xmlMeta.xmlAuthor;
        proPrimary.authorLogin = "";
    }

    let tlMs = Number(proPrimary.timeLimit);
    if (!Number.isFinite(tlMs)) tlMs = 1000;
    if (xmlMeta.timeLimitMs != null && Number.isFinite(xmlMeta.timeLimitMs)) {
        tlMs = xmlMeta.timeLimitMs;
    }
    let memBytes = Number(proPrimary.memoryLimit);
    if (!Number.isFinite(memBytes)) memBytes = 268435456;
    if (xmlMeta.memoryBytes != null && Number.isFinite(xmlMeta.memoryBytes)) {
        memBytes = xmlMeta.memoryBytes;
    }

    await hydratePolygonSampleTests(entries, problemDir, proPrimary, L);

    let statement_entry = priItem.anchorFilename
        ? entries.find((e) => e.filename === priItem.anchorFilename) || null
        : null;
    if (!statement_entry) {
        statement_entry = resolveStatementAnchorEntry(entries, problemDir, L);
    }
    row.statement_entry = statement_entry;

    const spjType = String(row.spjType || row.spj || "0");

    const problemLocales = [];
    for (let i = 0; i < snap.length; i++) {
        const s = snap[i];
        if (!statementJsonHasContent(s.json)) continue;
        const lk = sanitizeLocaleKey(s.langFolder);
        if (!lk) continue;
        if (problemLocales.length >= 10) break;
        const pj = s.json;
        problemLocales.push({
            locale_key: lk,
            locale_label: localeLabelForFolder(s.langFolder),
            locale_visible: 1,
            use_pdf: 0,
            description: `__LATEX__\n\n${normText(pj.legend) || "-"}`,
            input: `__LATEX__\n\n${normText(pj.input) || "-"}`,
            output: `__LATEX__\n\n${normText(pj.output) || "-"}`,
            hint: `__LATEX__\n\n${normText(pj.notes) || "-"}`,
            source: "",
            author: pj.authorName || pj.authorLogin || "",
        });
    }
    const primKey = sanitizeLocaleKey(L);
    if (primKey && problemLocales.length > 1) {
        problemLocales.sort((a, b) => {
            if (a.locale_key === primKey) return -1;
            if (b.locale_key === primKey) return 1;
            return 0;
        });
    }

    const polygon_pdf_main_path = findPolygonStatementPdfPath(entries, problemDir, L);
    const polygon_pdf_locale_paths = {};
    for (let i = 0; i < snap.length; i++) {
        const s = snap[i];
        if (s.langFolder === L) continue;
        if (!statementJsonHasContent(s.json)) continue;
        const lk = sanitizeLocaleKey(s.langFolder);
        if (!lk) continue;
        const zp = findPolygonStatementPdfPath(entries, problemDir, s.langFolder);
        if (zp) {
            polygon_pdf_locale_paths[lk] = zp;
        }
    }

    const pdfDigests = await collectPolygonPdfDigests(
        entries,
        polygon_pdf_main_path,
        polygon_pdf_locale_paths
    );

    const localeLines = [];
    for (let i = 0; i < snap.length; i++) {
        const s = snap[i];
        if (s.langFolder === L) continue;
        if (!statementJsonHasContent(s.json)) continue;
        const lk = sanitizeLocaleKey(s.langFolder) || s.langFolder;
        localeLines.push(
            `${lk}\t${normText(s.json.legend)}\t${normText(s.json.input)}\t${normText(s.json.output)}\t${normText(s.json.notes)}`
        );
    }

    const imageDigests = await collectImageDigests(entries, statement_entry, proPrimary);

    const attach_hash = await computePolyAttachFingerprint({
        dirShortName,
        xmlText,
        spjType,
        tlMs,
        memBytes,
        primaryName: proPrimary.name || fallbackTitle,
        primaryTexts: {
            authorName: proPrimary.authorName,
            authorLogin: proPrimary.authorLogin,
            legend: proPrimary.legend,
            input: proPrimary.input,
            output: proPrimary.output,
            notes: proPrimary.notes,
        },
        localeLines,
        imageDigests,
        pdfDigests,
    });

    const attach_files = [];
    const proForRecord = JSON.parse(JSON.stringify(proPrimary));
    applyReplaceGraphics(proForRecord, attach_hash, attach_files);

    const pid =
        row.problemJson && row.problemJson.problem_new_id != null
            ? row.problemJson.problem_new_id
            : row.idx || 1;
    const { problem, attach_files: af } = buildProblemRecord(
        proForRecord,
        pid,
        attach_hash,
        attach_files,
        problemLocales,
        tlMs,
        memBytes,
        spjType
    );

    row.problemJson = problem;
    row.attach_files = af;
    row.hash = problem.attach;
    row.title = problem.title;
    row.author = problem.author_md;
    row.polygon_pdf_main_path = polygon_pdf_main_path;
    row.polygon_pdf_locale_paths = polygon_pdf_locale_paths;
    row.polygon_primary_lang_folder = L;

    if (row.testData && window.ProblemPkg && window.ProblemPkg.packCore) {
        window.ProblemPkg.packCore.invalidateTestDataMaterialization(row.testData);
    } else if (row.testData) {
        delete row.testData.zipContent;
        delete row.testData.packedBlobs;
        delete row.testData._materializePromise;
    }

    applyPolygonPdfMode(row, row.polygon_pdf_mode || "latex");
    return true;
}

async function HandlePolygonZipFile(file) {
    polygonParseBatchMode = false;
    polygonScanMain = Object.assign({}, POLYGON_OVERLAY_HEAD.scan);
    showOverlay(
        polygonOverlayOpts(
            Object.assign({}, POLYGON_OVERLAY_HEAD.scan, {
                subtitle: "读取压缩包结构…",
                subtitle_en: "Reading archive layout…",
                progressMode: "hidden",
            })
        )
    );
    try {
        // 处理数据
        map_contest_problem = new Map();
        list_other_problem = [];
        list_problem = [];
        polygon_pid = 1;
        const contest_problem_name_list = await FindContestProblems(file);
        await FindProblemDirectories(file, contest_problem_name_list);

        if (contest_problem_name_list.length) {
            const missing = contest_problem_name_list.filter((n) => !map_contest_problem.has(n));
            if (missing.length) {
                alerty.warn(
                    `contest.xml 中下列题目未在包内找到（可能缺内层 zip 或未导出完整）：${missing.join(", ")}`,
                    `These contest.xml entries were not found in the package (missing nested zips or incomplete export): ${missing.join(", ")}`
                );
            }
        }

        // 将 map_contest_problem 的数据按 contest_problem_name_list 的顺序读出
        const ordered_contest_problems = contest_problem_name_list
            .map((name) => map_contest_problem.get(name))
            .filter((problem) => problem !== undefined);

        // 合并 ordered_contest_problems 和 list_other_problem
        list_problem = ordered_contest_problems.concat(list_other_problem);
        for (let i = 0; i < list_problem.length; i++) {
            list_problem[i].idx = i + 1;
        }
        if (list_problem.length === 0) {
            alerty.error(
                "未识别为 Polygon 题包：包内（含嵌套 zip）未发现 problem.xml。请使用 Polygon 导出的标准/完整题包，勿混入其它格式压缩包。",
                "Not a Polygon package: no problem.xml found (including nested zips). Use a standard/full Polygon export."
            );
            hideOverlay();
            return [];
        }
        const tableData = list_problem.map((row) => ({ ...row }));
        const noTest = tableData.filter((r) => r.testData && r.testData.fileCount === 0).length;
        const noStmt = tableData.filter((r) => r.pkg_no_statement).length;
        if (noTest || noStmt) {
            alerty.warn(
                `解析完成：${noTest ? noTest + " 道题无正式测例（.in/.a 对），请在 Polygon 准备测试并导出完整包。" : ""}${noStmt ? (noTest ? " " : "") + noStmt + " 道题无有效题面（语言列会为 0；请检查 statements 下 problem-properties.json 是否有内容）。" : ""}`,
                `Done: ${noTest ? noTest + " problem(s) have no official tests (.in/.a pairs). Prepare tests in Polygon and export a full package." : ""}${noStmt ? (noTest ? " " : "") + noStmt + " problem(s) have no valid statement (language count 0; check problem-properties.json under statements)." : ""}`
            );
        }
        // 隐藏 overlay
        hideOverlay();
        return tableData;
    } catch (error) {
        console.error("Error handling polygon zip file:", error);
        const msg =
            error && error.message
                ? String(error.message)
                : typeof error === "string"
                  ? error
                  : "unknown error";
        alerty.error(
            `解析压缩包失败（可能不是合法 zip 或已损坏）：${msg}`,
            `Failed to parse archive (invalid or corrupted zip?): ${msg}`
        );
        return [];
    } finally {
        hideOverlay();
    }
}

async function FindContestProblems(zipFile) {
    // 查找 contest.xml 信息
    const zipReader = new zip.ZipReader(new zip.BlobReader(zipFile));
    const entries = await zipReader.getEntries();

    let contest_problem_name_list = [];

    for (const entry of entries) {
        if (entry.directory) {
            continue;
        }
        updateOverlay(
            polygonOverlayOpts({
                ...POLYGON_OVERLAY_HEAD.scan,
                subtitle: "定位 contest.xml…",
                subtitle_en: "Locating contest.xml…",
                detail: entry.filename,
            }),
            null
        );
        if (polygonNestedZipRecursible(entry.filename)) {
            const nestedZipBlob = await entry.getData(new zip.BlobWriter());
            const nestedNames = await FindContestProblems(nestedZipBlob);
            contest_problem_name_list.push(...nestedNames);
        } else if (IsFile(entry.filename, "contest.xml")) {
            const text = await entry.getData(new zip.TextWriter());
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "application/xml");

            const problems = xmlDoc.getElementsByTagName("problem");
            for (let problem of problems) {
                const url = problem.getAttribute("url");
                const lastSegment = url.substring(url.lastIndexOf("/") + 1);
                contest_problem_name_list.push(lastSegment);
            }
        }
    }

    await zipReader.close();
    return contest_problem_name_list;
}
function IsFile(fullPath, filename) {
    const regex = new RegExp(`(^|[\\/])${filename}$`);
    return regex.test(fullPath);
}

/**
 * 递归收集 problem.xml 任务（不解析内容），用于先得到题目总数再显示确定进度条
 * @param {Blob|File} zipFile
 * @param {string[]} contest_problem_name_list
 * @param {object[]} outJobs
 */
async function collectProblemXmlJobs(zipFile, contest_problem_name_list, outJobs) {
    const zipReader = new zip.ZipReader(new zip.BlobReader(zipFile));
    const entries = await zipReader.getEntries();

    for (const entry of entries) {
        if (entry.directory) {
            continue;
        }
        updateOverlay(
            polygonOverlayOpts({
                ...POLYGON_OVERLAY_HEAD.scan,
                subtitle: "统计题目（problem.xml）…",
                subtitle_en: "Counting problems (problem.xml)…",
                detail: entry.filename,
            }),
            null
        );
        if (polygonNestedZipRecursible(entry.filename)) {
            const nestedZipBlob = await entry.getData(new zip.BlobWriter());
            await collectProblemXmlJobs(nestedZipBlob, contest_problem_name_list, outJobs);
        } else if (IsFile(entry.filename, "problem.xml")) {
            const parts = SplitPath(entry.filename);
            const dirPath =
                parts.length > 1
                    ? entry.filename.substring(0, entry.filename.lastIndexOf("/") + 1)
                    : "";
            const problem_entries =
                dirPath == ""
                    ? entries
                    : entries.filter((e) => e.filename.startsWith(dirPath));
            const dirName = parts.length > 1 ? parts[parts.length - 2] : "";
            const inContest =
                contest_problem_name_list.length > 0 && contest_problem_name_list.includes(dirName);
            outJobs.push({
                problem_entries,
                xml_entry: entry,
                dirName,
                inContest,
                pathKey: entry.filename,
            });
        }
    }

    await zipReader.close();
}

function sortPolygonParseJobs(jobs, contest_problem_name_list) {
    const used = new Set();
    const ordered = [];
    for (const name of contest_problem_name_list) {
        const j = jobs.find((x) => x.inContest && x.dirName === name && !used.has(x.pathKey));
        if (j) {
            ordered.push(j);
            used.add(j.pathKey);
        }
    }
    const rest = jobs.filter((x) => !used.has(x.pathKey));
    return ordered.concat(rest);
}

async function FindProblemDirectories(zipFile, contest_problem_name_list) {
    const jobs = [];
    await collectProblemXmlJobs(zipFile, contest_problem_name_list, jobs);
    const sorted = sortPolygonParseJobs(jobs, contest_problem_name_list);
    const n = sorted.length;

    if (n > 0) {
        polygonScanMain = Object.assign({}, POLYGON_OVERLAY_HEAD.problems);
        updateOverlay(
            polygonOverlayOpts({
                ...POLYGON_OVERLAY_HEAD.problems,
                subtitle: `共 ${n} 题 · 进度 0/${n}`,
                subtitle_en: `${n} problem(s) · 0/${n}`,
                detail: "",
                detail_en: "",
                progressMode: "determinate",
                progress: 0,
            }),
            0
        );
    }

    polygonParseBatchMode = n > 0;
    for (let i = 0; i < sorted.length; i++) {
        const job = sorted[i];
        const rec = await FetchProblem(job.problem_entries, job.xml_entry);
        const parts = SplitPath(job.xml_entry.filename);
        if (parts.length > 1 && contest_problem_name_list.includes(job.dirName)) {
            map_contest_problem.set(job.dirName, rec);
        } else {
            list_other_problem.push(rec);
        }
        const done = i + 1;
        const testPairs = sumPolygonTestFileCounts();
        const pct = Math.min(100, Math.round((done / n) * 100));
        polygonScanMain = Object.assign({}, POLYGON_OVERLAY_HEAD.problems);
        const titleShort = polygonEllipsis(rec.title || job.dirName || "", 30);
        updateOverlay(
            polygonOverlayOpts({
                ...POLYGON_OVERLAY_HEAD.problems,
                subtitle: `第 ${done}/${n} 题 · 测例对 ${testPairs}`,
                subtitle_en: `Problem ${done}/${n} · ${testPairs} pair(s)`,
                detail: titleShort ? `「${titleShort}」` : "",
                detail_en: titleShort ? `"${titleShort}"` : "",
                progressMode: "determinate",
                progress: pct,
            }),
            pct
        );
    }
    polygonParseBatchMode = false;
    if (n > 0) {
        const testPairs = sumPolygonTestFileCounts();
        polygonScanMain = Object.assign({}, POLYGON_OVERLAY_HEAD.problems);
        updateOverlay(
            polygonOverlayOpts({
                ...POLYGON_OVERLAY_HEAD.problems,
                subtitle: `全部完成 · 共 ${n} 题 · 测例对 ${testPairs}`,
                subtitle_en: `Done · ${n} problem(s) · ${testPairs} pair(s)`,
                detail: "",
                detail_en: "",
                progressMode: "determinate",
                progress: 100,
            }),
            100
        );
    }
}

async function MakeAttachFiles(problem_entries, statement_entry, attach_files) {
    if (!statement_entry || !attach_files || !attach_files.length) {
        return [];
    }
    const statementDir = statement_entry.filename.substring(0, statement_entry.filename.lastIndexOf("/") + 1);
    const attachFilesData = [];

    for (const file of attach_files) {
        const filePath = statementDir + file;
        const entry = problem_entries.find((e) => e.filename === filePath);
        if (entry) {
            const fileContent = await entry.getData(new zip.BlobWriter());
            attachFilesData.push({ filename: file, content: fileContent });
        }
    }

    return attachFilesData;
}

/** zip 内路径统一（反斜杠、前导 /），便于匹配各端 Polygon 导出与嵌套包 */
function normZipEntryPath(fn) {
    return String(fn || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function GetDirPath(filename) {
    const n = normZipEntryPath(filename);
    const i = n.lastIndexOf("/");
    return i <= 0 ? "" : n.substring(0, i);
}

/** 答案文件（…/tests/foo.a）对应输入：无扩展名或 .in */
function findPolygonTestInputForAnswer(problem_entries, answerFilename) {
    const n = normZipEntryPath(answerFilename);
    if (!n.endsWith(".a")) return undefined;
    const base = n.slice(0, -2);
    let hit = problem_entries.find((e) => normZipEntryPath(e.filename) === base);
    if (hit) return hit;
    return problem_entries.find((e) => normZipEntryPath(e.filename) === base + ".in");
}

function FindChecker(entries, problemXmlDir) {
    const pd = normZipEntryPath(problemXmlDir);
    return entries.find((entry) => {
        const f = normZipEntryPath(entry.filename);
        return pd === "" ? f === "check.cpp" : f === `${pd}/check.cpp`;
    });
}

function FindInteractor(entries, problemXmlDir) {
    const pd = normZipEntryPath(problemXmlDir);
    const wantA = pd === "" ? "files/interactor.cpp" : `${pd}/files/interactor.cpp`;
    return entries.find((entry) => {
        const f = normZipEntryPath(entry.filename);
        return f === wantA || f.endsWith("/files/interactor.cpp");
    });
} 
async function MakeTestData(
    proble_title,
    problem_entries,
    problem_xml_entry,
    spjType,
    tip_info = "Processing",
    abortSignal
) {
    const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));

    const problemDir = GetDirPath(problem_xml_entry.filename);
    const testsDir = problem_entries.filter((entry) => {
        const fn = normZipEntryPath(entry.filename);
        if (problemDir === "") {
            return fn.startsWith("tests/");
        }
        return fn.startsWith(`${problemDir}/tests/`);
    });
    let fileCount = 0;
    let totalSize = 0; // 累计文件大小
    /** 与 zip 内文件名一致（.in/.out 对 + 可选 tpj.cc），供界面列表与 modal 展示 */
    const packedFileNames = [];
    /** 与写入本 zip 相同的 Blob，供外层 CSGOJ 包直接 add，避免重复解压内层 zip */
    const packedBlobs = [];
    polygonScanMain = Object.assign({}, POLYGON_OVERLAY_HEAD.tests);
    const probTitle = normText(proble_title);
    const titleCn = probTitle ? `「${polygonEllipsis(probTitle, 26)}」` : "";
    const titleEn = probTitle ? `"${polygonEllipsis(probTitle, 26)}"` : "";
    const subCn =
        titleCn && tip_info === "Packing"
            ? `${titleCn} · 写入测例`
            : titleCn
              ? `${titleCn} · 读取`
              : tip_info === "Packing"
                ? "写入 .in / .out …"
                : "读取测例…";
    const subEn =
        titleEn && tip_info === "Packing"
            ? `${titleEn} · writing tests`
            : titleEn
              ? `${titleEn} · reading`
              : tip_info === "Packing"
                ? "Writing .in / .out…"
                : "Reading tests…";
    for (const entry of testsDir) {
        if (typeof window.overlayThrowIfAborted === "function") {
            window.overlayThrowIfAborted(abortSignal);
        }
        updateOverlay(
            polygonOverlayOpts({
                ...POLYGON_OVERLAY_HEAD.tests,
                subtitle: subCn,
                subtitle_en: subEn,
                detail: entry.filename,
            }),
            null
        );
        const nfn = normZipEntryPath(entry.filename);
        if (nfn.endsWith(".a")) {
            const inFile = findPolygonTestInputForAnswer(problem_entries, entry.filename);

            if (inFile) {
                const outFileContent = await entry.getData(new zip.BlobWriter());
                const inFileContent = await inFile.getData(new zip.BlobWriter());

                // 计算文件大小
                totalSize += outFileContent.size + inFileContent.size;

                const baseNorm = nfn.slice(0, -2);
                const baseSeg = baseNorm.substring(baseNorm.lastIndexOf("/") + 1);
                const outFilename = `${baseSeg}.out`;
                const inFilename = `${baseSeg}.in`;

                await zipWriter.add(outFilename, new zip.BlobReader(outFileContent));
                await zipWriter.add(inFilename, new zip.BlobReader(inFileContent));
                packedFileNames.push(inFilename, outFilename);
                packedBlobs.push({ name: outFilename, blob: outFileContent });
                packedBlobs.push({ name: inFilename, blob: inFileContent });
                fileCount++;
            }
        }
    }
    
    // 根据 spj 类型添加对应的文件
    if (spjType === "1") {
        // 特判评测：使用 check.cpp
        const spjEntry = FindChecker(problem_entries, problemDir);
        if (spjEntry) {
            const spjContent = await spjEntry.getData(new zip.BlobWriter());
            await zipWriter.add("tpj.cc", new zip.BlobReader(spjContent));
            packedFileNames.push("tpj.cc");
            packedBlobs.push({ name: "tpj.cc", blob: spjContent });
            totalSize += spjContent.size; // 计算SPJ文件大小
        } else {
            alerty.warn(
                `题目 ${proble_title} 不存在 check.cpp`,
                `Problem ${proble_title} does not have check.cpp`
            );
        }
    } else if (spjType === "2") {
        // 交互评测：使用 files/interactor.cpp
        const interactorEntry = FindInteractor(problem_entries, problemDir);
        if (interactorEntry) {
            const interactorContent = await interactorEntry.getData(new zip.BlobWriter());
            await zipWriter.add("tpj.cc", new zip.BlobReader(interactorContent));
            packedFileNames.push("tpj.cc");
            packedBlobs.push({ name: "tpj.cc", blob: interactorContent });
            totalSize += interactorContent.size; // 计算交互文件大小
        } else {
            alerty.warn(
                `题目 ${proble_title} 不存在 files/interactor.cpp`,
                `Problem ${proble_title} does not have files/interactor.cpp`
            );
        }
    }
    // spjType === "0" 时不添加任何文件（标准评测）

    const zipContent = await zipWriter.close();
    return {
        zipContent,
        fileCount,
        totalSize,
        problem_xml_entry,
        entries: problem_entries,
        packedFileNames,
        packedBlobs,
    };
}
async function FetchProblem(problem_entries, problem_xml_entry) {
    const problemDir = GetDirPath(problem_xml_entry.filename);
    const xmlParts = SplitPath(problem_xml_entry.filename);
    const dirShortName = xmlParts.length > 1 ? xmlParts[xmlParts.length - 2] : "";

    let xmlText = "";
    try {
        xmlText = await problem_xml_entry.getData(new zip.TextWriter());
    } catch (e) { /* ignore */ }
    const xmlMeta = parseProblemXml(xmlText);

    const stmtCandidates = [];
    for (const entry of problem_entries) {
        if (!IsFile(entry.filename, "problem-properties.json")) continue;
        if (!entry.filename.includes("/statements/")) continue;
        const parts = SplitPath(entry.filename);
        const langFolder = parts.length >= 2 ? parts[parts.length - 2] : "";
        stmtCandidates.push({ entry, langFolder });
    }
    stmtCandidates.sort((a, b) => comparePolygonStatementLangFolders(a.langFolder, b.langFolder));

    const parsedList = [];
    for (const c of stmtCandidates) {
        try {
            const t = await c.entry.getData(new zip.TextWriter());
            const j = JSON.parse(t);
            parsedList.push({ entry: c.entry, langFolder: c.langFolder, json: j });
        } catch (e) {
            console.warn("problem-properties parse fail", c.entry?.filename, e);
        }
    }

    await enrichPolygonStatements(problem_entries, problemDir, parsedList);

    const hasAnyValidStatement = parsedList.some((x) => statementJsonHasContent(x.json));
    /** 多语言且可识别中文目录时优先中文主语言；否则按已排序列表取首个有内容项（与 Polygon 习惯一致） */
    const primary =
        parsedList.find(
            (x) => statementJsonHasContent(x.json) && isPolygonChineseLangFolder(x.langFolder)
        ) ||
        parsedList.find((x) => statementJsonHasContent(x.json)) ||
        parsedList[0] ||
        null;
    /** 无任何有效题面 JSON（与语言列「有效个数」一致，用于解析结束告警） */
    const pkg_no_statement = !hasAnyValidStatement;
    const statement_entry = primary ? primary.entry : null;
    const fallbackTitle = polygonTitleFallback(xmlMeta.shortName, dirShortName);
    const proPrimary = primary
        ? { ...primary.json }
        : {
              name: fallbackTitle,
              legend: "-",
              input: "",
              output: "",
              notes: "",
              sampleTests: [],
              timeLimit: 1000,
              memoryLimit: 268435456,
              authorName: "",
              authorLogin: "",
          };
    if (!normText(proPrimary.name)) {
        proPrimary.name = fallbackTitle;
    } else {
        proPrimary.name = normText(proPrimary.name);
    }
    mergeAuthorFromAllParsedLanguages(proPrimary, parsedList);
    if (!normText(proPrimary.authorName) && !normText(proPrimary.authorLogin) && normText(xmlMeta.xmlAuthor)) {
        proPrimary.authorName = xmlMeta.xmlAuthor;
        proPrimary.authorLogin = "";
    }

    const interactorEntry = FindInteractor(problem_entries, problemDir);
    const checkerEntry = FindChecker(problem_entries, problemDir);
    const spjType = interactorEntry ? "2" : checkerEntry ? "1" : "0";

    let tlMs = Number(proPrimary.timeLimit);
    if (!Number.isFinite(tlMs)) tlMs = 1000;
    if (xmlMeta.timeLimitMs != null && Number.isFinite(xmlMeta.timeLimitMs)) {
        tlMs = xmlMeta.timeLimitMs;
    }
    let memBytes = Number(proPrimary.memoryLimit);
    if (!Number.isFinite(memBytes)) memBytes = 268435456;
    if (xmlMeta.memoryBytes != null && Number.isFinite(xmlMeta.memoryBytes)) {
        memBytes = xmlMeta.memoryBytes;
    }

    await hydratePolygonSampleTests(
        problem_entries,
        problemDir,
        proPrimary,
        primary ? primary.langFolder : "english"
    );

    const polygon_pdf_main_path = primary
        ? findPolygonStatementPdfPath(problem_entries, problemDir, primary.langFolder)
        : null;
    const polygon_pdf_locale_paths = {};
    for (const p of parsedList) {
        if (primary && p.entry === primary.entry) continue;
        if (!statementJsonHasContent(p.json)) continue;
        const lk = sanitizeLocaleKey(p.langFolder);
        if (!lk) continue;
        const zp = findPolygonStatementPdfPath(problem_entries, problemDir, p.langFolder);
        if (zp) {
            polygon_pdf_locale_paths[lk] = zp;
        }
    }
    const pdfDigests = await collectPolygonPdfDigests(
        problem_entries,
        polygon_pdf_main_path,
        polygon_pdf_locale_paths
    );

    const localeLines = [];
    for (const p of parsedList) {
        if (primary && p.entry === primary.entry) continue;
        if (!statementJsonHasContent(p.json)) continue;
        const lk = sanitizeLocaleKey(p.langFolder) || p.langFolder;
        localeLines.push(
            `${lk}\t${normText(p.json.legend)}\t${normText(p.json.input)}\t${normText(p.json.output)}\t${normText(p.json.notes)}`
        );
    }

    const imageDigests = await collectImageDigests(problem_entries, statement_entry, proPrimary);
    const attach_hash = await computePolyAttachFingerprint({
        dirShortName,
        xmlText,
        spjType,
        tlMs,
        memBytes,
        primaryName: proPrimary.name || fallbackTitle,
        primaryTexts: {
            authorName: proPrimary.authorName,
            authorLogin: proPrimary.authorLogin,
            legend: proPrimary.legend,
            input: proPrimary.input,
            output: proPrimary.output,
            notes: proPrimary.notes,
        },
        localeLines,
        imageDigests,
        pdfDigests,
    });

    const attach_files = [];
    const proForRecord = JSON.parse(JSON.stringify(proPrimary));
    applyReplaceGraphics(proForRecord, attach_hash, attach_files);

    const problemLocales = [];
    const orderedStmt = [];
    if (primary && statementJsonHasContent(primary.json)) {
        orderedStmt.push(primary);
    }
    for (const p of parsedList) {
        if (primary && p.entry === primary.entry) continue;
        if (!statementJsonHasContent(p.json)) continue;
        orderedStmt.push(p);
    }
    for (const p of orderedStmt) {
        const lk = sanitizeLocaleKey(p.langFolder);
        if (!lk) continue;
        if (problemLocales.length >= 10) break;
        problemLocales.push({
            locale_key: lk,
            locale_label: localeLabelForFolder(p.langFolder),
            locale_visible: 1,
            use_pdf: 0,
            description: `__LATEX__\n\n${normText(p.json.legend) || "-"}`,
            input: `__LATEX__\n\n${normText(p.json.input) || "-"}`,
            output: `__LATEX__\n\n${normText(p.json.output) || "-"}`,
            hint: `__LATEX__\n\n${normText(p.json.notes) || "-"}`,
            source: "",
            author: p.json.authorName || p.json.authorLogin || "",
        });
    }

    const pid = polygon_pid++;
    const { problem, attach_files: af } = buildProblemRecord(
        proForRecord,
        pid,
        attach_hash,
        attach_files,
        problemLocales,
        tlMs,
        memBytes,
        spjType
    );

    const packMeta = summarizePolygonTestPackMeta(problem_entries, problem_xml_entry, spjType);
    const testData = {
        zipContent: null,
        fileCount: packMeta.fileCount,
        totalSize: packMeta.totalSize,
        problem_xml_entry,
        entries: problem_entries,
        packedFileNames: packMeta.packedFileNames,
    };

    if (!polygonParseBatchMode) {
        const problemCount = map_contest_problem.size + list_other_problem.length;
        const testPairsSoFar = sumPolygonTestFileCounts() + (testData.fileCount || 0);
        const pc = problemCount + 1;
        const tlab = polygonEllipsis(problem.title, 28);
        polygonScanMain = Object.assign({}, POLYGON_OVERLAY_HEAD.problems);
        updateOverlay(
            polygonOverlayOpts({
                ...POLYGON_OVERLAY_HEAD.problems,
                subtitle: tlab
                    ? `「${tlab}」 · 第 ${pc} 题 · 测例对 ${testPairsSoFar}`
                    : `第 ${pc} 题 · 测例对 ${testPairsSoFar}`,
                subtitle_en: tlab
                    ? `"${tlab}" · #${pc} · ${testPairsSoFar} pair(s)`
                    : `Problem #${pc} · ${testPairsSoFar} pair(s)`,
            }),
            null
        );
    }

    let totalSizeMB = testData.totalSize / (1024 * 1024);
    if (totalSizeMB < 0.01) {
        totalSizeMB = totalSizeMB.toFixed(4);
    } else if (totalSizeMB < 0.1) {
        totalSizeMB = totalSizeMB.toFixed(3);
    } else {
        totalSizeMB = totalSizeMB.toFixed(2);
    }

    const langLabels = [];
    const langSeen = new Set();
    for (const p of parsedList) {
        if (!statementJsonHasContent(p.json)) continue;
        const f = p.langFolder;
        if (!f || langSeen.has(f)) continue;
        langSeen.add(f);
        langLabels.push(f);
    }
    const pkg_langs = langLabels.length ? langLabels.join(", ") : "—";

    const polygon_parsed_locales_snapshot = parsedList
        .filter((p) => statementJsonHasContent(p.json))
        .map((p) => ({
            langFolder: p.langFolder,
            json: JSON.parse(JSON.stringify(p.json)),
            anchorFilename: p.entry && p.entry.filename ? p.entry.filename : "",
        }));

    const polygonSolutions = [];
    if (xmlMeta.xmlSolutions && xmlMeta.xmlSolutions.length > 0) {
        for (const xs of xmlMeta.xmlSolutions) {
            const solEntry = problem_entries.find(
                (e) => e.filename === problemDir + xs.path || e.filename === xs.path
            );
            if (!solEntry) continue;
            try {
                const code = await solEntry.getData(new zip.TextWriter());
                if (!code || !code.trim()) continue;
                const ojResult = POLYGON_TAG_TO_OJ_RESULT[xs.tag] ?? 4;
                const ojLang = POLYGON_TYPE_TO_OJ_LANG[xs.type] ?? _guessLangFromExt(xs.path);
                const resultTag = ({4:"AC",5:"PE",6:"WA",7:"TLE",8:"MLE",9:"OLE",10:"RE",11:"CE"})[ojResult] || "??";
                const langName = ({0:"C",1:"C++",3:"Java",6:"Python3"})[ojLang] || "Unknown";
                const header = ojLang === 6
                    ? `# [Polygon] ${problem.title}\n# Tag: ${xs.tag} → ${resultTag} | Language: ${langName} (${xs.type})\n#\n`
                    : `/*\n * [Polygon] ${problem.title}\n * Tag: ${xs.tag} → ${resultTag} | Language: ${langName} (${xs.type})\n */\n`;
                polygonSolutions.push({
                    source: header + code,
                    language: ojLang,
                    result: ojResult,
                    result_tag: resultTag,
                });
            } catch (e) {
                console.warn("polygon solution read failed", xs.path, e);
            }
        }
    }

    const rec = {
        __pkg_source: "polygon",
        title: problem.title,
        author: problem.author_md,
        testdata: `${testData.fileCount} tests, ${totalSizeMB} MB`,
        td_file_count: testData.fileCount,
        td_size_label: `${totalSizeMB} MB`,
        td_packed_names: testData.packedFileNames || [],
        spj: spjType,
        spjType: spjType,
        hash: problem.attach,
        problemJson: problem,
        testData,
        statement_entry,
        attach_files: af,
        pkg_no_statement,
        pkg_langs,
        pkg_lang_list: langLabels,
        pkg_lang_count: langLabels.length,
        polygon_pdf_main_path: polygon_pdf_main_path,
        polygon_pdf_locale_paths: polygon_pdf_locale_paths,
        polygon_pdf_mode: "latex",
        polygon_parsed_locales_snapshot,
        polygon_xml_meta: {
            shortName: xmlMeta.shortName,
            timeLimitMs: xmlMeta.timeLimitMs,
            memoryBytes: xmlMeta.memoryBytes,
            xmlAuthor: xmlMeta.xmlAuthor,
        },
        polygon_dir_short_name: dirShortName,
        polygon_primary_lang_folder: primary ? primary.langFolder : "",
        polygonSolutions: polygonSolutions,
    };
    applyPolygonPdfMode(rec, "latex");
    return rec;
}

function DownloadPro(pid) {
    void (async () => {
        const problem = list_problem.find((p) => String(p.idx) === String(pid));
        if (!problem) return;
        try {
            problem.problemJson.spj = String(problem.spjType || problem.spj || "0");
            problem.problemJson.problem_new_id = 1;
            const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
            await zipWriter.add(
                "problemlist.json",
                new zip.TextReader(JSON.stringify([problem.problemJson], null, 4))
            );
            await zipWriter.add(
                "csg_export_timezone.json",
                new zip.TextReader(
                    JSON.stringify({
                        iana: CsgRequireAppTimezoneForWireExport(),
                        schema: 1,
                    })
                )
            );
            const attachDir = `ATTACH_${String(1).padStart(5, "0")}`;
            const testDir = `TEST_${String(1).padStart(5, "0")}`;
            await addPolygonAttachToZipWriter(zipWriter, attachDir, testDir, problem, null);
            const zipContent = await zipWriter.close();
            const url = URL.createObjectURL(zipContent);
            const a = document.createElement("a");
            a.href = url;
            const pcDn = window.ProblemPkg && window.ProblemPkg.packCore;
            a.download =
                pcDn && typeof pcDn.buildOjProblemPackFilename === "function"
                    ? pcDn.buildOjProblemPackFilename("polygon", `p${pid}`)
                    : `${pid}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("DownloadPro", e);
        }
    })();
}

async function DownloadTestData(pid) {
    const problem = list_problem.find((p) => String(p.idx) === String(pid));
    if (problem) {
        try {
            const testData = await ensurePolygonTestDataZip(problem, "Packing");
            if (testData && testData.zipContent) {
                const url = URL.createObjectURL(testData.zipContent);
                const a = document.createElement("a");
                let suffix = '';
                const spjType = String(problem.spjType || problem.spj || "0");
                if (spjType === "1") {
                    suffix = "_with_tpj";
                } else if (spjType === "2") {
                    suffix = "_interactive";
                }
                const pcTd = window.ProblemPkg && window.ProblemPkg.packCore;
                let infoTd = `p${pid}-testdata`;
                if (spjType === "1") infoTd += "-tpj";
                else if (spjType === "2") infoTd += "-interactive";
                a.download =
                    pcTd && typeof pcTd.buildOjProblemPackFilename === "function"
                        ? pcTd.buildOjProblemPackFilename("polygon", infoTd)
                        : `${pid}${suffix}.zip`;
                a.href = url;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                console.error("testData.zipContent is undefined");
            }
        } catch (error) {
            console.error("Error creating test data:", error);
        }
    }
}

function handleDownloadTestData(pid) {
    showOverlay(
        polygonOverlayOpts({
            ...POLYGON_OVERLAY_HEAD.tests,
            subtitle: "生成下载文件…",
            subtitle_en: "Preparing download…",
            progressMode: "indeterminate",
        })
    );
    DownloadTestData(pid).catch((error) => {
        console.error("Error downloading test data:", error);
    }).finally(()=> hideOverlay());
}
async function BuildSelectedProblemsZipBlob(tableSelector, abortSignal) {
    const sel = tableSelector || "#polygon_parse_table";
    const selectedProblems = $(sel).bootstrapTable("getSelections");
    if (selectedProblems.length === 0) {
        return null;
    }
    const pc = window.ProblemPkg && window.ProblemPkg.packCore;
    if (!pc || typeof pc.buildImportZipFromProblems !== "function") {
        throw new Error("ProblemPkg.packCore.buildImportZipFromProblems missing");
    }
    return pc.buildImportZipFromProblems({
        selectedProblems,
        abortSignal: abortSignal || null,
        materializeTestData: (p, tip, sig) => ensurePolygonTestDataZip(p, tip, sig),
        addAttachments: (zw, attachDir, problem, index) => {
            const pc = window.ProblemPkg && window.ProblemPkg.packCore;
            const testDir = pc && pc.testDirForIndex ? pc.testDirForIndex(index + 1) : `TEST_${String(index + 1).padStart(5, "0")}`;
            return addPolygonAttachToZipWriter(zw, attachDir, testDir, problem, abortSignal);
        },
        onProgress: (ctx) => {
            if (ctx.phase === "file") {
                const headline = String(ctx.problemTitle || "").trim();
                const file = String(ctx.detail || "").trim();
                const sz =
                    pc.zipEntrySizeOverlaySuffix &&
                    typeof pc.zipEntrySizeOverlaySuffix === "function"
                        ? pc.zipEntrySizeOverlaySuffix(
                              ctx.uncompressedSize,
                              ctx.compressedSize
                          )
                        : { cn: "", en: "" };
                const hl = polygonEllipsis(headline, 26);
                const detailCn = `${file}${sz.cn || ""}`;
                const detailEn = `${file}${sz.en || ""}`;
                const subCn = hl
                    ? `第 ${ctx.problemIndex}/${ctx.problemTotal} 题 · 「${hl}」`
                    : `第 ${ctx.problemIndex}/${ctx.problemTotal} 题`;
                const subEn = hl
                    ? `Problem ${ctx.problemIndex}/${ctx.problemTotal} · "${hl}"`
                    : `Problem ${ctx.problemIndex}/${ctx.problemTotal}`;
                updateOverlay(
                    polygonOverlayOpts({
                        ...POLYGON_OVERLAY_HEAD.pack,
                        subtitle: `${subCn} · 写入文件`,
                        subtitle_en: `${subEn} · writing`,
                        detail: detailCn,
                        detail_en: detailEn,
                    }),
                    null
                );
            } else if (ctx.phase === "problem_done") {
                updateOverlay(
                    polygonOverlayOpts({
                        ...POLYGON_OVERLAY_HEAD.pack,
                        subtitle: `已完成 ${ctx.problemIndex}/${ctx.problemTotal} 题`,
                        subtitle_en: `${ctx.problemIndex}/${ctx.problemTotal} problem(s) done`,
                        detail: "",
                        detail_en: "",
                    }),
                    null
                );
            }
        },
        packKind: "polygon",
    });
}

async function DownloadSelectedProblems() {
    const ac = new AbortController();
    showOverlay(
        polygonOverlayOpts({
            ...POLYGON_OVERLAY_HEAD.pack,
            subtitle: "准备所选题目…",
            subtitle_en: "Preparing selection…",
            progressMode: "indeterminate",
            cancelable: true,
            cancelLabel: "取消",
            cancelLabel_en: "Cancel",
            abortController: ac,
        })
    );
    try {
        const packed = await BuildSelectedProblemsZipBlob(undefined, ac.signal);
        if (!packed) {
            alerty.error(
                "至少需要选择一个题目",
                "At least one problem should be selected"
            );
            return;
        }
        const url = URL.createObjectURL(packed.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = packed.defaultName;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }
        console.error("Error downloading selected problems:", error);
    } finally {
        hideOverlay();
    }
}


function reorderPolygonSnapshotByFolderOrder(snap, orderedFolders) {
    if (!Array.isArray(snap)) return [];
    if (!Array.isArray(orderedFolders)) return snap.slice();
    const map = new Map(snap.map((s) => [s.langFolder, s]));
    const out = [];
    for (const f of orderedFolders) {
        const it = map.get(f);
        if (it) out.push(it);
    }
    for (const s of snap) {
        if (out.indexOf(s) < 0) out.push(s);
    }
    return out;
}

function pkgLangBuildOrderedForRow(pkgLangList, masterOrder) {
    const have = new Set(pkgLangList || []);
    const ordered = [];
    const seen = new Set();
    for (const x of masterOrder) {
        if (have.has(x) && !seen.has(x)) {
            ordered.push(x);
            seen.add(x);
        }
    }
    for (const x of pkgLangList || []) {
        if (!seen.has(x)) {
            ordered.push(x);
            seen.add(x);
        }
    }
    return ordered;
}

/**
 * 按目录名顺序重排 polygon_parsed_locales_snapshot，并将首项有题面内容者设为主题面。
 * @returns {Promise<boolean>}
 */
async function applyPolygonLangFolderOrder(row, orderedFolders) {
    if (!row || row.__pkg_source !== "polygon") return false;
    const snap = row.polygon_parsed_locales_snapshot;
    if (!Array.isArray(snap) || snap.length < 1) return false;
    row.polygon_parsed_locales_snapshot = reorderPolygonSnapshotByFolderOrder(snap, orderedFolders);
    const next = row.polygon_parsed_locales_snapshot;
    const prim =
        orderedFolders.find((f) => {
            const it = next.find((s) => s.langFolder === f);
            return it && statementJsonHasContent(it.json);
        }) || orderedFolders[0];
    if (!prim) return false;
    return applyPolygonPrimaryLangSwitch(row, prim);
}

/**
 * 将本题弹窗中的顺序套用到其它题：仅重排「能对应上」的目录名，其余语言接在后面保持原相对顺序。
 */
async function applyPkgLangOrderToAllProblems(masterRow, orderedFolders, tableId) {
    const tid = tableId || "polygon_parse_table";
    const $t = typeof jQuery !== "undefined" ? jQuery("#" + tid) : null;
    if (!$t || !$t.length || typeof $t.bootstrapTable !== "function") return;
    const list =
        masterRow && masterRow.__pkg_source === "thusaa"
            ? window.list_thusaa_problem
            : typeof list_problem !== "undefined"
              ? list_problem
              : [];
    if (!Array.isArray(list)) return;
    for (let i = 0; i < list.length; i++) {
        const other = list[i];
        if (!other || other === masterRow) continue;
        const haveList = other.pkg_lang_list || [];
        if (!haveList.length) continue;
        const ord = pkgLangBuildOrderedForRow(haveList, orderedFolders);
        if (other.__pkg_source === "polygon" && Array.isArray(other.polygon_parsed_locales_snapshot) && other.polygon_parsed_locales_snapshot.length > 1) {
            other.polygon_parsed_locales_snapshot = reorderPolygonSnapshotByFolderOrder(other.polygon_parsed_locales_snapshot, ord);
            const prim = ord.find((f) => {
                const it = other.polygon_parsed_locales_snapshot.find((s) => s.langFolder === f);
                return it && statementJsonHasContent(it.json);
            }) || ord[0];
            await applyPolygonPrimaryLangSwitch(other, prim);
        }
        other.pkg_lang_list = ord;
        other.pkg_langs = ord.join(", ");
        const all = $t.bootstrapTable("getData");
        const idx = all.findIndex((x) => String(x.idx) === String(other.idx));
        if (idx >= 0) {
            $t.bootstrapTable("updateRow", { index: idx, row: other, replace: true });
        }
    }
}

window.ProblemPkg = window.ProblemPkg || {};
window.ProblemPkg.polygon = Object.assign(window.ProblemPkg.polygon || {}, {
    source: "polygon",
    applyPdfMode: applyPolygonPdfMode,
    rowHasAnyPdf: polygonRowHasAnyPdf,
    applyPrimaryLangSwitch: applyPolygonPrimaryLangSwitch,
    reorderPolygonSnapshotByFolderOrder: reorderPolygonSnapshotByFolderOrder,
    pkgLangBuildOrderedForRow: pkgLangBuildOrderedForRow,
    applyPolygonLangFolderOrder: applyPolygonLangFolderOrder,
    applyPkgLangOrderToAllProblems: applyPkgLangOrderToAllProblems,
});

/** 题包转换页 UI：modal 内刷新测例文件名列表（按当前评测类型下拉选项重新打包预览） */
window.PolygonConvertUi = {
    async fetchTestdataPackedNamesForPid(pid) {
        const problem = list_problem.find((p) => String(p.idx) === String(pid));
        if (!problem) {
            return { ok: false, names: [], err: "not_found" };
        }
        const td = problem.testData;
        if (!td || !td.entries || !td.problem_xml_entry) {
            return { ok: false, names: [], err: "no_testdata" };
        }
        try {
            const spj = String(problem.spjType || problem.spj || "0");
            const meta = summarizePolygonTestPackMeta(td.entries, td.problem_xml_entry, spj);
            let names = (meta.packedFileNames || []).slice();

            if (!names.length && Array.isArray(td.packedBlobs) && td.packedBlobs.length) {
                names = td.packedBlobs.map((x) => x && x.name).filter(Boolean);
            }
            if (!names.length && Array.isArray(td.packedFileNames) && td.packedFileNames.length) {
                names = td.packedFileNames.slice();
                if (spj === "0") {
                    names = names.filter((n) => n !== "tpj.cc");
                } else if ((spj === "1" || spj === "2") && names.indexOf("tpj.cc") < 0) {
                    const pd = GetDirPath(td.problem_xml_entry.filename);
                    const needTpj =
                        spj === "1" ? FindChecker(td.entries, pd) : FindInteractor(td.entries, pd);
                    if (needTpj) names.push("tpj.cc");
                }
            }

            return { ok: true, names };
        } catch (e) {
            return { ok: false, names: [], err: String(e && e.message ? e.message : e) };
        }
    },
};