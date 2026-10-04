<?php
/**
 * 压缩/解压相关工具（Zippy）
 *
 * 设计目标：
 * - 统一创建 Zippy 实例，避免到处重复调用 Zippy::load()（会做 adapter/环境探测）
 * - 仅做“单请求”缓存：static 变量在一次 PHP 请求内复用，FPM 下不会跨请求共享
 */

use Alchemy\Zippy\Adapter\AdapterContainer;
use Alchemy\Zippy\Zippy;

/**
 * 获取 Zippy 实例（单请求缓存）
 * @return Zippy
 */
function GetZippy()
{
    static $zippy = null;
    if ($zippy instanceof Zippy) {
        return $zippy;
    }

    // 如果 proc_open 不可用（例如 php.ini disable_functions 禁用），Zippy 的命令行适配器无法工作。
    // 此时仅使用 PHP Zip 扩展（ZipArchive）适配器，避免触发 Symfony Process 依赖。
    if (!function_exists('proc_open')) {
        if (!class_exists('ZipArchive')) {
            throw new \RuntimeException('系统禁用了 proc_open，且未安装 PHP zip 扩展（ZipArchive）。无法进行 zip 压缩/解压。');
        }

        $adapters = AdapterContainer::load();
        $factory = new Zippy($adapters);

        // 只注册 zip 策略，并强制只使用 ZipExtensionAdapter（不探测命令行 zip/unzip）。
        $factory->addStrategy(new class($adapters) extends \Alchemy\Zippy\FileStrategy\ZipFileStrategy {
            protected function getServiceNames()
            {
                return [
                    'Alchemy\\Zippy\\Adapter\\ZipExtensionAdapter',
                ];
            }
        });

        $zippy = $factory;
        return $zippy;
    }

    // 默认路径：启用 Zippy 的所有默认策略（zip/tar 等），由其自行探测最合适适配器
    $zippy = Zippy::load();
    return $zippy;
}


