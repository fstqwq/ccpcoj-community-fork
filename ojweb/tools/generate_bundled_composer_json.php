<?php
/**
 * 生成 ojweb/composer.json（仅用于生成 autoload 映射，不做依赖下载）
 *
 * 目标：
 * - 仓库内已包含 vendor 目录（离线部署）
 * - 但 vendor/composer/autoload_* 映射不完整，导致 ThinkPHP5.1 无法自动加载第三方库
 * - 通过扫描 vendor/{vendor}/{package}/composer.json 的 autoload 配置，生成根 composer.json 的 autoload
 * - 然后执行：composer dump-autoload -o 生成完整的 vendor/composer/autoload_*.php
 *
 * 使用：
 *   php tools/generate_bundled_composer_json.php
 */

$root = realpath(__DIR__ . '/..'); // ojweb/
if (!$root) {
    fwrite(STDERR, "Cannot resolve ojweb root.\n");
    exit(1);
}

$vendorDir = $root . DIRECTORY_SEPARATOR . 'vendor';
if (!is_dir($vendorDir)) {
    fwrite(STDERR, "vendor directory not found: {$vendorDir}\n");
    exit(1);
}

function normPath($p) {
    return str_replace(['\\', '//'], ['/', '/'], $p);
}

$autoload = [
    'psr-4'    => [
        'app\\' => 'application/',
    ],
    'psr-0'    => [],
    'classmap' => [],
    'files'    => [],
];

// 扫描 vendor/{vendor}/{package}/composer.json
$vendorLv1 = scandir($vendorDir);
foreach ($vendorLv1 as $v1) {
    if ($v1 === '.' || $v1 === '..') continue;
    $v1Path = $vendorDir . DIRECTORY_SEPARATOR . $v1;
    if (!is_dir($v1Path)) continue;

    $pkgs = scandir($v1Path);
    foreach ($pkgs as $pkg) {
        if ($pkg === '.' || $pkg === '..') continue;
        $pkgPath = $v1Path . DIRECTORY_SEPARATOR . $pkg;
        if (!is_dir($pkgPath)) continue;

        $composerJson = $pkgPath . DIRECTORY_SEPARATOR . 'composer.json';
        if (!is_file($composerJson)) continue;

        $json = json_decode(file_get_contents($composerJson), true);
        if (!is_array($json)) continue;

        if (empty($json['autoload']) || !is_array($json['autoload'])) continue;
        $a = $json['autoload'];

        // psr-4
        if (!empty($a['psr-4']) && is_array($a['psr-4'])) {
            foreach ($a['psr-4'] as $ns => $paths) {
                $ns = (string)$ns;
                if ($ns === '' || $ns === 'app\\') continue;
                $paths = (array)$paths;
                $relPaths = [];
                foreach ($paths as $p) {
                    $p = trim((string)$p);
                    if ($p === '') continue;
                    $rel = 'vendor/' . $v1 . '/' . $pkg . '/' . $p;
                    $relPaths[] = rtrim(normPath($rel), '/');
                }
                if (!$relPaths) continue;

                // 合并已有映射（去重）
                if (!isset($autoload['psr-4'][$ns])) {
                    $autoload['psr-4'][$ns] = (count($relPaths) === 1) ? $relPaths[0] : $relPaths;
                } else {
                    $old = (array)$autoload['psr-4'][$ns];
                    $merged = array_values(array_unique(array_merge($old, $relPaths)));
                    $autoload['psr-4'][$ns] = (count($merged) === 1) ? $merged[0] : $merged;
                }
            }
        }

        // psr-0
        if (!empty($a['psr-0']) && is_array($a['psr-0'])) {
            foreach ($a['psr-0'] as $ns => $paths) {
                $ns = (string)$ns;
                if ($ns === '') continue;
                $paths = (array)$paths;
                $relPaths = [];
                foreach ($paths as $p) {
                    $p = trim((string)$p);
                    if ($p === '') continue;
                    $rel = 'vendor/' . $v1 . '/' . $pkg . '/' . $p;
                    $relPaths[] = rtrim(normPath($rel), '/');
                }
                if (!$relPaths) continue;

                if (!isset($autoload['psr-0'][$ns])) {
                    $autoload['psr-0'][$ns] = (count($relPaths) === 1) ? $relPaths[0] : $relPaths;
                } else {
                    $old = (array)$autoload['psr-0'][$ns];
                    $merged = array_values(array_unique(array_merge($old, $relPaths)));
                    $autoload['psr-0'][$ns] = (count($merged) === 1) ? $merged[0] : $merged;
                }
            }
        }

        // classmap
        if (!empty($a['classmap']) && is_array($a['classmap'])) {
            foreach ($a['classmap'] as $p) {
                $p = trim((string)$p);
                if ($p === '') continue;
                $autoload['classmap'][] = rtrim(normPath('vendor/' . $v1 . '/' . $pkg . '/' . $p), '/');
            }
        }

        // files
        if (!empty($a['files']) && is_array($a['files'])) {
            foreach ($a['files'] as $p) {
                $p = trim((string)$p);
                if ($p === '') continue;
                $autoload['files'][] = normPath('vendor/' . $v1 . '/' . $pkg . '/' . $p);
            }
        }
    }
}

// 去重 & 排序（保证稳定输出）
$autoload['classmap'] = array_values(array_unique($autoload['classmap']));
$autoload['files'] = array_values(array_unique($autoload['files']));
ksort($autoload['psr-4']);
ksort($autoload['psr-0']);
sort($autoload['classmap']);
sort($autoload['files']);

// 清理空项
if (empty($autoload['psr-0'])) unset($autoload['psr-0']);
if (empty($autoload['classmap'])) unset($autoload['classmap']);
if (empty($autoload['files'])) unset($autoload['files']);

$composer = [
    'name' => 'topthink/think',
    'description' => 'CSGOJ2 bundled vendor (offline deploy)',
    'type' => 'project',
    'autoload' => $autoload,
    'config' => [
        'optimize-autoloader' => true,
        'sort-packages' => false,
    ],
];

$outFile = $root . DIRECTORY_SEPARATOR . 'composer.json';
$jsonOut = json_encode($composer, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
file_put_contents($outFile, $jsonOut);

echo "Generated composer.json with autoload mappings.\n";
echo "Next: composer dump-autoload -o\n";


