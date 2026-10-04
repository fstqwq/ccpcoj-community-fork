// **************************************************
// 可复用：权限说明提示（标题右侧）——JS 可选增强
// 用法：
// - 模板渲染 <div class="csg-perm-hint" data-context="..." data-perm-json="...">
// - 若 window.CSGOJ_PERMISSION_HINT_MAP[context] 存在，则覆盖文案/样式
// **************************************************

(function() {
    'use strict';

    function safeJsonParse(s) {
        try { return JSON.parse(s); } catch (e) { return null; }
    }

    function applyHint(el, cfg) {
        if (!el || !cfg) return;
        const cnCur = el.querySelector('[data-perm="current-cn"]');
        const enCur = el.querySelector('[data-perm="current-en"]');
        const cnDesc = el.querySelector('[data-perm="desc-cn"]');
        const enDesc = el.querySelector('[data-perm="desc-en"]');

        const roleCn = cfg.role_cn || cfg.current_cn || cfg.title_cn;
        const roleEn = cfg.role_en || cfg.current_en || cfg.title_en;
        const descCn = cfg.desc_cn;
        const descEn = cfg.desc_en;

        if (roleCn && cnCur) {
            // 若传入是完整句子（包含“当前权限”），则直接覆盖文本；否则只替换值区
            const v = cnCur.querySelector('.csg-perm-v');
            if (v && !String(roleCn).includes('当前')) v.textContent = roleCn;
            else cnCur.textContent = roleCn;
        }
        if (roleEn && enCur) {
            const v = enCur.querySelector('.csg-perm-v');
            if (v && !String(roleEn).toLowerCase().includes('current')) v.textContent = roleEn;
            else enCur.textContent = roleEn;
        }
        if (typeof descCn === 'string' && cnDesc) cnDesc.textContent = descCn;
        if (typeof descEn === 'string' && enDesc) enDesc.textContent = descEn;

        if (cfg.level) {
            el.className = el.className.replace(/\bcsg-perm-hint--\w+\b/g, '').trim();
            el.classList.add('csg-perm-hint--' + cfg.level);
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('.csg-perm-hint').forEach((n) => {
            const ctx = String(n.getAttribute('data-context') || '');
            const map = window.CSGOJ_PERMISSION_HINT_MAP || {};
            if (ctx && map && map[ctx]) {
                applyHint(n, map[ctx]);
                return;
            }

            const raw = n.getAttribute('data-perm-json');
            if (raw) {
                const cfg = safeJsonParse(raw);
                if (cfg) applyHint(n, cfg);
            }
        });
    });
})();


