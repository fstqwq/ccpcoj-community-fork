/**
 * 抢先设置 html[data-contestlive-skin]，减少 FOUC。须先于 contestlive_skin.css。
 * 依赖：contestlive_skin_common.js（须先于本文件）
 */
(function () {
    var L = window.ContestliveSkinLib;
    var sc = document.getElementById('contestlive-skin-boot');
    var page = (sc && sc.getAttribute('data-contestlive-page')) || 'live';
    var skin = 'default';
    if (L) {
        skin = L.resolveSkin(page, null);
        L.applySkinToDom(skin);
    } else {
        document.documentElement.setAttribute('data-contestlive-skin', 'default');
    }
})();
