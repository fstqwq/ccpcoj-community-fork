/**
 * 记录管理相关函数模块
 * 负责多记录的管理（创建、切换、删除等）
 */
(function() {
    'use strict';
    
    /**
     * 初始化记录管理
     * @param {Object} app - WebDrawApp 实例
     */
    async function initRecordManagement(app) {
        await refreshRecordsList(app);
        
        // 如果没有记录，创建第一个
        const list = await window.WebDrawStorage.getRecordsList();
        if (list.length === 0) {
            const recordId = await window.WebDrawStorage.createRecord('图形 1');
            app.currentRecordId = recordId;
            saveCurrentRecordId(app);
            await loadRecord(app, recordId);
        } else {
            // 尝试加载上次访问的记录
            const lastRecordId = loadCurrentRecordId(app);
            let recordIdToLoad = null;
            
            if (lastRecordId) {
                // 检查记录是否还存在
                const recordExists = list.some(r => r.id === lastRecordId);
                if (recordExists) {
                    recordIdToLoad = lastRecordId;
                }
            }
            
            // 如果上次的记录不存在，使用第一个记录
            if (!recordIdToLoad) {
                recordIdToLoad = list[0].id;
            }
            
            app.currentRecordId = recordIdToLoad;
            saveCurrentRecordId(app);
            await loadRecord(app, app.currentRecordId);
        }
        
        // 更新下拉列表选中项
        const recordSelect = document.getElementById('record-select');
        if (recordSelect) {
            recordSelect.value = app.currentRecordId;
        }
    }
    
    /**
     * 保存当前记录ID
     * @param {Object} app - WebDrawApp 实例
     */
    function saveCurrentRecordId(app) {
        if (app.currentRecordId) {
            const CURRENT_RECORD_KEY = window.WebDrawConstants.CURRENT_RECORD_KEY;
            try {
                localStorage.setItem(CURRENT_RECORD_KEY, app.currentRecordId);
            } catch (error) {
                console.error('Save current record ID error:', error);
            }
        }
    }
    
    /**
     * 加载当前记录ID
     * @param {Object} app - WebDrawApp 实例
     * @returns {String|null} 记录ID
     */
    function loadCurrentRecordId(app) {
        const CURRENT_RECORD_KEY = window.WebDrawConstants.CURRENT_RECORD_KEY;
        try {
            return localStorage.getItem(CURRENT_RECORD_KEY);
        } catch (error) {
            console.error('Load current record ID error:', error);
            return null;
        }
    }
    
    /**
     * 刷新记录列表
     * @param {Object} app - WebDrawApp 实例
     */
    async function refreshRecordsList(app) {
        const list = await window.WebDrawStorage.getRecordsList();
        const recordSelect = document.getElementById('record-select');
        if (recordSelect) {
            recordSelect.innerHTML = '';
            if (list.length === 0) {
                recordSelect.innerHTML = '<option value="">暂无记录</option>';
            } else {
                list.forEach(record => {
                    const option = document.createElement('option');
                    option.value = record.id;
                    option.textContent = record.name;
                    if (record.id === app.currentRecordId) {
                        option.selected = true;
                    }
                    recordSelect.appendChild(option);
                });
            }
        }
    }
    
    /**
     * 切换记录
     * @param {Object} app - WebDrawApp 实例
     * @param {String} recordId - 记录ID
     */
    async function switchRecord(app, recordId) {
        if (!recordId) return;
        
        // 保存当前记录
        if (app.currentRecordId) {
            await saveCurrentRecord(app);
        }
        
        // 加载新记录
        app.currentRecordId = recordId;
        saveCurrentRecordId(app); // 保存当前记录ID
        await loadRecord(app, recordId);
    }
    
    /**
     * 创建新记录
     * @param {Object} app - WebDrawApp 实例
     */
    async function createNewRecord(app) {
        const name = prompt('请输入新图形名称\nPlease enter new record name:', `图形 ${(await window.WebDrawStorage.getRecordsList()).length + 1}`);
        if (!name) return;
        
        // 保存当前记录
        if (app.currentRecordId) {
            await saveCurrentRecord(app);
        }
        
        // 创建新记录
        const recordId = await window.WebDrawStorage.createRecord(name);
        app.currentRecordId = recordId;
        saveCurrentRecordId(app); // 保存当前记录ID
        
        // 清空画布
        app.shapes.forEach(s => {
            const elementToRemove = s.groupElement || s.element;
            if (elementToRemove && elementToRemove.parentNode) {
                elementToRemove.parentNode.removeChild(elementToRemove);
            }
        });
        app.connectors.forEach(c => {
            if (c.element && c.element.parentNode) {
                c.element.parentNode.removeChild(c.element);
            }
        });
        app.shapes = [];
        app.connectors = [];
        window.WebDrawSelection.deselectAll(app);
        app.history = [];
        app.historyIndex = -1;
        window.WebDrawHistory.saveState(app);
        
        await refreshRecordsList(app);
    }
    
    /**
     * 重命名当前记录
     * @param {Object} app - WebDrawApp 实例
     */
    async function renameCurrentRecord(app) {
        if (!app.currentRecordId) return;
        
        const list = await window.WebDrawStorage.getRecordsList();
        const record = list.find(r => r.id === app.currentRecordId);
        if (!record) return;
        
        const newName = prompt('请输入新名称\nPlease enter new name:', record.name);
        if (!newName || newName.trim() === '') return;
        
        await window.WebDrawStorage.updateRecordName(app.currentRecordId, newName.trim());
        await refreshRecordsList(app);
    }
    
    /**
     * 删除当前记录
     * @param {Object} app - WebDrawApp 实例
     */
    async function deleteCurrentRecord(app) {
        if (!app.currentRecordId) return;
        
        const list = await window.WebDrawStorage.getRecordsList();
        if (list.length <= 1) {
            alert('至少需要保留一个图形记录\nAt least one record must be kept');
            return;
        }
        
        if (!confirm(`确定要删除当前图形 "${list.find(r => r.id === app.currentRecordId)?.name}" 吗？\nAre you sure you want to delete this record?`)) {
            return;
        }
        
        await window.WebDrawStorage.deleteRecord(app.currentRecordId);
        
        // 切换到第一个记录
        const newList = await window.WebDrawStorage.getRecordsList();
        if (newList.length > 0) {
            app.currentRecordId = newList[0].id;
            saveCurrentRecordId(app); // 保存当前记录ID
            await loadRecord(app, app.currentRecordId);
        }
        
        await refreshRecordsList(app);
    }
    
    /**
     * 保存当前记录
     * @param {Object} app - WebDrawApp 实例
     */
    async function saveCurrentRecord(app) {
        if (!app.currentRecordId) return;
        
        const state = {
            shapes: app.shapes.map(s => s.toJSON()),
            connectors: app.connectors.map(c => c.toJSON()),
            history: app.history,
            historyIndex: app.historyIndex,
            timestamp: Date.now(),
            recordId: app.currentRecordId
        };
        
        await window.WebDrawStorage.saveRecord(app.currentRecordId, state, false);
    }
    
    /**
     * 加载记录
     * @param {Object} app - WebDrawApp 实例
     * @param {String} recordId - 记录ID
     */
    async function loadRecord(app, recordId) {
        const state = await window.WebDrawStorage.loadRecord(recordId);
        
        if (state) {
            // 恢复图形和连接线（会自动恢复历史记录）
            window.WebDrawHistory.restoreState(app, state, false);
            
            // 如果历史记录为空，保存当前状态作为初始状态
            if (app.history.length === 0) {
                window.WebDrawHistory.saveState(app);
            }
        } else {
            // 新记录，初始化
            app.shapes = [];
            app.connectors = [];
            if (window.WebDrawSelection) {
                window.WebDrawSelection.deselectAll(app);
            } else {
                app.deselectAll();
            }
            app.history = [];
            app.historyIndex = -1;
            window.WebDrawHistory.saveState(app);
        }
    }
    
    /**
     * 自动保存到 IndexedDB（异步，不阻塞）
     * @param {Object} app - WebDrawApp 实例
     * @param {Object} state - 要保存的状态
     */
    async function autoSaveToStorage(app, state) {
        try {
            if (!app.currentRecordId) return;
            
            const fullState = {
                ...state,
                history: app.history,
                historyIndex: app.historyIndex,
                recordId: app.currentRecordId
            };
            
            await window.WebDrawStorage.saveRecord(app.currentRecordId, fullState, false);
        } catch (error) {
            console.error('Auto save error:', error);
        }
    }
    
    // 导出函数
    window.WebDrawRecordManagement = {
        initRecordManagement,
        saveCurrentRecordId,
        loadCurrentRecordId,
        refreshRecordsList,
        switchRecord,
        createNewRecord,
        renameCurrentRecord,
        deleteCurrentRecord,
        saveCurrentRecord,
        loadRecord,
        autoSaveToStorage
    };
})();

