/**
 * CSG Select - 通用美化选择器组件
 * 业务无关，支持搜索、自定义内容、多种配置和事件
 */

(function() {
    'use strict';
    
    // 避免重复初始化
    if (typeof window.CSGSelect !== 'undefined') {
        return;
    }
    
    class CSGSelect {
        constructor() {
            this.selects = new Map();
            this.defaultOptions = {
                size: 'md',           // sm, md, lg
                theme: 'default',     // default, primary, success, warning, danger
                searchable: true,     // 是否可搜索
                allowCustom: true,    // 是否允许自定义输入
                placeholder: '请选择...', // 占位符
                placeholderEn: 'Please select...', // 英文占位符
                noResultsText: '无结果', // 无结果提示
                noResultsTextEn: 'No results', // 英文无结果提示
                customText: '自定义输入', // 自定义输入提示
                customTextEn: 'Custom input', // 英文自定义输入提示
                animate: true,        // 是否启用动画
                maxHeight: '15rem',   // 下拉框最大高度，设置为 'none' 或 'auto' 则不限制高度
                noScroll: false,       // 是否禁用滚动条（当 maxHeight 为 'none' 或 'auto' 时自动禁用）
                fixedWidth: true,      // 是否按最长的选项设置固定宽度，默认 true
                onChange: null,       // 值改变回调
                onInit: null,         // 初始化回调
                onSearch: null,       // 搜索回调
                onCustom: null        // 自定义输入回调
            };
            this.init();
        }
        
        init() {
            // 自动初始化页面中所有csg-select
            this.autoInit();
            
            // 监听动态添加的选择器
            this.observeChanges();
        }
        
        /**
         * 自动初始化所有选择器
         * 延迟初始化，确保其他组件（如general_formatter）先完成值设置
         */
        autoInit() {
            // 延迟初始化，确保DOM完全渲染且其他组件已完成值设置
            // 使用 requestAnimationFrame + setTimeout 确保在 general_formatter 之后初始化
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const selects = document.querySelectorAll('.csg-select-input:not([data-csg-initialized])');
                    selects.forEach(selectEl => {
                        this.initSelect(selectEl);
                    });
                }, 100); // 延迟100ms，确保general_formatter先完成anchor同步
            });
        }
        
        /**
         * 初始化单个选择器
         */
        initSelect(selectEl) {
            if (selectEl.dataset.csgInitialized) {
                return;
            }
            
            const options = this.parseOptions(selectEl);
            const selectId = this.generateId();
            
            // 标记为已初始化
            selectEl.dataset.csgInitialized = 'true';
            selectEl.dataset.csgSelectId = selectId;
            
            // 创建选择器实例
            const selectInstance = new CSGSelectInstance(selectEl, options, this);
            this.selects.set(selectId, selectInstance);
            
            // 初始化回调
            if (options.onInit && typeof options.onInit === 'function') {
                options.onInit(selectInstance);
            }
        }
        
        /**
         * 解析选项配置
         */
        parseOptions(selectEl) {
            const options = { ...this.defaultOptions };
            
            // 从data属性解析配置
            const dataOptions = selectEl.dataset;
            Object.keys(dataOptions).forEach(key => {
                if (key.startsWith('csg')) {
                    // 将 data-csg-xxx-yyy 转换为驼峰命名 xxxYyy
                    // 例如：csgNoScroll -> noScroll, csgSearchable -> searchable
                    let optionKey = key.replace(/^csg/, ''); // 去掉 csg 前缀
                    // 将首字母转为小写，其余保持驼峰命名
                    optionKey = optionKey.charAt(0).toLowerCase() + optionKey.slice(1);
                    let value = dataOptions[key];
                    
                    // 类型转换
                    if (value === 'true') value = true;
                    else if (value === 'false') value = false;
                    else if (!isNaN(value) && value !== '') value = Number(value);
                    
                    options[optionKey] = value;
                }
            });
            
            return options;
        }
        
        /**
         * 生成唯一ID
         */
        generateId() {
            return 'csg-select-' + Math.random().toString(36).substr(2, 9);
        }
        
        /**
         * 监听DOM变化
         */
        observeChanges() {
            if (typeof MutationObserver !== 'undefined') {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) { // Element node
                                if (node.classList && node.classList.contains('csg-select-input')) {
                                    this.initSelect(node);
                                } else if (node.querySelectorAll) {
                                    const selects = node.querySelectorAll('.csg-select-input:not([data-csg-initialized])');
                                    selects.forEach(selectEl => {
                                        this.initSelect(selectEl);
                                    });
                                }
                            }
                        });
                    });
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
        }
        
        /**
         * 销毁选择器
         */
        destroy(selectId) {
            const selectInstance = this.selects.get(selectId);
            if (selectInstance) {
                selectInstance.destroy();
                this.selects.delete(selectId);
            }
        }
        
        /**
         * 获取选择器实例
         */
        getInstance(selectId) {
            return this.selects.get(selectId);
        }
    }
    
    /**
     * 单个选择器实例
     */
    class CSGSelectInstance {
        constructor(selectEl, options, parent) {
            this.selectEl = selectEl;
            this.options = options;
            this.parent = parent;
            this.isOpen = false;
            this.searchValue = '';
            this.highlightedIndex = -1;
            this.filteredOptions = [];
            
            this.createDisplay();
            this.bindEvents();
            this.loadOptions();
        }
        
        /**
         * 创建显示区域
         */
        createDisplay() {
            const container = this.selectEl.parentElement;
            this.container = container; // 保存容器引用

            if (!container.classList.contains('csg-select')) {
                container.classList.add('csg-select');
            }

            // 应用尺寸和主题类
            if (this.options.size !== 'md') {
                container.classList.add(`csg-select-${this.options.size}`);
            }
            if (this.options.theme !== 'default') {
                container.classList.add(`csg-select-${this.options.theme}`);
            }

            // 计算并设置固定宽度（如果启用）
            if (this.options.fixedWidth) {
                container.classList.add('csg-select-fixed-width');
                this.setFixedWidth();
            }
            
            // 创建隐藏input用于表单提交
            this.createHiddenInput();
            
            // 创建显示区域
            this.displayEl = document.createElement('div');
            this.displayEl.className = 'csg-select-display';
            this.displayEl.tabIndex = 0;
            
            // 创建文本显示
            this.textEl = document.createElement('div');
            this.textEl.className = 'csg-select-text';
            this.textEl.textContent = this.getPlaceholder();
            
            // 创建箭头
            this.arrowEl = document.createElement('div');
            this.arrowEl.className = 'csg-select-arrow';
            
            // 创建下拉容器
            this.dropdownEl = document.createElement('div');
            this.dropdownEl.className = 'csg-select-dropdown';
            
            // 应用 maxHeight 和 noScroll 配置
            if (this.options.noScroll === true || this.options.noScroll === 'true') {
                this.dropdownEl.style.maxHeight = 'none';
                this.dropdownEl.style.overflowY = 'visible';
                this.dropdownEl.classList.add('csg-select-no-scroll');
            } else if (this.options.maxHeight && (this.options.maxHeight === 'none' || this.options.maxHeight === 'auto')) {
                this.dropdownEl.style.maxHeight = 'none';
                this.dropdownEl.style.overflowY = 'visible';
            } else if (this.options.maxHeight) {
                this.dropdownEl.style.maxHeight = this.options.maxHeight;
            }
            
            // 创建搜索框（如果启用）
            if (this.options.searchable) {
                this.createSearchBox();
            }
            
            // 创建选项容器
            this.optionsEl = document.createElement('div');
            this.optionsEl.className = 'csg-select-options';
            
            // 如果设置了 noScroll，也应用到选项容器
            if (this.options.noScroll === true || this.options.noScroll === 'true') {
                this.optionsEl.style.maxHeight = 'none';
                this.optionsEl.style.overflowY = 'visible';
            }
            
            // 组装结构
            this.displayEl.appendChild(this.textEl);
            this.displayEl.appendChild(this.arrowEl);
            this.dropdownEl.appendChild(this.optionsEl);
            container.appendChild(this.displayEl);
            container.appendChild(this.dropdownEl);
            
            // 监听原生select的change事件，实现双向绑定
            // 当原生select的值被程序化修改时（比如从anchor同步），同步更新csg-select的显示
            this.selectChangeHandler = () => {
                const newValue = this.selectEl.value;
                // 查找匹配的选项
                const matchingOption = this.originalOptions.find(opt => opt.value === newValue);
                if (matchingOption) {
                    // 只有当值确实改变时才更新显示，避免循环触发
                    const currentDisplayValue = this.textEl.textContent;
                    if (currentDisplayValue !== matchingOption.text && currentDisplayValue !== this.getPlaceholder()) {
                        this.setValue(matchingOption.value, matchingOption.text, matchingOption.color, matchingOption.colorClass);
                    }
                }
            };
            this.selectEl.addEventListener('change', this.selectChangeHandler);
        }
        
        /**
         * 创建隐藏input用于表单提交
         */
        createHiddenInput() {
            // 检查是否已存在隐藏input
            const existingHidden = this.selectEl.parentElement.querySelector(`input[type="hidden"][name="${this.selectEl.name}"]`);
            if (existingHidden) {
                this.hiddenInput = existingHidden;
                return;
            }
            
            // 创建隐藏input
            this.hiddenInput = document.createElement('input');
            this.hiddenInput.type = 'hidden';
            this.hiddenInput.name = this.selectEl.name;
            this.hiddenInput.id = this.selectEl.id + '_hidden';
            this.hiddenInput.value = this.selectEl.value;
            
            // 插入到select元素后面
            this.selectEl.parentElement.insertBefore(this.hiddenInput, this.selectEl.nextSibling);
        }
        
        /**
         * 创建搜索框
         */
        createSearchBox() {
            const searchEl = document.createElement('div');
            searchEl.className = 'csg-select-search';
            
            this.searchInputEl = document.createElement('input');
            this.searchInputEl.type = 'text';
            this.searchInputEl.className = 'csg-select-search-input';
            this.searchInputEl.placeholder = '搜索...';
            
            searchEl.appendChild(this.searchInputEl);
            this.dropdownEl.appendChild(searchEl);
        }
        
        /**
         * 绑定事件
         */
        bindEvents() {
            // 显示区域点击事件
            this.displayEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
            
            // 键盘事件
            this.displayEl.addEventListener('keydown', (e) => {
                this.handleKeydown(e);
            });
            
            // 搜索框事件
            if (this.searchInputEl) {
                this.searchInputEl.addEventListener('input', (e) => {
                    this.handleSearch(e.target.value);
                });
                
                this.searchInputEl.addEventListener('keydown', (e) => {
                    this.handleSearchKeydown(e);
                });
            }
            
            // 点击外部关闭（使用箭头函数以便后续移除）
            this.documentClickHandler = (e) => {
                if (!this.displayEl || !this.dropdownEl) {
                    return; // 组件已被销毁
                }
                if (!this.displayEl.contains(e.target) && !this.dropdownEl.contains(e.target)) {
                    this.close();
                }
            };
            document.addEventListener('click', this.documentClickHandler);
        }
        
        /**
         * 加载选项
         */
        loadOptions() {
            this.originalOptions = [];
            const options = this.selectEl.querySelectorAll('option');
            
            // 读取原生select的当前值（可能是程序化设置的，不一定是selected属性）
            const currentValue = this.selectEl.value;
            let currentOptionData = null;
            
            options.forEach((option, index) => {
                const optionData = {
                    value: option.value,
                    text: option.textContent,
                    textEn: option.dataset.textEn || option.textContent,
                    disabled: option.disabled,
                    selected: option.selected,
                    index: index,
                    // 支持选项颜色：从 data-color 或 data-color-class 读取
                    color: option.dataset.color || null,
                    colorClass: option.dataset.colorClass || null
                };
                
                this.originalOptions.push(optionData);
                
                // 如果选项的值匹配当前select的值，记录为当前选项
                if (option.value === currentValue) {
                    currentOptionData = optionData;
                }
            });
            
            // 设置初始值：优先使用匹配当前select值的选项，否则使用selected的选项
            if (currentOptionData) {
                this.setValue(currentOptionData.value, currentOptionData.text, currentOptionData.color, currentOptionData.colorClass);
            } else {
                // 如果没有匹配的选项，尝试使用selected的选项
                const selectedOption = this.originalOptions.find(opt => opt.selected);
                if (selectedOption) {
                    this.setValue(selectedOption.value, selectedOption.text, selectedOption.color, selectedOption.colorClass);
                }
            }
            
            this.filteredOptions = [...this.originalOptions];
            this.renderOptions();
        }
        
        /**
         * 渲染选项
         */
        renderOptions() {
            this.optionsEl.innerHTML = '';
            
            // 添加自定义输入选项（如果启用且搜索有值）
            if (this.options.allowCustom && this.searchValue.trim()) {
                const customOption = this.createOptionElement({
                    value: this.searchValue,
                    text: `${this.getCustomText()}: "${this.searchValue}"`,
                    isCustom: true
                });
                this.optionsEl.appendChild(customOption);
            }
            
            // 渲染过滤后的选项
            this.filteredOptions.forEach((option, index) => {
                const optionEl = this.createOptionElement(option, index);
                this.optionsEl.appendChild(optionEl);
            });
            
            // 如果没有选项且没有自定义输入，显示无结果提示
            if (this.filteredOptions.length === 0 && (!this.options.allowCustom || !this.searchValue.trim())) {
                const noResultsEl = document.createElement('div');
                noResultsEl.className = 'csg-select-no-results';
                noResultsEl.textContent = this.getNoResultsText();
                this.optionsEl.appendChild(noResultsEl);
            }
        }
        
        /**
         * 创建选项元素
         */
        createOptionElement(option, index = -1) {
            const optionEl = document.createElement('div');
            optionEl.className = 'csg-select-option';
            if (option.isCustom) {
                optionEl.classList.add('custom');
            }
            
            // 应用颜色样式
            if (option.colorClass) {
                optionEl.classList.add(`csg-select-option-${option.colorClass}`);
            }
            if (option.color) {
                optionEl.style.color = option.color;
            }
            
            const textEl = document.createElement('div');
            textEl.className = 'csg-select-option-text';
            textEl.textContent = option.text;
            
            // 如果选项有颜色，也应用到文本
            if (option.colorClass) {
                textEl.classList.add(`csg-select-option-text-${option.colorClass}`);
            }
            if (option.color) {
                textEl.style.color = option.color;
            }
            
            optionEl.appendChild(textEl);
            
            // 添加点击事件
            optionEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectOption(option);
            });
            
            // 添加鼠标悬停事件
            optionEl.addEventListener('mouseenter', () => {
                this.highlightOption(index);
            });
            
            return optionEl;
        }

        /**
         * 设置固定宽度（按最长选项计算）
         */
        setFixedWidth() {
            if (!this.displayEl) return;

            // 创建临时元素来测量文本宽度
            const measureEl = document.createElement('div');
            measureEl.style.position = 'absolute';
            measureEl.style.visibility = 'hidden';
            measureEl.style.whiteSpace = 'nowrap';
            measureEl.style.fontSize = getComputedStyle(this.displayEl).fontSize;
            measureEl.style.fontFamily = getComputedStyle(this.displayEl).fontFamily;
            measureEl.style.padding = getComputedStyle(this.displayEl).padding;
            document.body.appendChild(measureEl);

            let maxWidth = 0;

            // 测量所有选项的宽度
            this.originalOptions.forEach(option => {
                measureEl.textContent = option.text;
                const width = measureEl.offsetWidth;
                if (width > maxWidth) {
                    maxWidth = width;
                }
            });

            // 清理临时元素
            document.body.removeChild(measureEl);

            // 设置固定宽度（考虑箭头和内边距）
            const arrowWidth = 20; // 箭头大约 20px
            const padding = 16; // 左右内边距大约 16px
            const fixedWidth = Math.max(maxWidth + arrowWidth + padding, 120); // 最小120px

            this.displayEl.style.width = fixedWidth + 'px';
        }

        /**
         * 选择选项
         */
        selectOption(option) {
            if (option.disabled) return;
            
            // 临时移除change事件监听器，避免循环触发
            if (this.selectChangeHandler) {
                this.selectEl.removeEventListener('change', this.selectChangeHandler);
            }
            
            // 更新原生select的值
            this.selectEl.value = option.value;

            // 更新csg-select的显示
            this.setValue(option.value, option.text, option.color, option.colorClass);
            this.close();
            
            // 重新绑定change事件监听器
            if (this.selectChangeHandler) {
                this.selectEl.addEventListener('change', this.selectChangeHandler);
            }
            
            // 确保这不是从anchor同步的操作（清除可能的初始化标志）
            // 这样change事件处理器就能正确识别这是用户操作
            const $select = $(this.selectEl);
            
            // 强制清除所有可能阻止更新的标志
            $select.removeData('initializing-from-anchor');
            $select.data('anchor-events-bound', true);
            
            // 确保 isInitializingFilters 全局标志为 false（允许更新 anchor）
            // 查找所有可能的 isInitializingFilters 标志键（格式：tableId_prefix_isInitializingFilters）
            // 由于我们不知道具体的 tableId 和 prefix，需要查找所有匹配的键
            for (const key in window) {
                if (key.includes('isInitializingFilters') && window[key] === true) {
                    window[key] = false;
                }
            }
            
            // 使用 setTimeout 确保标志清除在事件触发之前完成
            setTimeout(() => {
                // 触发原生select的change事件
                // 只用原生 dispatchEvent 即可，jQuery 的命名空间事件处理器也会响应原生 change 事件
                // 不能同时 trigger + dispatchEvent，否则会触发两次 change，导致重复请求
                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                this.selectEl.dispatchEvent(changeEvent);
            }, 0);
            
            // 触发自定义回调
            if (this.options.onChange && typeof this.options.onChange === 'function') {
                this.options.onChange(option.value, option.text, this);
            }
            
            // 触发自定义输入回调
            if (option.isCustom && this.options.onCustom && typeof this.options.onCustom === 'function') {
                this.options.onCustom(option.value, this);
            }
        }
        
        /**
         * 设置值
         */
        setValue(value, text, color = null, colorClass = null) {
            this.selectEl.value = value;
            this.textEl.textContent = text;
            this.textEl.classList.add('has-value');
            
            // 移除之前的颜色类
            this.textEl.className = 'csg-select-text has-value';
            this.textEl.style.color = '';
            
            // 应用新的颜色
            if (colorClass) {
                this.textEl.classList.add(`csg-select-text-${colorClass}`);
            }
            if (color) {
                this.textEl.style.color = color;
            }
            
            // 同步隐藏input的值
            if (this.hiddenInput) {
                this.hiddenInput.value = value;
            }
        }
        
        /**
         * 切换显示状态
         */
        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }
        
        /**
         * 打开下拉框
         */
        open() {
            this.isOpen = true;
            this.displayEl.parentElement.classList.add('open');
            
            if (this.searchInputEl) {
                this.searchInputEl.focus();
            }
            
            this.highlightedIndex = -1;
        }
        
        /**
         * 关闭下拉框
         */
        close() {
            if (!this.displayEl || !this.displayEl.parentElement) {
                return; // 组件已被销毁
            }
            
            this.isOpen = false;
            this.displayEl.parentElement.classList.remove('open');
            
            if (this.searchInputEl) {
                this.searchInputEl.value = '';
                this.searchValue = '';
            }
            
            this.filteredOptions = [...this.originalOptions];
            this.renderOptions();
        }
        
        /**
         * 处理搜索
         */
        handleSearch(value) {
            this.searchValue = value;
            
            if (!value.trim()) {
                this.filteredOptions = [...this.originalOptions];
            } else {
                this.filteredOptions = this.originalOptions.filter(option => 
                    option.text.toLowerCase().includes(value.toLowerCase()) ||
                    option.textEn.toLowerCase().includes(value.toLowerCase())
                );
            }
            
            this.renderOptions();
            
            // 触发搜索回调
            if (this.options.onSearch && typeof this.options.onSearch === 'function') {
                this.options.onSearch(value, this.filteredOptions, this);
            }
        }
        
        /**
         * 处理键盘事件
         */
        handleKeydown(e) {
            if (!this.isOpen) {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.open();
                }
                return;
            }
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.highlightNext();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.highlightPrevious();
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.selectHighlighted();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.close();
                    break;
            }
        }
        
        /**
         * 处理搜索框键盘事件
         */
        handleSearchKeydown(e) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.highlightNext();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.highlightPrevious();
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.selectHighlighted();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.close();
                    break;
            }
        }
        
        /**
         * 高亮下一个选项
         */
        highlightNext() {
            const options = this.optionsEl.querySelectorAll('.csg-select-option');
            if (options.length === 0) return;
            
            this.highlightedIndex = Math.min(this.highlightedIndex + 1, options.length - 1);
            this.updateHighlight();
        }
        
        /**
         * 高亮上一个选项
         */
        highlightPrevious() {
            const options = this.optionsEl.querySelectorAll('.csg-select-option');
            if (options.length === 0) return;
            
            this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
            this.updateHighlight();
        }
        
        /**
         * 更新高亮状态
         */
        updateHighlight() {
            const options = this.optionsEl.querySelectorAll('.csg-select-option');
            options.forEach((option, index) => {
                option.classList.toggle('highlighted', index === this.highlightedIndex);
            });
        }
        
        /**
         * 高亮指定选项
         */
        highlightOption(index) {
            this.highlightedIndex = index;
            this.updateHighlight();
        }
        
        /**
         * 选择高亮的选项
         */
        selectHighlighted() {
            const options = this.optionsEl.querySelectorAll('.csg-select-option');
            if (this.highlightedIndex >= 0 && this.highlightedIndex < options.length) {
                const option = options[this.highlightedIndex];
                option.click();
            }
        }
        
        /**
         * 获取占位符文本
         */
        getPlaceholder() {
            // 这里可以根据语言设置返回不同的占位符
            return this.options.placeholder;
        }
        
        /**
         * 获取无结果文本
         */
        getNoResultsText() {
            return this.options.noResultsText;
        }
        
        /**
         * 获取自定义输入文本
         */
        getCustomText() {
            return this.options.customText;
        }
        
        /**
         * 销毁选择器
         */
        destroy() {
            // 移除文档点击事件监听器
            if (this.documentClickHandler) {
                document.removeEventListener('click', this.documentClickHandler);
                this.documentClickHandler = null;
            }
            
            // 移除原生select的change事件监听器
            if (this.selectChangeHandler) {
                this.selectEl.removeEventListener('change', this.selectChangeHandler);
                this.selectChangeHandler = null;
            }
            
            // 移除事件监听器
            if (this.displayEl) {
                this.displayEl.removeEventListener('click', this.toggle);
                this.displayEl.removeEventListener('keydown', this.handleKeydown);
            }
            
            if (this.searchInputEl) {
                this.searchInputEl.removeEventListener('input', this.handleSearch);
                this.searchInputEl.removeEventListener('keydown', this.handleSearchKeydown);
            }
            
            // 移除DOM元素
            if (this.displayEl && this.displayEl.parentNode) {
                this.displayEl.parentNode.removeChild(this.displayEl);
                this.displayEl = null;
            }
            if (this.dropdownEl && this.dropdownEl.parentNode) {
                this.dropdownEl.parentNode.removeChild(this.dropdownEl);
                this.dropdownEl = null;
            }
        }
    }
    
    // 创建全局实例
    window.CSGSelect = new CSGSelect();
    
    // 页面加载完成后自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.CSGSelect.autoInit();
        });
    } else {
        window.CSGSelect.autoInit();
    }
    
})();
