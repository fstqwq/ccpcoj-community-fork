/**
 * DualListSelector - 通用左右双栏选择器组件
 * 左侧候选列表（支持搜索），右侧已选列表；通过参数定制数据源、展示字段、排除项、输出输入框等
 * 可用于：课程教师选择（考试可管理人）、候选班级等
 */
(function() {
    'use strict';

    function escapeHtml(text) {
        if (text == null) return '';
        var div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function defaultResponseAdapter(ret) {
        if (Array.isArray(ret)) return ret;
        if (ret && ret.data && Array.isArray(ret.data)) return ret.data;
        return [];
    }

    function defaultLabels() {
        return {
            candidateTitle: '候选',
            candidateTitleEn: 'Available',
            selectedTitle: '已选',
            selectedTitleEn: 'Selected',
            selectedEmpty: '暂无已选',
            loading: '加载中...',
            noResults: '没有找到',
            searchPlaceholder: '搜索...'
        };
    }

    /**
     * options:
     *   container: string 容器选择器
     *   fetch: { url: string, method?: 'GET'|'POST', params?: object|function }
     *   idField: string 条目主键字段名，如 'user_id' / 'clss_id'
     *   itemDisplay: Array<{ field: string, tag?: string, className?: string }> 每行展示的字段（tag 默认 span，可选 strong/small 等）
     *   excludeIds: Array 从候选中排除的 id 列表
     *   initialSelectedIds: Array 初始已选 id
     *   outputInputId: string 隐藏域 id，写入逗号分隔的 id
     *   labels: object 覆盖默认文案
     *   responseAdapter: (response) => array 将接口返回转为条目数组
     *   itemTransform: (item) => item 每条数据在展示前的转换（如补 pvrole_label）
     *   searchFields: Array<string> 用于前端搜索的字段名，默认取 itemDisplay 的 field
     */
    window.DualListSelector = function(options) {
        this.options = options || {};
        this.container = $(options.container);
        this.idField = options.idField || 'id';
        this.fetchConfig = options.fetch || {};
        this.itemDisplay = options.itemDisplay || [{ field: this.idField, tag: 'strong' }];
        this.excludeIdsSet = new Set(Array.isArray(options.excludeIds) ? options.excludeIds.map(String) : []);
        this.initialSelectedIds = Array.isArray(options.initialSelectedIds) ? options.initialSelectedIds : [];
        this.outputInputId = options.outputInputId || '';
        this.labels = Object.assign({}, defaultLabels(), options.labels || {});
        this.responseAdapter = typeof options.responseAdapter === 'function' ? options.responseAdapter : defaultResponseAdapter;
        this.itemTransform = typeof options.itemTransform === 'function' ? options.itemTransform : function(i) { return i; };
        this.searchFields = options.searchFields || this.itemDisplay.map(function(d) { return d.field; });

        this.selectedIds = new Set();
        this.selectedMap = new Map();
        this.allItems = [];
        this.filteredItems = [];
        this.onChange = typeof options.onChange === 'function' ? options.onChange : null;

        this.init();
    };

    DualListSelector.prototype.init = function() {
        this.render();
        this.bindEvents();
        this.selectedIds = new Set(this.initialSelectedIds.filter(Boolean).map(String));
        this.loadData();
    };

    DualListSelector.prototype.emitChange = function() {
        var ids = this.getSelectedIds();
        if (this.outputInputId) {
            var $out = $('#' + this.outputInputId);
            if ($out.length) $out.val(ids.join(','));
        }
        if (this.onChange) {
            try { this.onChange(ids, this); } catch (e) {}
        }
    };

    DualListSelector.prototype.render = function() {
        var L = this.labels;
        var html = [
            '<div class="dual-list-selector">',
            '  <div class="row g-3">',
            '    <div class="col-md-6">',
            '      <div class="dual-list-panel border rounded p-2" style="min-height: 280px;">',
            '        <strong class="dual-list-candidate-title">' + escapeHtml(L.candidateTitle) + ' <span class="en-text">' + escapeHtml(L.candidateTitleEn) + '</span></strong>',
            '        <div class="input-group input-group-sm mt-2">',
            '          <input type="text" class="form-control dual-list-search-input" placeholder="' + escapeHtml(L.searchPlaceholder) + '" autocomplete="off">',
            '          <button class="btn btn-outline-secondary dual-list-search-btn" type="button"><i class="bi bi-search"></i></button>',
            '        </div>',
            '        <div class="dual-list-candidate-list border rounded mt-2" style="height: 220px; overflow-y: auto;">',
            '          <div class="text-center text-muted py-3 dual-list-loading"><div class="spinner-border spinner-border-sm" role="status"></div> <span class="ms-2">' + escapeHtml(L.loading) + '</span></div>',
            '        </div>',
            '      </div>',
            '    </div>',
            '    <div class="col-md-6">',
            '      <div class="dual-list-panel border rounded p-2" style="min-height: 280px;">',
            '        <strong class="dual-list-selected-title">' + escapeHtml(L.selectedTitle) + ' <span class="en-text">' + escapeHtml(L.selectedTitleEn) + '</span></strong>',
            '        <span class="badge bg-primary ms-2 dual-list-selected-count">0</span>',
            '        <div class="dual-list-selected-list border rounded mt-2" style="height: 220px; overflow-y: auto;">',
            '          <div class="text-muted text-center py-3 dual-list-selected-empty">' + escapeHtml(L.selectedEmpty) + '</div>',
            '        </div>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
        this.container.html(html);
    };

    DualListSelector.prototype.$ = function(className) {
        return this.container.find(className);
    };

    DualListSelector.prototype.bindEvents = function() {
        var self = this;
        var searchTimeout;
        this.$('.dual-list-search-input').on('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() { self.filterList(); }, 300);
        });
        this.$('.dual-list-search-btn').on('click', function() { self.filterList(); });
    };

    DualListSelector.prototype.loadData = function() {
        var self = this;
        var url = this.fetchConfig.url;
        var method = (this.fetchConfig.method || 'GET').toUpperCase();
        var params = this.fetchConfig.params;
        if (typeof params === 'function') params = params();
        if (!url) {
            this.$('.dual-list-loading').html('<div class="text-danger">未配置数据地址</div>');
            return;
        }
        var req = method === 'POST' ? $.post(url, params || {}) : $.get(url, params || {});
        req.done(function(ret) {
            var list = self.responseAdapter(ret);
            list = list.map(function(item) { return self.itemTransform(item); });
            self.allItems = list.filter(function(item) {
                var id = item[self.idField];
                return id != null && !self.excludeIdsSet.has(String(id).trim());
            });
            self.filteredItems = self.allItems.slice();
            self.$('.dual-list-loading').hide();
            self.selectedMap.clear();
            self.allItems.forEach(function(item) {
                var id = item[self.idField];
                if (self.selectedIds.has(String(id))) self.selectedMap.set(String(id), item);
            });
            self.updateCandidateList();
            self.updateSelectedList();
            self.updateSelectedCount();
            self.emitChange();
        }).fail(function() {
            self.$('.dual-list-loading').html('<div class="text-danger">加载失败</div>');
        });
    };

    DualListSelector.prototype.filterList = function() {
        var q = (this.$('.dual-list-search-input').val() || '').toLowerCase().trim();
        if (!q) {
            this.filteredItems = this.allItems;
        } else {
            var fields = this.searchFields;
            this.filteredItems = this.allItems.filter(function(item) {
                for (var i = 0; i < fields.length; i++) {
                    var v = (item[fields[i]] || '').toString().toLowerCase();
                    if (v.indexOf(q) !== -1) return true;
                }
                return false;
            });
        }
        this.updateCandidateList();
    };

    DualListSelector.prototype.updateCandidateList = function() {
        var self = this;
        var html = this.filteredItems.map(function(item) {
            var idStr = String(item[self.idField]);
            var selected = self.selectedIds.has(idStr);
            var cls = 'dual-list-candidate-item' + (selected ? ' active' : '');
            var inner = self.itemDisplay.map(function(d) {
                var tag = d.tag || 'span';
                var clsAttr = d.className ? ' class="' + escapeHtml(d.className) + '"' : '';
                var val = item[d.field];
                return '<' + tag + clsAttr + '>' + escapeHtml(val != null ? val : '') + '</' + tag + '>';
            }).join(' ');
            return '<div class="' + cls + '" data-id="' + escapeHtml(idStr) + '">' +
                '<div class="form-check">' +
                '<input class="form-check-input" type="checkbox" ' + (selected ? 'checked' : '') + '>' +
                '<label class="form-check-label w-100">' + inner + '</label></div></div>';
        }).join('');
        if (!html) html = '<div class="text-muted text-center py-3">' + escapeHtml(this.labels.noResults) + '</div>';
        var $list = this.$('.dual-list-candidate-list');
        $list.empty().append(html);
        $list.find('.dual-list-candidate-item').on('click', function(e) {
            if ($(e.target).is('input[type=checkbox]') || $(e.target).is('label')) return;
            var $item = $(this);
            var cb = $item.find('input[type=checkbox]');
            cb.prop('checked', !cb.prop('checked'));
            cb.trigger('change');
        });
        $list.find('.dual-list-candidate-item input[type=checkbox]').on('change', function() {
            var idStr = $(this).closest('.dual-list-candidate-item').attr('data-id');
            self.toggle(idStr, $(this).prop('checked'));
        });
    };

    DualListSelector.prototype.toggle = function(idStr, selected) {
        var item = this.allItems.find(function(x) { return String(x[this.idField]) === idStr; }.bind(this));
        if (!item) return;
        if (selected) {
            this.selectedIds.add(idStr);
            this.selectedMap.set(idStr, item);
        } else {
            this.selectedIds.delete(idStr);
            this.selectedMap.delete(idStr);
        }
        this.updateSelectedList();
        this.updateSelectedCount();
        this.updateCandidateList();
        this.emitChange();
    };

    DualListSelector.prototype.updateSelectedList = function() {
        var self = this;
        var $list = this.$('.dual-list-selected-list');
        var $empty = this.$('.dual-list-selected-empty');
        if (this.selectedIds.size === 0) {
            $list.html('<div class="text-muted text-center py-3 dual-list-selected-empty">' + escapeHtml(this.labels.selectedEmpty) + '</div>');
            return;
        }
        var html = [];
        this.selectedMap.forEach(function(item) {
            var inner = self.itemDisplay.map(function(d) {
                var tag = d.tag || 'span';
                var clsAttr = d.className ? ' class="' + escapeHtml(d.className) + '"' : '';
                var val = item[d.field];
                return '<' + tag + clsAttr + '>' + escapeHtml(val != null ? val : '') + '</' + tag + '>';
            }).join(' ');
            html.push('<div class="dual-list-selected-item d-flex justify-content-between align-items-center p-2 border-bottom">' +
                '<div class="flex-grow-1">' + inner + '</div>' +
                '<button type="button" class="btn btn-sm btn-outline-danger dual-list-remove-btn" data-id="' + escapeHtml(String(item[self.idField])) + '"><i class="bi bi-x"></i></button></div>');
        });
        $list.html(html.join(''));
        $list.find('.dual-list-remove-btn').on('click', function() {
            self.toggle($(this).attr('data-id'), false);
        });
    };

    DualListSelector.prototype.updateSelectedCount = function() {
        this.$('.dual-list-selected-count').text(this.selectedIds.size);
    };

    DualListSelector.prototype.getSelectedIds = function() {
        return Array.from(this.selectedIds);
    };
})();
