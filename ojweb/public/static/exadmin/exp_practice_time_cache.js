/**
 * exadmin 练习添加：按班级缓存「周几×时段」起止时间（IndexedDB，无 TTL；分段 7 天未写入则丢弃）。
 */
(function (global) {
    'use strict';

    var DB_NAME = 'csg_exadmin_exp';
    var STORE_NAME = 'practice_time_seg';
    var MS_WEEK = 7 * 24 * 60 * 60 * 1000;

    function slotFromHour(h) {
        if (h < 13) {
            return 0;
        }
        if (h < 18) {
            return 1;
        }
        return 2;
    }

    function segKeyFromDate(d) {
        return String(d.getDay()) + '-' + String(slotFromHour(d.getHours()));
    }

    function parseSqlLocal(s) {
        if (!s || typeof s !== 'string') {
            return null;
        }
        var m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
        if (!m) {
            return null;
        }
        return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], 0);
    }

    function formatSqlLocal(d) {
        var pad = function (n) {
            return (n < 10 ? '0' : '') + n;
        };
        return (
            d.getFullYear() +
            '-' +
            pad(d.getMonth() + 1) +
            '-' +
            pad(d.getDate()) +
            ' ' +
            pad(d.getHours()) +
            ':' +
            pad(d.getMinutes()) +
            ':' +
            pad(d.getSeconds())
        );
    }

    function sqlToDatetimeLocal(sql) {
        if (!sql) {
            return '';
        }
        if (typeof window.CsgAppNaiveSqlToDatetimeLocalValue === 'function') {
            var v0 = window.CsgAppNaiveSqlToDatetimeLocalValue(sql);
            if (v0) {
                return v0;
            }
        }
        var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):/.exec(String(sql).trim());
        if (!m) {
            return '';
        }
        return m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5];
    }

    function pruneSegments(segments, nowMs) {
        var t = typeof nowMs === 'number' ? nowMs : Date.now();
        Object.keys(segments).forEach(function (k) {
            var e = segments[k];
            if (!e || typeof e.updatedAtMs !== 'number' || t - e.updatedAtMs > MS_WEEK) {
                delete segments[k];
            }
        });
    }

    function findNextSameWeekdayAfter(from, refStart) {
        var dow = refStart.getDay();
        var H = refStart.getHours();
        var M = refStart.getMinutes();
        var S = refStart.getSeconds();
        var fromMs = from.getTime();
        var i;
        for (i = 0; i < 400; i++) {
            var base = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, H, M, S, 0);
            if (base.getTime() <= fromMs) {
                continue;
            }
            if (base.getDay() === dow) {
                return base;
            }
        }
        return null;
    }

    function idbReady() {
        return global.idb && typeof global.idb.get === 'function' && typeof global.idb.set === 'function';
    }

    function storageKey(clssId) {
        return 'clss_' + String(clssId);
    }

    function loadDoc(clssId) {
        if (!idbReady()) {
            return Promise.resolve(null);
        }
        return global.idb.get(DB_NAME, STORE_NAME, storageKey(clssId)).catch(function () {
            return null;
        });
    }

    function saveDoc(clssId, doc) {
        if (!idbReady()) {
            return Promise.resolve();
        }
        return global.idb.set(DB_NAME, STORE_NAME, storageKey(clssId), doc).catch(function () {});
    }

    function loadDocPrunePersist(clssId) {
        return loadDoc(clssId).then(function (doc) {
            if (!doc || typeof doc !== 'object' || !doc.segments || typeof doc.segments !== 'object') {
                return doc;
            }
            var beforeKeys = Object.keys(doc.segments).length;
            var segs;
            try {
                segs = JSON.parse(JSON.stringify(doc.segments));
            } catch (e) {
                return doc;
            }
            pruneSegments(segs);
            if (Object.keys(segs).length !== beforeKeys) {
                doc.segments = segs;
                return saveDoc(clssId, doc).then(function () {
                    return doc;
                });
            }
            return doc;
        });
    }

    function recordPair(clssId, startSql, endSql) {
        var start = parseSqlLocal(startSql);
        var end = parseSqlLocal(endSql);
        if (!start || !end || end.getTime() <= start.getTime()) {
            return Promise.resolve();
        }
        var key = segKeyFromDate(start);
        return loadDoc(clssId).then(function (raw) {
            var doc = raw && typeof raw === 'object' ? raw : { v: 1, segments: {} };
            if (!doc.segments || typeof doc.segments !== 'object') {
                doc.segments = {};
            }
            doc.segments[key] = {
                startMs: start.getTime(),
                endMs: end.getTime(),
                updatedAtMs: Date.now(),
            };
            pruneSegments(doc.segments);
            return saveDoc(clssId, doc);
        });
    }

    function getSuggestion(clssId) {
        return loadDocPrunePersist(clssId).then(function (doc) {
            if (!doc || !doc.segments) {
                return null;
            }
            var segs = doc.segments;
            var entries = Object.keys(segs)
                .map(function (k) {
                    return segs[k];
                })
                .filter(function (e) {
                    return e && typeof e.startMs === 'number' && typeof e.endMs === 'number';
                });
            if (!entries.length) {
                return null;
            }

            var now = new Date();
            var nowMs = now.getTime();

            var futures = entries
                .filter(function (e) {
                    return e.startMs > nowMs;
                })
                .sort(function (a, b) {
                    return a.startMs - b.startMs;
                });
            if (futures.length) {
                var fe = futures[0];
                return {
                    startSql: formatSqlLocal(new Date(fe.startMs)),
                    endSql: formatSqlLocal(new Date(fe.endMs)),
                };
            }

            var best = null;
            var i;
            for (i = 0; i < entries.length; i++) {
                var refS = new Date(entries[i].startMs);
                var refE = new Date(entries[i].endMs);
                var dur = refE.getTime() - refS.getTime();
                if (dur <= 0) {
                    continue;
                }
                var nextS = findNextSameWeekdayAfter(now, refS);
                if (!nextS) {
                    continue;
                }
                var nextE = new Date(nextS.getTime() + dur);
                if (!best || nextS.getTime() < best.start.getTime()) {
                    best = { start: nextS, end: nextE };
                }
            }
            if (!best) {
                return null;
            }
            return {
                startSql: formatSqlLocal(best.start),
                endSql: formatSqlLocal(best.end),
            };
        });
    }

    function recordFromBatch(batchArr) {
        if (!batchArr || !batchArr.length) {
            return Promise.resolve();
        }
        return Promise.all(
            batchArr.map(function (b) {
                if (!b || !b.clss_id || !b.start_time || !b.end_time) {
                    return Promise.resolve();
                }
                return recordPair(b.clss_id, b.start_time, b.end_time);
            })
        ).then(function () {});
    }

    global.ExpPracticeTimeCache = {
        recordPair: recordPair,
        getSuggestion: getSuggestion,
        recordFromBatch: recordFromBatch,
        sqlToDatetimeLocal: sqlToDatetimeLocal,
    };
})(typeof window !== 'undefined' ? window : this);
