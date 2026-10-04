/**
 * Lodop 打印作业串行队列。
 * 每趟打印（一次 PRINT() 打印信号，含该次之前的 PRINT_INIT / 排版）执行完毕后，
 * 按本趟 gap 常量等待再处理下一趟。预览不入队。
 *
 * 【打印间隔】CSG_PRINT_JOB_GAP_MS / CSG_BALLOON_PRINT_JOB_GAP_MS（毫秒）；
 * 【闲时等待时长】CSG_AUTO_PRINT_IDLE_POLL_SEC / CSG_AUTO_PRINT_BUSY_POLL_SEC（秒，print_manager 拉表倒计时）；
 * 代码 A4 入队：print_control.js → PrintCode → CsgPrintJobQueue.enqueue；
 * 气球小票：balloon_print.js → enqueue(..., CSG_BALLOON_PRINT_JOB_GAP_MS)。
 */
/** 【打印间隔】代码 A4：两趟 PRINT() 之间的等待（毫秒） */
var CSG_PRINT_JOB_GAP_MS = 2000;
/** 【打印间隔】气球热敏小票：两趟 PRINT() 之间的等待（毫秒） */
var CSG_BALLOON_PRINT_JOB_GAP_MS = 1000;
/** 【闲时等待时长】自动打印：refresh 后确认无 Waiting 时，下次整表 refresh 倒计时（秒） */
var CSG_AUTO_PRINT_IDLE_POLL_SEC = 10;
/** 自动打印：连打 / 本页未确认闲时，拉表 refresh 倒计时（秒）；非【闲时等待时长】 */
var CSG_AUTO_PRINT_BUSY_POLL_SEC = 5;

(function (global) {
    var queue = [];
    var draining = false;

    function delay(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function drain() {
        if (draining || queue.length === 0) {
            return;
        }
        draining = true;
        var entry = queue.shift();
        Promise.resolve()
            .then(function () {
                return entry.run();
            })
            .then(
                function (result) {
                    entry.resolve(result);
                },
                function (err) {
                    entry.reject(err);
                }
            )
            .finally(function () {
                return delay(entry.gapMs);
            })
            .then(
                function () {
                    draining = false;
                    drain();
                },
                function () {
                    draining = false;
                    drain();
                }
            );
    }

    /**
     * @param {function(): (void|Promise<*>)} run 单趟打印：组版并调用 PRINT()
     * @param {number} [gapMs] 【打印间隔】本趟 PRINT 后的等待（毫秒）；默认 CSG_PRINT_JOB_GAP_MS
     * @returns {Promise<*>}
     */
    function enqueue(run, gapMs) {
        var gap =
            typeof gapMs === 'number' && !isNaN(gapMs) && gapMs >= 0
                ? gapMs
                : CSG_PRINT_JOB_GAP_MS;
        return new Promise(function (resolve, reject) {
            queue.push({ run: run, resolve: resolve, reject: reject, gapMs: gap });
            drain();
        });
    }

    global.CsgPrintJobQueue = {
        enqueue: enqueue,
    };
})(typeof window !== "undefined" ? window : this);
