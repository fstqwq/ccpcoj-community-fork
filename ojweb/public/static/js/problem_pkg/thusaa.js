/**
 * 酒井算协 / THU 风格题包（conf.yaml + statement + data/down）解析与 CSGOJ 导入 ZIP 打包。
 * 依赖：global.js、overlay.js、@zip.js、pack_core.js、vendor/sha256、vendor/js-yaml、table_formatters.js（FormatterProParser*）。
 */
(function () {
    "use strict";

    var list_thusaa_problem = [];

    function normText(s) {
        if (s == null) return "";
        return String(s).replace(/^\ufeff/, "").replace(/\r\n/g, "\n").trim();
    }

    async function sha256Hex(data) {
        var u8;
        if (typeof data === "string") {
            u8 = new TextEncoder().encode(data);
        } else if (data instanceof ArrayBuffer) {
            u8 = new Uint8Array(data);
        } else {
            u8 = new Uint8Array(data);
        }
        var subtle = globalThis.crypto && globalThis.crypto.subtle;
        if (subtle && typeof subtle.digest === "function") {
            try {
                var hash = await subtle.digest("SHA-256", u8);
                return Array.from(new Uint8Array(hash))
                    .map(function (b) {
                        return b.toString(16).padStart(2, "0");
                    })
                    .join("");
            } catch (e) {
                console.warn("crypto.subtle.digest failed", e);
            }
        }
        if (typeof globalThis.sha256 === "function") {
            var ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
            return globalThis.sha256(ab);
        }
        throw new Error("SHA-256 unavailable");
    }

    function formatDeterministicAttachFolderFromSha256Hex(hex64) {
        var h = String(hex64 || "")
            .replace(/[^a-fA-F0-9]/g, "")
            .toLowerCase();
        if (h.length < 38) {
            return "poly_" + h.padEnd(64, "0").slice(0, 64);
        }
        var day = h.slice(0, 2) + "-" + h.slice(2, 4) + "-" + h.slice(4, 6);
        var u32 = h.slice(6, 38);
        var u =
            u32.slice(0, 8) +
            "-" +
            u32.slice(8, 12) +
            "-" +
            u32.slice(12, 16) +
            "-" +
            u32.slice(16, 20) +
            "-" +
            u32.slice(20, 32);
        return day + "-" + u;
    }

    function thusaaOverlayOpts(extra) {
        return Object.assign(
            {
                cardWidth: "min(440px, 92vw)",
                overlayProgressSpinnerPolicy: "progress_only",
            },
            extra || {}
        );
    }

    function loadYaml(text) {
        if (!text || !globalThis.jsyaml || typeof globalThis.jsyaml.load !== "function") {
            throw new Error("jsyaml.load unavailable");
        }
        return globalThis.jsyaml.load(text);
    }

    /**
     * 识别「映射键行」行首：缩进 + 键名 + 冒号（与列表项 `- cases:` 区分）。
     */
    function thusaaMappingKeyStart(line) {
        var m = /^(\s*)([^\s:#-][^:\n]*?)\s*:\s*/.exec(line);
        if (!m) return null;
        return { indent: m[1], key: m[2].trim() };
    }

    /**
     * 酒井部分 conf.yaml 存在连续重复键（如两行 users:），PyYAML 能读而 js-yaml 4 报 duplicated mapping key。
     * 去掉每组「连续、同缩进、同名」中的第一行，保留后者（与 last-wins 一致）。
     */
    function stripThusaaYamlDuplicateMappingKeys(text) {
        var lines = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        var out = [];
        for (var i = 0; i < lines.length; i++) {
            var m1 = thusaaMappingKeyStart(lines[i]);
            if (m1 && i + 1 < lines.length) {
                var m2 = thusaaMappingKeyStart(lines[i + 1]);
                if (m2 && m1.indent === m2.indent && m1.key === m2.key) {
                    continue;
                }
            }
            out.push(lines[i]);
        }
        return out.join("\n");
    }

    /**
     * @param {string} ytext
     * @param {string} [pathForLog] zip 内路径，便于控制台排查
     */
    function loadThusaaConfYaml(ytext, pathForLog) {
        var path = pathForLog || "";
        try {
            return loadYaml(ytext);
        } catch (e1) {
            var fixed = stripThusaaYamlDuplicateMappingKeys(ytext);
            if (fixed !== ytext) {
                try {
                    return loadYaml(fixed);
                } catch (e2) {
                    var msg2 = String(e2 && e2.message ? e2.message : e2);
                    if (typeof console !== "undefined" && console.warn) {
                        console.warn(
                            "[thusaa] conf.yaml parse failed after duplicate-key strip:",
                            path || "(unknown)",
                            msg2
                        );
                    }
                    if (typeof console !== "undefined" && console.warn) {
                        console.warn(
                            "[thusaa] conf.yaml snippet (first 1500 chars):",
                            path,
                            "\n" + String(ytext).slice(0, 1500)
                        );
                    }
                    throw e2;
                }
            }
            var msg1 = String(e1 && e1.message ? e1.message : e1);
            if (typeof console !== "undefined" && console.warn) {
                console.warn("[thusaa] conf.yaml parse failed:", path || "(unknown)", msg1);
            }
            if (typeof console !== "undefined" && console.warn) {
                console.warn(
                    "[thusaa] conf.yaml snippet (first 1500 chars):",
                    path,
                    "\n" + String(ytext).slice(0, 1500)
                );
            }
            throw e1;
        }
    }

    function flattenDataCases(dataArr) {
        if (!Array.isArray(dataArr)) return [];
        var out = [];
        for (var i = 0; i < dataArr.length; i++) {
            var block = dataArr[i];
            if (!block || typeof block !== "object") continue;
            var cs = block.cases;
            if (!Array.isArray(cs)) continue;
            for (var j = 0; j < cs.length; j++) {
                out.push(String(cs[j]));
            }
        }
        return out;
    }

    function flattenSampleCases(samplesArr) {
        if (!Array.isArray(samplesArr)) return [];
        var out = [];
        for (var i = 0; i < samplesArr.length; i++) {
            var block = samplesArr[i];
            if (!block || typeof block !== "object") continue;
            var cs = block.cases;
            if (!Array.isArray(cs)) continue;
            for (var j = 0; j < cs.length; j++) {
                out.push(String(cs[j]));
            }
        }
        return out;
    }

    function uniqueOrdered(arr) {
        var seen = new Set();
        var o = [];
        for (var i = 0; i < arr.length; i++) {
            var k = arr[i];
            if (seen.has(k)) continue;
            seen.add(k);
            o.push(k);
        }
        return o;
    }

    function parseThusaaMemoryLimit(s) {
        if (s == null) return 256;
        var m = String(s).match(/(\d+)/);
        if (!m) return 256;
        var n = parseInt(m[1], 10);
        return Number.isNaN(n) ? 256 : n;
    }

    function parseThusaaTimeLimit(conf) {
        var t = conf["time limit"];
        if (t == null) return 1.0;
        var v = parseFloat(String(t));
        return Number.isNaN(v) ? 1.0 : v;
    }

    function thusaaTitle(conf) {
        var t = conf.title;
        if (typeof t === "string") return normText(t);
        if (t && typeof t === "object") {
            return normText(
                t["zh-cn"] || t["zh_cn"] || t.en || t["en"] || Object.values(t)[0]
            );
        }
        return "";
    }

    /** 进度条摘要：题目标题前若干字（Unicode 码位），最多 5 个；非题面描述。 */
    function thusaaTitleBriefForOverlay(title) {
        var t = normText(title);
        if (!t) return "";
        var chars = Array.from(t);
        return chars.slice(0, 5).join("");
    }

    function isThusaaProblemYaml(y) {
        if (!y || typeof y !== "object") return false;
        if (y.folder === "contest") return false;
        var dataArr = y.data;
        if (!Array.isArray(dataArr)) return false;
        for (var i = 0; i < dataArr.length; i++) {
            var d = dataArr[i];
            if (d && Array.isArray(d.cases) && d.cases.length) return true;
        }
        return false;
    }

    function confDirPrefixFromPath(filename) {
        var n = filename.replace(/\\/g, "/");
        var lower = n.toLowerCase();
        if (!lower.endsWith("/conf.yaml") && lower !== "conf.yaml") return null;
        if (lower === "conf.yaml") return "";
        return n.slice(0, -"/conf.yaml".length);
    }

    function indexOfAny(md, candidates) {
        var best = -1;
        for (var i = 0; i < candidates.length; i++) {
            var ix = md.indexOf(candidates[i]);
            if (ix >= 0 && (best < 0 || ix < best)) best = ix;
        }
        return best;
    }

    /**
     * 题面：替换 img 宏，按酒井模板切 description/input/output/hint；失败时整段落入 description。
     */
    function parseThusaaStatement(mdContent, attachFolder) {
        var md = String(mdContent || "").replace(/^\ufeff/, "").replace(/\r\n/g, "\n");
        if (attachFolder) {
            md = md.replace(
                /\{\{\s*img\(\s*'([^']*)'[^}]*\}\}/g,
                function (_, fn) {
                    return "![](/upload/problem_attach/" + attachFolder + "/" + fn + ")";
                }
            );
            md = md.replace(
                /\{\{\s*img\(\s*"([^"]*)"[^}]*\}\}/g,
                function (_, fn) {
                    return "![](/upload/problem_attach/" + attachFolder + "/" + fn + ")";
                }
            );
        }
        md = md.replace(/^\{\{\s*self\.title\(\)\s*\}\}\s*\n*/m, "");

        var d0 = indexOfAny(md, ["{{ s('description') }}", '{{ s("description") }}']);
        var i0 = indexOfAny(md, ["{{ s('input format') }}", '{{ s("input format") }}']);
        var i1 = indexOfAny(md, ["{{ self.input_file() }}", "{{ self.input_file() }}"]);
        var o0 = indexOfAny(md, ["{{ s('output format') }}", '{{ s("output format") }}']);
        var o1 = indexOfAny(md, ["{{ self.output_file() }}", "{{ self.output_file() }}"]);
        var sampleIdx = indexOfAny(md, ["{{ s('sample',", '{{ s("sample",']);
        var hint0 = indexOfAny(md, [
            "{{ self.title_sample_description() }}",
            "{{self.title_sample_description()}}",
        ]);

        var description_md = "";
        var input_md = "";
        var output_md = "";
        var hint_md = "";
        if (d0 >= 0 && i0 > d0 && i1 > i0 && o0 > i1 && o1 > o0) {
            description_md = normText(
                md
                    .slice(d0, i0)
                    .replace(/\{\{\s*s\(['"]description['"]\)\s*\}\}/g, "")
                    .trim()
            );
            input_md = normText(
                md
                    .slice(i1, o0)
                    .replace(/\{\{\s*self\.input_file\(\)\s*\}\}/g, "")
                    .trim()
            );
            var outEnd = sampleIdx >= 0 ? sampleIdx : md.length;
            output_md = normText(
                md
                    .slice(o1, outEnd)
                    .replace(/\{\{\s*self\.output_file\(\)\s*\}\}/g, "")
                    .trim()
            );
            if (hint0 >= 0) {
                hint_md = normText(
                    md
                        .slice(hint0)
                        .replace(/\{\{\s*self\.title_sample_description\(\)\s*\}\}/g, "")
                        .trim()
                );
            }
        } else {
            description_md = normText(md) || "-";
        }
        return { description_md: description_md, input_md: input_md, output_md: output_md, hint_md: hint_md };
    }

    function findStatementEntry(entries, prefix) {
        var base = prefix ? prefix + "/statement/" : "statement/";
        var candidates = [
            base + "zh-cn.md",
            base + "zh-cn.MD",
            base + "zh_cn.md",
            base + "en.md",
            base + "en.MD",
        ];
        for (var i = 0; i < candidates.length; i++) {
            var p = candidates[i];
            var e = entries.find(function (x) {
                return !x.directory && x.filename === p;
            });
            if (e) return { entry: e, rel: p.slice(base.length) };
        }
        var pref = prefix ? prefix + "/statement/" : "statement/";
        var found = entries.filter(function (e) {
            return (
                !e.directory &&
                e.filename.startsWith(pref) &&
                /\.md$/i.test(e.filename)
            );
        });
        found.sort(function (a, b) {
            return a.filename.localeCompare(b.filename);
        });
        if (found.length) {
            return {
                entry: found[0],
                rel: found[0].filename.slice(pref.length),
            };
        }
        return null;
    }

    function findCheckerEntry(entries, prefix) {
        var dp = (prefix ? prefix + "/" : "") + "data/";
        var names = ["chk.cpp", "check.cpp", "checker.cpp", "chk"];
        for (var i = 0; i < names.length; i++) {
            var e = entries.find(function (x) {
                return !x.directory && x.filename === dp + names[i];
            });
            if (e) return e;
        }
        return null;
    }

    function defaultSpjFromChecker(checkerEntry) {
        return checkerEntry ? "1" : "0";
    }

    async function computeThusaaAttachFingerprint(prefix, conf, stmtText, stmtRel) {
        var lines = [
            "thusaa_fp1",
            normText(prefix),
            normText(JSON.stringify(conf).slice(0, 8000)),
            normText(stmtRel),
            normText(stmtText).slice(0, 12000),
        ];
        var h = await sha256Hex(lines.join("\n"));
        return formatDeterministicAttachFolderFromSha256Hex(h);
    }

    function filterEntriesForPrefix(allEntries, prefix) {
        if (!normText(prefix)) return allEntries.slice();
        var p = prefix + "/";
        return allEntries.filter(function (e) {
            return e.filename === prefix || e.filename.startsWith(p);
        });
    }

    function summarizeThusaaPack(entries, prefix, conf, spjType) {
        var cases = uniqueOrdered(flattenDataCases(conf.data));
        var dp = (prefix ? prefix + "/" : "") + "data/";
        var names = [];
        var fileCount = 0;
        var totalSize = 0;
        for (var i = 0; i < cases.length; i++) {
            var id = cases[i];
            var inPath = dp + id + ".in";
            var ansPath = dp + id + ".ans";
            var inE = entries.find(function (e) {
                return e.filename === inPath;
            });
            var ansE = entries.find(function (e) {
                return e.filename === ansPath;
            });
            if (inE && ansE) {
                names.push(id + ".in", id + ".out");
                fileCount++;
                totalSize +=
                    (Number(inE.uncompressedSize) || 0) +
                    (Number(ansE.uncompressedSize) || 0);
            }
        }
        if (String(spjType) === "1") {
            var ch = findCheckerEntry(entries, prefix);
            if (ch) {
                names.push("tpj.cc");
                totalSize += Number(ch.uncompressedSize) || 0;
            }
        }
        return { fileCount: fileCount, totalSize: totalSize, packedFileNames: names };
    }

    async function collectThusaaResourceBlobs(entries, prefix) {
        var rp = (prefix ? prefix + "/" : "") + "resources/";
        var out = [];
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e.directory) continue;
            if (!e.filename.startsWith(rp)) continue;
            var leaf = e.filename.slice(rp.length);
            if (!leaf || leaf.indexOf("/") >= 0) continue;
            var blob = await e.getData(new zip.BlobWriter());
            out.push({ filename: leaf, content: blob });
        }
        return out;
    }

    async function makeThusaaTestDataZip(title, entries, prefix, conf, spjType, tipInfo, abortSignal) {
        var zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
        var cases = uniqueOrdered(flattenDataCases(conf.data));
        var dp = (prefix ? prefix + "/" : "") + "data/";
        var fileCount = 0;
        var totalSize = 0;
        var packedFileNames = [];
        /** 与内层 zip 一致，供外层导入包直接写入，避免重复解压（与 Polygon MakeTestData 对齐） */
        var packedBlobs = [];
        var stageSub =
            tipInfo === "Packing"
                ? {
                      subtitle: "正在读取并打包测例文件",
                      subtitle_en: "Reading and packing test files",
                  }
                : {
                      subtitle: "正在读取测例文件",
                      subtitle_en: "Reading test files",
                  };

        for (var i = 0; i < cases.length; i++) {
            if (typeof window.overlayThrowIfAborted === "function") {
                window.overlayThrowIfAborted(abortSignal);
            }
            var id = cases[i];
            var inPath = dp + id + ".in";
            var ansPath = dp + id + ".ans";
            var inEnt = entries.find(function (e) {
                return e.filename === inPath;
            });
            var ansEnt = entries.find(function (e) {
                return e.filename === ansPath;
            });
            if (inEnt && ansEnt) {
                var titleBrief = thusaaTitleBriefForOverlay(title);
                var detailCn = titleBrief ? "「" + titleBrief + "」 " + inPath : inPath;
                var detailEn = titleBrief ? '"' + titleBrief + '" ' + inPath : inPath;
                updateOverlay(
                    thusaaOverlayOpts(
                        Object.assign({}, stageSub, {
                            message: "正在处理酒井算协题包…",
                            message_en: "Parsing THUSAAC package…",
                            detail: detailCn,
                            detail_en: detailEn,
                        })
                    ),
                    null
                );
                var inBlob = await inEnt.getData(new zip.BlobWriter());
                var outBlob = await ansEnt.getData(new zip.BlobWriter());
                totalSize += inBlob.size + outBlob.size;
                await zipWriter.add(id + ".in", new zip.BlobReader(inBlob));
                await zipWriter.add(id + ".out", new zip.BlobReader(outBlob));
                packedFileNames.push(id + ".in", id + ".out");
                packedBlobs.push({ name: id + ".in", blob: inBlob });
                packedBlobs.push({ name: id + ".out", blob: outBlob });
                fileCount++;
            }
        }

        if (typeof window.overlayThrowIfAborted === "function") {
            window.overlayThrowIfAborted(abortSignal);
        }
        if (String(spjType) === "1") {
            var spjEnt = findCheckerEntry(entries, prefix);
            if (spjEnt) {
                var spjBlob = await spjEnt.getData(new zip.BlobWriter());
                await zipWriter.add("tpj.cc", new zip.BlobReader(spjBlob));
                packedFileNames.push("tpj.cc");
                packedBlobs.push({ name: "tpj.cc", blob: spjBlob });
                totalSize += spjBlob.size;
            } else if (typeof alerty !== "undefined") {
                alerty.warn(
                    "题目「" + title + "」未找到 chk.cpp / check.cpp（特判）",
                    'Problem "' + title + '" has no chk.cpp / check.cpp (special judge)'
                );
            }
        } else if (String(spjType) === "2" && typeof alerty !== "undefined") {
            alerty.warn(
                "酒井算协包通常不含交互评测 interactor；请改评测类型或换题包",
                "THUSAAC packages rarely include interactors; change judge type or use another package"
            );
        }

        var zipContent = await zipWriter.close();
        return {
            zipContent: zipContent,
            packedBlobs: packedBlobs,
            fileCount: fileCount,
            totalSize: totalSize,
            packedFileNames: packedFileNames,
            entries: entries,
            problem_prefix: prefix,
            conf: conf,
        };
    }

    async function ensureThusaaTestDataZip(problemRec, tipInfo, abortSignal) {
        var td = problemRec && problemRec.testData;
        if (!td) throw new Error("ensureThusaaTestDataZip: missing testData");
        if (td.zipContent) return td;
        if (td._materializePromise) return td._materializePromise;
        var spjType = String(problemRec.spjType || problemRec.spj || "0");
        td._materializePromise = (async function () {
            try {
                var fresh = await makeThusaaTestDataZip(
                    problemRec.problemJson.title,
                    td.entries,
                    td.problem_prefix,
                    td.conf,
                    spjType,
                    tipInfo || "Packing",
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

    function _guessThusaaLang(filename) {
        var f = String(filename || "").toLowerCase();
        if (f.endsWith(".py")) return 6;
        if (f.endsWith(".java")) return 3;
        if (f.endsWith(".c") && !f.endsWith(".cc")) return 0;
        return 1;
    }

    var _THUSAA_STD_RE = /(?:^|\/)(std\.(cpp|cc|c|py|java)|std)$/i;
    var _THUSAA_SKIP_DIRS = /\/(data|down|statement|solution)\//i;

    async function _extractThusaaSolutions(allEntries, prefix, title, checkerEntry) {
        var solutions = [];
        var checkerPath = checkerEntry ? checkerEntry.filename : null;
        var base = prefix ? prefix + "/" : "";
        for (var i = 0; i < allEntries.length; i++) {
            var e = allEntries[i];
            if (e.directory) continue;
            var fn = e.filename;
            if (!fn.startsWith(base)) continue;
            var rel = fn.slice(base.length);
            if (_THUSAA_SKIP_DIRS.test("/" + rel)) continue;
            if (!_THUSAA_STD_RE.test(rel)) continue;
            if (checkerPath && fn === checkerPath) continue;
            try {
                var code = await e.getData(new zip.TextWriter());
                if (!code || !code.trim()) continue;
                var lang = _guessThusaaLang(fn);
                var langName = ({0:"C",1:"C++",3:"Java",6:"Python3"})[lang] || "Unknown";
                var header = lang === 6
                    ? "# [THUSAA] " + title + "\n# Tag: main (std) | Language: " + langName + " | File: " + rel + "\n#\n"
                    : "/*\n * [THUSAA] " + title + "\n * Tag: main (std) | Language: " + langName + " | File: " + rel + "\n */\n";
                solutions.push({
                    source: header + code,
                    language: lang,
                    result: 4,
                    result_tag: "AC",
                });
            } catch (ex) {
                console.warn("thusaa solution read fail", fn, ex);
            }
        }
        return solutions;
    }

    /**
     * 从解析的 statement 和 conf.yaml 推断 locale_key。
     * 优先用 statement 文件名（如 zh-cn.md → "zh-cn"），否则回退到 "main"。
     */
    function inferThusaaLocaleKey(stmtRel) {
        if (stmtRel) {
            var key = stmtRel.replace(/\.md$/i, "").trim();
            if (key && /^[A-Za-z0-9_-]{1,64}$/.test(key)) return key;
        }
        return "main";
    }

    function inferThusaaLocaleLabel(localeKey) {
        var lower = (localeKey || "").toLowerCase();
        if (lower === "zh-cn" || lower === "zh_cn" || lower === "zh-hans") return "简体中文";
        if (lower === "zh-tw" || lower === "zh_tw" || lower === "zh-hant") return "繁體中文";
        if (lower === "en" || lower.startsWith("en-") || lower.startsWith("en_")) return "English";
        if (lower === "main") return "Default";
        return localeKey || "";
    }

    async function buildThusaaProblemRow(allEntries, prefix, conf) {
        var scoped = filterEntriesForPrefix(allEntries, prefix);
        var checkerEntry = findCheckerEntry(allEntries, prefix);
        var spjType = defaultSpjFromChecker(checkerEntry);

        var stmt = findStatementEntry(allEntries, prefix);
        var stmtText = "";
        var stmtRel = "";
        if (stmt && stmt.entry) {
            try {
                stmtText = await stmt.entry.getData(new zip.TextWriter());
            } catch (e) {
                console.warn("statement read fail", e);
            }
            stmtRel = stmt.rel || "";
        }

        var attach = await computeThusaaAttachFingerprint(prefix, conf, stmtText, stmtRel);
        var parsed = parseThusaaStatement(stmtText, attach);

        var sampleIds = uniqueOrdered(flattenSampleCases(conf.samples));
        var downp = (prefix ? prefix + "/" : "") + "down/";
        var sampleTests = [];
        for (var si = 0; si < sampleIds.length; si++) {
            var sid = sampleIds[si];
            var pIn = downp + sid + ".in";
            var pAns = downp + sid + ".ans";
            var eIn = allEntries.find(function (e) {
                return e.filename === pIn;
            });
            var eAns = allEntries.find(function (e) {
                return e.filename === pAns;
            });
            if (eIn && eAns) {
                try {
                    var tin = normText(await eIn.getData(new zip.TextWriter()));
                    var tout = normText(await eAns.getData(new zip.TextWriter()));
                    sampleTests.push({ input: tin, output: tout });
                } catch (e) {
                    console.warn("sample read fail", sid, e);
                }
            }
        }

        var title = thusaaTitle(conf) || prefix.split("/").pop() || "（未命名题）";
        var memMb = parseThusaaMemoryLimit(conf["memory limit"]);
        var tl = parseThusaaTimeLimit(conf);

        var localeKey = inferThusaaLocaleKey(stmtRel);
        var localeLabel = inferThusaaLocaleLabel(localeKey);

        var problemLocales = [{
            locale_key: localeKey,
            sort_order: 1,
            locale_label: localeLabel,
            use_pdf: 0,
            locale_visible: 1,
            description: parsed.description_md || "-",
            input: parsed.input_md || "-",
            output: parsed.output_md || "-",
            hint: parsed.hint_md || "",
            source: "",
            author: "",
        }];

        var problemJson = {
            accepted: 0,
            attach: attach,
            author: "",
            author_md: "",
            description: "",
            description_md: parsed.description_md || "-",
            hint: "",
            hint_md: parsed.hint_md || "",
            in_date: CsgAppWallNaiveSqlNow(),
            input: "",
            input_md: parsed.input_md || "-",
            output: "",
            output_md: parsed.output_md || "-",
            memory_limit: memMb,
            problem_id: 0,
            problem_new_id: 0,
            sample_input: JSON.stringify({
                data_type: "json",
                data: sampleTests.map(function (t) {
                    return (t.input || "").replace(/\r\n/g, "\n");
                }),
            }),
            sample_output: JSON.stringify({
                data_type: "json",
                data: sampleTests.map(function (t) {
                    return (t.output || "").replace(/\r\n/g, "\n");
                }),
            }),
            solved: 0,
            source: "",
            source_md: "",
            spj: spjType,
            submit: 0,
            time_limit: tl,
            title: title,
            problem_locales: problemLocales,
        };

        var sum0 = summarizeThusaaPack(scoped, prefix, conf, spjType);
        var totalSizeMB = sum0.totalSize / (1024 * 1024);
        if (totalSizeMB < 0.01) totalSizeMB = Number(totalSizeMB.toFixed(4));
        else if (totalSizeMB < 0.1) totalSizeMB = Number(totalSizeMB.toFixed(3));
        else totalSizeMB = Number(totalSizeMB.toFixed(2));

        var pkg_lang_count = stmt && stmtText.trim() ? 1 : 0;
        var pkg_lang_list = stmtRel ? [stmtRel.replace(/\.md$/i, "")] : [];

        var testData = {
            kind: "thusaa",
            entries: scoped,
            problem_prefix: prefix,
            conf: conf,
            checkerEntry: checkerEntry,
            fileCount: sum0.fileCount,
            totalSize: sum0.totalSize,
            packedFileNames: sum0.packedFileNames,
            zipContent: null,
            _materializePromise: null,
        };

        var thusaaSolutions = [];
        try {
            thusaaSolutions = await _extractThusaaSolutions(allEntries, prefix, title, checkerEntry);
        } catch (e) {
            console.warn("thusaa solution extraction failed", e);
        }

        return {
            __pkg_source: "thusaa",
            title: title,
            testdata: sum0.fileCount + " tests, " + totalSizeMB + " MB",
            td_file_count: sum0.fileCount,
            td_size_label: totalSizeMB + " MB",
            td_packed_names: sum0.packedFileNames,
            spj: spjType,
            spjType: spjType,
            hash: attach,
            problemJson: problemJson,
            testData: testData,
            pkg_no_statement: !stmtText.trim(),
            pkg_langs: pkg_lang_count ? pkg_lang_list.join(", ") : "—",
            pkg_lang_list: pkg_lang_list,
            pkg_lang_count: pkg_lang_count,
            thusaaSolutions: thusaaSolutions,
        };
    }

    async function HandleThusaaZipFile(file) {
        showOverlay(
            thusaaOverlayOpts({
                message: "正在解析酒井算协题包…",
                message_en: "Parsing THUSAAC / Jiujing package…",
                progressMode: "hidden",
            })
        );
        list_thusaa_problem.length = 0;
        var warnings = [];
        try {
            var zipReader = new zip.ZipReader(new zip.BlobReader(file));
            var entries = await zipReader.getEntries();
            var confPaths = [];
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                if (e.directory) continue;
                var pref = confDirPrefixFromPath(e.filename);
                if (pref === null) continue;
                confPaths.push({ entry: e, prefix: pref });
            }

            var jobs = [];
            for (var j = 0; j < confPaths.length; j++) {
                var item = confPaths[j];
                updateOverlay(
                    thusaaOverlayOpts({
                        message: "正在扫描 conf.yaml…",
                        message_en: "Scanning conf.yaml…",
                        detail: item.entry.filename,
                    }),
                    null
                );
                var ytext;
                try {
                    ytext = await item.entry.getData(new zip.TextWriter());
                } catch (e2) {
                    continue;
                }
                var y;
                try {
                    y = loadThusaaConfYaml(ytext, item.entry.filename);
                } catch (e3) {
                    var errDetail = String(e3 && e3.message ? e3.message : e3);
                    if (typeof console !== "undefined" && console.warn) {
                        console.warn(
                            "[thusaa] skip conf (YAML):",
                            item.entry.filename,
                            errDetail
                        );
                    }
                    warnings.push(item.entry.filename + ": YAML 解析失败");
                    continue;
                }
                if (!isThusaaProblemYaml(y)) continue;
                jobs.push({ prefix: item.prefix, conf: y });
            }

            jobs.sort(function (a, b) {
                return a.prefix.localeCompare(b.prefix);
            });

            for (var k = 0; k < jobs.length; k++) {
                updateOverlay(
                    thusaaOverlayOpts({
                        message: "正在解析题目 " + (k + 1) + " / " + jobs.length + "…",
                        message_en: "Parsing problem " + (k + 1) + " / " + jobs.length + "…",
                        detail: jobs[k].prefix,
                    }),
                    null
                );
                try {
                    var row = await buildThusaaProblemRow(entries, jobs[k].prefix, jobs[k].conf);
                    list_thusaa_problem.push(row);
                } catch (e4) {
                    console.error(e4);
                    warnings.push(jobs[k].prefix + ": " + (e4.message || String(e4)));
                }
            }

            await zipReader.close();

            for (var ii = 0; ii < list_thusaa_problem.length; ii++) {
                list_thusaa_problem[ii].idx = ii + 1;
            }

            if (!list_thusaa_problem.length) {
                if (typeof alerty !== "undefined") {
                    alerty.error(
                        "未识别到酒井算协题目（需含带 data.cases 的 conf.yaml，且非 contest 根配置）",
                        "No Jiujing-style problems found (need conf.yaml with data.cases, not contest root)"
                    );
                }
            } else if (warnings.length && typeof alerty !== "undefined") {
                alerty.warn(
                    "部分路径已跳过：\n" + warnings.slice(0, 8).join("\n"),
                    "Some paths skipped:\n" + warnings.slice(0, 8).join("\n")
                );
            }

            var noStmt = list_thusaa_problem.filter(function (r) {
                return r.pkg_no_statement;
            }).length;
            var noData = list_thusaa_problem.filter(function (r) {
                return !r.td_file_count;
            }).length;
            if ((noStmt || noData) && typeof alerty !== "undefined") {
                alerty.warn(
                    (noStmt ? noStmt + " 道题缺少可读 statement。" : "") +
                        (noData ? (noStmt ? " " : "") + noData + " 道题未找到成对 data/*.in + *.ans。" : ""),
                    (noStmt ? noStmt + " problem(s) lack statement. " : "") +
                        (noData ? noData + " problem(s) have no data/*.in+.ans pairs." : "")
                );
            }

            return list_thusaa_problem.map(function (r) {
                return Object.assign({}, r);
            });
        } catch (err) {
            console.error(err);
            if (typeof alerty !== "undefined") {
                alerty.error(String(err.message || err), String(err.message || err));
            }
            return [];
        } finally {
            hideOverlay();
        }
    }

    async function DownloadThusaaPro(pid) {
        var problem = list_thusaa_problem.find(function (p) {
            return String(p.idx) === String(pid);
        });
        if (!problem) return;
        problem.problemJson.spj = String(problem.spjType || problem.spj || "0");
        problem.problemJson.problem_new_id = 1;

        var zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
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

        var resources = await collectThusaaResourceBlobs(
            problem.testData.entries,
            problem.testData.problem_prefix
        );
        var attachDir =
            window.ProblemPkg && window.ProblemPkg.packCore
                ? window.ProblemPkg.packCore.attachDirForIndex(1)
                : "ATTACH_" + String(1).padStart(5, "0");
        for (var i = 0; i < resources.length; i++) {
            var f = resources[i];
            await zipWriter.add(attachDir + "/" + f.filename, new zip.BlobReader(f.content));
        }

        var pc = window.ProblemPkg && window.ProblemPkg.packCore;
        var td = await ensureThusaaTestDataZip(problem, "Packing");
        if (pc && td && ((td.packedBlobs && td.packedBlobs.length) || td.zipContent)) {
            await pc.appendTestDataDirToZipWriter(zipWriter, pc.testDirForIndex(1), td, null);
        }

        var zipContent = await zipWriter.close();
        var url = URL.createObjectURL(zipContent);
        var a = document.createElement("a");
        a.href = url;
        var pcDn = window.ProblemPkg && window.ProblemPkg.packCore;
        a.download =
            pcDn && typeof pcDn.buildOjProblemPackFilename === "function"
                ? pcDn.buildOjProblemPackFilename("thusaa", "p" + pid)
                : pid + ".zip";
        a.click();
        URL.revokeObjectURL(url);
    }

    async function DownloadThusaaTestData(pid) {
        var problem = list_thusaa_problem.find(function (p) {
            return String(p.idx) === String(pid);
        });
        if (!problem) return;
        var testData = await ensureThusaaTestDataZip(problem, "Packing");
        if (testData && testData.zipContent) {
            var url = URL.createObjectURL(testData.zipContent);
            var a = document.createElement("a");
            var suffix = "";
            var spjType = String(problem.spjType || problem.spj || "0");
            if (spjType === "1") suffix = "_with_tpj";
            else if (spjType === "2") suffix = "_interactive";
            var pcTd = window.ProblemPkg && window.ProblemPkg.packCore;
            var infoTd = "p" + pid + "-testdata";
            if (spjType === "1") infoTd += "-tpj";
            else if (spjType === "2") infoTd += "-interactive";
            a.download =
                pcTd && typeof pcTd.buildOjProblemPackFilename === "function"
                    ? pcTd.buildOjProblemPackFilename("thusaa", infoTd)
                    : pid + suffix + ".zip";
            a.href = url;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    function handleThusaaDownloadTestData(pid) {
        showOverlay(
            thusaaOverlayOpts({
                message: "正在生成测试数据压缩包…",
                message_en: "Building test data archive…",
                progressMode: "indeterminate",
            })
        );
        DownloadThusaaTestData(pid)
            .catch(function (err) {
                console.error(err);
            })
            .finally(function () {
                hideOverlay();
            });
    }

    async function BuildSelectedThusaaProblemsZipBlob(tableSelector, abortSignal) {
        var sel = tableSelector || "#thusaa_parse_table";
        var selectedProblems = $(sel).bootstrapTable("getSelections");
        var pc = window.ProblemPkg && window.ProblemPkg.packCore;
        if (!pc || typeof pc.buildImportZipFromProblems !== "function") {
            throw new Error("ProblemPkg.packCore.buildImportZipFromProblems missing");
        }
        return pc.buildImportZipFromProblems({
            selectedProblems: selectedProblems,
            abortSignal: abortSignal || null,
            materializeTestData: function (p, tip, sig) {
                return ensureThusaaTestDataZip(p, tip, sig);
            },
            addAttachments: async function (zipWriter, attachDir, problem) {
                if (typeof window.overlayThrowIfAborted === "function") {
                    window.overlayThrowIfAborted(abortSignal);
                }
                var resources = await collectThusaaResourceBlobs(
                    problem.testData.entries,
                    problem.testData.problem_prefix
                );
                for (var r = 0; r < resources.length; r++) {
                    if (typeof window.overlayThrowIfAborted === "function") {
                        window.overlayThrowIfAborted(abortSignal);
                    }
                    await zipWriter.add(
                        attachDir + "/" + resources[r].filename,
                        new zip.BlobReader(resources[r].content)
                    );
                }
            },
            onProgress: function (ctx) {
                if (ctx.phase === "file") {
                    var headline = String(ctx.problemTitle || "").trim();
                    var file = String(ctx.detail || "").trim();
                    var sz =
                        pc.zipEntrySizeOverlaySuffix &&
                        typeof pc.zipEntrySizeOverlaySuffix === "function"
                            ? pc.zipEntrySizeOverlaySuffix(
                                  ctx.uncompressedSize,
                                  ctx.compressedSize
                              )
                            : { cn: "", en: "" };
                    var detailCn = headline
                        ? "第 " +
                          ctx.problemIndex +
                          "/" +
                          ctx.problemTotal +
                          " 题「" +
                          headline +
                          "」· " +
                          file +
                          (sz.cn || "")
                        : file + (sz.cn || "");
                    var detailEn = headline
                        ? "Problem " +
                          ctx.problemIndex +
                          "/" +
                          ctx.problemTotal +
                          ' "' +
                          headline +
                          '" · ' +
                          file +
                          (sz.en || "")
                        : file + (sz.en || "");
                    updateOverlay(
                        thusaaOverlayOpts({
                            message:
                                "正在打包…（" + ctx.problemIndex + "/" + ctx.problemTotal + " 道题）",
                            message_en:
                                "Packing… (" + ctx.problemIndex + "/" + ctx.problemTotal + " problem(s))",
                            subtitle: "正在写入测例文件",
                            subtitle_en: "Writing test files",
                            detail: detailCn,
                            detail_en: detailEn,
                        }),
                        null
                    );
                } else if (ctx.phase === "problem_done") {
                    updateOverlay(
                        thusaaOverlayOpts({
                            message:
                                "正在打包…（已完成 " +
                                ctx.problemIndex +
                                "/" +
                                ctx.problemTotal +
                                " 道题）",
                            message_en:
                                "Packing… (" +
                                ctx.problemIndex +
                                "/" +
                                ctx.problemTotal +
                                " problem(s) done)",
                            subtitle: "",
                            subtitle_en: "",
                            detail: "",
                        }),
                        null
                    );
                }
            },
            packKind: "thusaa",
        });
    }

    async function DownloadSelectedThusaaProblems() {
        var ac = new AbortController();
        showOverlay(
            thusaaOverlayOpts({
                message: "正在打包所选题目…",
                message_en: "Packing selected problems…",
                progressMode: "indeterminate",
                cancelable: true,
                cancelLabel: "取消",
                cancelLabel_en: "Cancel",
                abortController: ac,
            })
        );
        try {
            var packed = await BuildSelectedThusaaProblemsZipBlob("#thusaa_parse_table", ac.signal);
            if (!packed) {
                if (typeof alerty !== "undefined") {
                    alerty.error("至少需要选择一个题目", "At least one problem should be selected");
                }
                return;
            }
            var url = URL.createObjectURL(packed.blob);
            var a = document.createElement("a");
            a.href = url;
            a.download = packed.defaultName;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            if (e && e.name === "AbortError") {
                return;
            }
            console.error(e);
        } finally {
            hideOverlay();
        }
    }

    window.HandleThusaaZipFile = HandleThusaaZipFile;
    window.list_thusaa_problem = list_thusaa_problem;
    window.DownloadThusaaPro = DownloadThusaaPro;
    window.handleThusaaDownloadTestData = handleThusaaDownloadTestData;
    window.BuildSelectedThusaaProblemsZipBlob = BuildSelectedThusaaProblemsZipBlob;
    window.DownloadSelectedThusaaProblems = DownloadSelectedThusaaProblems;

    window.ThusaaConvertUi = {
        fetchTestdataPackedNamesForPid: async function (pid) {
            var problem = list_thusaa_problem.find(function (p) {
                return String(p.idx) === String(pid);
            });
            if (!problem || !problem.testData) {
                return { ok: false, names: [], err: "not_found" };
            }
            try {
                var spj = String(problem.spjType || problem.spj || "0");
                var sum = summarizeThusaaPack(
                    problem.testData.entries,
                    problem.testData.problem_prefix,
                    problem.testData.conf,
                    spj
                );
                return { ok: true, names: sum.packedFileNames || [] };
            } catch (e) {
                return { ok: false, names: [], err: String(e && e.message ? e.message : e) };
            }
        },
    };

    window.ProblemPkg = window.ProblemPkg || {};
    window.ProblemPkg.thusaa = {
        ready: true,
        source: "thusaa",
        list: list_thusaa_problem,
    };
})();
