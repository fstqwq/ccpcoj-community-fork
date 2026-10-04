/**
 * 班级选择器组件（支持多选、搜索、分页加载）
 * 用于 exadmin 模块的练习编辑页面
 * 左右双栏布局：左边候选，右边已选
 */

class ClssSelector {
    constructor(options) {
        this.container = $(options.container);
        this.selectedClssIds = new Set();
        this.selectedClssMap = new Map(); // clss_id => {clss_id, clss_title, clss_year, clss_semester, is_own}
        this.allClssList = []; // 所有已加载的班级
        this.showOldClss = false; // 是否显示旧班级
        this.isAdmin = options.isAdmin || false;
        this.currentUserId = options.currentUserId || '';
        this.isCourseAdmin = options.isCourseAdmin || false;
        this.isReadOnly = options.isReadOnly || false; // 只读模式（编辑模式下非管理员）
        // 最大可选数量：null/undefined 表示不限制；1 表示单选（可替换）
        this.maxSelect = (options.maxSelect === undefined || options.maxSelect === null) ? null : parseInt(options.maxSelect);
        this.monthsThreshold = 6; // 6个月前的班级视为旧班级
        this.filteredClssList = []; // 当前显示的候选列表（用于搜索）
        this.hasOldClss = false; // 是否存在被“旧班级”过滤掉的数据（用于提示文案）
        this.onSelectionChange = (typeof options.onSelectionChange === 'function') ? options.onSelectionChange : null;
        
        this.init();
    }
    
    init() {
        this.render();
        this.bindEvents();
        if (!this.isReadOnly) {
            this.loadClssList();
        }
    }

    /**
     * 预置一个“已绑定班级”（用于编辑页：班级列表异步加载前也能先展示已选）
     * 注意：这里只负责 UI 与隐藏域同步；等 loadClssList 完成后会自动用真实数据刷新。
     */
    preselectClssInfo(clssId, clssTitle = '', clssSemester = '') {
        const id = parseInt(clssId, 10);
        if (!Number.isFinite(id) || id <= 0) return;

        // 单选模式下清空旧选中
        if (this.maxSelect === 1) {
            this.selectedClssIds.clear();
            this.selectedClssMap.clear();
        }

        this.selectedClssIds.add(id);
        this.selectedClssMap.set(id, {
            clss_id: id,
            clss_title: clssTitle || '',
            clss_year: null,
            clss_semester: clssSemester || '',
            is_own: false,
            is_old: false
        });

        this.updateSelectedList();
        this.updateSelectedCount();
        this.updateHiddenInput();
        this.updateCandidateList();
        this.emitSelectionChange();
    }

    emitSelectionChange() {
        if (this.onSelectionChange) {
            try {
                this.onSelectionChange(this.getSelectedClssIds(), this);
            } catch (e) {}
        }
    }
    
    render() {
        if (this.isReadOnly) {
            // 只读模式：显示单个班级信息（编辑模式下非管理员）
            const html = `
                <div class="clss-selector-container clss-selector-readonly">
                    <div class="form-group mb-3">
                        <label class="bilingual-label clss-bind-label d-flex align-items-center">
                            <span class="clss-bind-label-text">
                                绑定班级 <span class="en-text">Bind Class</span>
                            </span>
                            <span class="badge bg-primary ms-2 clss-selected-count-badge" id="clss_selected_count">1</span>
                            <span class="clss-bind-help ms-2">
                                仅课程管理员可修改
                                <span class="en-text">Only course admins can modify</span>
                            </span>
                        </label>
                        <div class="border rounded bg-light clss-selector-readonly-panel" id="clss_readonly_display">
                            <div class="text-muted small">加载中...</div>
                        </div>
                        <input type="hidden" name="clss_ids" id="clss_ids_input" value="">
                    </div>
                </div>
            `;
            this.container.html(html);
        } else {
            // 可编辑模式：左右双栏布局（新增/复制：可多选；编辑：通常单选替换）
            const bindEnText = (this.maxSelect === 1) ? 'Bind Class' : 'Bind Classes';
            const helpHtml = (this.maxSelect === 1)
                ? `<span class="clss-bind-help ms-2">仅课程管理员可修改<span class="en-text">Only course admins can modify</span></span>`
                : '';
            const html = `
                <div class="clss-selector-container">
                    <div class="form-group mb-3">
                        <label class="bilingual-label clss-bind-label d-flex align-items-center">
                            <span class="clss-bind-label-text">
                                绑定班级 <span class="en-text">${bindEnText}</span>
                            </span>
                            <span class="badge bg-primary ms-2 clss-selected-count-badge" id="clss_selected_count">0</span>
                            ${helpHtml}
                        </label>
                        <div class="row g-2 align-items-stretch">
                            <!-- 左侧：候选班级列表 -->
                            <div class="col-md-6">
                                <div class="clss-selector-panel">
                                    <div class="clss-selector-toolbar">
                                        <div class="clss-selector-col-title">
                                            候选班级 <span class="en-text">Available</span>
                                        </div>
                                        <button class="btn btn-sm btn-outline-secondary" type="button" id="toggle_old_clss_btn" style="display: none;">
                                            <i class="bi bi-chevron-down"></i> 显示更早
                                        </button>
                                    </div>
                                    <div class="input-group">
                                        <input type="text" class="form-control form-control-sm" id="clss_search_input" 
                                               placeholder="搜索班级名称、学期..." 
                                               autocomplete="off">
                                        <button class="btn btn-outline-secondary btn-sm" type="button" id="clss_search_btn">
                                            <i class="bi bi-search"></i>
                                        </button>
                                    </div>
                                    <div class="clss-selector-scroll" id="clss_candidate_list">
                                        <div class="text-center text-muted py-3" id="clss_loading">
                                            <div class="spinner-border spinner-border-sm" role="status"></div>
                                            <span class="ms-2">加载中...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 右侧：已选班级列表 -->
                            <div class="col-md-6">
                                <div class="clss-selector-panel">
                                    <div class="clss-selector-toolbar clss-selector-toolbar--single">
                                        <div class="clss-selector-col-title">
                                            已选班级 <span class="en-text">Selected</span>
                                        </div>
                                    </div>
                                    <div class="clss-selector-scroll" id="clss_selected_list">
                                        <div class="text-muted text-center py-3" id="clss_selected_empty">
                                            暂无已选班级
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 隐藏输入框，存储选中的班级ID（逗号分隔） -->
                        <input type="hidden" name="clss_ids" id="clss_ids_input" value="">
                    </div>
                </div>
            `;
            this.container.html(html);
        }
    }
    
    bindEvents() {
        const self = this;
        
        if (this.isReadOnly) {
            return; // 只读模式不需要绑定事件
        }
        
        // 搜索输入
        let searchTimeout;
        $('#clss_search_input').on('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                self.filterClssList();
            }, 300);
        });
        
        $('#clss_search_btn').on('click', function() {
            self.filterClssList();
        });
        
        // 切换显示旧班级
        $('#toggle_old_clss_btn').on('click', function() {
            self.showOldClss = !self.showOldClss;
            self.updateCandidateList();
            const icon = $(this).find('i');
            if (self.showOldClss) {
                icon.removeClass('bi-chevron-down').addClass('bi-chevron-up');
                $(this).html('<i class="bi bi-chevron-up"></i> 隐藏更早');
            } else {
                icon.removeClass('bi-chevron-up').addClass('bi-chevron-down');
                $(this).html('<i class="bi bi-chevron-down"></i> 显示更早');
            }
        });
    }
    
    loadClssList() {
        const self = this;
        // 绑定班级列表：
        // - 课程管理员：可见本课程全部班级
        // - 非课程管理员（教师/编辑等）：仅可见“自己管辖的班级”（避免选择后端无权限的班级）
        const flg_self = this.isCourseAdmin ? 0 : 1;
        
        $.post('/exadmin/clss/clss_list_ajax', {
            flg_self: flg_self
        }, function(ret) {
            // 处理返回数据：可能是数组或对象（带 total/rows）
            let clssList = [];
            if (ret.code == 1 && ret.data) {
                if (Array.isArray(ret.data)) {
                    clssList = ret.data;
                } else if (ret.data.rows && Array.isArray(ret.data.rows)) {
                    clssList = ret.data.rows;
                } else if (ret.data && Array.isArray(ret.data)) {
                    clssList = ret.data;
                }
            }
            
            if (clssList.length > 0) {
                self.allClssList = clssList;
                // 按学期和ID排序
                self.allClssList.sort((a, b) => {
                    const aSemester = a.clss_semester || a.semester || '';
                    const bSemester = b.clss_semester || b.semester || '';
                    if (aSemester == bSemester) {
                        return b.clss_id - a.clss_id;
                    }
                    return aSemester > bSemester ? -1 : 1;
                });
                
                // 标记是否是自己的班级
                self.allClssList.forEach(clss => {
                    if (self.currentUserId && clss.teachers) {
                        clss.is_own = clss.teachers.some(t => t.user_id == self.currentUserId);
                    } else {
                        clss.is_own = false;
                    }
                });
                
                self.filteredClssList = self.allClssList;
                self.updateCandidateList();
                // 如果编辑页在加载前已经预置了选中班级，这里用真实数据刷新一次（补齐 title/semester/is_old 等）
                if (self.selectedClssIds.size > 0) {
                    self.setSelectedClssIds(Array.from(self.selectedClssIds));
                } else {
                    self.updateSelectedList();
                    self.updateSelectedCount();
                    self.updateHiddenInput();
                }
                $('#clss_loading').hide();
            } else {
                $('#clss_loading').html('<div class="text-danger">加载失败或没有可用班级</div>');
            }
        }).fail(function() {
            $('#clss_loading').html('<div class="text-danger">加载失败</div>');
        });
    }
    
    isClssTooOld(clss) {
        if (!clss.in_date) return false;
        const clssDate = new Date(clss.in_date);
        const now = new Date();
        const diffMonths = (now.getFullYear() - clssDate.getFullYear()) * 12 + 
                          (now.getMonth() - clssDate.getMonth());
        return diffMonths > this.monthsThreshold;
    }
    
    filterClssList() {
        const searchText = $('#clss_search_input').val().toLowerCase().trim();
        if (!searchText) {
            this.filteredClssList = this.allClssList;
        } else {
            this.filteredClssList = this.allClssList.filter(clss => {
                const title = (clss.clss_title || clss.title || '').toLowerCase();
                const semester = (clss.clss_semester || clss.semester || '').toLowerCase();
                const clssId = String(clss.clss_id || '');
                return title.includes(searchText) || 
                       semester.includes(searchText) || 
                       clssId.includes(searchText);
            });
        }
        this.updateCandidateList();
    }
    
    updateCandidateList() {
        let displayList = [];
        let hasOldClss = false;
        
        // 检查是否有旧班级
        this.allClssList.forEach(clss => {
            if (this.isClssTooOld(clss)) {
                hasOldClss = true;
            }
        });
        this.hasOldClss = hasOldClss;
        
        // 根据 showOldClss 决定显示哪些班级
        this.filteredClssList.forEach(clss => {
            const isOld = this.isClssTooOld(clss);
            const isSelected = this.selectedClssIds.has(clss.clss_id);
            
            // 如果已选中的是旧班级，始终显示
            if (isOld && !this.showOldClss && !isSelected) {
                return; // 跳过未选中的旧班级
            }
            
            displayList.push(clss);
        });
        
        // 显示/隐藏"显示更早班级"按钮
        if (hasOldClss) {
            $('#toggle_old_clss_btn').show();
        } else {
            $('#toggle_old_clss_btn').hide();
        }
        
        this.renderCandidateList(displayList);
    }
    
    renderCandidateList(clssList) {
        const self = this;
        // 特殊提示：当前没有“近期班级”，但存在更早班级（需要点“显示更早”）
        if ((!clssList || clssList.length === 0) && this.hasOldClss && !this.showOldClss) {
            $('#clss_candidate_list').html(
                '<div class="text-muted text-center py-3">' +
                '暂无近期班级，点击“显示更早”查看' +
                '<div class="en-text">No recent classes. Click "Show older".</div>' +
                '</div>'
            );
            return;
        }
        const html = clssList.map(clss => {
            const isSelected = this.selectedClssIds.has(clss.clss_id);
            const isOld = this.isClssTooOld(clss);
            const isOwn = clss.is_own || false;
            const oldBadge = isOld ? '<span class="badge bg-warning text-dark ms-1 clss-selector-badge">旧</span>' : '';
            const ownBadge = isOwn ? '<span class="badge bg-success ms-1 clss-selector-badge">我的</span>' : '';
            const selectedClass = isSelected ? 'active' : '';
            const clssTitle = clss.clss_title || clss.title || '';
            const clssSemester = clss.clss_semester || clss.semester || '';
            
            return `
                <div class="clss-candidate-item ${selectedClass}" data-clss-id="${clss.clss_id}">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" 
                               ${isSelected ? 'checked' : ''} 
                               id="clss_check_${clss.clss_id}">
                        <label class="form-check-label w-100" for="clss_check_${clss.clss_id}">
                            <strong>${clss.clss_id}</strong>: ${this.escapeHtml(clssTitle)}
                            ${oldBadge}${ownBadge}
                            <small class="text-muted d-block">${clssSemester}</small>
                        </label>
                    </div>
                </div>
            `;
        }).join('');
        
        if (html) {
            $('#clss_candidate_list').html(html);
        } else {
            $('#clss_candidate_list').html('<div class="text-muted text-center py-3">没有找到班级</div>');
        }
        
        // 绑定点击事件
        $('.clss-candidate-item').on('click', function(e) {
            if ($(e.target).is('input[type="checkbox"]') || $(e.target).is('label')) {
                return; // 让 checkbox 自己处理
            }
            const checkbox = $(this).find('input[type="checkbox"]');
            checkbox.prop('checked', !checkbox.prop('checked'));
            checkbox.trigger('change');
        });
        
        // 绑定 checkbox 变化事件
        $('.clss-candidate-item input[type="checkbox"]').on('change', function() {
            const clssId = parseInt($(this).closest('.clss-candidate-item').data('clss-id'));
            const isChecked = $(this).prop('checked');
            self.toggleClss(clssId, isChecked);
        });
    }
    
    toggleClss(clssId, isSelected) {
        const clss = this.allClssList.find(c => c.clss_id == clssId);
        if (!clss) return;
        
        if (isSelected) {
            // 单选模式：选择新班级时，自动替换旧选择
            if (this.maxSelect === 1) {
                for (const oldId of Array.from(this.selectedClssIds)) {
                    if (oldId !== clssId) {
                        this.selectedClssIds.delete(oldId);
                        this.selectedClssMap.delete(oldId);
                    }
                }
            }
            this.selectedClssIds.add(clssId);
            this.selectedClssMap.set(clssId, {
                clss_id: clss.clss_id,
                clss_title: clss.clss_title || clss.title,
                clss_year: clss.clss_year || clss.year,
                clss_semester: clss.clss_semester || clss.semester,
                is_own: clss.is_own,
                is_old: this.isClssTooOld(clss)
            });
        } else {
            this.selectedClssIds.delete(clssId);
            this.selectedClssMap.delete(clssId);
        }
        
        this.updateSelectedList();
        this.updateSelectedCount();
        this.updateHiddenInput();
        this.updateCandidateList(); // 更新候选列表的选中状态
        this.emitSelectionChange();
    }
    
    updateSelectedList() {
        const count = this.selectedClssIds.size;
        
        if (count === 0) {
            $('#clss_selected_list').html('<div class="text-muted text-center py-3" id="clss_selected_empty">暂无已选班级</div>');
            return;
        }
        
        const html = Array.from(this.selectedClssMap.values()).map(clss => {
            const oldBadge = clss.is_old ? '<span class="badge bg-warning text-dark ms-1 clss-selector-badge">旧</span>' : '';
            const ownBadge = clss.is_own ? '<span class="badge bg-success ms-1 clss-selector-badge">我的</span>' : '';
            return `
                <div class="clss-selected-item clss-selected-row d-flex justify-content-between align-items-center border-bottom">
                    <div class="flex-grow-1">
                        <strong>${clss.clss_id}</strong>: ${this.escapeHtml(clss.clss_title || '')}
                        ${oldBadge}${ownBadge}
                        <small class="text-muted d-block">${clss.clss_semester || ''}</small>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-danger clss-selector-remove-btn" 
                            onclick="window.clssSelector.removeClss(${clss.clss_id})">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        $('#clss_selected_list').html(html);
    }
    
    updateSelectedCount() {
        const count = this.selectedClssIds.size;
        $('#clss_selected_count').text(count);
    }
    
    removeClss(clssId) {
        this.selectedClssIds.delete(clssId);
        this.selectedClssMap.delete(clssId);
        this.updateSelectedList();
        this.updateSelectedCount();
        this.updateHiddenInput();
        this.updateCandidateList(); // 更新候选列表的选中状态
        this.emitSelectionChange();
    }
    
    updateHiddenInput() {
        const ids = Array.from(this.selectedClssIds).join(',');
        $('#clss_ids_input').val(ids).trigger('change');
    }
    
    getSelectedClssIds() {
        return Array.from(this.selectedClssIds);
    }
    
    setSelectedClssIds(ids) {
        this.selectedClssIds.clear();
        this.selectedClssMap.clear();
        if (Array.isArray(ids)) {
            // 单选模式下，只保留第一个
            if (this.maxSelect === 1 && ids.length > 1) {
                ids = [ids[0]];
            }
            ids.forEach(id => {
                const clss = this.allClssList.find(c => c.clss_id == id);
                if (clss) {
                    this.selectedClssIds.add(id);
                    this.selectedClssMap.set(id, {
                        clss_id: clss.clss_id,
                        clss_title: clss.clss_title || clss.title,
                        clss_year: clss.clss_year || clss.year,
                        clss_semester: clss.clss_semester || clss.semester,
                        is_own: clss.is_own,
                        is_old: this.isClssTooOld(clss)
                    });
                }
            });
        }
        this.updateSelectedList();
        this.updateSelectedCount();
        this.updateHiddenInput();
        this.updateCandidateList();
        this.emitSelectionChange();
    }
    
    // 只读模式：设置单个班级显示
    setReadOnlyClss(clssId, clssTitle, clssSemester) {
        if (!this.isReadOnly) return;

        // 维护内部选中状态，便于统一校验/按钮状态
        const id = parseInt(clssId, 10);
        if (Number.isFinite(id) && id > 0) {
            this.selectedClssIds.clear();
            this.selectedClssMap.clear();
            this.selectedClssIds.add(id);
            this.selectedClssMap.set(id, {
                clss_id: id,
                clss_title: clssTitle || '',
                clss_year: null,
                clss_semester: clssSemester || '',
                is_own: false,
                is_old: false
            });
        }
        
        const html = `
            <div class="d-flex align-items-center">
                <strong>${clssId}</strong>: ${this.escapeHtml(clssTitle || '')}
                <small class="text-muted ms-2">${clssSemester || ''}</small>
            </div>
            <div class="text-muted small mt-1">
                <i class="bi bi-info-circle"></i> 仅课程管理员可修改班级绑定
            </div>
        `;
        $('#clss_readonly_display').html(html);
        $('#clss_ids_input').val(clssId).trigger('change');
        this.updateSelectedCount();
        this.emitSelectionChange();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    validate() {
        const selectedIds = this.getSelectedClssIds();
        if (selectedIds.length === 0) {
            return { valid: false, message: '请至少选择一个班级' };
        }

        // 单选模式必须恰好选择 1 个
        if (this.maxSelect === 1 && selectedIds.length !== 1) {
            return { valid: false, message: '编辑练习时只能绑定一个班级' };
        }
        
        // 检查是否有旧班级
        const oldClss = Array.from(this.selectedClssMap.values()).filter(c => c.is_old);
        if (oldClss.length > 0) {
            const oldClssNames = oldClss.map(c => `${c.clss_id}: ${c.clss_title || ''}`).join('\n');
            return {
                valid: true,
                needConfirm: true,
                message: `您选择了 ${oldClss.length} 个较旧的班级（创建时间超过 ${this.monthsThreshold} 个月）：\n\n${oldClssNames}\n\n确定要继续吗？`
            };
        }
        
        return { valid: true, needConfirm: false };
    }
}
