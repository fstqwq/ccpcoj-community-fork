<head lang="en">
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <meta name="renderer" content="webkit" />
    <link rel="icon" href="__IMG__/global/favicon.ico" />
    <title><?php
        $__csg_doc_title = 'Online Judge';
        if (isset($pagetitle) && $pagetitle !== '') {
            $__csg_doc_title = (string)$pagetitle;
            if (isset($pagetitle_en) && $pagetitle_en !== '') {
                $__csg_doc_title .= ' · ' . (string)$pagetitle_en;
            }
        }
        echo htmlspecialchars($__csg_doc_title, ENT_QUOTES, 'UTF-8');
    ?></title>
    {include file="../../csgoj/view/public/global_css" /}
    {include file="../../csgoj/view/public/global_js" /}
</head>