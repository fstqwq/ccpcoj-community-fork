/**
 * expsys 班级管理相关 JavaScript
 */

(function() {
    'use strict';
    
    // 排序标志，防止重复排序导致的无限循环
    let isSorting = false;
    
    /**
     * 初始化班级列表表格
     * 在数据加载成功、渲染之前对数据进行排序
     * 使用 load-success 事件，在数据加载成功后检查并排序
     */
    function initClssListTable() {
        const $table = $('#clss_list_table');
        if ($table.length === 0) {
            return;
        }
        
        // 使用 load-success 事件在数据加载成功后对数据进行排序
        // 这个事件在数据加载完成但还未渲染到页面时触发
        $table.off('load-success.bs.table.clssSort').on('load-success.bs.table.clssSort', function() {
            // 如果正在排序，跳过（防止循环）
            if (isSorting) {
                return;
            }
            
            // 获取当前表格数据
            const data = $table.bootstrapTable('getData');
            
            // 如果数据存在且长度大于0，进行排序
            if (data && data.length > 0) {
                // 检查数据是否已经按 clss_id 降序排序
                let needSort = false;
                for (let i = 0; i < data.length - 1; i++) {
                    const idA = parseInt(data[i].clss_id) || 0;
                    const idB = parseInt(data[i + 1].clss_id) || 0;
                    if (idA < idB) {
                        needSort = true;
                        break;
                    }
                }
                
                // 如果需要排序，进行排序并重新加载
                if (needSort) {
                    isSorting = true;
                    
                    // 按 clss_id 降序排序
                    const sortedData = data.slice().sort(function(a, b) {
                        const idA = parseInt(a.clss_id) || 0;
                        const idB = parseInt(b.clss_id) || 0;
                        return idB - idA; // 降序
                    });
                    
                    // 重新加载排序后的数据
                    // 注意：这会再次触发 load-success 事件，但 isSorting 标志会阻止循环
                    $table.bootstrapTable('load', sortedData);
                    
                    // 重置标志（使用 setTimeout 确保在下次事件触发前重置）
                    setTimeout(function() {
                        isSorting = false;
                    }, 100);
                }
            }
        });
    }
    
    // 页面加载完成后初始化
    $(document).ready(function() {
        initClssListTable();
    });
    
    // 导出函数供外部调用
    if (typeof window !== 'undefined') {
        window.initClssListTable = initClssListTable;
    }
    
})();

