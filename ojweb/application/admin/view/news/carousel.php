<script type="text/javascript" src="__STATIC__/js/form_validate_tip.js"></script>

<div class="carousel-admin-page">
<div class="admin-page-header admin-page-header--compact-carousel">
    <div class="admin-page-header-left">
        <div class="admin-page-header-icon">
            <i class="bi bi-images"></i>
        </div>
        <h1 class="admin-page-header-title">
            <div class="admin-page-header-title-main">
                首页轮播<span class="en-text">Home Carousel</span>
            </div>
        </h1>
    </div>
    <div class="admin-page-header-actions">
        <button type="button" class="btn btn-success btn-sm"
                data-modal-url="/{$module}/filemanager/filemanager?item={$controller}&id={$staticPage.carousel}"
                data-modal-title="附件管理 · 首页轮播"
                title="上传与管理轮播用到的图片等附件">
            <span class="cn-text"><i class="bi bi-paperclip"></i> 附件</span><span class="en-text">Attach</span>
        </button>
        <a href="__HOME__/index/index" target="_blank" class="btn btn-outline-secondary btn-sm" title="预览首页 (Preview home)">
            <i class="bi bi-box-arrow-up-right"></i>
            <span class="cn-text">预览</span><span class="en-text">Preview</span>
        </a>
    </div>
</div>

<div class="container-fluid px-3 pb-3">
    <p class="small text-muted mb-2 lh-sm carousel-admin-hint">
        <span class="cn-text">关闭开关后，访客在首页将看不到轮播区域。</span>
        <span class="en-text">When the switch is off, visitors will not see the carousel on the home page.</span>
    </p>

    <form id="carousel_edit_form" class="admin-form" method="post" action="/{$module}/news/carousel_ajax">
        <div class="d-flex flex-wrap align-items-center gap-3 border rounded px-3 py-2 mb-2 bg-body-secondary bg-opacity-25">
            <div class="form-check form-switch mb-0">
                <input class="form-check-input" type="checkbox" role="switch" id="show_carousel"
                       name="show_carousel" value="1" {if $news.defunct == '0'}checked{/if}>
                <label class="form-check-label bilingual-label small mb-0" for="show_carousel">
                    首页显示<span class="en-text">Show on home</span>
                </label>
            </div>
            <div class="vr d-none d-md-block"></div>
            <div class="d-flex flex-wrap gap-2 ms-md-auto">
                <button type="submit" id="carousel_submit_btn" class="btn btn-primary btn-sm bilingual-button py-1">
                    <span><i class="bi bi-check-circle"></i> 保存</span><span class="en-text">Save</span>
                </button>
                <button type="button" id="carousel_shift_btn" class="btn btn-outline-info btn-sm py-1"
                        title="三张幻灯片字段循环移位">
                    <i class="bi bi-arrow-repeat"></i><span class="cn-text">移位</span><span class="en-text">Shift</span>
                </button>
                <button type="button" id="carousel_clear_btn" class="btn btn-outline-warning btn-sm py-1"
                        title="清空各幻灯片的链接与文案（不影响开关）">
                    <i class="bi bi-eraser"></i><span class="cn-text">清空</span><span class="en-text">Clear</span>
                </button>
            </div>
        </div>

        <?php
        $carouselNewsId = isset($staticPage['carousel']) ? intval($staticPage['carousel']) : 0;
        ?>
        <div class="row g-2">
        <?php for ($ci = 0; $ci < 3; $ci ++): ?>
            <div class="col-12 col-lg-4">
                <div class="border rounded h-100 px-2 pt-2 pb-1 bg-white">
                    <div class="fw-semibold small bilingual-label border-bottom pb-1 mb-2 text-secondary">
                        幻灯片 <?php echo htmlspecialchars((string)$ci, ENT_QUOTES, 'UTF-8'); ?>
                        <span class="en-text">Slide <?php echo htmlspecialchars((string)$ci, ENT_QUOTES, 'UTF-8'); ?></span>
                    </div>
                    <?php foreach ($carouselItem as $item):
                        $fh = isset($carouselFieldHelp[$item]) ? $carouselFieldHelp[$item] : [
                            'label_cn' => $item,
                            'label_en' => $item,
                            'hint_cn' => '',
                            'hint_en' => '',
                        ];
                        $cell = isset($carousel[$item][$ci]) ? $carousel[$item][$ci] : '';
                        $fid = htmlspecialchars($item . (string)$ci, ENT_QUOTES, 'UTF-8');
                        $tip = trim(($fh['hint_cn'] ?? '') . ' ' . ($fh['hint_en'] ?? ''));
                        $tipAttr = $tip !== '' ? htmlspecialchars($tip, ENT_QUOTES, 'UTF-8') : '';
                    ?>
                    <div class="mb-2">
                        <label class="form-label small mb-0 text-muted" for="fld_<?php echo $fid; ?>">
                            <?php echo htmlspecialchars($fh['label_cn'], ENT_QUOTES, 'UTF-8'); ?><span class="en-text"><?php echo htmlspecialchars($fh['label_en'], ENT_QUOTES, 'UTF-8'); ?></span>
                        </label>
                        <input type="text" class="form-control form-control-sm mt-1" id="fld_<?php echo $fid; ?>"
                               name="<?php echo htmlspecialchars($item, ENT_QUOTES, 'UTF-8') . $ci; ?>"
                               value="<?php echo htmlspecialchars((string)$cell, ENT_QUOTES, 'UTF-8'); ?>"
                               autocomplete="off"<?php if ($tipAttr !== ''): ?> title="<?php echo $tipAttr; ?>"<?php endif; ?>>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endfor; ?>
        </div>

        <input type="hidden" name="news_id" value="<?php echo $carouselNewsId; ?>">
    </form>
</div>

<style>
/* 轮播编辑页：收紧页头与表单纵向占位（仅本页） */
.carousel-admin-page .admin-page-header--compact-carousel {
    margin-bottom: 0.5rem;
}
@media (min-width: 992px) {
    .carousel-admin-page .row.g-2 > [class*="col-lg-4"] {
        display: flex;
    }
    .carousel-admin-page .row.g-2 > [class*="col-lg-4"] > .border.rounded {
        flex: 1 1 auto;
    }
}
</style>

</div>

{js href="__STATIC__/csgoj/news/carousel_admin.js" /}
