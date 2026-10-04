/**
 * 题包转换 — CSGOJ 导入 ZIP 构建共用逻辑（Polygon / 酒井算协）。
 * 依赖：全局 zip（js_zip）、ProblemPkg 命名空间。
 *
 * 优化要点：
 * - testData 同时保留 zipContent（下载测例 / 兼容）与 packedBlobs（避免重复解压内层 zip）
 * - 切换 spj 时须调用 invalidateTestDataMaterialization
 */
(function () {
    "use strict";

    var ProblemPkg = (window.ProblemPkg = window.ProblemPkg || {});
    var packCore = {};

    /** @param {string} s */
    function sanitizeZipNameSegment(s, maxLen) {
        var m = typeof maxLen === "number" && maxLen > 0 ? maxLen : 96;
        var t = String(s == null ? "" : s)
            .trim()
            .replace(/[^A-Za-z0-9_.-]+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^[._-]+|[._-]+$/g, "");
        if (!t) {
            t = "x";
        }
        if (t.length > m) {
            t = t.slice(0, m);
        }
        return t;
    }

    async function appendExportTimezoneSidecarZipWriter(writer) {
        var tz = CsgRequireAppTimezoneForWireExport();
        await writer.add(
            "csg_export_timezone.json",
            new zip.TextReader(JSON.stringify({ iana: tz, schema: 1 }))
        );
    }

    function problemPackUsernameSegment() {
        try {
            var raw =
                typeof window !== "undefined" && window.PROBLEM_PKG_USERNAME != null
                    ? String(window.PROBLEM_PKG_USERNAME)
                    : "";
            var seg = sanitizeZipNameSegment(raw, 40);
            return seg || "guest";
        } catch (e) {
            return "guest";
        }
    }

    /**
     * OJ-Problem-{kind}-{info}-{user}{YYYYMMDDHHmmss}.zip（时间与用户名无分隔）
     * @param {"polygon"|"thusaa"|"csgoj"} kind
     * @param {string} infoSegment 题量/题标识等
     */
    function buildOjProblemPackFilename(kind, infoSegment) {
        var k = String(kind || "")
            .trim()
            .toLowerCase();
        if (k !== "csgoj" && k !== "polygon" && k !== "thusaa") {
            k = "polygon";
        }
        var info = sanitizeZipNameSegment(infoSegment, 80) || "pack";
        var userSeg = problemPackUsernameSegment();
        var d = new Date();
        function pad(n) {
            return String(n).length < 2 ? "0" + n : String(n);
        }
        var ts =
            "" +
            d.getFullYear() +
            pad(d.getMonth() + 1) +
            pad(d.getDate()) +
            pad(d.getHours()) +
            pad(d.getMinutes()) +
            pad(d.getSeconds());
        return "OJ-Problem-" + k + "-" + info + "-" + userSeg + ts + ".zip";
    }

    function throwIfAborted(signal) {
        if (typeof window.overlayThrowIfAborted === "function") {
            window.overlayThrowIfAborted(signal);
        } else if (signal && signal.aborted) {
            throw new DOMException("Cancelled", "AbortError");
        }
    }

    /** 打包进度 overlay「第 n/m 题」中引号内摘要：题目标题（表格 title / problemJson.title），非题面描述 */
    var PACK_PROGRESS_TITLE_BRIEF_MAX_UNITS = 5;

    function problemPackProgressTitleText(problem) {
        if (problem && problem.title != null && String(problem.title).trim()) {
            return String(problem.title).trim();
        }
        if (problem && problem.problemJson && problem.problemJson.title != null) {
            return String(problem.problemJson.title).trim();
        }
        return "";
    }

    /**
     * 题目标题短摘要（Unicode 码位），与酒井测例打包 overlay 一致；不用 description。
     * @param {object} problem
     * @param {number} [maxUnits]
     */
    function titleBriefForPackProgress(problem, maxUnits) {
        var n =
            typeof maxUnits === "number" && isFinite(maxUnits) && maxUnits > 0
                ? Math.floor(maxUnits)
                : PACK_PROGRESS_TITLE_BRIEF_MAX_UNITS;
        var s = problemPackProgressTitleText(problem);
        if (!s) return "";
        return Array.from(s).slice(0, n).join("");
    }

    /** @param {number} bytes */
    function formatBytesForProgress(bytes) {
        if (typeof bytes !== "number" || !isFinite(bytes) || bytes < 0) {
            return "";
        }
        if (bytes < 1024) {
            return String(Math.round(bytes)) + " B";
        }
        if (bytes < 1048576) {
            return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
        }
        if (bytes < 1073741824) {
            return (bytes / 1048576).toFixed(bytes < 10485760 ? 2 : 1) + " MB";
        }
        return (bytes / 1073741824).toFixed(2) + " GB";
    }

    /**
     * 测例写入 zip 后用于 overlay 的中英文字段（原始大小 / 压缩后占用）。
     * @param {number|undefined} uncompressedSize
     * @param {number|undefined} compressedSize
     * @returns {{ cn: string, en: string }}
     */
    function zipEntrySizeOverlaySuffix(uncompressedSize, compressedSize) {
        var u = Number(uncompressedSize);
        var c = Number(compressedSize);
        if (!isFinite(u) || !isFinite(c) || u < 0 || c < 0) {
            return { cn: "", en: "" };
        }
        var fu = formatBytesForProgress(u);
        var fc = formatBytesForProgress(c);
        if (!fu || !fc) {
            return { cn: "", en: "" };
        }
        return {
            cn: " · 原始 " + fu + " · ZIP 内 " + fc,
            en: " · raw " + fu + " · in-zip " + fc,
        };
    }

    /** @param {number} index 1-based */
    function testDirForIndex(index) {
        return "TEST_" + String(index).padStart(5, "0");
    }

    /** @param {number} index 1-based */
    function attachDirForIndex(index) {
        return "ATTACH_" + String(index).padStart(5, "0");
    }

    /**
     * 切换评测类型等场景：丢弃已物化的测例 zip，强制按新 spj 重建。
     * @param {object} [testData]
     */
    function invalidateTestDataMaterialization(testData) {
        if (!testData || typeof testData !== "object") return;
        delete testData.zipContent;
        delete testData.packedBlobs;
        delete testData._materializePromise;
    }

    /**
     * 将一道题的测例写入外层 ZipWriter。
     * 优先 packedBlobs（与内层 zip 字节一致，免再解压）；否则读 zipContent。
     *
     * @param {*} zipWriter zip.js ZipWriter
     * @param {string} testDir 如 TEST_00001
     * @param {{ packedBlobs?: { name: string, blob: Blob }[], zipContent?: Blob }} testDataRec
     * @param {(info: { name: string, uncompressedSize: number, compressedSize: number }) => void} [onFileDetail] 写入完成后回调（供 overlay 显示大小）
     * @param {AbortSignal|null} [abortSignal]
     */
    async function appendTestDataDirToZipWriter(zipWriter, testDir, testDataRec, onFileDetail, abortSignal) {
        if (!testDataRec) return;
        var blobs = testDataRec.packedBlobs;
        var addedFiles = new Set();
        if (blobs && blobs.length > 0) {
            for (var bi = 0; bi < blobs.length; bi++) {
                throwIfAborted(abortSignal);
                var item = blobs[bi];
                if (!item || !item.name) continue;
                var fp = testDir + "/" + item.name;
                if (addedFiles.has(fp)) continue;
                var added = await zipWriter.add(fp, new zip.BlobReader(item.blob));
                if (onFileDetail) {
                    onFileDetail({
                        name: item.name,
                        uncompressedSize: added.uncompressedSize,
                        compressedSize: added.compressedSize,
                    });
                }
                addedFiles.add(fp);
            }
            return;
        }
        if (testDataRec.zipContent) {
            var testZipReader = new zip.ZipReader(new zip.BlobReader(testDataRec.zipContent));
            try {
                var entries = await testZipReader.getEntries();
                for (var j = 0; j < entries.length; j++) {
                    throwIfAborted(abortSignal);
                    var entry = entries[j];
                    if (entry.directory) continue;
                    var data = await entry.getData(new zip.BlobWriter());
                    var filePath = testDir + "/" + entry.filename;
                    if (!addedFiles.has(filePath)) {
                        var addedZip = await zipWriter.add(filePath, new zip.BlobReader(data));
                        if (onFileDetail) {
                            onFileDetail({
                                name: entry.filename,
                                uncompressedSize: addedZip.uncompressedSize,
                                compressedSize: addedZip.compressedSize,
                            });
                        }
                        addedFiles.add(filePath);
                    }
                }
            } finally {
                await testZipReader.close();
            }
        }
    }

    /**
     * 批量勾选 → CSGOJ 导入 ZIP（problemlist + TEST_* + ATTACH_*）。
     *
     * @param {object} opts
     * @param {object[]} opts.selectedProblems
     * @param {(problem: object, tip: string, abortSignal?: AbortSignal) => Promise<object>} opts.materializeTestData 返回含 zipContent / packedBlobs
     * @param {AbortSignal|null} [opts.abortSignal]
     * @param {(zipWriter: *, attachDir: string, problem: object, index: number) => Promise<void>} opts.addAttachments；**index** 为 0-based，Polygon 等可用 **`testDirForIndex(index + 1)`** 将题面 PDF 写入 **TEST_*** 而非 ATTACH
     * @param {(ctx: { problemIndex: number, problemTotal: number, problemTitle: string, detail: string, phase: 'file'|'problem_done', uncompressedSize?: number, compressedSize?: number }}) => void} [opts.onProgress] problemTitle 为题目标题短摘要（非题面描述）
     * @param {"polygon"|"thusaa"} [opts.packKind] 与 OJ-Problem-{kind}-* 命名一致；缺省时退回 defaultNamePrefix+日期
     * @param {string} [opts.packInfoSegment] 如 n3q、p1；缺省为 n{题数}q
     * @param {string} [opts.defaultNamePrefix] 仅当未传 packKind 时使用（兼容旧调用）
     * @returns {Promise<{ blob: Blob, defaultName: string }|null>}
     */
    async function buildImportZipFromProblems(opts) {
        var selectedProblems = opts.selectedProblems;
        if (!selectedProblems || !selectedProblems.length) return null;
        var materializeTestData = opts.materializeTestData;
        var addAttachments = opts.addAttachments;
        var onProgress = opts.onProgress;
        var defaultNamePrefix = opts.defaultNamePrefix || "problem_pkg_";
        var abortSignal = opts.abortSignal || null;

        var zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
        var problemList = [];
        var n = selectedProblems.length;

        for (var i = 0; i < n; i++) {
            throwIfAborted(abortSignal);
            var problem = selectedProblems[i];
            var finalSpj = String(problem.spjType || problem.spj || "0");
            problem.problemJson.spj = finalSpj;
            problem.problemJson.problem_new_id = i + 1;
            if (problem.polygonSolutions && problem.polygonSolutions.length > 0) {
                problem.problemJson.solutions = problem.polygonSolutions;
            } else if (problem.thusaaSolutions && problem.thusaaSolutions.length > 0) {
                problem.problemJson.solutions = problem.thusaaSolutions;
            }
            problemList.push(problem.problemJson);

            var problemTitle = titleBriefForPackProgress(problem);

            var testDir = testDirForIndex(i + 1);
            var testDataRec = await materializeTestData(problem, "Packing", abortSignal);
            throwIfAborted(abortSignal);
            await appendTestDataDirToZipWriter(zipWriter, testDir, testDataRec, function (info) {
                if (onProgress) {
                    onProgress({
                        problemIndex: i + 1,
                        problemTotal: n,
                        problemTitle: problemTitle,
                        detail: info && info.name != null ? String(info.name) : "",
                        uncompressedSize: info && typeof info.uncompressedSize === "number" ? info.uncompressedSize : undefined,
                        compressedSize: info && typeof info.compressedSize === "number" ? info.compressedSize : undefined,
                        phase: "file",
                    });
                }
            }, abortSignal);

            throwIfAborted(abortSignal);
            var attachDir = attachDirForIndex(i + 1);
            await addAttachments(zipWriter, attachDir, problem, i);
            if (onProgress) {
                onProgress({
                    problemIndex: i + 1,
                    problemTotal: n,
                    problemTitle: problemTitle,
                    detail: "",
                    phase: "problem_done",
                });
            }
        }

        throwIfAborted(abortSignal);
        await zipWriter.add(
            "problemlist.json",
            new zip.TextReader(JSON.stringify(problemList, null, 4))
        );
        await appendExportTimezoneSidecarZipWriter(zipWriter);
        var blob = await zipWriter.close();
        var defaultName;
        if (opts.packKind === "polygon" || opts.packKind === "thusaa") {
            var infoSeg =
                opts.packInfoSegment != null && String(opts.packInfoSegment).trim() !== ""
                    ? String(opts.packInfoSegment).trim()
                    : "n" + n + "q";
            defaultName = buildOjProblemPackFilename(opts.packKind, infoSeg);
        } else {
            defaultName = defaultNamePrefix + new Date().toISOString().slice(0, 10) + ".zip";
        }
        return {
            blob: blob,
            defaultName: defaultName,
        };
    }

    packCore.appendExportTimezoneSidecarZipWriter = appendExportTimezoneSidecarZipWriter;
    packCore.testDirForIndex = testDirForIndex;
    packCore.attachDirForIndex = attachDirForIndex;
    packCore.invalidateTestDataMaterialization = invalidateTestDataMaterialization;
    packCore.appendTestDataDirToZipWriter = appendTestDataDirToZipWriter;
    packCore.buildImportZipFromProblems = buildImportZipFromProblems;
    packCore.throwIfAborted = throwIfAborted;
    packCore.formatBytesForProgress = formatBytesForProgress;
    packCore.zipEntrySizeOverlaySuffix = zipEntrySizeOverlaySuffix;
    packCore.titleBriefForPackProgress = titleBriefForPackProgress;
    packCore.PACK_PROGRESS_TITLE_BRIEF_MAX_UNITS = PACK_PROGRESS_TITLE_BRIEF_MAX_UNITS;
    packCore.sanitizeZipNameSegment = sanitizeZipNameSegment;
    packCore.buildOjProblemPackFilename = buildOjProblemPackFilename;

    ProblemPkg.packCore = packCore;
})();
