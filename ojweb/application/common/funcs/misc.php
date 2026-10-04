<?php
/**
 * 杂项工具函数（Markdown / IP / Carousel）
 *
 * 作用：
 * - Markdown/LaTeX 内容转换（Pandoc）
 * - 客户端 IP 解析
 * - 首页 Carousel 配置读取与默认初始化
 *
 * 依赖：
 * - 运行环境：`$_SERVER`
 * - ThinkPHP：`config()`, `db()`
 * - 第三方：`Pandoc` 类（用于 ParseMarkdown）
 *
 * 约束：
 * - 仅允许函数定义；禁止文件顶层执行任何逻辑。
 * - 由 `ojweb/application/common.php` 统一 require_once 引入。
 *
 * 导出函数：
 * - ParseMarkdown
 * - GetRealIp
 * - IsCsgStaticPageNewsId
 * - CsgHomeCarouselShouldShow
 * - SetCarousel
 */

/**
 * 是否为 CsgcpcConst.STATIC_PAGE 配置的固定页 news。
 * 用于「按 news_id 拉取正文」的前台路径（如新闻详情、FAQ）：访客不按 defunct 过滤。
 * 例外：首页轮播区域是否展示由 {@see CsgHomeCarouselShouldShow()} 单独判定（对应后台「显示轮播图」）。
 *
 * @param int|string $news_id
 */
function IsCsgStaticPageNewsId($news_id)
{
    static $idMap = null;
    if ($idMap !== null) {
        return isset($idMap[intval($news_id)]);
    }
    $idMap = [];
    $sp = config('CsgcpcConst.STATIC_PAGE');
    if (is_array($sp)) {
        foreach ($sp as $v) {
            $id = intval($v);
            if ($id > 0) {
                $idMap[$id] = true;
            }
        }
    }
    return isset($idMap[intval($news_id)]);
}

/**
 * 首页是否展示轮播区：由 STATIC_PAGE.carousel 对应 news 行的 defunct 控制（'0' 显示，'1' 隐藏）。
 *
 * @param array $carouselNewsRow SetCarousel() 返回的 news 行
 */
function CsgHomeCarouselShouldShow(array $carouselNewsRow)
{
    return isset($carouselNewsRow['defunct']) && $carouselNewsRow['defunct'] === '0';
}

function ParseMarkdown($str, $highlight=false, $toc=0, $title=null)
{
    $retHtml = '';

    // 如果输入为空，直接返回空字符串
    if (empty($str) || trim($str) === '') {
        return '';
    }

    try {
        $Pandoc = new Pandoc();
        $text_type = "markdown";
        // 基于首行 "__LATEX__" 作为 LaTex 标识
        $firstLine = strtok(ltrim($str), "\n");
        if ($firstLine !== false && trim($firstLine) === '__LATEX__') {
            $text_type = "latex";
            $str = substr($str, strlen($firstLine) + 1); // Remove the first line
        }
        // 使用 katex 作为数学引擎（明确指定）
        $retHtml = $Pandoc->convert($str, $text_type, "html", $highlight, $toc, $title, 'katex');

        // 检查返回结果是否为空或与输入相同（可能转换失败）
        if (empty($retHtml) || trim($retHtml) === '') {
            error_log("ParseMarkdown: Pandoc returned empty output for input: " . substr($str, 0, 100));
            // 如果输出为空，返回转义的原始字符串
            $retHtml = htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
        }
    } catch (\Exception $e) {
        // 记录错误日志（包含更详细的错误信息）
        $errorMsg = $e->getMessage();
        error_log("ParseMarkdown error: " . $errorMsg);
        // 如果 Pandoc 转换失败，返回转义的原始字符串（不再使用 Parsedown）
        $retHtml = htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
    } catch (\Throwable $e) {
        // 捕获所有错误（包括 PHP 7+ 的 Error）
        $errorMsg = $e->getMessage();
        error_log("ParseMarkdown fatal error: " . $errorMsg);
        $retHtml = htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
    }
    return $retHtml;
}

//获取客户端真实IP
function GetRealIp()
{
    $unknown = 'unknown';
    if ( isset($_SERVER['HTTP_X_FORWARDED_FOR']) && $_SERVER['HTTP_X_FORWARDED_FOR'] && strcasecmp($_SERVER['HTTP_X_FORWARDED_FOR'], $unknown) ) {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
    } elseif ( isset($_SERVER['REMOTE_ADDR']) && $_SERVER['REMOTE_ADDR'] && strcasecmp($_SERVER['REMOTE_ADDR'], $unknown) ) {
        $ip = $_SERVER['REMOTE_ADDR'];
    }
    /*
    处理多层代理的情况
    或者使用正则方式：$ip = preg_match("/[\d\.]{7,15}/", $ip, $matches) ? $matches[0] : $unknown;
    */
    if (false !== strpos($ip, ','))
    {
        $ip_explode = explode(',', $ip);
        $ip = reset($ip_explode);
    }
    return $ip;
}

//Carousel设置
function SetCarousel()
{
    //首页滚动大图设置
    //结构为：
    //        [
    //            'href'=> [三个跳转链接],
    //            'src' => [三个图片链接]
    //        ]
    $carouselConfig = config('CsgcpcConst.CAROUSEL');
    $staticPage = config('CsgcpcConst.STATIC_PAGE');
    $news = db('news')->where('news_id', $staticPage['carousel'])->find();
    if(!$news)
    {
        $news = [
            'news_id'    => $staticPage['carousel'],
            'title'        => 'Carousel',
            'content'    => '',
            'time'        => date('Y-m-d H:i:s'),
            'defunct'    => '1',
        ];
        db('news')->insert($news);
    }
    $carousel = json_decode($news['content'], true);
    $resetCarousel = false;
    if(!is_array($carousel))
        $resetCarousel = true;
    if(!$resetCarousel)
    {
        foreach($carouselConfig['carouselItem'] as $item)
        {
            if (!array_key_exists($item, $carousel))
            {
                $resetCarousel = true;
                break;
            }
            else
            {
                for($i = 0; $i < 3; $i ++)
                {
                    if(!array_key_exists($i, $carousel[$item]))
                        $resetCarousel = true;
                }
                if($resetCarousel)
                    break;
            }
        }
    }
    if($resetCarousel)
        $carousel = [
            'href' => ['', '', ''],
            'src' => $carouselConfig['srcDefault'],
            'header' => ['', '', ''],
            'content' => ['', '', '']
        ];
    for($i = 0; $i < 3; $i ++)
    {
        if(trim($carousel['src'][$i]) == '')
            $carousel['src'][$i] = $carouselConfig['srcDefault'][$i];
    }
    return ['news'=>$news, 'carousel'=>$carousel];
}


