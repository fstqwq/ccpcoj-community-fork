<?php
require __DIR__.'/../ojweb/application/common/funcs/FaqEnvironment.php';
$defaults = require __DIR__.'/../ojweb/config/JudgeDefaultConfig.php';
$config = $defaults['config'];
$cases = [$config];
$config['c'] = ['cc_std'=>'-std=c11', 'cc_opt'=>'-O0'];
$config['cpp'] = ['cpp_std'=>'-std=c++20', 'cpp_opt'=>'-O3'];
$config['common']['stack_limit_mb'] = 128;
$config['java']['xms'] = 512;
$config['java']['xmx'] = 768;
$config['java']['memory_bonus'] = 32;
$cases[] = $config;
echo json_encode(array_map(function ($case) {
    return ['config'=>$case, 'commands'=>\app\common\funcs\FaqEnvironment::commands($case)];
}, $cases));
