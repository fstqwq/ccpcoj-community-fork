
// 题目选择器查询参数函数
function problemSelectionQueryParams(params) {
    return {
        offset: params.offset,
        limit: params.limit,
        sort: params.sort,
        order: params.order,
        search: params.search
    };
}

/* ========================================
   题号输入组件 (Problem Input Component)
   ======================================== */

// 题号输入组件管理类
class ProblemInputComponent {
           constructor(containerId, options = {}) {
               this.container = document.getElementById(containerId);
               if (!this.container) {
                   console.error(`ProblemInputComponent: Container ${containerId} not found`);
                   return;
               }
               
               this.opts = Object.assign({
                   max: 26,
                   allowDuplicates: false,
                   allowInvalid: false,
                   showCount: true,
                   showActions: true,
                   /** 外观：default 完整标签与说明；compact 与 input-group-sm / ZIP 导出条对齐 */
                   uiVariant: 'default',
                   showLabel: true,
                   showHelpText: true,
                   /** 传给内置 input 的 placeholder；null 用组件默认长文案 */
                   inputPlaceholder: null,
                   onChange: null,
                   onError: null
               }, options);
               
               this.chipsInput = null;
               this.sortState = 'none'; // none, asc, desc
               this.sortHistory = []; // 存储排序历史
               this._build();
               this._init();
           }
    
           _build() {
               const variantClass = this.opts.uiVariant === 'compact'
                   ? ' problem-input-component--compact'
                   : '';
               const noLabelClass = !this.opts.showLabel ? ' problem-input-component--no-label' : '';
               const chipsAria = !this.opts.showLabel
                   ? ` aria-label="题号列表：回车或逗号分隔，最多 ${this.opts.max} 题" role="group"`
                   : '';
               const labelHtml = this.opts.showLabel
                   ? `
                       <div class="component-label">
                           <label class="form-label">
                               题目列表
                               ${this.opts.showCount ? '<span class="problem-count-badge badge bg-primary">0/' + this.opts.max + '</span>' : ''}
                               <span class="en-text text-muted ${this.opts.uiVariant === 'compact' ? 'problem-input-component__en-inline' : 'd-block'}">Problem List</span>
                           </label>
                       </div>`
                   : '';
               // 创建组件HTML结构
               this.container.innerHTML = `
                   <div class="problem-input-component${variantClass}${noLabelClass}">
                       ${labelHtml}
                       <!-- 最佳实践：后端用 problems[] 接收数组；同时保留 problems_csv 便于调试/兼容 -->
                       <input type="hidden" name="problems_csv" value="">
                       <div class="problem-hidden-array" aria-hidden="true"></div>
                       
                       <!-- 题号标签输入区域与操作按钮组合 -->
                       <div class="input-group${this.opts.uiVariant === 'compact' ? ' input-group-sm' : ''}">
                           <!-- 题号标签输入区域 -->
                           <div class="csg-prochips"${chipsAria}
                                data-input="input[name='problems_csv']" 
                                data-max="${this.opts.max}"
                                data-allow-duplicates="${this.opts.allowDuplicates}"
                                data-allow-invalid="${this.opts.allowInvalid}">
                           </div>
                           
                           ${this.opts.showActions ? `
                           <!-- 操作按钮组 -->
                           <div class="btn-group" role="group">
                               <button type="button" class="btn btn-outline-primary btn-sm" 
                                       data-action="open-selector"
                                       title="题目选择器 / Problem Selector">
                                   <i class="bi bi-list-check"></i>
                               </button>
                               <button type="button" class="btn btn-outline-success btn-sm"
                                       data-action="copy"
                                       title="复制题目列表 / Copy as CSV">
                                   <i class="bi bi-clipboard"></i>
                               </button>
                               <button type="button" class="btn btn-outline-secondary btn-sm" 
                                       data-action="sort"
                                       title="排序 / Sort"
                                       data-sort-state="none">
                                   <i class="bi bi-sort-numeric-down"></i>
                               </button>
                               <button type="button" class="btn btn-outline-danger btn-sm" 
                                       data-action="clear"
                                       title="清空 / Clear">
                                   <i class="bi bi-trash"></i>
                               </button>
                           </div>
                           ` : ''}
                       </div>
                       
                       ${this.opts.showHelpText ? `
                       <div class="form-text problem-input-component__hint">
                           <span class="bilingual-inline">
                               <span>输入题号后回车/逗号分隔，或使用题目选择器（最多${this.opts.max}个题目）</span>
                               <span class="en-text">Enter problem IDs separated by comma, or use problem selector (max ${this.opts.max} problems)</span>
                           </span>
                       </div>
                       ` : ''}
                   </div>
               `;
           }
    
    _init() {
        // 初始化题号标签输入组件
        const chipsContainer = this.container.querySelector('.csg-prochips');
               const chipsOpts = {
                   hiddenInput: 'input[name="problems_csv"]',
                   onChange: (csv, component) => {
                       this._updateCount();
                       // 同步 problems_csv（字符串）并构造 problems[]（数组，最佳实践）
                       const hiddenInput = this.container.querySelector('input[name="problems_csv"]');
                       if (hiddenInput) {
                           hiddenInput.value = csv;
                           // 触发事件通知其他监听器
                           hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
                           hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                       }
                       this._syncProblemsArrayInputs(csv);
                       if (typeof this.opts.onChange === 'function') {
                           this.opts.onChange(csv, component);
                       }
                   },
                   onError: (message) => {
                       if (typeof this.opts.onError === 'function') {
                           this.opts.onError(message);
                       } else {
                           alerty.warning(message);
                       }
                   }
               };
               if (this.opts.inputPlaceholder) {
                   chipsOpts.placeholder = this.opts.inputPlaceholder;
               }
               this.chipsInput = new ProblemChipsInput(chipsContainer, chipsOpts);
        
        // 绑定操作按钮事件
        this._bindEvents();
    }

    /**
     * 将 csv 同步为多个 hidden input：name="problems[]"
     * 说明：不要同时提交 name="problems"（标量）与 name="problems[]"（数组），PHP 会产生覆盖/歧义。
     */
    _syncProblemsArrayInputs(csv) {
        const holder = this.container.querySelector('.problem-hidden-array');
        if (!holder) return;
        // 清空旧的
        holder.innerHTML = '';

        const raw = String(csv || '').trim();
        if (!raw) return;

        // 仅按英文逗号切分（组件输出保证是逗号），同时容忍空白
        const parts = raw.split(',').map(s => String(s).trim()).filter(Boolean);
        if (parts.length === 0) return;

        const frag = document.createDocumentFragment();
        for (const p of parts) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'problems[]';
            input.value = p;
            frag.appendChild(input);
        }
        holder.appendChild(frag);
    }
    
           _bindEvents() {
               // 题目选择器按钮
               this.container.querySelector('[data-action="open-selector"]')?.addEventListener('click', () => {
                   this._openSelector();
               });

               // 复制按钮：复制当前题目列表为逗号分隔字符串
               this.container.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
                   try {
                       const csv = (this.chipsInput && typeof this.chipsInput.toCSV === 'function')
                           ? String(this.chipsInput.toCSV() || '')
                           : '';
                       const text = csv.trim();
                       if (!text) {
                           alerty.warning({
                               message: '题目列表为空，无法复制',
                               message_en: 'Problem list is empty, nothing to copy'
                           });
                           return;
                       }
                       // 优先使用现代 Clipboard API
                       if (navigator.clipboard && navigator.clipboard.writeText) {
                           await navigator.clipboard.writeText(text);
                       } else {
                           // fallback：textarea + execCommand（兼容旧浏览器/非 HTTPS）
                           const ta = document.createElement('textarea');
                           ta.value = text;
                           ta.setAttribute('readonly', 'readonly');
                           ta.style.position = 'fixed';
                           ta.style.left = '-9999px';
                           ta.style.top = '0';
                           document.body.appendChild(ta);
                           ta.focus();
                           ta.select();
                           const ok = document.execCommand('copy');
                           document.body.removeChild(ta);
                           if (!ok) {
                               throw new Error('copy failed');
                           }
                       }
                       alerty.success({
                           message: '已复制题目列表（逗号分隔）',
                           message_en: 'Copied as comma-separated list'
                       });
                   } catch (e) {
                       console.error(e);
                       alerty.error({
                           message: '复制失败，请手动复制隐藏输入框内容',
                           message_en: 'Copy failed, please copy manually'
                       });
                   }
               });
               
               // 排序按钮
               this.container.querySelector('[data-action="sort"]')?.addEventListener('click', () => {
                   this._handleSort();
               });
               
               // 清空按钮
               this.container.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
                   this.chipsInput.clear();
               });
           }
    
    _openSelector() {
        if (typeof window.showProblemSelection === 'function') {
            window.showProblemSelection();
        } else {
            console.error('Problem selection modal not available');
        }
    }
    
           _updateCount() {
               const badge = this.container.querySelector('.problem-count-badge');
               if (badge) {
                   const count = this.chipsInput.getCount();
                   badge.textContent = `${count}/${this.opts.max}`;
               }
           }
           
           _handleSort() {
               const currentArray = this.chipsInput.toArray();
               if (currentArray.length === 0) {
                   alerty.warning({
                       message: '题目列表为空，无法排序',
                       message_en: 'Problem list is empty, cannot sort'
                   });
                   return;
               }
               
               const sortBtn = this.container.querySelector('[data-action="sort"]');
               const sortIcon = sortBtn.querySelector('i');
               
               // 保存当前状态到历史记录
               if (this.sortState !== 'none') {
                   this.sortHistory.push({
                       state: this.sortState,
                       array: [...currentArray]
                   });
               }
               
               let newArray = [...currentArray];
               let newState = 'none';
               let newIcon = 'bi-sort-numeric-down';
               let newTitle = '排序 / Sort';
               
               switch (this.sortState) {
                   case 'none':
                       // 正序排序
                       newArray.sort((a, b) => parseInt(a) - parseInt(b));
                       newState = 'asc';
                       newIcon = 'bi-sort-numeric-up';
                       newTitle = '倒序 / Descending';
                       break;
                   case 'asc':
                       // 倒序排序
                       newArray.sort((a, b) => parseInt(b) - parseInt(a));
                       newState = 'desc';
                       newIcon = 'bi-arrow-counterclockwise';
                       newTitle = '恢复 / Restore';
                       break;
                   case 'desc':
                       // 恢复最近一次修改
                       if (this.sortHistory.length > 0) {
                           const lastState = this.sortHistory.pop();
                           newArray = lastState.array;
                           newState = 'none';
                           newIcon = 'bi-sort-numeric-down';
                           newTitle = '排序 / Sort';
                       } else {
                           // 没有历史记录，恢复到原始顺序
                           newArray = currentArray;
                           newState = 'none';
                           newIcon = 'bi-sort-numeric-down';
                           newTitle = '排序 / Sort';
                       }
                       break;
               }
               
               // 更新状态
               this.sortState = newState;
               sortBtn.setAttribute('data-sort-state', newState);
               sortBtn.setAttribute('title', newTitle);
               sortIcon.className = `bi ${newIcon}`;
               
               // 应用新的排序
               this.chipsInput.setFromArray(newArray);
               
               // 显示操作提示
               const messages = {
                   'asc': { zh: '已按正序排序', en: 'Sorted in ascending order' },
                   'desc': { zh: '已按倒序排序', en: 'Sorted in descending order' },
                   'none': { zh: '已恢复原始顺序', en: 'Restored to original order' }
               };
               
               if (messages[newState]) {
                   alerty.success({
                       message: messages[newState].zh,
                       message_en: messages[newState].en
                   });
               }
           }
    
    // 公共API方法
    setValue(csv) {
        this.chipsInput.setFromCSV(csv);
    }
    
    getValue() {
        return this.chipsInput.toCSV();
    }
    
    getArray() {
        return this.chipsInput.toArray();
    }
    
    clear() {
        this.chipsInput.clear();
    }
    
    addProblems(problemIds) {
        this.chipsInput.addMany(problemIds.map(String));
    }
    
    disable() {
        this.chipsInput.disable();
    }
    
    enable() {
        this.chipsInput.enable();
    }
}

/* ========================================
   题目选择器模态框功能 (Problem Selection Modal) - Bootstrap Table 版本
   ======================================== */

// 题目选择器相关变量
let problemSelectionTable = null;
let selectedProblems = new Set();

if (typeof window.problemPickerCheckOrder === 'undefined') {
    window.problemPickerCheckOrder = [];
}
if (typeof window.problemPickerShiftAnchorIndex === 'undefined') {
    window.problemPickerShiftAnchorIndex = -1;
}
if (typeof window.problemPickerSuppressRowEvents === 'undefined') {
    window.problemPickerSuppressRowEvents = false;
}

// 初始化题目选择器模态框
function initProblemSelectionModal() {
    // 检查模态框元素是否存在
    const modalElement = document.getElementById('problemSelectionModal');
    if (!modalElement) {
        console.warn('Problem selection modal element not found');
        return;
    }
    
    const problemSelectionModal = new bootstrap.Modal(modalElement);
    
    // 显示模态框
    window.showProblemSelection = function() {
        if (problemSelectionModal) {
            window.problemPickerCheckOrder = [];
            window.problemPickerShiftAnchorIndex = -1;
            problemSelectionModal.show();
            // 刷新表格数据
            setTimeout(() => {
                const table = $('#problemSelectionTable');
                if (table.length && typeof table.bootstrapTable === 'function') {
                    table.bootstrapTable('refresh');
                }
                if (typeof window.updateProblemPickerPickFooter === 'function') {
                    window.updateProblemPickerPickFooter();
                }
            }, 100);
        } else {
            console.error('Problem selection modal not initialized');
        }
    };

    $('#problemSelectionModal').on('shown.bs.modal.problemPicker', function () {
        const $t = $('#problemSelectionTable');
        if ($t.length && $t.data('bootstrap.table')) {
            $t.bootstrapTable('resetView');
        }
        if (typeof window.updateProblemPickerPickFooter === 'function') {
            window.updateProblemPickerPickFooter();
        }
    });

    $('#problemSelectionModal').on('hidden.bs.modal.problemPicker', function () {
        window.problemPickerCheckOrder = [];
        window.problemPickerShiftAnchorIndex = -1;
        if (typeof window.updateProblemPickerPickFooter === 'function') {
            window.updateProblemPickerPickFooter();
        }
    });
    
    // 延迟初始化选择器功能
    setTimeout(initProblemSelectionFeatures, 200);
}

// 题目选择器专用功能（与模板练习选择器一致的累加 + Shift 区间顺序；服务端分页下区间仅限当前页 getData）
function initProblemSelectionFeatures() {
    const table = $('#problemSelectionTable');
    
    if (!table.length) {
        console.warn('Problem selection table not found');
        return;
    }
    if (table.data('problemPickerPickInited')) {
        return;
    }
    table.data('problemPickerPickInited', true);

    let problemPickerMouse = { shift: false, ctrl: false, index: -1 };
    let problemPickerApplyingRange = false;

    function problemPickerBuildPathIndices(anchorIdx, endIdx) {
        const C = typeof window.CsgBsTablePickOrder !== 'undefined' ? window.CsgBsTablePickOrder : null;
        if (C && typeof C.buildPathIndices === 'function') {
            return C.buildPathIndices(anchorIdx, endIdx);
        }
        const path = [];
        if (anchorIdx <= endIdx) {
            for (let i = anchorIdx; i <= endIdx; i++) {
                path.push(i);
            }
        } else {
            for (let j = anchorIdx; j >= endIdx; j--) {
                path.push(j);
            }
        }
        return path;
    }

    function problemPickerMergePathIds(pathIds) {
        const C = typeof window.CsgBsTablePickOrder !== 'undefined' ? window.CsgBsTablePickOrder : null;
        if (C && typeof C.mergePathIntoOrder === 'function') {
            window.problemPickerCheckOrder = C.mergePathIntoOrder(window.problemPickerCheckOrder || [], pathIds);
            return;
        }
        const set = {};
        (pathIds || []).forEach(function (id) {
            set[id] = true;
        });
        const rest = (window.problemPickerCheckOrder || []).filter(function (id) {
            return !set[id];
        });
        window.problemPickerCheckOrder = rest.concat(pathIds || []);
    }

    function updateProblemPickerPickFooter() {
        const order = window.problemPickerCheckOrder || [];
        if ($('#selectedCountFooter').length) {
            $('#selectedCountFooter').text(String(order.length));
        }
        if ($('#selectedCount').length) {
            $('#selectedCount').text(String(order.length));
        }
        let text = order.length ? order.join(', ') : '—';
        const maxLen = 600;
        if (text.length > maxLen) {
            text = text.slice(0, maxLen) + '…';
        }
        if ($('#problemPickerPickIds').length) {
            $('#problemPickerPickIds').text(text);
        }
    }
    window.updateProblemPickerPickFooter = updateProblemPickerPickFooter;

    function syncProblemPickerChecksFromOrder() {
        const order = window.problemPickerCheckOrder || [];
        if (!order.length) {
            return;
        }
        const pickSet = {};
        order.forEach(function (pid) {
            pickSet[String(pid)] = true;
        });
        let data;
        try {
            data = table.bootstrapTable('getData') || [];
        } catch (eSync) {
            return;
        }
        const values = [];
        data.forEach(function (row) {
            if (row && pickSet[String(row.problem_id)]) {
                values.push(row.problem_id);
            }
        });
        if (!values.length) {
            return;
        }
        window.problemPickerSuppressRowEvents = true;
        try {
            table.bootstrapTable('checkBy', { field: 'problem_id', values: values });
        } catch (eSync2) {
            // ignore
        } finally {
            window.problemPickerSuppressRowEvents = false;
        }
    }

    table.off('post-body.bs.table.problemPickerSync').on('post-body.bs.table.problemPickerSync', function () {
        syncProblemPickerChecksFromOrder();
    });

    table.off('mousedown.problemPickerPick').on('mousedown.problemPickerPick', 'tbody tr', function (e) {
        const $td = $(e.target).closest('td');
        if (!$td.length) {
            problemPickerMouse = { shift: !!e.shiftKey, ctrl: !!(e.ctrlKey || e.metaKey), index: -1 };
            return;
        }
        const ci = $td[0].cellIndex;
        // 勾选列 + 题号列（与模板选择器「前三列」同理，此处为前两列）
        if (ci === undefined || ci > 1) {
            problemPickerMouse = { shift: !!e.shiftKey, ctrl: !!(e.ctrlKey || e.metaKey), index: -1 };
            return;
        }
        const $tr = $(this);
        const idx = $tr.data('index');
        if (idx === undefined || idx === null || idx === '') {
            return;
        }
        problemPickerMouse = {
            shift: !!e.shiftKey,
            ctrl: !!(e.ctrlKey || e.metaKey),
            index: parseInt(idx, 10)
        };
    });

    table.off('check.bs.table.problemPickerPick').on('check.bs.table.problemPickerPick', function (e, row) {
        if (window.problemPickerSuppressRowEvents) {
            return;
        }
        if (problemPickerApplyingRange) {
            return;
        }
        let data;
        try {
            data = table.bootstrapTable('getData') || [];
        } catch (e0) {
            return;
        }
        const curIdx = data.findIndex(function (r) {
            return r.problem_id === row.problem_id;
        });
        if (curIdx < 0) {
            return;
        }
        const anchor = typeof window.problemPickerShiftAnchorIndex === 'number' ? window.problemPickerShiftAnchorIndex : -1;

        if (problemPickerMouse.shift && anchor >= 0) {
            problemPickerApplyingRange = true;
            try {
                const pathIdx = problemPickerBuildPathIndices(anchor, curIdx);
                const pathIds = pathIdx.map(function (i) {
                    return data[i].problem_id;
                });
                pathIdx.forEach(function (i) {
                    if (i !== curIdx) {
                        try {
                            table.bootstrapTable('check', i);
                        } catch (e1) {
                            // ignore
                        }
                    }
                });
                problemPickerMergePathIds(pathIds);
                window.problemPickerShiftAnchorIndex = curIdx;
            } finally {
                problemPickerApplyingRange = false;
            }
        } else {
            const pid = row.problem_id;
            const ord = window.problemPickerCheckOrder || [];
            if (ord.indexOf(pid) === -1) {
                ord.push(pid);
            }
            window.problemPickerCheckOrder = ord;
            window.problemPickerShiftAnchorIndex = curIdx;
        }
        updateProblemPickerPickFooter();
    });

    table.off('uncheck.bs.table.problemPickerPick').on('uncheck.bs.table.problemPickerPick', function (e, row) {
        if (window.problemPickerSuppressRowEvents) {
            return;
        }
        if (problemPickerApplyingRange) {
            return;
        }
        const pid = row.problem_id;
        window.problemPickerCheckOrder = (window.problemPickerCheckOrder || []).filter(function (x) {
            return x !== pid;
        });
        let data;
        try {
            data = table.bootstrapTable('getData') || [];
        } catch (e2) {
            data = [];
        }
        const curIdx = data.findIndex(function (r) {
            return r.problem_id === pid;
        });
        if (curIdx >= 0 && window.problemPickerShiftAnchorIndex === curIdx) {
            window.problemPickerShiftAnchorIndex = -1;
        }
        updateProblemPickerPickFooter();
    });

    table.off('check-all.bs.table.problemPickerPick').on('check-all.bs.table.problemPickerPick', function () {
        if (window.problemPickerSuppressRowEvents) {
            return;
        }
        let data;
        let sel;
        try {
            data = table.bootstrapTable('getData') || [];
            sel = table.bootstrapTable('getSelections') || [];
        } catch (e3) {
            return;
        }
        const set = {};
        sel.forEach(function (r) {
            set[r.problem_id] = true;
        });
        const ord = [];
        data.forEach(function (r) {
            if (set[r.problem_id]) {
                ord.push(r.problem_id);
            }
        });
        window.problemPickerCheckOrder = ord;
        if (ord.length) {
            const li = data.findIndex(function (r) {
                return r.problem_id === ord[ord.length - 1];
            });
            window.problemPickerShiftAnchorIndex = li >= 0 ? li : -1;
        } else {
            window.problemPickerShiftAnchorIndex = -1;
        }
        updateProblemPickerPickFooter();
    });

    table.off('uncheck-all.bs.table.problemPickerPick').on('uncheck-all.bs.table.problemPickerPick', function () {
        if (window.problemPickerSuppressRowEvents) {
            return;
        }
        window.problemPickerCheckOrder = [];
        window.problemPickerShiftAnchorIndex = -1;
        updateProblemPickerPickFooter();
    });
    
    // 绑定工具栏按钮事件
    $(document).off('click.problemPickerPick', '#selectAllBtn').on('click.problemPickerPick', '#selectAllBtn', function() {
        table.bootstrapTable('checkAll');
    });
    
    $(document).off('click.problemPickerPick', '#deselectAllBtn').on('click.problemPickerPick', '#deselectAllBtn', function() {
        table.bootstrapTable('uncheckAll');
    });
    
    $(document).off('click.problemPickerPick', '#selectVisibleBtn').on('click.problemPickerPick', '#selectVisibleBtn', function() {
        table.bootstrapTable('checkBy', {field: 'problem_id'});
    });
    
    // 确认选择
    // 服务端分页下 getSelections 仅含当前页；跨页勾选以 problemPickerCheckOrder 为准（与页脚预览一致）
    $(document).off('click.problemPickerPick', '#confirmSelection').on('click.problemPickerPick', '#confirmSelection', function() {
        const rawOrder = window.problemPickerCheckOrder || [];
        const seen = {};
        const ordered = [];
        rawOrder.forEach(function (pid) {
            if (seen[pid]) {
                return;
            }
            seen[pid] = true;
            ordered.push(pid);
        });

        if (ordered.length === 0) {
            alerty.warning({
                message: '请至少选择一个题目',
                message_en: 'Please select at least one problem'
            });
            return;
        }

        if (window.onProblemSelectionConfirm) {
            window.onProblemSelectionConfirm(ordered);
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('problemSelectionModal'));
        if (modal) {
            modal.hide();
        }
    });
}

// 全局题号输入组件实例管理
window.ProblemInputComponents = new Map();

// 创建题号输入组件的便捷函数
window.createProblemInput = function(containerId, options = {}) {
    const component = new ProblemInputComponent(containerId, options);
    window.ProblemInputComponents.set(containerId, component);
    return component;
};

(function(global){
    'use strict';
    
    const SEP_REG = /[,\s，；;]+/g;
    // 与后端 contest 题号解析一致：至少 4 位数字题号（≥1000），可选「:分值」如 100071:20
    const PRO_ID_REG = /^\d{4,}(:\d+)?$/;

    class ProblemChipsInput {
        constructor(el, options = {}) {
            this.root = typeof el === 'string' ? document.querySelector(el) : el;
            if (!this.root) throw new Error('ProblemChipsInput: root element not found');

            const ds = this.root.dataset;
            this.opts = Object.assign({
                hiddenInput: ds.input || null,     // 绑定的隐藏输入选择器
                max: parseInt(ds.max || '999', 10),
                allowDuplicates: ds.allowDuplicates === 'true',
                allowInvalid: ds.allowInvalid === 'true',
                placeholder: null,
                onChange: null,
                onError: null
            }, options);

            this.hidden = this.opts.hiddenInput ? document.querySelector(this.opts.hiddenInput) : null;
            this.values = new Map(); // key -> { id, valid }
            this._build();
            this._loadFromHidden();
        }

        _loadFromHidden() {
            // 从隐藏输入框加载初始值
            if (this.hidden && this.hidden.value) {
                this.setFromCSV(this.hidden.value);
            }
        }

        _build() {
            this.root.classList.add('csg-prochips');

            // 创建输入框
            this.input = document.createElement('input');
            this.input.type = 'text';
            this.input.className = 'csg-prochips-input';
            this.input.placeholder = this.opts.placeholder || '输入题号后回车/逗号分隔…';
            this.root.appendChild(this.input);

            // 输入事件处理
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                    e.preventDefault();
                    this._commitInput();
                } else if (e.key === 'Backspace') {
                    // 如果输入框为空，删除最后一个chip
                    if (!this.input.value) {
                        const last = Array.from(this.values.keys()).pop();
                        if (last) this.remove(last);
                    }
                } else if (e.key === 'Delete') {
                    // Delete键：如果输入框为空，删除第一个chip
                    if (!this.input.value) {
                        const first = Array.from(this.values.keys())[0];
                        if (first) this.remove(first);
                    }
                } else if (e.key === 'ArrowLeft' && !this.input.value) {
                    // 左箭头：如果输入框为空，选择最后一个chip
                    const lastChip = this.root.querySelector('.chip:last-child');
                    if (lastChip) {
                        lastChip.classList.add('selected');
                        e.preventDefault();
                    }
                } else if (e.key === 'ArrowRight' && !this.input.value) {
                    // 右箭头：如果输入框为空，选择第一个chip
                    const firstChip = this.root.querySelector('.chip:first-child');
                    if (firstChip) {
                        firstChip.classList.add('selected');
                        e.preventDefault();
                    }
                } else if (e.key === 'Escape') {
                    // ESC键：取消选择
                    this.root.querySelectorAll('.chip.selected').forEach(chip => {
                        chip.classList.remove('selected');
                    });
                }
            });

            // 粘贴事件处理
            this.input.addEventListener('paste', (e) => {
                const text = (e.clipboardData || window.clipboardData).getData('text');
                if (text && SEP_REG.test(text)) {
                    e.preventDefault();
                    this.addMany(this._parse(text));
                }
            });

            // 失焦时提交输入
            this.input.addEventListener('blur', () => this._commitInput());

            // 委托删除事件
            this.root.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-close[data-id]');
                if (!btn) return;
                const id = btn.getAttribute('data-id');
                this.remove(id);
            });
        }

        _parse(str) {
            return str.split(SEP_REG)
                      .map(s => s.trim())
                      .filter(s => s.length);
        }

        _valid(id) {
            return PRO_ID_REG.test(id);
        }

        _commitInput() {
            const val = this.input.value.trim();
            if (!val) return;
            this.input.value = '';
            const items = this._parse(val);
            if (items.length) this.addMany(items);
        }

        add(id) {
            if (this.values.size >= this.opts.max) {
                this._error(`最多只能添加 ${this.opts.max} 个题目`);
                return false;
            }
            
            const key = id;
            const valid = this._valid(id);
            
            if (!this.opts.allowInvalid && !valid) {
                this._error(`题号格式无效: ${id}`);
                return false;
            }
            
            if (!this.opts.allowDuplicates && this.values.has(key)) {
                this._error(`题号已存在: ${id}`);
                return false;
            }

            this.values.set(key, { id, valid });
            this._renderChip(id, valid);
            this._syncHidden();
            return true;
        }

        _renderChip(id, valid) {
            const chip = document.createElement('span');
            chip.className = 'chip' + (valid ? '' : ' invalid');
            chip.setAttribute('data-id', id);
            chip.setAttribute('draggable', 'true');
            chip.innerHTML = `
                <span>${id}</span>
                <button type="button" class="btn-close" aria-label="删除" data-id="${id}"></button>
            `;
            
            // 添加拖拽事件
            this._addDragEvents(chip);
            
            this.root.insertBefore(chip, this.input);
        }

        addMany(list) {
            const added = [];
            const errors = [];
            
            list.forEach(id => {
                if (this.add(id)) {
                    added.push(id);
                } else {
                    errors.push(id);
                }
            });
            
            if (errors.length > 0) {
                this._error(`部分题号添加失败: ${errors.join(', ')}`);
            }
            
            return added;
        }

        remove(id) {
            this.values.delete(id);
            const node = this.root.querySelector(`.chip[data-id="${CSS.escape(id)}"]`);
            if (node) node.remove();
            this._syncHidden();
        }

        setFromCSV(csv) {
            this.clear();
            if (csv && csv.trim()) {
                this.addMany(this._parse(csv));
            }
        }

        toCSV() {
            return Array.from(this.values.keys()).join(',');
        }

        toArray() {
            return Array.from(this.values.keys());
        }
        
        setFromArray(array) {
            this.clear();
            this.addMany(array.map(String));
        }

        clear() {
            this.values.clear();
            this.root.querySelectorAll('.chip').forEach(n => n.remove());
            this._syncHidden();
        }

        getCount() {
            return this.values.size;
        }

        getValidCount() {
            return Array.from(this.values.values()).filter(v => v.valid).length;
        }

        _syncHidden() {
            const csv = this.toCSV();
            if (this.hidden) {
                this.hidden.value = csv;
                // 触发 change 和 input 事件，确保其他监听器能收到通知
                this.hidden.dispatchEvent(new Event('input', { bubbles: true }));
                this.hidden.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (typeof this.opts.onChange === 'function') {
                this.opts.onChange(csv, this);
            }
        }

        _error(message) {
            if (typeof this.opts.onError === 'function') {
                this.opts.onError(message);
            } else {
                console.warn('ProblemChipsInput:', message);
            }
        }

        _addDragEvents(chip) {
            chip.addEventListener('dragstart', (e) => {
                this.draggedChip = chip;
                chip.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            chip.addEventListener('dragend', (e) => {
                chip.classList.remove('dragging');
                this.draggedChip = null;
            });

            chip.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            chip.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.draggedChip && this.draggedChip !== chip) {
                    this._moveChip(this.draggedChip, chip);
                }
            });
        }

        _moveChip(draggedChip, targetChip) {
            // 获取两个chip的ID
            const draggedId = draggedChip.getAttribute('data-id');
            const targetId = targetChip.getAttribute('data-id');
            
            // 获取当前DOM顺序（基于实际DOM位置）
            const domChips = Array.from(this.root.querySelectorAll('.chip'));
            const currentDomOrder = domChips.map(chip => chip.getAttribute('data-id'));
            
            // 找到拖拽元素和目标元素在DOM中的位置
            const draggedIndex = currentDomOrder.indexOf(draggedId);
            const targetIndex = currentDomOrder.indexOf(targetId);
            
            if (draggedIndex === -1 || targetIndex === -1) return;
            
            // 计算新的DOM顺序
            const newDomOrder = [...currentDomOrder];
            newDomOrder.splice(draggedIndex, 1);
            newDomOrder.splice(targetIndex, 0, draggedId);
            
            // 重新构建values Map，严格按照新的DOM顺序
            const newValues = new Map();
            newDomOrder.forEach(id => {
                if (this.values.has(id)) {
                    newValues.set(id, this.values.get(id));
                }
            });
            this.values = newValues;
            
            // 重新渲染DOM，确保完全同步
            this._reorderDOM(newDomOrder);
            
            // 更新隐藏输入框
            this._syncHidden();
        }

        _reorderDOM(newOrder) {
            // 获取所有chip元素
            const chips = Array.from(this.root.querySelectorAll('.chip'));
            const chipMap = new Map();
            
            // 创建chip映射
            chips.forEach(chip => {
                const id = chip.getAttribute('data-id');
                chipMap.set(id, chip);
            });
            
            // 移除所有chip
            chips.forEach(chip => chip.remove());
            
            // 按新顺序重新插入
            newOrder.forEach(id => {
                const chip = chipMap.get(id);
                if (chip) {
                    this.root.insertBefore(chip, this.input);
                }
            });
        }

        // 排序功能
        sort() {
            const ids = this.toArray().sort((a, b) => parseInt(a) - parseInt(b));
            
            // 重新构建values Map
            const newValues = new Map();
            ids.forEach(id => {
                if (this.values.has(id)) {
                    newValues.set(id, this.values.get(id));
                }
            });
            this.values = newValues;
            
            // 重新渲染DOM
            this._reorderDOM(ids);
            
            // 更新隐藏输入框
            this._syncHidden();
        }

        // 禁用/启用
        disable() {
            this.root.classList.add('disabled');
            this.input.disabled = true;
        }

        enable() {
            this.root.classList.remove('disabled');
            this.input.disabled = false;
        }
    }

    // 全局暴露
    global.ProblemChipsInput = ProblemChipsInput;

    // 自动初始化所有带有 data-auto-init 属性的组件
    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('[data-auto-init="problem-chips"]').forEach(el => {
            new ProblemChipsInput(el);
        });
    });

})(window);
