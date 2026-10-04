{__NOLAYOUT__}
<?php
$page_title = '评测数据';
$page_title_en = 'Judge Data';
$show_title = true;
// .in/.out/tpj.cc 保持严格；.zip 放宽：无空白、无 \ / : * ? " < > | 即可（如 题号-标题-时间.zip）
$file_regex = '/^(([0-9a-zA-Z-_. ()]+\\.(in|out))|tpj\\.cc)|([^\\s\\\\/:*?"<>|]+\\.zip)$/i';
?>
{include file="../../admin/view/filemanager/file_page_base" /}