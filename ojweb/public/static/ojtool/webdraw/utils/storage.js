/**
 * 存储功能 - 支持多记录管理
 */
(function() {
    'use strict';
    
    const STORAGE_KEY = window.WebDrawConstants.STORAGE_KEY;
    const STORAGE_LIST_KEY = window.WebDrawConstants.STORAGE_LIST_KEY;
    
    // 获取存储接口
    function getStorage() {
        if (window.idb && window.idb.SetIdb && window.idb.GetIdb && window.idb.DelIdb) {
            return {
                async set(key, value) {
                    await window.idb.SetIdb(key, value);
                },
                async get(key) {
                    return await window.idb.GetIdb(key);
                },
                async del(key) {
                    await window.idb.DelIdb(key);
                }
            };
        } else {
            return {
                async set(key, value) {
                    localStorage.setItem(key, JSON.stringify(value));
                },
                async get(key) {
                    const stored = localStorage.getItem(key);
                    return stored ? JSON.parse(stored) : null;
                },
                async del(key) {
                    localStorage.removeItem(key);
                }
            };
        }
    }
    
    window.WebDrawStorage = {
        storage: getStorage(),
        
        /**
         * 检查记录是否过期
         * @param {Object} record - 记录对象
         * @returns {boolean} 是否过期
         */
        isRecordExpired(record) {
            if (!record || !record.updatedAt) {
                return true; // 没有更新时间，视为过期
            }
            const expiryMs = window.WebDrawConstants?.RECORD_EXPIRY_MS || (3 * 60 * 60 * 1000);
            const now = Date.now();
            return (now - record.updatedAt) > expiryMs;
        },
        
        /**
         * 获取所有记录列表（自动过滤过期记录）
         * @returns {Promise<Array>} 记录列表
         */
        async getRecordsList() {
            try {
                const list = await this.storage.get(STORAGE_LIST_KEY);
                if (!list || !Array.isArray(list)) {
                    return [];
                }
                
                // 过滤掉过期的记录
                const validRecords = [];
                const expiredRecordIds = [];
                
                for (const record of list) {
                    if (this.isRecordExpired(record)) {
                        expiredRecordIds.push(record.id);
                    } else {
                        validRecords.push(record);
                    }
                }
                
                // 如果有过期记录，删除它们并更新列表
                if (expiredRecordIds.length > 0) {
                    // 删除过期记录的数据
                    for (const recordId of expiredRecordIds) {
                        const key = `${STORAGE_KEY}_${recordId}`;
                        await this.storage.del(key);
                    }
                    
                    // 从列表中移除过期记录
                    const filtered = list.filter(r => !expiredRecordIds.includes(r.id));
                    await this.saveRecordsList(filtered);
                    
                    return filtered;
                }
                
                return validRecords;
            } catch (error) {
                console.error('Get records list error:', error);
                return [];
            }
        },
        
        /**
         * 保存记录列表
         * @param {Array} list - 记录列表
         */
        async saveRecordsList(list) {
            try {
                await this.storage.set(STORAGE_LIST_KEY, list);
            } catch (error) {
                console.error('Save records list error:', error);
            }
        },
        
        /**
         * 保存记录
         * @param {string} recordId - 记录ID
         * @param {Object} state - 要保存的状态
         * @param {boolean} showAlert - 是否显示提示（默认 false）
         */
        async saveRecord(recordId, state, showAlert = false) {
            try {
                const key = `${STORAGE_KEY}_${recordId}`;
                await this.storage.set(key, state);
                
                // 更新记录列表
                const list = await this.getRecordsList();
                const recordIndex = list.findIndex(r => r.id === recordId);
                if (recordIndex >= 0) {
                    list[recordIndex].updatedAt = Date.now();
                } else {
                    list.push({
                        id: recordId,
                        name: state.name || `图形 ${list.length + 1}`,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                }
                await this.saveRecordsList(list);
                
                if (showAlert) {
                    alert('保存成功！\nSaved successfully!');
                }
            } catch (error) {
                console.error('Save record error:', error);
                if (showAlert) {
                    alert('保存失败！\nSave failed!');
                }
            }
        },
        
        /**
         * 加载记录（检查有效期）
         * @param {string} recordId - 记录ID
         * @returns {Promise<Object|null>} 加载的状态，如果过期则返回null
         */
        async loadRecord(recordId) {
            try {
                // 先检查记录列表中的记录是否过期
                const list = await this.getRecordsList();
                const record = list.find(r => r.id === recordId);
                
                if (!record) {
                    // 记录不在列表中，可能已被删除或过期
                    return null;
                }
                
                if (this.isRecordExpired(record)) {
                    // 记录已过期，删除它
                    await this.deleteRecord(recordId);
                    return null;
                }
                
                // 记录有效，加载数据
                const key = `${STORAGE_KEY}_${recordId}`;
                return await this.storage.get(key);
            } catch (error) {
                console.error('Load record error:', error);
                return null;
            }
        },
        
        /**
         * 删除记录
         * @param {string} recordId - 记录ID
         */
        async deleteRecord(recordId) {
            try {
                const key = `${STORAGE_KEY}_${recordId}`;
                await this.storage.del(key);
                
                // 从记录列表中移除（不检查有效期，直接删除）
                const list = await this.storage.get(STORAGE_LIST_KEY) || [];
                const filtered = list.filter(r => r.id !== recordId);
                await this.saveRecordsList(filtered);
            } catch (error) {
                console.error('Delete record error:', error);
            }
        },
        
        /**
         * 创建新记录
         * @param {string} name - 记录名称
         * @returns {Promise<string>} 新记录的ID
         */
        async createRecord(name) {
            const recordId = `record_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
            const list = await this.getRecordsList();
            list.push({
                id: recordId,
                name: name || `图形 ${list.length + 1}`,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            await this.saveRecordsList(list);
            return recordId;
        },
        
        /**
         * 更新记录名称
         * @param {string} recordId - 记录ID
         * @param {string} name - 新名称
         */
        async updateRecordName(recordId, name) {
            const list = await this.getRecordsList();
            const record = list.find(r => r.id === recordId);
            if (record) {
                record.name = name;
                record.updatedAt = Date.now();
                await this.saveRecordsList(list);
            }
        },
        
        // 兼容旧接口
        async save(state, showAlert = false) {
            // 如果没有 recordId，使用默认记录
            const recordId = state.recordId || 'default';
            await this.saveRecord(recordId, state, showAlert);
        },
        
        async load() {
            // 加载默认记录
            return await this.loadRecord('default');
        }
    };
})();

