<!-- 通用页头：变量 csg_ph_icon_class、csg_ph_icon_href（可选）、csg_ph_icon_title（可选）、csg_ph_heading_html | csg_ph_title+csg_ph_en、csg_ph_chips_html、csg_ph_actions_html；样式见 global_css 中 csg_page_header.css -->
{js href="__STATIC__/csgoj/common/csg_page_header.js" /}
<?php
$icon = isset($csg_ph_icon_class) ? trim((string) $csg_ph_icon_class) : '';
if ($icon === '') {
	$icon = 'bi-stars';
}
if (preg_match('/^bi\\s+bi-/i', $icon)) {
	// 已是 "bi bi-xxx"
} elseif (preg_match('/^bi-/i', $icon)) {
	$icon = 'bi ' . $icon;
} elseif (!preg_match('/^bi\\s/i', $icon)) {
	$icon = 'bi bi-' . $icon;
}
$iconHref = isset($csg_ph_icon_href) ? trim((string) $csg_ph_icon_href) : '';
$iconTitle = isset($csg_ph_icon_title) ? trim((string) $csg_ph_icon_title) : '';
$iconInner = '<i class="' . htmlspecialchars($icon, ENT_QUOTES, 'UTF-8') . '"></i>';
?>
<div class="csg-page-header" role="banner">
	<div class="csg-page-header__sheet">
		<div class="csg-page-header__grid">
			<div class="csg-page-header__identity">
				<?php if ($iconHref !== ''): ?>
				<a class="csg-page-header__icon csg-page-header__icon--link" href="<?php echo htmlspecialchars($iconHref, ENT_QUOTES, 'UTF-8'); ?>"<?php if ($iconTitle !== ''): ?> title="<?php echo htmlspecialchars($iconTitle, ENT_QUOTES, 'UTF-8'); ?>"<?php endif; ?>>
					<?php echo $iconInner; ?>
				</a>
				<?php else: ?>
				<div class="csg-page-header__icon" aria-hidden="true">
					<?php echo $iconInner; ?>
				</div>
				<?php endif; ?>
				<div class="csg-page-header__wording">
					{notempty name="csg_ph_heading_html"}
						{$csg_ph_heading_html|raw}
					{else /}
						<h1 class="csg-page-header__heading">
							<span class="csg-page-header__title">{$csg_ph_title|default=''}</span>
							{notempty name="csg_ph_en"}
								<span class="csg-page-header__en en-text">{$csg_ph_en}</span>
							{/notempty}
						</h1>
					{/notempty}
					{notempty name="csg_ph_chips_html"}
					<div class="csg-page-header__chips">{$csg_ph_chips_html|raw}</div>
					{/notempty}
				</div>
			</div>
			{notempty name="csg_ph_actions_html"}
			<div class="csg-page-header__actions">{$csg_ph_actions_html|raw}</div>
			{/notempty}
		</div>
	</div>
</div>
