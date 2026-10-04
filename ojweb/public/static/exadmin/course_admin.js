// **************************************************
// 课程组编辑页面管理
// **************************************************

(function() {
    'use strict';
    
    // 获取模块路径
    function getCourseModule() {
        return (window.COURSE_EDIT_CONFIG && window.COURSE_EDIT_CONFIG.module) || 'exadmin';
    }
    
    class CourseEditPage {
        constructor(config) {
            this.config = config || {};
            this.editMode = this.config.edit_mode || false;
            this.courseEnvConfig = typeof course_env_config !== 'undefined' ? course_env_config : {};
            
            // 处理 courseDefaultConfig，确保它是正确的对象格式
            let rawConfigData = typeof courseDefaultConfig !== 'undefined' ? courseDefaultConfig : null;
            if (Array.isArray(rawConfigData)) {
                // 如果是数组（可能是空数组），使用默认值
                console.warn('[CourseEditPage] courseDefaultConfig 是数组，使用默认值');
                rawConfigData = null;
            }
            this.configData = rawConfigData && typeof rawConfigData === 'object' && !Array.isArray(rawConfigData) 
                ? rawConfigData 
                : { config: {}, definitions: {} };
            
            // 页面元素引用
            this.submitButton = $('#submit_button');
            this.submitButtonTexts = window.Bilingual ? window.Bilingual.getBilingualText(this.submitButton) : { chinese: this.submitButton.text(), english: '' };
            this.submitButtonText = this.submitButtonTexts.chinese;
            this.submitButtonEnText = this.submitButtonTexts.english;
            this.courseEditForm = $('#course_edit_form');
        }
        
        /**
         * 初始化课程编辑页
         */
        init() {
            // 先绑定快捷键，避免后续初始化异常导致 Ctrl+S 不生效
            this.bindKeyboardShortcuts();
            
            // 配置面板初始化可能依赖较多组件，做容错不影响“提交”主流程
            try {
                this.initCourseConfig();
            } catch (e) {
                try { console.error(e); } catch (_) {}
            }
            
            // 初始化课程介绍编辑器（Vditor）
            this.initCourseDescriptionEditor();

            this.setupFormValidation();
        }

        /**
         * 课程介绍：使用 Vditor 编辑器（依赖 pkg_vditor.php + csg_vditor.js）
         * - 编辑器内容实时同步到隐藏 textarea（course_description）
         * - 提交时仍由 textarea 参与提交
         */
        initCourseDescriptionEditor() {
            const editorEl = document.getElementById('course_description_editor');
            const textareaEl = document.getElementById('course_description');
            if (!editorEl || !textareaEl) return;
            if (typeof window.CsgVditor === 'undefined' || typeof window.CsgVditor.createEditor !== 'function') {
                return;
            }

            const initialValue = textareaEl.value || '';
            try {
                this.descriptionEditor = window.CsgVditor.createEditor({
                    el: editorEl,
                    value: initialValue,
                    height: 320,
                    onChange: (md) => {
                        textareaEl.value = md || '';
                        // 触发输入事件，便于表单验证/状态更新
                        try {
                            textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
                        } catch (e) {}
                    },
                    options: {
                        placeholder: '介绍 ...',
                        // 明确使用本地资源根路径（避免外部 unpkg）
                        cdn: '/static/vditor',
                    }
                });
            } catch (e) {
                // 不影响主流程
            }
        }
        
        /**
         * 初始化课程配置（交互式界面）
         */
        initCourseConfig() {
            // 获取配置数据
            const configDataText = $('#course_config_data').val();
            
            let currentConfig = {};
            
            if (configDataText) {
                try {
                    currentConfig = JSON.parse(configDataText);
                } catch (e) {
                    currentConfig = this.configData.config || {};
                }
            } else {
                currentConfig = this.configData.config || {};
            }
            
            // 合并默认配置
            const defaultConfig = this.configData.config || {};
            currentConfig = Object.assign({}, defaultConfig, currentConfig);
            
            // 保存初始配置
            this.initialConfig = JSON.parse(JSON.stringify(currentConfig));
            
            // 生成配置表单
            this.generateConfigForm(currentConfig);

            // 初始化 tooltip（配置项说明）
            this.initConfigTooltips();
            
            // 初始化组件
            if (window.csgSwitch) {
                window.csgSwitch.autoInit();
            }
            
            // 初始化数字输入框验证
            this.initNumberInputValidation();
            
            // 绑定配置表单事件
            this.bindConfigFormEvents();

            // 首次渲染后同步一次“分类标题栏状态预览/改动星标”
            this.checkModifications();
        }
        
        /**
         * 初始化配置项的 Bootstrap tooltip
         */
        initConfigTooltips() {
            try {
                // Bootstrap 5: window.bootstrap.Tooltip
                if (!window.bootstrap || !window.bootstrap.Tooltip) return;

                const containerEl = document.getElementById('config_form_container');
                if (!containerEl) return;

                const triggers = Array.from(containerEl.querySelectorAll('[data-bs-toggle="tooltip"]'));
                triggers.forEach((el) => {
                    try {
                        const inst = window.bootstrap.Tooltip.getInstance(el);
                        if (inst) inst.dispose();
                    } catch (e) {}
                    new window.bootstrap.Tooltip(el, {
                        container: 'body',
                        trigger: 'hover focus',
                        html: false,
                        customClass: 'course-config-tooltip'
                    });
                });
            } catch (e) {
                // 不影响主流程
            }
        }

        /**
         * HTML 属性安全转义（用于 data-bs-title 等属性）
         */
        escapeHtmlAttr(text) {
            return String(text ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        /**
         * 将表单收集到的字符串值按字段定义做类型归一化（number -> Number, switch -> Boolean）
         * @param {Object} formData
         * @returns {Object}
         */
        normalizeConfigTypes(formData) {
            const out = { ...(formData || {}) };
            const defs = this.configData?.definitions?.fields || {};
            Object.keys(out).forEach((key) => {
                const field = defs[key];
                if (!field) return;
                if (field.type === 'number') {
                    // 允许空值，但正常情况下不会出现；空值不转换
                    if (out[key] === '' || out[key] === null || typeof out[key] === 'undefined') return;
                    const num = Number(out[key]);
                    if (!Number.isNaN(num)) out[key] = num;

                    // 兼容：PLAGIARISM_SCORE 支持 0~1（小数）或 0~100（百分比整数）
                    if (key === 'PLAGIARISM_SCORE' && typeof out[key] === 'number' && !Number.isNaN(out[key])) {
                        if (out[key] > 1) out[key] = out[key] / 100;
                    }
                } else if (field.type === 'switch') {
                    out[key] = Boolean(out[key]);
                }
            });
            return out;
        }

        /**
         * 生成配置表单
         */
        generateConfigForm(config) {
            const container = $('#config_form_container');
            
            if (container.length === 0) {
                return;
            }
            
            // 紧凑布局：按分类折叠展示（Accordion）
            let html = '<div class="course-config-compact accordion accordion-flush" id="course_config_accordion">';
            
            const definitions = this.configData.definitions || {};
            const fields = definitions.fields || {};
            
            // 按分类分组
            const categories = {};
            Object.keys(fields).forEach(fieldKey => {
                const field = fields[fieldKey];
                const category = field.category || '其他';
                const categoryEn = field.category_en || 'Other';
                
                if (!categories[category]) {
                    categories[category] = {
                        name: category,
                        nameEn: categoryEn,
                        fields: {}
                    };
                }
                categories[category].fields[fieldKey] = field;
            });
            
            // 生成分组表单（默认展开第一组）
            const categoryKeys = Object.keys(categories);
            // 缓存分类结构，供“标题栏预览/改动星标”使用
            this._courseConfigCategories = categories;
            this._courseConfigCategoryKeys = categoryKeys;

            categoryKeys.forEach((categoryKey, idx) => {
                const category = categories[categoryKey];
                const collapseId = `course_cfg_collapse_${idx}`;
                const headingId = `course_cfg_heading_${idx}`;
                const expanded = idx === 0 ? 'true' : 'false';
                const showClass = idx === 0 ? 'show' : '';
                const collapsedClass = idx === 0 ? '' : 'collapsed';

                // “查重扣分”这组 3 个参数并排：lg 下三列，其它分组保持两列
                const isPlagiarismCategory = (category.name === '查重扣分' || category.nameEn === 'Plagiarism Deduction');
                const gridColsClass = isPlagiarismCategory ? 'row-cols-1 row-cols-md-2 row-cols-lg-3' : 'row-cols-1 row-cols-md-2';

                html += `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="${headingId}">
                            <button class="accordion-button py-2 ${collapsedClass}" type="button"
                                data-bs-toggle="collapse" data-bs-target="#${collapseId}"
                                aria-expanded="${expanded}" aria-controls="${collapseId}">
                                <span class="course-config-accordion-title bilingual-inline">
                                    ${category.name}<span class="en-text">${category.nameEn}</span>
                                </span>
                                <span class="course-config-accordion-meta">
                                    <span class="course-config-cat-preview"></span>
                                    <span class="course-config-cat-indicator" style="display:none;" title="该分类有改动">
                                        <i class="bi bi-star-fill"></i>
                                    </span>
                                    <span class="course-config-cat-count badge bg-warning text-dark" style="display:none;"></span>
                                </span>
                            </button>
                        </h2>
                        <div id="${collapseId}" class="accordion-collapse collapse ${showClass}" aria-labelledby="${headingId}"
                             data-bs-parent="#course_config_accordion">
                            <div class="accordion-body py-2">
                                <div class="row ${gridColsClass} g-2 course-config-grid">
                `;
                
                Object.keys(category.fields).forEach(fieldKey => {
                    const field = category.fields[fieldKey];
                    const fieldValue = config[fieldKey] !== undefined ? config[fieldKey] : (this.configData.config[fieldKey] || '');
                    const fieldId = `config_${fieldKey}`;
                    const fieldName = `config[${fieldKey}]`;
                    
                    let fieldHtml = '';
                    
                    if (field.type === 'switch') {
                        const switchValue = Array.isArray(fieldValue) ? fieldValue[0] : fieldValue;
                        // Tooltip 文案：中英文换行（不使用“/”）
                        const tipText = `${field.description.cn}\n${field.description.en}`;
                        const tipTextEscaped = this.escapeHtmlAttr(tipText);
                        fieldHtml = `
                            <div class="col">
                                <div class="csg-switch-container">
                                    <div class="csg-switch-setting">
                                        <div class="d-flex align-items-center">
                                            <div class="csg-switch-setting-content">
                                                <div class="csg-switch-setting-title">
                                                    <div class="course-config-label-row">
                                                        <span class="course-config-label-cn">${field.label.cn}</span>
                                                        <i class="bi bi-question-circle course-config-help"
                                                           data-bs-toggle="tooltip" data-bs-placement="top"
                                                           data-bs-title="${tipTextEscaped}" title=""></i>
                                                    </div>
                                                    <span class="en-text text-muted">${field.label.en}</span>
                                                </div>
                                            </div>
                                            <div class="csg-switch-setting-control">
                                                <input type="checkbox" class="csg-switch-input" 
                                                       data-csg-text-on="启用" data-csg-text-on-en="Enabled"
                                                       data-csg-text-off="禁用" data-csg-text-off-en="Disabled"
                                                       name="${fieldName}" id="${fieldId}" ${switchValue ? 'checked' : ''}>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="modified-indicator" style="display: none;">
                                        <i class="bi bi-star-fill"></i>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else if (field.type === 'number') {
                        // 数字类型
                        const rawNumericValue = Array.isArray(fieldValue) ? fieldValue[0] : fieldValue;
                        const numericValue = (rawNumericValue === '' || rawNumericValue === null || typeof rawNumericValue === 'undefined')
                            ? ''
                            : Number(rawNumericValue);

                        // 特殊：查重扣分比例前端按 0~100 整数百分比输入，但保存仍为 0~1 小数
                        const isPlagiarismScore = (fieldKey === 'PLAGIARISM_SCORE');
                        const displayValue = isPlagiarismScore
                            ? (numericValue === '' || Number.isNaN(numericValue)
                                ? ''
                                : (numericValue <= 1 ? Math.round(numericValue * 100) : Math.round(numericValue)))
                            : (numericValue === '' || Number.isNaN(numericValue) ? '' : numericValue);

                        const unitCn = isPlagiarismScore ? '(%)' : (field.unit ? `(${field.unit.cn})` : '');
                        const unitEn = isPlagiarismScore ? '(%)' : (field.unit ? `(${field.unit.en})` : '');

                        // min/max/step 必须写到 HTML attribute，否则浏览器会用默认 step=1 且 step base=当前 value，导致提示“0.4 和 1.4”
                        const minAttr = isPlagiarismScore ? 0 : (field.min ?? '');
                        const maxAttr = isPlagiarismScore ? 100 : (field.max ?? '');
                        const stepAttr = isPlagiarismScore ? 1 : (field.step ?? '');
                        // Tooltip 文案：中英文换行（不使用“/”）
                        const tipText = isPlagiarismScore
                            ? `${field.description.cn}\n（前端输入 0~100，保存自动换算为 0~1）\n${field.description.en}\n(Frontend uses 0~100, saved as 0~1)`
                            : `${field.description.cn}\n${field.description.en}`;
                        const tipTextEscaped = this.escapeHtmlAttr(tipText);
                        fieldHtml = `
                            <div class="col">
                                <label for="${fieldId}" class="form-label small mb-1">
                                    <span class="course-config-label-row">
                                        <span class="course-config-label-cn">${field.label.cn}${unitCn}</span>
                                        <i class="bi bi-question-circle course-config-help"
                                           data-bs-toggle="tooltip" data-bs-placement="top"
                                           data-bs-title="${tipTextEscaped}" title=""></i>
                                    </span>
                                    <span class="en-text text-muted">${field.label.en}${unitEn}</span>
                                </label>
                                <div class="form-control-container">
                                    <input type="number" class="form-control form-control-sm number-input" 
                                           name="${fieldName}" id="${fieldId}" 
                                           value="${displayValue}" 
                                           title=""
                                           min="${minAttr}" max="${maxAttr}" step="${stepAttr}"
                                           data-field-min="${field.min ?? ''}" 
                                           data-field-max="${field.max ?? ''}" 
                                           data-field-step="${field.step ?? ''}"
                                           data-field-unit="${field.unit ? field.unit.cn : ''}">
                                    <div class="modified-indicator" style="display: none;">
                                        <i class="bi bi-star-fill"></i>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                    
                    html += fieldHtml;
                });
                
                html += `
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';

            if (categoryKeys.length === 0) {
                html = '<div class="alert alert-warning mb-0">暂无配置项可显示</div>';
            }
            
            container.html(html);
            // 每次渲染完重新初始化 tooltip
            this.initConfigTooltips();
        }

        /**
         * 生成分类标题栏的“简略预览”
         * - 只展示前 N 项（避免太长）
         * - switch 显示 开/关；number 显示数值
         */
        escapeHtmlText(text) {
            return String(text ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        buildCategoryPreview(categoryFields, currentConfig) {
            const keys = Object.keys(categoryFields || {});
            const maxItems = 3;
            const partsHtml = [];
            const partsTitle = [];
            for (let i = 0; i < keys.length && partsHtml.length < maxItems; i++) {
                const key = keys[i];
                const field = categoryFields[key];
                if (!field) continue;
                const label = field.label?.cn || key;
                const v = currentConfig ? currentConfig[key] : undefined;
                if (field.type === 'switch') {
                    const valText = v ? '开' : '关';
                    const valClass = v ? 'cfgv cfgv-on' : 'cfgv cfgv-off';
                    const labelEsc = this.escapeHtmlText(label);
                    partsHtml.push(`<span class="cfgk">${labelEsc}:</span><span class="${valClass}">${valText}</span>`);
                    partsTitle.push(`${label}:${valText}`);
                } else if (field.type === 'number') {
                    if (typeof v !== 'undefined' && v !== null && v !== '') {
                        if (key === 'PLAGIARISM_SCORE') {
                            const num = Number(v);
                            if (!Number.isNaN(num)) {
                                const pct = num <= 1 ? Math.round(num * 100) : Math.round(num);
                                const valText = `${pct}%`;
                                const labelEsc = this.escapeHtmlText(label);
                                partsHtml.push(`<span class="cfgk">${labelEsc}:</span><span class="cfgv cfgv-num">${this.escapeHtmlText(valText)}</span>`);
                                partsTitle.push(`${label}:${valText}`);
                            } else {
                                const valText = String(v);
                                const labelEsc = this.escapeHtmlText(label);
                                partsHtml.push(`<span class="cfgk">${labelEsc}:</span><span class="cfgv cfgv-num">${this.escapeHtmlText(valText)}</span>`);
                                partsTitle.push(`${label}:${valText}`);
                            }
                        } else {
                            const valText = String(v);
                            const labelEsc = this.escapeHtmlText(label);
                            partsHtml.push(`<span class="cfgk">${labelEsc}:</span><span class="cfgv cfgv-num">${this.escapeHtmlText(valText)}</span>`);
                            partsTitle.push(`${label}:${valText}`);
                        }
                    }
                }
            }
            const suffix = keys.length > maxItems ? ' …' : '';
            return {
                html: (partsHtml.join('<span class="cfgsep"></span>') + this.escapeHtmlText(suffix)).trim(),
                title: (partsTitle.join('  ') + suffix).trim()
            };
        }

        /**
         * 同步每个折叠分类标题栏的星标/改动数/简略预览（与表单双向绑定）
         */
        updateCategoryHeaderStatus(currentConfigNormalized) {
            const categories = this._courseConfigCategories || {};
            const categoryKeys = this._courseConfigCategoryKeys || [];
            categoryKeys.forEach((categoryKey, idx) => {
                const category = categories[categoryKey];
                if (!category) return;
                const headingId = `course_cfg_heading_${idx}`;
                const headerEl = document.getElementById(headingId);
                if (!headerEl) return;

                const previewEl = headerEl.querySelector('.course-config-cat-preview');
                const starEl = headerEl.querySelector('.course-config-cat-indicator');
                const countEl = headerEl.querySelector('.course-config-cat-count');

                // 预览：始终显示当前状态（即使没改动也能看到“目前状态”）
                const preview = this.buildCategoryPreview(category.fields, currentConfigNormalized);
                if (previewEl) {
                    previewEl.innerHTML = preview.html || '';
                    previewEl.title = preview.title || '';
                }

                // 改动数：只在该分类有改动时显示
                let modifiedCount = 0;
                Object.keys(category.fields || {}).forEach((key) => {
                    const cur = this.cleanFieldValue(currentConfigNormalized ? currentConfigNormalized[key] : undefined);
                    const init = this.cleanFieldValue(this.initialConfig ? this.initialConfig[key] : undefined);
                    if (cur !== init) modifiedCount++;
                });

                if (modifiedCount > 0) {
                    if (starEl) starEl.style.display = '';
                    if (countEl) {
                        countEl.style.display = '';
                        countEl.textContent = `改${modifiedCount}`;
                    }
                } else {
                    if (starEl) starEl.style.display = 'none';
                    if (countEl) countEl.style.display = 'none';
                }
            });
        }
        
        /**
         * 初始化数字输入框验证
         */
        initNumberInputValidation() {
            $('.number-input').each(function() {
                const $input = $(this);
                const $tooltip = $input.siblings('.number-validation-tooltip');
                let validationTimeout;
                
                const name = $input.attr('name');
                if (!name) return;
                
                const keys = name.replace('config[', '').replace(']', '').split('[');
                const fieldKey = keys[0];
                
                function validateNumberInput() {
                    const value = parseFloat($input.val());
                    
                    if ($input.val() === '' || isNaN(value)) {
                        $input[0].setCustomValidity('');
                        return;
                    }
                    
                    const definitions = window.courseDefaultConfig?.definitions?.fields || {};
                    const field = definitions[fieldKey];
                    if (!field) return;
                    
                    applyValidationToInput($input, fieldKey, value, definitions);
                }
                
                $input.on('input', function() {
                    clearTimeout(validationTimeout);
                    validationTimeout = setTimeout(validateNumberInput, 500);
                });
                
                $input.on('blur', function() {
                    clearTimeout(validationTimeout);
                    validateNumberInput();
                });
            });
        }
        
        /**
         * 绑定配置表单事件
         */
        bindConfigFormEvents() {
            // 修改检测
            $(document).on('change input', '#course_config_form input', () => {
                this.checkModifications();
            });
            
            // 获取默认配置
            $('#get_default_config').on('click', () => {
                const btn = $('#get_default_config');
                const originalHtml = btn.html();
                btn.prop('disabled', true).html('<i class="bi bi-hourglass-split"></i>');
                
                const module = getCourseModule();
                $.ajax({
                    url: `/${module}/course/get_default_config_ajax`,
                    type: 'GET',
                    dataType: 'json',
                    success: (response) => {
                        if (response.code === 1) {
                            this.configData.config = response.data;
                            this.generateConfigForm(response.data);
                            
                            if (window.csgSwitch) {
                                window.csgSwitch.autoInit();
                            }
                            this.initNumberInputValidation();
                            this.checkModifications();
                            
                            alerty.success('已加载默认配置', 'Default configuration loaded');
                        } else {
                            alerty.error(response.msg, 'Failed to load default configuration');
                        }
                    },
                    error: (xhr, status, error) => {
                        alerty.error('获取默认配置失败：' + error, 'Failed to get default configuration: ' + error);
                    },
                    complete: () => {
                        btn.prop('disabled', false).html(originalHtml);
                    }
                });
            });
            
            // 下载配置
            $('#export_config').on('click', () => {
                this.exportConfig();
            });
            
            // 上传配置
            $('#import_config').on('click', () => {
                $('#import_file_input').click();
            });
            
            $('#import_file_input').on('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.importConfig(file);
                }
            });
            
        }
        
        /**
         * 检查修改状态
         */
        checkModifications() {
            const currentConfigRaw = this.collectFormData();
            const currentConfig = this.normalizeConfigTypes(currentConfigRaw);
            let hasModifications = false;
            let modifiedCount = 0;
            
            // 清除所有修改状态
            $('#course_config_form input').removeClass('modified');
            $('#course_config_form .csg-switch-setting').removeClass('modified');
            $('.modified-indicator').hide();
            
            Object.keys(currentConfig).forEach(key => {
                const currentValue = this.cleanFieldValue(currentConfig[key]);
                const initialValue = this.cleanFieldValue(this.initialConfig[key]);
                
                if (currentValue !== initialValue) {
                    hasModifications = true;
                    modifiedCount++;
                    
                    const $element = $(`#config_${key}`);
                    if ($element.hasClass('csg-switch-input')) {
                        $element.closest('.csg-switch-setting').addClass('modified');
                        $element.closest('.csg-switch-container').find('.modified-indicator').show();
                    } else {
                        $element.addClass('modified');
                        $element.closest('.form-control-container').find('.modified-indicator').show();
                    }
                }
            });
            
            // 修改状态检测保留，但不显示提示（配置随主表单一起保存）
            // if (hasModifications) {
            //     $('#modification_count').text(modifiedCount);
            //     $('#modification_status').show();
            //     $('#header_modification_icon').show();
            // } else {
            //     $('#modification_status').hide();
            //     $('#header_modification_icon').hide();
            // }

            // 同步折叠标题栏的星标/改动数/预览
            this.updateCategoryHeaderStatus(currentConfig);
        }
        
        /**
         * 收集表单数据
         */
        collectFormData() {
            const formData = {};
            $('#course_config_form input').each(function() {
                const name = $(this).attr('name');
                if (name && name.startsWith('config[')) {
                    const key = name.replace('config[', '').replace(']', '');
                    if ($(this).is(':checkbox')) {
                        formData[key] = $(this).is(':checked');
                    } else {
                        formData[key] = $(this).val();
                    }
                }
            });
            return formData;
        }
        
        /**
         * 清理字段值
         */
        cleanFieldValue(value) {
            if (typeof value === 'boolean') {
                return value;
            } else if (typeof value === 'number' || !isNaN(parseFloat(value))) {
                return parseFloat(value);
            } else {
                return String(value || '').trim();
            }
        }
        
        /**
         * 下载配置
         */
        exportConfig() {
            // 以“默认配置”为底，再用当前表单覆盖，保证导出字段完整且类型正确
            const base = this.configData?.config || {};
            const formDataRaw = this.collectFormData();
            const formData = this.normalizeConfigTypes(formDataRaw);
            const merged = Object.assign({}, base, formData);

            const exportData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                description: 'CSGOJ Course Configuration Export',
                config: merged
            };
            
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `course_config_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            alerty.success('配置下载已启动 / Configuration export started');
        }
        
        /**
         * 上传配置
         */
        importConfig(file) {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);

                    // 兼容两种格式：
                    // 1) 我们导出的结构：{ config: {...}, ... }
                    // 2) 纯配置对象：{ALLOW_WA_INFO:..., ...}
                    let importedConfig = null;
                    if (importData && typeof importData === 'object' && importData.config && typeof importData.config === 'object') {
                        importedConfig = importData.config;
                    } else if (importData && typeof importData === 'object' && !Array.isArray(importData)) {
                        importedConfig = importData;
                    }

                    if (!importedConfig || typeof importedConfig !== 'object' || Array.isArray(importedConfig)) {
                        alerty.error('无效的配置文件格式', 'Invalid configuration file format');
                        return;
                    }
                    
                    this.processImportedConfig(importedConfig);
                } catch (error) {
                    alerty.error('配置文件解析失败：' + error.message, 'Failed to parse configuration file: ' + error.message);
                }
            };
            
            reader.onerror = () => {
                alerty.error('文件读取失败', 'Failed to read file');
            };
            
            reader.readAsText(file);
        }
        
        /**
         * 处理上传的配置
         */
        processImportedConfig(importedConfig) {
            const definitions = this.configData.definitions?.fields || {};
            const unknownFields = [];
            const invalidFields = [];
            
            Object.keys(importedConfig).forEach(key => {
                if (!definitions[key]) {
                    unknownFields.push(key);
                    return;
                }
                
                const field = definitions[key];
                let value = importedConfig[key];
                
                if (field.type === 'switch') {
                    if (typeof value !== 'boolean') {
                        invalidFields.push(`${key}: 必须是布尔值`);
                        return;
                    }
                    $(`#config_${key}`).prop('checked', value);
                } else if (field.type === 'number') {
                    if (typeof value !== 'number' || isNaN(value)) {
                        invalidFields.push(`${key}: 必须是数字`);
                        return;
                    }
                    // 兼容：PLAGIARISM_SCORE 支持 0~1 或 0~100（视为百分比，需除以 100）
                    if (key === 'PLAGIARISM_SCORE' && value > 1) {
                        value = value / 100;
                    }
                    if (field.min !== undefined && value < field.min) {
                        invalidFields.push(`${key}: 不能小于 ${field.min}`);
                        return;
                    }
                    if (field.max !== undefined && value > field.max) {
                        invalidFields.push(`${key}: 不能大于 ${field.max}`);
                        return;
                    }
                    // 前端显示：PLAGIARISM_SCORE 用百分比整数
                    if (key === 'PLAGIARISM_SCORE') {
                        $(`#config_${key}`).val(Math.round(value * 100));
                    } else {
                        $(`#config_${key}`).val(value);
                    }
                }
            });
            
            if (window.csgSwitch) {
                window.csgSwitch.autoInit();
            }
            
            this.checkModifications();
            
            if (unknownFields.length > 0) {
                alerty.warn(`上传的配置包含 ${unknownFields.length} 个未知字段，已忽略`, `Imported configuration contains ${unknownFields.length} unknown fields, ignored`);
            }
            
            if (invalidFields.length > 0) {
                alerty.warn(`上传的配置包含 ${invalidFields.length} 个无效字段`, `Imported configuration contains ${invalidFields.length} invalid fields`);
            }
            
            if (unknownFields.length === 0 && invalidFields.length === 0) {
                alerty.success('配置上传成功', 'Configuration imported successfully');
            }
        }
        
        /**
         * 设置表单验证
         */
        setupFormValidation() {
            // 自定义验证函数：course key 只能包含数字、字母和下划线
            const validateCourseKey = (value, element) => {
                return /^[a-zA-Z0-9_]+$/.test(value);
            };
            
            // 表单验证规则
            const fieldConfigs = {
                course_key: {
                    rules: {
                        required: true,
                        maxlength: 30,
                        custom: [validateCourseKey]
                    },
                    messages: {
                        custom: FormValidationTip.createBilingualMessage(
                            '仅支持数字字母下划线',
                            'Only letters, numbers, and underscores are allowed'
                        )
                    }
                },
                course_title: {
                    rules: {
                        required: true,
                        maxlength: 128
                    }
                },
                course_unit: {
                    rules: {
                        maxlength: 128
                    }
                },
                course_description: {
                    rules: {
                        maxlength: 16384
                    }
                }
            };
            
            // 使用 FormValidationTip 进行表单验证
            if (typeof FormValidationTip !== 'undefined') {
                FormValidationTip.initCommonFormValidation('#course_edit_form', fieldConfigs, (form) => {
                    return this.handleSubmit(form);
                });
            } else {
                console.error('FormValidationTip is not loaded');
            }
        }
        
        /**
         * 处理表单提交
         */
        handleSubmit(form) {
            const submitButton = document.getElementById('submit_button');
            if (!submitButton) return false;
            const $btn = $('#submit_button');

            // 确保 Vditor 内容已同步到 textarea
            try {
                const textareaEl = document.getElementById('course_description');
                if (textareaEl && this.descriptionEditor && typeof this.descriptionEditor.getValue === 'function') {
                    textareaEl.value = this.descriptionEditor.getValue() || textareaEl.value || '';
                }
            } catch (e) {}
            
            // 提交配置数据（如果有修改）
            const currentConfigRaw = this.collectFormData();
            const currentConfig = this.normalizeConfigTypes(currentConfigRaw);
            const jsonData = JSON.stringify(currentConfig);
            $('#course_config_json').val(jsonData);
            
            // 提交中视觉反馈
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="cn-text"><i class="bi bi-hourglass-split me-1"></i> 提交中</span><span class="en-text">Submitting</span>';
            
            const onSuccess = (ret) => {
                if (ret && ret.code == 1) {
                    if (ret.data && ret.data.alert === true) {
                        alerty.alert(ret.msg);
                    } else {
                        alerty.success(ret.msg);
                    }
                    button_delay($btn, 3, this.submitButtonText, null, this.submitButtonEnText);
                    
                    // 更新初始配置
                    this.initialConfig = JSON.parse(JSON.stringify(currentConfig));
                    this.checkModifications();
                    
                    // 非编辑模式（添加成功）则按返回的 course_key 跳转到编辑页
                    try {
                        const cfg = window.COURSE_EDIT_CONFIG || {};
                        if (!cfg.edit_mode && ret.data && ret.data.course_key) {
                            setTimeout(() => {
                                window.location.href = `/exadmin/course/course_edit?key=${ret.data.course_key}`;
                            }, 500);
                        }
                        // 编辑模式：仅当 ret.code=1 且确实修改了 course_key 时才跳转
                        if (cfg.edit_mode && ret.data && ret.data.course_key) {
                            const newKey = ret.data.course_key || '';
                            const changedFlag = (ret.data.course_key_changed === true);
                            // 不由前端自行比较判断，完全以服务端返回的标记为准
                            if (changedFlag) {
                                setTimeout(() => {
                                    window.location.href = `/${cfg.module}/course/course_edit?key=${newKey}`;
                                }, 500);
                            }
                        }
                    } catch (e) {}
                } else {
                    alerty.alert((ret && ret.msg) || '修改失败', (ret && ret.msg_en) || 'Update failed');
                    button_delay($btn, 3, this.submitButtonText, null, this.submitButtonEnText);
                }
            };

            // 兼容：如果 $.fn.ajaxSubmit 不存在，则回退到 $.ajax（避免“点提交无反应”）
            try {
                if ($.fn && typeof $.fn.ajaxSubmit === 'function') {
                    $(form).ajaxSubmit(onSuccess);
                } else {
                    $.ajax({
                        url: form.action,
                        type: (form.method || 'POST').toUpperCase(),
                        data: $(form).serialize(),
                        dataType: 'json',
                        success: onSuccess,
                        error: (xhr, status, error) => {
                            alerty.error('提交失败：' + error, 'Submit failed: ' + error);
                            button_delay($btn, 3, this.submitButtonText, null, this.submitButtonEnText);
                            submitButton.disabled = false;
                        }
                    });
                }
            } catch (e) {
                alerty.error('提交异常：' + (e && e.message ? e.message : e), 'Submit error');
                button_delay($btn, 3, this.submitButtonText, null, this.submitButtonEnText);
                submitButton.disabled = false;
            }
            return false;
        }
        
        /**
         * 绑定键盘快捷键
         */
        bindKeyboardShortcuts() {
            // 键盘快捷键：Ctrl+S 保存表单（允许在 input/textarea 中使用）
            $(window).on('keydown', (e) => {
                const isSaveKey = (e.key && e.key.toLowerCase() === 's') || e.keyCode === 83;
                if (!isSaveKey) return;
                if (!(e.ctrlKey || e.metaKey)) return;
                
                e.preventDefault();
                
                const form = document.getElementById('course_edit_form');
                if (form && typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                    return;
                }
                const btn = document.getElementById('submit_button');
                if (btn) {
                    btn.click();
                }
            });
        }
    }
    
    // 应用验证到输入框
    function applyValidationToInput($input, fieldKey, value, definitions) {
        const field = definitions[fieldKey];
        if (!field) return;
        
        const errors = [];
        
        if (field.type === 'number') {
            if (typeof value !== 'number' || isNaN(value)) {
                errors.push(`必须是数字`);
            } else {
                if (field.min !== undefined && value < field.min) {
                    errors.push(`不能小于 ${field.min}`);
                }
                if (field.max !== undefined && value > field.max) {
                    errors.push(`不能大于 ${field.max}`);
                }
            }
        }
        
        if (errors.length === 0) {
            $input.addClass('is-valid').removeClass('is-invalid');
            $input[0].setCustomValidity('');
        } else {
            $input.addClass('is-invalid').removeClass('is-valid');
            $input[0].setCustomValidity(errors[0]);
        }
    }
    
    // 导出到全局作用域
    window.CourseEditPage = CourseEditPage;
    
    // 注意：不要在文件内部自动初始化，让视图文件控制初始化时机
    // 这样可以避免重复初始化
    // $(document).ready(function() {
    //     if (typeof window.COURSE_EDIT_CONFIG !== 'undefined') {
    //         const courseEditPage = new window.CourseEditPage(window.COURSE_EDIT_CONFIG);
    //         courseEditPage.init();
    //     }
    // });
})();

