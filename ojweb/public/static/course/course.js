/**
 * 课程组相关页面 JavaScript（通用功能）
 * Course Related Pages JavaScript (Common Functions)
 * 
 * 功能模块：
 * 1. 课程列表展示（列表页）
 * 
 * 注意：课程编辑页的专用功能已移至 course_admin.js
 */

// ========================================
// 课程列表页功能类
// ========================================
(function() {
    'use strict';
    
    /**
     * 课程列表页管理类
     */
    class CourseListPage {
        constructor(ojMode, ojStatus) {
            this.state = {
                data: [],
                filtered: [],
                selectedKey: null,
                OJ_MODE: ojMode,
                OJ_STATUS: ojStatus
            };
            
            // 课程详情缓存：避免重复点击同一课程时反复请求 course_ajax
            this.courseInfoCache = {};
            this.courseInfoLoadedKey = null;
            this._courseInfoXhr = null;
        }
        
        /**
         * 初始化课程列表页
         */
        init() {
            // 加载课程列表
            this.loadCourseList();
            
            // 搜索框事件
            $('#course_search').on('input', () => {
                this.filterCourseList($('#course_search').val());
            });
            
            // 搜索框回车事件
            $('#course_search').on('keypress', (e) => {
                if (e.which === 13) {
                    e.preventDefault();
                }
            });
        }
        
        /**
         * 加载课程列表
         */
        loadCourseList() {
            $('#course_list_loading').removeClass('d-none').addClass('d-flex');
            $('#course_list').empty();
            $('#course_list_empty').addClass('d-none').removeClass('d-flex');
            
            $.get('/course/index/course_list_ajax', (ret) => {
                try {
                    // 后端返回格式: {code: 1, msg: "...", data: [...]}
                    if (ret && ret.code == 1 && Array.isArray(ret.data)) {
                        this.state.data = ret.data;
                    } else {
                        this.state.data = [];
                    }
                    this.state.filtered = this.state.data;
                    this.renderCourseList();
                    $('#course_list_loading').addClass('d-none').removeClass('d-flex');
                    
                    // 检查url是否设置了显示的课程
                    const course_key = csg.GetAnchor('course');
                    if (course_key) {
                        const course = this.state.data.find(c => c.course_key === course_key);
                        if (course) {
                            this.selectCourse(course);
                            this.showCourseInfo(course);
                        } else {
                            // URL 中指定的课程不存在，显示 About Us
                            this.state.selectedKey = null;
                            this.showAboutUs();
                        }
                    } else {
                        // 没有选中课程，显示 About Us
                        this.state.selectedKey = null;
                        this.showAboutUs();
                    }
                } catch (e) {
                    console.error('Error loading course list:', e);
                    this.state.data = [];
                    this.state.filtered = [];
                    $('#course_list_loading').addClass('d-none').removeClass('d-flex');
                    $('#course_list_empty').removeClass('d-none').addClass('d-flex');
                    // 即使课程列表加载失败，也显示 About Us
                    this.state.selectedKey = null;
                    this.showAboutUs();
                }
            }).fail(() => {
                $('#course_list_loading').addClass('d-none').removeClass('d-flex');
                $('#course_list_empty').removeClass('d-none').addClass('d-flex');
                this.state.data = [];
                this.state.filtered = [];
                // 即使课程列表加载失败，也显示 About Us
                this.state.selectedKey = null;
                this.showAboutUs();
            });
        }
        
        /**
         * 渲染课程列表
         */
        renderCourseList() {
            const $list = $('#course_list');
            $list.empty();
            
            if (!Array.isArray(this.state.filtered) || this.state.filtered.length === 0) {
                $('#course_list_empty').removeClass('d-none').addClass('d-flex');
                return;
            }
            
            $('#course_list_empty').addClass('d-none').removeClass('d-flex');
            
            try {
                this.state.filtered.forEach((course, index) => {
                    const target_module = this.state.OJ_MODE == "cpcsys" ? "examsys" : "expsys";
                    const isSelected = this.state.selectedKey === course.course_key;
                    const attach = course.attach || course.course_key;
                    const logoUrl = attach ? `/upload/course_attach/${attach}/unit_logo.png` : '';
                    const courseUnit = course.course_unit
                        ? `<div class="course-item-unit">
                               ${logoUrl ? `<img class="course-unit-logo" src="${logoUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" />` : ''}
                               <i class="bi bi-building course-unit-icon" style="${logoUrl ? 'display:none;' : ''}"></i>
                               <span class="course-unit-text">${course.course_unit}</span>
                           </div>`
                        : '';
                    const listItem = `
                        <li class="list-group-item course-item ${isSelected ? 'active' : ''}" 
                            data-course-key="${course.course_key}">
                            <div class="course-item-content">
                                <div class="d-flex ${courseUnit ? 'align-items-start' : 'align-items-center'}">
                                    <div class="course-item-number-wrapper me-3">
                                        <div class="course-item-number">${index + 1}</div>
                                        <div class="course-item-key"><span class="course-item-key-text">${course.course_key || ''}</span></div>
                                    </div>
                                    <div class="flex-grow-1 course-item-info ${courseUnit ? 'has-unit' : 'no-unit'}">
                                        <div class="course-item-title course-text-title">${course.course_title || ''}</div>
                                        ${courseUnit}
                                    </div>
                                </div>
                                <a href="/${target_module}?now_course_key=${course.course_key}" 
                                   class="course-item-enter-tab"
                                   title="进入"
                                   onclick="event.stopPropagation();">
                                    进入
                                </a>
                            </div>
                        </li>
                    `;
                    $list.append(listItem);
                });
                
                // 绑定点击事件
                const self = this;
                $list.find('.course-item').off('click').on('click', function() {
                    const courseKey = $(this).data('course-key');
                    // 重复点击同一课程（没有切换）不重复加载 course_ajax
                    if (courseKey && courseKey === self.state.selectedKey) {
                        return;
                    }
                    const course = self.state.data.find(c => c.course_key === courseKey);
                    if (course) {
                        self.selectCourse(course);
                        self.showCourseInfo(course);
                    }
                });

                // course_key 溢出时：悬停跑马灯显示完整内容
                $list.find('.course-item-key')
                    .off('mouseenter.courseKeyMarquee mouseleave.courseKeyMarquee')
                    .on('mouseenter.courseKeyMarquee', function() {
                        const $key = $(this);
                        const $text = $key.find('.course-item-key-text');
                        if ($text.length === 0) return;

                        const textEl = $text.get(0);
                        const keyEl = $key.get(0);
                        if (!textEl || !keyEl) return;

                        // 只在真实溢出时启用动画
                        const cs = window.getComputedStyle(keyEl);
                        const paddingLeft = parseFloat(cs.paddingLeft || '0') || 0;
                        const paddingRight = parseFloat(cs.paddingRight || '0') || 0;
                        const innerWidth = Math.max(0, keyEl.clientWidth - paddingLeft - paddingRight);
                        const distance = Math.max(0, textEl.scrollWidth - innerWidth);
                        if (distance <= 1) {
                            $key.removeClass('is-overflow');
                            $key.css('--marquee-distance', '');
                            $key.css('--marquee-duration', '');
                            return;
                        }

                        // 按距离动态设置速度：约 55px/s，最短 2.4s，最长 9s
                        const duration = Math.min(9, Math.max(2.4, distance / 55));
                        $key.addClass('is-overflow');
                        $key.css('--marquee-distance', `${distance}px`);
                        $key.css('--marquee-duration', `${duration}s`);
                    })
                    .on('mouseleave.courseKeyMarquee', function() {
                        const $key = $(this);
                        $key.removeClass('is-overflow');
                        $key.css('--marquee-distance', '');
                        $key.css('--marquee-duration', '');
                    });
            } catch (e) {
                console.error('Error rendering course list:', e);
                $('#course_list_empty').removeClass('d-none').addClass('d-flex');
            }
        }
        
        /**
         * 选择课程
         */
        selectCourse(course) {
            this.state.selectedKey = course.course_key;
            csg.SetAnchor(course.course_key, 'course');
            
            // 更新列表项样式
            $('#course_list .course-item').removeClass('active');
            
            const $selectedItem = $(`#course_list .course-item[data-course-key="${course.course_key}"]`);
            $selectedItem.addClass('active');
        }
        
        /**
         * 显示 About Us 内容（当没有选中课程时）
         */
        showAboutUs() {
            // 如果正在加载课程信息，取消请求
            try {
                if (this._courseInfoXhr && this._courseInfoXhr.readyState !== 4) {
                    this._courseInfoXhr.abort();
                }
            } catch (e) {}
            
            $.get('/course/index/aboutus_ajax', (ret) => {
                try {
                    let aboutData = null;
                    if (ret && ret.code == 1 && ret.data) {
                        aboutData = ret.data;
                    }
                    this.renderAboutUs(aboutData);
                } catch (e) {
                    console.error('Error loading about us:', e);
                    this.renderAboutUs(null);
                }
            }).fail(() => {
                this.renderAboutUs(null);
            });
        }
        
        /**
         * 渲染 About Us 内容（系统介绍）
         */
        renderAboutUs(aboutData) {
            const data = aboutData || {};
            const title = '编程实践及多模式考试平台'; // 固定标题
            const content = data.content || '';
            
            // 隐藏header，系统介绍作为独立内容显示
            this.updateInfoPanelHeader('', '', '', '', false);
            
            const aboutHtml = `
                <div class="system-about">
                    <div class="system-about-header mb-4">
                        <h1 class="system-about-title mb-2">${title}</h1>
                        <p class="system-about-subtitle text-muted mb-0">Programming Practice and Multi-Mode Examination Platform</p>
                    </div>
                    <div class="system-about-content md_display_div">
                        ${content ? '' : '<div class="alert alert-info border-0 shadow-sm"><i class="bi bi-info-circle me-2"></i>内容待编辑</div>'}
                    </div>
                </div>
            `;
            $('#course_description').html(aboutHtml);
            
            // 隐藏加载提示
            $('#course_description_loading').addClass('d-none');
            
            // 如果有内容，使用 Vditor 渲染 Markdown
            if (content) {
                const contentContainer = $('#course_description .system-about-content');
                if (typeof CsgVditor !== 'undefined' && typeof CsgVditor.render === 'function') {
                    CsgVditor.render({
                        el: contentContainer[0],
                        markdown: content
                    });
                } else if (typeof Vditor !== 'undefined' && typeof Vditor.md2html === 'function') {
                    const htmlPromise = Vditor.md2html(content);
                    if (htmlPromise instanceof Promise) {
                        htmlPromise.then((html) => {
                            contentContainer.html(html);
                        });
                    } else {
                        contentContainer.html(htmlPromise);
                    }
                } else {
                    contentContainer.text(content);
                }
            }
        }
        
        /**
         * 更新右侧信息面板的标题和样式
         * @param {string} title - 标题文本
         * @param {string} iconClass - 图标类名
         * @param {string} headerClass - header样式类
         * @param {string} iconColorClass - 图标颜色类
         * @param {boolean} showHeader - 是否显示header（默认true）
         */
        updateInfoPanelHeader(title, iconClass, headerClass, iconColorClass, showHeader = true) {
            const $header = $('#course_info_header');
            const $icon = $('#course_info_icon');
            const $title = $('#course_info_title');
            const $cardBody = $header.siblings('.card-body');
            
            // 控制header的显示/隐藏
            if (showHeader) {
                $header.removeClass('d-none').show();
                $cardBody.removeClass('header-hidden');
            } else {
                $header.addClass('d-none').hide();
                $cardBody.addClass('header-hidden');
                return; // 隐藏时不需要更新其他内容
            }
            
            // 更新标题
            $title.text(title);
            
            // 更新图标
            if (iconClass) {
                // 移除所有可能的图标类，只保留bi基础类
                $icon.removeClass('bi-info-circle-fill bi-building bi-book-half');
                $icon.addClass(`bi ${iconClass} me-2`);
            }
            
            // 更新header样式
            $header.removeClass('bg-light bg-gradient bg-primary bg-secondary');
            
            if (headerClass === 'bg-gradient') {
                // 渐变背景（系统介绍）
                $header.addClass('bg-gradient');
                $icon.removeClass('text-primary text-dark').addClass(iconColorClass || 'text-white');
                $title.removeClass('text-dark text-muted').addClass(iconColorClass || 'text-white');
            } else {
                // 默认样式（课程介绍）
                $header.addClass('bg-light');
                $icon.removeClass('text-white').addClass(iconColorClass || 'text-primary');
                $title.removeClass('text-white').addClass('text-dark');
            }
        }
        
        /**
         * 显示课程信息
         */
        showCourseInfo(course) {
            const key = course && course.course_key ? course.course_key : null;
            if (!key) {
                // 如果没有课程key，显示 About Us
                this.showAboutUs();
                return;
            }
            
            // 已经展示过当前课程详情：不重复加载
            if (this.state.selectedKey === key && this.courseInfoLoadedKey === key) {
                return;
            }
            
            // 如果有缓存，直接渲染
            if (this.courseInfoCache[key]) {
                this.renderCourseInfo(this.courseInfoCache[key], course);
                this.courseInfoLoadedKey = key;
                return;
            }
            
            // 取消上一次未完成请求，避免竞态与浪费
            try {
                if (this._courseInfoXhr && this._courseInfoXhr.readyState !== 4) {
                    this._courseInfoXhr.abort();
                }
            } catch (e) {}
            
            this._courseInfoXhr = $.get(`/course/index/course_ajax?course_key=${key}`, (ret) => {
                try {
                    // 如果用户已经切换到其他课程，忽略本次返回（避免旧请求覆盖新课程）
                    if (this.state.selectedKey && this.state.selectedKey !== key) {
                        // 仍然可以缓存数据，便于后续切回快速展示
                        if (ret && ret.code == 1 && ret.data) {
                            this.courseInfoCache[key] = ret.data;
                        }
                        return;
                    }
                    
                    // 后端返回格式: {code: 1, msg: "...", data: {...}}
                    let courseData = course;
                    if (ret && ret.code == 1 && ret.data) {
                        courseData = ret.data;
                    }
                    
                    // 缓存并渲染
                    this.courseInfoCache[key] = courseData;
                    this.renderCourseInfo(courseData, course);
                    this.courseInfoLoadedKey = key;
                } catch (e) {
                    console.error('Error loading course info:', e);
                    $('#course_description').html(`
                        <div class="course-detail">
                            <h2 class="card-title mb-3">
                                <i class="bi bi-book-half"></i> ${course.course_title || ''}
                            </h2>
                            <div class="course-content">
                                <p class="text-muted">加载课程介绍失败</p>
                            </div>
                        </div>
                    `);
                }
            }).fail(() => {
                $('#course_description').html(`
                    <div class="course-detail">
                        <h2 class="card-title mb-3">
                            <i class="bi bi-book-half"></i> ${course.course_title || ''}
                        </h2>
                        <div class="course-content">
                            <p class="text-muted">加载课程介绍失败</p>
                        </div>
                    </div>
                `);
            });
        }

        /**
         * 渲染课程详情（支持 Markdown）
         */
        renderCourseInfo(courseData, fallbackCourse) {
            const data = courseData || fallbackCourse || {};
            
            // 显示header，更新右侧面板标题和样式为"课程介绍"
            this.updateInfoPanelHeader('课程介绍', 'bi-info-circle-fill', 'bg-light', 'text-primary', true);
            
            const courseHtml = `
                <div class="course-detail">
                    <h2 class="card-title mb-3">
                        <i class="bi bi-book-half"></i> ${data.course_title || ''}
                    </h2>
                    <div class="course-content md_display_div">
                        <!-- Markdown 内容将通过 Vditor 异步渲染 -->
                    </div>
                </div>
            `;
            $('#course_description').html(courseHtml);
            
            // 隐藏加载提示
            $('#course_description_loading').addClass('d-none');
            
            // 使用 Vditor 渲染 Markdown
            const contentContainer = $('#course_description .course-content');
            const markdown = data.course_description || '暂无课程介绍';
            
            if (typeof CsgVditor !== 'undefined' && typeof CsgVditor.render === 'function') {
                CsgVditor.render({
                    el: contentContainer[0],
                    markdown: markdown
                });
            } else if (typeof Vditor !== 'undefined' && typeof Vditor.md2html === 'function') {
                // 降级方案：使用 Vditor.md2html
                const htmlPromise = Vditor.md2html(markdown);
                if (htmlPromise instanceof Promise) {
                    htmlPromise.then((html) => {
                        contentContainer.html(html);
                    });
                } else {
                    contentContainer.html(htmlPromise);
                }
            } else {
                // 最终降级：直接显示文本
                contentContainer.text(markdown);
            }
        }
        
        /**
         * 搜索功能
         */
        filterCourseList(searchText) {
            if (!searchText || searchText.trim() === '') {
                this.state.filtered = this.state.data;
            } else {
                const search = searchText.toLowerCase();
                this.state.filtered = this.state.data.filter(course => {
                    return (course.course_title && course.course_title.toLowerCase().includes(search)) ||
                           (course.course_key && course.course_key.toLowerCase().includes(search)) ||
                           (course.course_unit && course.course_unit.toLowerCase().includes(search));
                });
            }
            this.renderCourseList();
        }
    }
    
    // 导出到全局作用域
    window.CourseListPage = CourseListPage;

    /**
     * 课程侧边栏：根据 course_title + course_unit 哈希一个配色方案
     * - 背景色体现在 sidebar（含 course-sidebar-content 区域的整体背景）
     * - 自动计算文字色，避免浅色背景下白字看不清
     */
    function applyCourseSidebarHashTheme() {
        const $sidebar = $('.course-sidebar');
        if ($sidebar.length === 0) return;

        const title = String($sidebar.data('course-title') || $sidebar.find('.course-sidebar-title').text() || '').trim();
        const unit = String($sidebar.data('course-unit') || '').trim();
        const key = `${title}#${unit}`;

        const scheme = csg.hashColorScheme(key);
        $sidebar[0].style.setProperty('--course-sidebar-bg', scheme.bg);
        $sidebar[0].style.setProperty('--course-sidebar-bg-hover', scheme.hover);
        $sidebar[0].style.setProperty('--course-sidebar-bg-active', scheme.active);
        $sidebar[0].style.setProperty('--course-sidebar-fg', scheme.fg);
    }

    // util.js 全局已引入：直接使用 csg，不做降级处理
    $(function() {
        applyCourseSidebarHashTheme();
    });
})();
