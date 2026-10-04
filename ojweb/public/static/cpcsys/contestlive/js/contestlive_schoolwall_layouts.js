/**
 * 校徽墙多布局：与 PHP ContestliveDisplayAddition::SCHOOLWALL_LAYOUT_IDS 顺序一致。
 *   - grid          标准等距网格
 *   - stagger_rows  砖纹（宽行 C / 窄行 C−1 真砖纹，sub-grid 半格使奇数差精确居中）
 *   - hex           蜂巢错位（奇行向右半格，右侧内边距吸收溢出）
 *   - rhythm        节奏缩放（cell 不变、徽章按 2×2 强对比 1.18 / 0.66 棋盘缩放）
 *   - mosaic        马赛克（每行随机宽窄 + 微抖列起点，与 stagger_rows 拉开节奏）
 *   - radial        黄金角螺旋（向日葵阵，cell 大小自适应到刚好不重叠）
 *   - spiral        阿基米德螺旋（明显方向感，logo 沿一条线条缠绕外扩）
 *   - arc_rings     同心椭圆环（K=2/3 双圈强对比，外圈横扁、内圈紧致，避免环间过近）
 *   - petals        花瓣放射（n 平均分到 K 瓣，每瓣沿放射线弧展开，明显对称花型）
 *   - frame         矩形外框（沿矩形周长分布，居中留白）
 *   - scatter       随机散点（泊松式可重入，避免重叠）
 *
 * 删除：wave / gradient_density / justify_full（与 grid 视觉差异过小）；
 *      stagger_cols（仅奇列下移半格，与 hex 同质 + 节奏感弱于 mosaic / rhythm）
 *
 * 依赖：无（由 contestlive_schoolwall.js 在 docready 后调用）。同 PHP 端 SCHOOLWALL_LAYOUT_IDS / 单测须保持一致。
 */
(function (w) {
    var ORDER = [
        'grid',
        'stagger_rows',
        'hex',
        'rhythm',
        'mosaic',
        'radial',
        'spiral',
        'arc_rings',
        'petals',
        'frame',
        'scatter',
    ];
    var VALID = {};
    for (var vi = 0; vi < ORDER.length; vi++) {
        VALID[ORDER[vi]] = true;
    }
    var HOTKEY_KEY = 'contestlive_layout_hotkey_live_schoolwall';
    var TX =
        'left 0.38s cubic-bezier(0.4,0,0.2,1),top 0.38s cubic-bezier(0.4,0,0.2,1),transform 0.38s cubic-bezier(0.4,0,0.2,1),width 0.38s cubic-bezier(0.4,0,0.2,1),height 0.38s cubic-bezier(0.4,0,0.2,1),margin 0.38s cubic-bezier(0.4,0,0.2,1),margin-left 0.38s cubic-bezier(0.4,0,0.2,1),margin-top 0.38s cubic-bezier(0.4,0,0.2,1)';

    function lsGet(k) {
        try {
            return w.localStorage.getItem(k);
        } catch (e) {
            return null;
        }
    }

    function pickValid(id) {
        return id && VALID[id] ? id : 'grid';
    }

    function resolveLiveSchoolwall() {
        var hk = lsGet(HOTKEY_KEY);
        if (hk && VALID[hk]) {
            return hk;
        }
        var cfg = w.CONTEST_LIVE_DISPLAY_CONFIG;
        if (cfg && cfg.schoolwall_layout && VALID[cfg.schoolwall_layout]) {
            return cfg.schoolwall_layout;
        }
        return 'grid';
    }

    function computeWallGridDimensions(n, innerW, innerH) {
        if (n <= 0) {
            return { cols: 1, rows: 1 };
        }
        var rho = innerW / Math.max(innerH, 1e-6);
        var bestCols = 1;
        var bestRows = n;
        var bestScore = Infinity;
        var c;
        for (c = 1; c <= n; c++) {
            var r = Math.ceil(n / c);
            var cw = innerW / c;
            var ch = innerH / r;
            var cellAr = cw / Math.max(ch, 1e-9);
            var arPenalty = Math.abs(Math.log(Math.max(cellAr, 1e-6)));
            var emptySlots = c * r - n;
            var viewportNudge = Math.abs(Math.log((c / Math.max(r, 1e-9)) / rho)) * 0.12;
            var score = arPenalty + emptySlots * 0.018 + viewportNudge;
            if (score < bestScore) {
                bestScore = score;
                bestCols = c;
                bestRows = r;
            }
        }
        return { cols: bestCols, rows: bestRows };
    }

    function innerBox(grid) {
        var r = grid.getBoundingClientRect();
        return {
            w: Math.max(64, r.width),
            h: Math.max(64, r.height),
        };
    }

    function clearCellStyles(cells) {
        var i;
        for (i = 0; i < cells.length; i++) {
            var el = cells[i];
            el.style.position = '';
            el.style.left = '';
            el.style.top = '';
            el.style.width = '';
            el.style.height = '';
            el.style.margin = '';
            el.style.marginLeft = '';
            el.style.marginTop = '';
            el.style.transform = '';
            el.style.gridColumnStart = '';
            el.style.gridColumnEnd = '';
            el.style.gridRowStart = '';
            el.style.zIndex = '';
            el.style.transition = TX;
            var bd = el.querySelector('.contestlive-schoolwall__badge');
            if (bd) {
                bd.style.transform = '';
            }
        }
    }

    function resetGridCss(grid) {
        grid.style.display = 'grid';
        grid.style.position = '';
        grid.style.flex = '1';
        grid.style.minHeight = '0';
        grid.style.width = '';
        grid.style.height = '';
        grid.style.gridTemplateColumns = '';
        grid.style.gridTemplateRows = '';
        grid.style.columnGap = '';
        grid.style.rowGap = '';
        grid.style.gap = '';
        grid.style.justifyContent = '';
        grid.style.alignContent = '';
        grid.style.placeItems = '';
        grid.style.padding = '';
        grid.style.paddingLeft = '';
        grid.style.paddingRight = '';
        grid.style.paddingTop = '';
        grid.style.paddingBottom = '';
    }

    function applyPartialRowCenter(cells, n, cols, rows) {
        if (n <= 0 || rows <= 1) {
            return;
        }
        var rem = n - (rows - 1) * cols;
        if (rem >= cols || rem <= 0) {
            return;
        }
        var pad = cols - rem;
        var startCol = Math.floor(pad / 2) + 1;
        var j;
        for (j = 0; j < rem; j++) {
            var idx = n - rem + j;
            if (cells[idx]) {
                cells[idx].style.gridColumnStart = String(startCol + j);
                /** 当 pad 为奇数时 grid 列只能整数对齐：用 transform 补半格使末行视觉居中 */
                if (pad % 2 === 1) {
                    cells[idx].style.transform = 'translateX(50%)';
                }
            }
        }
    }

    /**
     * 行错位（砖纹）：宽行 C / 窄行 C−1 居中交替；当 C−k 为奇数时窄行整体 translateX(50%) 精确居中。
     */
    function layoutStaggerRowsBrick(root, grid, cells, n, innerW, innerH) {
        resetGridCss(grid);
        grid.style.position = 'relative';
        var gap = 'clamp(0.22rem, 0.32vmin, 0.5rem)';
        grid.style.gap = gap;
        var dim = computeWallGridDimensions(n, innerW, innerH);
        var C = dim.cols;
        var i;
        if (n <= 0) {
            return;
        }
        if (C <= 1) {
            layoutGridLike(root, grid, cells, n, 'grid', innerW, innerH);
            return;
        }
        var bands = [];
        var idx = 0;
        while (idx < n) {
            var wide = bands.length % 2 === 0;
            var take = wide ? C : Math.max(1, C - 1);
            if (take > n - idx) {
                take = n - idx;
            }
            bands.push({ start: idx, count: take });
            idx += take;
        }
        var rb = bands.length;
        grid.style.gridTemplateColumns = 'repeat(' + C + ', minmax(0, 1fr))';
        grid.style.gridTemplateRows = 'repeat(' + rb + ', minmax(0, 1fr))';
        for (i = 0; i < n; i++) {
            if (cells[i]) {
                cells[i].style.transform = '';
            }
        }
        var bi;
        for (bi = 0; bi < bands.length; bi++) {
            var b = bands[bi];
            var k = b.count;
            var c0 = Math.floor((C - k) / 2) + 1;
            var halfShift = (C - k) % 2 === 1 && k > 0 && k < C;
            var j;
            for (j = 0; j < k; j++) {
                var ci = b.start + j;
                if (!cells[ci]) {
                    continue;
                }
                cells[ci].style.gridRowStart = String(bi + 1);
                cells[ci].style.gridColumnStart = String(c0 + j);
                if (halfShift) {
                    cells[ci].style.transform = 'translateX(50%)';
                }
            }
        }
    }

    function layoutGridLike(root, grid, cells, n, mode, innerW, innerH) {
        resetGridCss(grid);
        grid.style.position = 'relative';
        var dim = computeWallGridDimensions(n, innerW, innerH);
        var cols = dim.cols;
        var rows = dim.rows;
        var gap = 'clamp(0.22rem, 0.32vmin, 0.5rem)';
        if (mode === 'hex') {
            gap = 'clamp(0.12rem, 0.22vmin, 0.38rem)';
        }
        grid.style.gap = gap;
        grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
        grid.style.gridTemplateRows = 'repeat(' + rows + ', minmax(0, 1fr))';
        var i;
        for (i = 0; i < n; i++) {
            var r = Math.floor(i / cols);
            var xf = '';
            if (mode === 'hex' && r % 2 === 1) {
                xf = 'translateX(50%)';
            }
            cells[i].style.transform = xf;
        }
        applyPartialRowCenter(cells, n, cols, rows);
        applyShiftOverflowEdgePad(grid, mode, innerW, innerH, cols, rows);
    }

    /**
     * @param {HTMLElement} grid
     * @param {string} mode
     * @param {number} innerW
     * @param {number} innerH
     * @param {number} cols
     * @param {number} rows
     */
    function applyShiftOverflowEdgePad(grid, mode, innerW, innerH, cols, rows) {
        if (mode !== 'hex') {
            return;
        }
        void grid.offsetWidth;
        var cs = w.getComputedStyle(grid);
        var colGap = parseFloat(cs.columnGap);
        if (isNaN(colGap) || colGap < 0) {
            colGap = 0;
        }
        if (cols > 0) {
            var availX = innerW - (cols - 1) * colGap;
            if (availX > 0) {
                grid.style.paddingRight = availX / (2 * cols + 1) + 'px';
            }
        }
    }

    /**
     * 节奏缩放：徽章按 2×2 棋盘 1.18 / 0.66 强对比，与 grid 拉开视觉差异。
     */
    function layoutRhythm(root, grid, cells, n, innerW, innerH) {
        layoutGridLike(root, grid, cells, n, 'grid', innerW, innerH);
        var dim = computeWallGridDimensions(n, innerW, innerH);
        var cols = dim.cols;
        var i;
        for (i = 0; i < n; i++) {
            var r = Math.floor(i / cols);
            var c = i % cols;
            var bd = cells[i].querySelector('.contestlive-schoolwall__badge');
            if (bd) {
                /** 棋盘格 2×2 大小调换：(r+c)%2 决定大小，确保上下左右相邻都不同 */
                var s = (r + c) % 2 === 0 ? 1.18 : 0.66;
                bd.style.transform = 'scale(' + s + ')';
            }
        }
    }

    /**
     * 马赛克（mosaic）：每行宽度由确定性伪随机 1..C / 1..C-1 在 [floor(C*0.55), C] 间挑，
     * 多行起点错位但总数对齐 n。与 stagger_rows 区别：每行宽度更不固定（5/6/7 混合），节奏更不规则。
     */
    function layoutMosaic(root, grid, cells, n, innerW, innerH) {
        resetGridCss(grid);
        grid.style.position = 'relative';
        grid.style.gap = 'clamp(0.22rem, 0.32vmin, 0.5rem)';
        var dim = computeWallGridDimensions(n, innerW, innerH);
        var C = dim.cols;
        if (n <= 0 || C <= 1) {
            layoutGridLike(root, grid, cells, n, 'grid', innerW, innerH);
            return;
        }
        var rng = mulberry32((n * 2654435761) ^ (C << 1) ^ (innerW & 0xffff));
        var bands = [];
        var idx = 0;
        var lo = Math.max(1, Math.floor(C * 0.55));
        var prev = 0;
        while (idx < n) {
            var minK = Math.max(1, lo);
            var maxK = C;
            var k;
            do {
                k = minK + Math.floor(rng() * (maxK - minK + 1));
            } while (k === prev && maxK > minK);
            prev = k;
            if (k > n - idx) {
                k = n - idx;
            }
            bands.push({ start: idx, count: k });
            idx += k;
        }
        var rb = bands.length;
        grid.style.gridTemplateColumns = 'repeat(' + C + ', minmax(0, 1fr))';
        grid.style.gridTemplateRows = 'repeat(' + rb + ', minmax(0, 1fr))';
        var bi;
        for (bi = 0; bi < bands.length; bi++) {
            var b = bands[bi];
            var k2 = b.count;
            var c0 = Math.floor((C - k2) / 2) + 1;
            var halfShift = (C - k2) % 2 === 1 && k2 < C;
            var j;
            for (j = 0; j < k2; j++) {
                var ci = b.start + j;
                if (!cells[ci]) {
                    continue;
                }
                cells[ci].style.gridRowStart = String(bi + 1);
                cells[ci].style.gridColumnStart = String(c0 + j);
                if (halfShift) {
                    cells[ci].style.transform = 'translateX(50%)';
                }
            }
        }
    }

    function layoutRadial(root, grid, cells, n, innerW, innerH) {
        resetGridCss(grid);
        grid.style.display = 'block';
        grid.style.position = 'relative';
        grid.style.width = '100%';
        grid.style.height = '100%';
        if (n <= 0) {
            return;
        }
        var pts = [];
        var i;
        var GA = 2.39996322972865332;
        for (i = 0; i < n; i++) {
            var ang = i * GA;
            var rr = Math.sqrt(i + 1);
            pts.push({ x: rr * Math.cos(ang), y: rr * Math.sin(ang) });
        }
        /** X/Y 分别撑满半轴 → 圆形点云椭圆变形铺满矩形，避免短边对齐时左右大块空白 */
        var maxXabs = 0.01;
        var maxYabs = 0.01;
        for (i = 0; i < n; i++) {
            if (Math.abs(pts[i].x) > maxXabs) {
                maxXabs = Math.abs(pts[i].x);
            }
            if (Math.abs(pts[i].y) > maxYabs) {
                maxYabs = Math.abs(pts[i].y);
            }
        }
        var margin = 6;
        var scaleX = (innerW * 0.5 - margin) / maxXabs;
        var scaleY = (innerH * 0.5 - margin) / maxYabs;
        /** 不重叠半径：用变换后的真正最近邻距离（不能用变换前的 minD * scaleMin 高估） */
        var minD2 = Infinity;
        for (i = 0; i < n; i++) {
            for (var j2 = i + 1; j2 < n; j2++) {
                var ddx = (pts[i].x - pts[j2].x) * scaleX;
                var ddy = (pts[i].y - pts[j2].y) * scaleY;
                var dij = Math.hypot(ddx, ddy);
                if (dij < minD2) {
                    minD2 = dij;
                }
            }
        }
        if (!isFinite(minD2)) {
            minD2 = 60;
        }
        var cellR = Math.max(28, minD2 * 0.5 * 0.98);
        var cx = innerW * 0.5;
        var cy = innerH * 0.5;
        for (i = 0; i < n; i++) {
            var x = cx + pts[i].x * scaleX - cellR;
            var y = cy + pts[i].y * scaleY - cellR;
            cells[i].style.position = 'absolute';
            cells[i].style.left = Math.round(x) + 'px';
            cells[i].style.top = Math.round(y) + 'px';
            cells[i].style.width = Math.round(2 * cellR) + 'px';
            cells[i].style.height = Math.round(2 * cellR) + 'px';
        }
    }

    /**
     * 阿基米德螺旋：r = a + b*θ，从中心向外卷绕一条线。两点间弧长固定 → 视觉螺旋方向感强。
     * 椭圆变形撑满矩形（避免短边对齐留大块空白）；cellR 由变换后真实最近邻距离决定。
     */
    function layoutSpiral(root, grid, cells, n, innerW, innerH) {
        resetGridCss(grid);
        grid.style.display = 'block';
        grid.style.position = 'relative';
        grid.style.width = '100%';
        grid.style.height = '100%';
        if (n <= 0) {
            return;
        }
        var margin = 8;
        var cx = innerW * 0.5;
        var cy = innerH * 0.5;
        var pts = [];
        var i;
        var thetaMax = Math.sqrt(n) * 1.85; // 单位螺旋，约 1.5 圈
        for (i = 0; i < n; i++) {
            /** θ_i = thetaMax * sqrt(i / (n-1))：累积弧长 ∝ θ²，逐点近似等弧长 */
            var t = n > 1 ? Math.sqrt(i / (n - 1)) * thetaMax : 0;
            var rr = t / Math.max(0.01, thetaMax); /** 归一化到 [0,1] */
            pts.push({ x: rr * Math.cos(t), y: rr * Math.sin(t) });
        }
        var maxXabs = 0.01;
        var maxYabs = 0.01;
        for (i = 0; i < n; i++) {
            if (Math.abs(pts[i].x) > maxXabs) {
                maxXabs = Math.abs(pts[i].x);
            }
            if (Math.abs(pts[i].y) > maxYabs) {
                maxYabs = Math.abs(pts[i].y);
            }
        }
        var scaleX = (innerW * 0.5 - margin) / maxXabs;
        var scaleY = (innerH * 0.5 - margin) / maxYabs;
        /** 螺旋点对距离总体单调递增，但椭圆变形后 X/Y 方向不同，逐对取最小最稳 */
        var minD2 = Infinity;
        for (i = 0; i < n; i++) {
            for (var j2 = i + 1; j2 < n; j2++) {
                var ddx = (pts[i].x - pts[j2].x) * scaleX;
                var ddy = (pts[i].y - pts[j2].y) * scaleY;
                var d = Math.hypot(ddx, ddy);
                if (d < minD2) {
                    minD2 = d;
                }
            }
        }
        if (!isFinite(minD2)) {
            minD2 = 60;
        }
        var cellR = Math.max(22, minD2 * 0.5 * 0.96);
        for (i = 0; i < n; i++) {
            var x = cx + pts[i].x * scaleX - cellR;
            var y = cy + pts[i].y * scaleY - cellR;
            cells[i].style.position = 'absolute';
            cells[i].style.left = Math.round(x) + 'px';
            cells[i].style.top = Math.round(y) + 'px';
            cells[i].style.width = Math.round(2 * cellR) + 'px';
            cells[i].style.height = Math.round(2 * cellR) + 'px';
        }
    }

    /**
     * 同心椭圆环：K=2 (n<32) 或 K=3 (n>=32) 双/三圈强对比；
     *   - 椭圆半径 (rx,ry) 按视口比例伸展，外圈贴近边缘、内圈占 0.36 / 中圈占 0.66；
     *   - n 按 0.65 (K=2) 或 0.50/0.30/0.20 (K=3) 比例分配，外圈最多、内圈最少；
     *   - 相邻圈错开半相位（phase = π/m_k），看起来更像一朵花的环带；
     *   - cellR 同时受最外圈弧距 / 最近圈半径差约束以避免重叠。
     */
    function layoutArcRings(root, grid, cells, n, innerW, innerH) {
        resetGridCss(grid);
        grid.style.display = 'block';
        grid.style.position = 'relative';
        grid.style.width = '100%';
        grid.style.height = '100%';
        if (n <= 0) {
            return;
        }
        var margin = 12;
        var rxOuter = Math.max(40, innerW * 0.5 - margin);
        var ryOuter = Math.max(40, innerH * 0.5 - margin);
        var K = n >= 32 ? 3 : 2;
        if (n <= 6) {
            K = 1;
        }
        var ratios;
        var allocRatio;
        if (K === 1) {
            ratios = [1];
            allocRatio = [1];
        } else if (K === 2) {
            ratios = [0.42, 1];
            allocRatio = [0.35, 0.65];
        } else {
            ratios = [0.34, 0.66, 1];
            allocRatio = [0.18, 0.32, 0.50];
        }
        var alloc = [];
        var assigned = 0;
        for (var ki = 0; ki < K; ki++) {
            var m = Math.max(1, Math.round(n * allocRatio[ki]));
            alloc.push(m);
            assigned += m;
        }
        var diff = assigned - n;
        var adj = K - 1;
        while (diff !== 0 && K > 0) {
            if (diff > 0 && alloc[adj] > 1) {
                alloc[adj]--;
                diff--;
            } else if (diff < 0) {
                alloc[adj]++;
                diff++;
            } else {
                adj--;
                if (adj < 0) {
                    adj = K - 1;
                }
            }
        }
        var cx = innerW * 0.5;
        var cy = innerH * 0.5;
        /** cellR 由最外圈弧距 / 相邻圈最小径差共同约束（外圈周长用拉马努金椭圆近似，比平均半径更准） */
        var rxK = rxOuter * ratios[K - 1];
        var ryK = ryOuter * ratios[K - 1];
        var outerCircum = Math.PI * (3 * (rxK + ryK) - Math.sqrt((3 * rxK + ryK) * (rxK + 3 * ryK)));
        var outerArc = outerCircum / Math.max(1, alloc[K - 1]);
        var radDiffMin = K > 1 ? (Math.min(rxOuter, ryOuter) * (ratios[K - 1] - ratios[K - 2])) : Math.min(rxOuter, ryOuter);
        var cellR = Math.max(24, Math.min(outerArc * 0.5 * 0.92, radDiffMin * 0.5 * 0.92, Math.min(rxOuter, ryOuter) * 0.32));
        var idx = 0;
        for (var kk = 0; kk < K; kk++) {
            var m2 = alloc[kk];
            var rx2 = rxOuter * ratios[kk];
            var ry2 = ryOuter * ratios[kk];
            var phase = (kk % 2) * (Math.PI / Math.max(1, m2));
            for (var j2 = 0; j2 < m2; j2++) {
                if (idx >= n) {
                    break;
                }
                /** 起点 -π/2（顶端），顺时针 */
                var ang = (j2 / m2) * 2 * Math.PI + phase - Math.PI / 2;
                var px = cx + rx2 * Math.cos(ang) - cellR;
                var py = cy + ry2 * Math.sin(ang) - cellR;
                cells[idx].style.position = 'absolute';
                cells[idx].style.left = Math.round(px) + 'px';
                cells[idx].style.top = Math.round(py) + 'px';
                cells[idx].style.width = Math.round(2 * cellR) + 'px';
                cells[idx].style.height = Math.round(2 * cellR) + 'px';
                idx++;
            }
        }
    }

    /**
     * 花瓣放射（petals）：n 分到 K 瓣（K = clamp(round(√(2n)), 5, 9)，瓣多则每瓣点少→径向间距大→徽标更大），
     *   - X/Y 用 Rx, Ry 椭圆撑满（避免短边圆形对齐留下宽视口左右大块空白），
     *   - 每瓣沿固定角度 angle_k = -π/2 + 2πk/K 椭圆外推，
     *   - 瓣内做轻微弧度偏摆 (±κ * sin(πt)) 使每条瓣略弯成花瓣形，
     *   - 中心留出 t=0.10 圈，瓣从此处起始至外边缘 t=0.96。
     */
    function layoutPetals(root, grid, cells, n, innerW, innerH) {
        resetGridCss(grid);
        grid.style.display = 'block';
        grid.style.position = 'relative';
        grid.style.width = '100%';
        grid.style.height = '100%';
        if (n <= 0) {
            return;
        }
        var margin = 12;
        var Rx = Math.max(40, innerW * 0.5 - margin);
        var Ry = Math.max(40, innerH * 0.5 - margin);
        var K = Math.max(5, Math.min(9, Math.round(Math.sqrt(2 * n))));
        if (K > n) {
            K = n;
        }
        var base = Math.floor(n / K);
        var extra = n - base * K;
        var alloc = [];
        for (var k0 = 0; k0 < K; k0++) {
            alloc.push(base + (k0 < extra ? 1 : 0));
        }
        var maxM = base + (extra > 0 ? 1 : 0);
        var tInner = 0.10;
        var tOuter = 0.96;
        var radialStepNorm = (tOuter - tInner) / Math.max(1, maxM - (maxM === 1 ? 0 : 1));
        /** 径向相邻最小距离：归一径向步乘上椭圆短轴方向半径 */
        var radialMinDist = radialStepNorm * Math.min(Rx, Ry);
        /** 外圈瓣间最近距离：相邻瓣外端点弧长 ≈ tOuter * 2 * sqrt(Rx*Ry) * sin(π/K)（椭圆几何均值近似） */
        var outerArcAprx = tOuter * 2 * Math.sqrt(Rx * Ry) * Math.sin(Math.PI / Math.max(1, K));
        var cellR = Math.max(22, Math.min(radialMinDist * 0.5 * 0.92, outerArcAprx * 0.5 * 0.85));
        var cx = innerW * 0.5;
        var cy = innerH * 0.5;
        /** 瓣内弧度幅度 κ：让花瓣看起来有圆弧、不是僵直放射 */
        var kappa = (Math.PI / K) * 0.32;
        var idx = 0;
        for (var k = 0; k < K; k++) {
            var baseAng = -Math.PI / 2 + (2 * Math.PI * k) / K;
            var m = alloc[k];
            for (var j = 0; j < m; j++) {
                if (idx >= n) {
                    break;
                }
                /** s∈[0,1]：1 个时定 0.5；多个时含端点均分 */
                var s = m === 1 ? 0.5 : j / (m - 1);
                var t = tInner + s * (tOuter - tInner);
                /** 瓣弧偏摆：sin(πs) 在两端 0、中段 1，让瓣肚向一侧鼓出 */
                var bulge = kappa * Math.sin(Math.PI * s);
                /** 偶数瓣向逆时针、奇数瓣向顺时针弯，整体形成对称花型 */
                var angOff = k % 2 === 0 ? bulge : -bulge;
                var ang = baseAng + angOff;
                var px = cx + t * Rx * Math.cos(ang) - cellR;
                var py = cy + t * Ry * Math.sin(ang) - cellR;
                cells[idx].style.position = 'absolute';
                cells[idx].style.left = Math.round(px) + 'px';
                cells[idx].style.top = Math.round(py) + 'px';
                cells[idx].style.width = Math.round(2 * cellR) + 'px';
                cells[idx].style.height = Math.round(2 * cellR) + 'px';
                idx++;
            }
        }
    }

    function layoutFrame(root, grid, cells, n, innerW, innerH) {
        resetGridCss(grid);
        grid.style.display = 'block';
        grid.style.position = 'relative';
        grid.style.width = '100%';
        grid.style.height = '100%';
        var t = Math.min(innerW, innerH) * 0.105;
        t = Math.max(28, Math.min(t, Math.min(innerW, innerH) * 0.22));
        var ix0 = t;
        var iy0 = t;
        var ix1 = innerW - t;
        var iy1 = innerH - t;
        var iw = Math.max(1, ix1 - ix0);
        var ih = Math.max(1, iy1 - iy0);
        var perim = 2 * (iw + ih);
        /** 徽标尺寸顶满外框带宽：t * 2.4 让其占边带 1.2 倍宽（向内外溢出，弱化中空感）；
         *  周长约束放宽到 perim/(n+0.2) 让相邻徽标贴近、不留间隙。 */
        var s = Math.min(t * 2.4, perim / Math.max(6, n + 0.2));
        s = Math.max(22, s);
        var i;
        for (i = 0; i < n; i++) {
            var d = (i + 0.5) * (perim / n);
            var x;
            var y;
            if (d <= iw) {
                x = ix0 + d;
                y = iy0;
            } else if (d <= iw + ih) {
                x = ix1;
                y = iy0 + (d - iw);
            } else if (d <= 2 * iw + ih) {
                x = ix1 - (d - iw - ih);
                y = iy1;
            } else {
                x = ix0;
                y = iy1 - (d - 2 * iw - ih);
            }
            cells[i].style.position = 'absolute';
            cells[i].style.left = Math.round(x - s * 0.5) + 'px';
            cells[i].style.top = Math.round(y - s * 0.5) + 'px';
            cells[i].style.width = Math.round(s) + 'px';
            cells[i].style.height = Math.round(s) + 'px';
        }
    }

    function mulberry32(seed) {
        var a = seed >>> 0;
        return function () {
            var t = (a += 0x6d2b79f5) >>> 0;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function layoutScatter(root, grid, cells, n, innerW, innerH) {
        resetGridCss(grid);
        grid.style.display = 'block';
        grid.style.position = 'relative';
        grid.style.width = '100%';
        grid.style.height = '100%';
        var margin = 8;
        var sTry = Math.min(innerW, innerH) / Math.max(2.0, Math.sqrt(n + 1));
        sTry = Math.max(22, Math.min(sTry, Math.min(innerW, innerH) * 0.28));
        var best = null;
        var round;
        for (round = 0; round < 40; round++) {
            var rng = mulberry32(((n << 12) ^ (innerW << 1) ^ innerH ^ (round * 2654435761)) >>> 0);
            var pos = [];
            var guard = 0;
            while (pos.length < n && guard < n * 220) {
                guard++;
                var x = margin + rng() * Math.max(0.01, innerW - 2 * margin - sTry);
                var y = margin + rng() * Math.max(0.01, innerH - 2 * margin - sTry);
                var ok = true;
                var p;
                for (p = 0; p < pos.length; p++) {
                    if (Math.hypot(x - pos[p].x, y - pos[p].y) < sTry * 1.02) {
                        ok = false;
                        break;
                    }
                }
                if (ok) {
                    pos.push({ x: x, y: y });
                }
            }
            if (pos.length === n) {
                best = { s: sTry, pos: pos };
                break;
            }
            sTry *= 0.92;
        }
        if (!best) {
            layoutGridLike(root, grid, cells, n, 'grid', innerW, innerH);
            return;
        }
        var i;
        for (i = 0; i < n; i++) {
            cells[i].style.position = 'absolute';
            cells[i].style.left = Math.round(best.pos[i].x) + 'px';
            cells[i].style.top = Math.round(best.pos[i].y) + 'px';
            cells[i].style.width = Math.round(best.s) + 'px';
            cells[i].style.height = Math.round(best.s) + 'px';
        }
    }

    /**
     * @param {HTMLElement} root
     * @param {HTMLElement} grid
     * @param {HTMLElement[]} cells
     * @param {number} n
     */
    function apply(mode, root, grid, cells, n) {
        var id = pickValid(mode);
        root.setAttribute('data-schoolwall-layout', id);
        clearCellStyles(cells);
        if (n <= 0) {
            resetGridCss(grid);
            return;
        }
        var box = innerBox(grid);
        var innerW = box.w;
        var innerH = box.h;
        if (id === 'grid') {
            layoutGridLike(root, grid, cells, n, 'grid', innerW, innerH);
        } else if (id === 'stagger_rows') {
            layoutStaggerRowsBrick(root, grid, cells, n, innerW, innerH);
        } else if (id === 'hex') {
            layoutGridLike(root, grid, cells, n, 'hex', innerW, innerH);
        } else if (id === 'rhythm') {
            layoutRhythm(root, grid, cells, n, innerW, innerH);
        } else if (id === 'mosaic') {
            layoutMosaic(root, grid, cells, n, innerW, innerH);
        } else if (id === 'radial') {
            layoutRadial(root, grid, cells, n, innerW, innerH);
        } else if (id === 'spiral') {
            layoutSpiral(root, grid, cells, n, innerW, innerH);
        } else if (id === 'arc_rings') {
            layoutArcRings(root, grid, cells, n, innerW, innerH);
        } else if (id === 'petals') {
            layoutPetals(root, grid, cells, n, innerW, innerH);
        } else if (id === 'frame') {
            layoutFrame(root, grid, cells, n, innerW, innerH);
        } else if (id === 'scatter') {
            layoutScatter(root, grid, cells, n, innerW, innerH);
        } else {
            layoutGridLike(root, grid, cells, n, 'grid', innerW, innerH);
        }
    }

    w.ContestliveSchoolwallLayout = {
        ORDER: ORDER,
        VALID: VALID,
        HOTKEY_KEY: HOTKEY_KEY,
        pickValid: pickValid,
        resolveLiveSchoolwall: resolveLiveSchoolwall,
        computeWallGridDimensions: computeWallGridDimensions,
        apply: apply,
    };
})(window);
