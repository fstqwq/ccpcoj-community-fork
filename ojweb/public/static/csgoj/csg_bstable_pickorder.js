/**
 * Bootstrap Table 勾选顺序：离散勾选不互斥 + Shift 按「锚点→当前行」在数据索引上走区间（含逆序）。
 * 供模板练习选择器、题目选择 Modal 等复用（客户端分页表用全量 getData；服务端分页仅当前页索引）。
 */
(function (global) {
    'use strict';

    /**
     * @param {number} anchorIdx
     * @param {number} endIdx
     * @returns {number[]}
     */
    function buildPathIndices(anchorIdx, endIdx) {
        const path = [];
        if (anchorIdx <= endIdx) {
            for (let i = anchorIdx; i <= endIdx; i++) {
                path.push(i);
            }
        } else {
            for (let i = anchorIdx; i >= endIdx; i--) {
                path.push(i);
            }
        }
        return path;
    }

    /**
     * 将一段 pathIds（已按起点→终点顺序）合并进现有顺序：先去掉 path 内 id 再接到末尾。
     * @param {number[]} existingOrder
     * @param {number[]} pathIds
     * @returns {number[]}
     */
    function mergePathIntoOrder(existingOrder, pathIds) {
        const set = {};
        (pathIds || []).forEach(function (id) {
            set[id] = true;
        });
        const rest = (existingOrder || []).filter(function (id) {
            return !set[id];
        });
        return rest.concat(pathIds || []);
    }

    global.CsgBsTablePickOrder = {
        buildPathIndices: buildPathIndices,
        mergePathIntoOrder: mergePathIntoOrder
    };
})(typeof window !== 'undefined' ? window : this);
