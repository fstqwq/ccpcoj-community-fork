// examsys 模块全局 JavaScript
// 注意：AutoInitBootstrapTooltips 和 DoInitTooltip 等功能已在全局 global.js 中提供
// 如需添加 examsys 特有的全局函数，请在此文件中添加

// 页面模块常量（全局定义，避免重复声明）
// 防重复加载：如果已定义则跳过
// 注意：由于 const 不能重复声明，我们使用 window.PAGE_MODULE 作为主要存储
// 代码中应使用 window.PAGE_MODULE 或 PAGE_MODULE（如果已声明）

// 首先确保 window.PAGE_MODULE 存在（可以安全地重复设置）
if (typeof window.PAGE_MODULE === 'undefined') {
    window.PAGE_MODULE = 'examsys';
}

// 尝试创建全局变量 PAGE_MODULE（如果尚未声明）
// 使用 var 而不是 const，因为 var 可以重复声明（会忽略重复声明，不会报错）
try {
    // 检查 PAGE_MODULE 是否已声明
    // 注意：typeof 对未声明的变量返回 'undefined'
    if (typeof PAGE_MODULE === 'undefined') {
        // 使用 eval 在全局作用域声明 var（var 可以重复声明）
        // 注意：eval 中的 var 会在全局作用域声明变量
        eval('var PAGE_MODULE = window.PAGE_MODULE;');
    }
} catch(e) {
    // 如果出错，确保 window.PAGE_MODULE 存在
    if (typeof window.PAGE_MODULE === 'undefined') {
        window.PAGE_MODULE = 'examsys';
    }
}

// ================================
// examsys：滚动区（overflow-y scroll/auto）展开/收起
// 用于：代码模板、参考代码、参考答案等固定高度代码块
// ================================
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.ex-scroll-toggle');
    if (!btn) return;
    e.preventDefault();

    const section = btn.closest('.ex-scroll-section');
    if (!section) {
        throw new Error('ex-scroll-toggle: missing .ex-scroll-section wrapper');
    }
    const selector = btn.getAttribute('data-ex-target');
    if (!selector) {
        throw new Error('ex-scroll-toggle: missing data-ex-target');
    }
    const target = section.querySelector(selector);
    if (!target) {
        throw new Error('ex-scroll-toggle: target not found: ' + selector);
    }

    const icon = btn.querySelector('i');
    if (!icon) {
        throw new Error('ex-scroll-toggle: missing icon <i>');
    }

    const expanded = target.getAttribute('data-ex-expanded') === '1';
    if (!expanded) {
        target.setAttribute('data-ex-orig-max-height', target.style.maxHeight || '');
        target.setAttribute('data-ex-orig-overflow', target.style.overflow || '');
        target.setAttribute('data-ex-orig-overflow-y', target.style.overflowY || '');

        target.style.maxHeight = 'none';
        target.style.overflow = 'visible';
        target.style.overflowY = 'visible';
        target.setAttribute('data-ex-expanded', '1');

        icon.className = 'bi bi-arrows-angle-contract';
        btn.setAttribute('title', '收起 / Collapse');
    } else {
        target.style.maxHeight = target.getAttribute('data-ex-orig-max-height') || '';
        target.style.overflow = target.getAttribute('data-ex-orig-overflow') || '';
        target.style.overflowY = target.getAttribute('data-ex-orig-overflow-y') || '';
        target.setAttribute('data-ex-expanded', '0');

        icon.className = 'bi bi-arrows-angle-expand';
        btn.setAttribute('title', '展开 / Expand');
    }
});

// ================================
// examsys：图片缩略图点击查看大图（默认支持，可通过 data-csg-img-clickable="0" 关闭）
// 约定：缩略图使用 class="csg-img-thumb"
// ================================
function CsgEnsureImageViewerModal() {
    const existing = document.getElementById('csg_image_viewer_modal');
    if (existing) return existing;

    const modalHtml = `
        <div class="modal fade" id="csg_image_viewer_modal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title bilingual-inline">
                            <span class="cn-text">图片预览</span>
                            <span class="en-text">Image Preview</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-2">
                        <div class="text-center">
                            <img id="csg_image_viewer_img" class="img-fluid rounded" alt="preview" style="max-height: 78vh;">
                        </div>
                    </div>
                    <div class="modal-footer py-2">
                        <a class="btn btn-outline-secondary btn-sm" id="csg_image_viewer_open_new" href="#" target="_blank" rel="noopener">
                            <span class="cn-text">新窗口打开</span>
                            <span class="en-text">Open in new tab</span>
                        </a>
                        <button type="button" class="btn btn-primary btn-sm" data-bs-dismiss="modal">
                            <span class="cn-text">关闭</span>
                            <span class="en-text">Close</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = modalHtml.trim();
    document.body.appendChild(wrap.firstElementChild);
    return document.getElementById('csg_image_viewer_modal');
}

document.addEventListener('click', function(e) {
    const img = e.target.closest('img.csg-img-thumb');
    if (!img) return;
    const clickable = img.getAttribute('data-csg-img-clickable');
    if (clickable === '0') return;
    const src = img.getAttribute('src') || '';
    if (!src || src.trim() === '') return;

    const modalEl = CsgEnsureImageViewerModal();
    const imgEl = document.getElementById('csg_image_viewer_img');
    const openNew = document.getElementById('csg_image_viewer_open_new');
    if (imgEl) imgEl.src = src;
    if (openNew) openNew.href = src;

    // bootstrap modal show
    try {
        const m = bootstrap.Modal.getOrCreateInstance(modalEl);
        m.show();
    } catch (err) {
        // fallback: just open new tab
        window.open(src, '_blank', 'noopener');
    }
});
