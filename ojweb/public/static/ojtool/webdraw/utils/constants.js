/**
 * 常量定义
 */
(function() {
    'use strict';
    
    window.WebDrawConstants = {
        SVG_NS: 'http://www.w3.org/2000/svg',
        STORAGE_KEY: 'webdraw_data',
        STORAGE_LIST_KEY: 'webdraw_records_list', // 记录列表的键
        CURRENT_RECORD_KEY: 'webdraw_current_record', // 当前记录ID的键
        MIN_SHAPE_SIZE: 20,
        COPY_OFFSET: 30,
        PASTE_OFFSET: 20, // 粘贴时的偏移量
        MAX_HISTORY: 50,
        SNAP_DISTANCE: 15, // 吸附距离（像素）
        CIRCLE_EDGE_THRESHOLD: 10, // 圆形边缘检测阈值（像素），用于鼠标图标变化和边缘拖拽调整大小
        DRAW_START_THRESHOLD: 10, // 绘制开始阈值（像素），拖动超过此距离才开始绘制
        TEXT_FONT_SIZE: 24, // 统一文本字体大小（像素），用于形状内文字和自由文字
        RECORD_EXPIRY_HOURS: 3, // 图形记录有效期（小时）
        RECORD_EXPIRY_MS: 3 * 60 * 60 * 1000 // 图形记录有效期（毫秒）：3小时
    };
})();

