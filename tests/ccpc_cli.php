<?php
require __DIR__ . '/../ojweb/application/common/funcs/CcpcRules.php';
use app\common\funcs\CcpcRules;
date_default_timezone_set('UTC');
while (($line = fgets(STDIN)) !== false) {
    $v = json_decode($line, true);
    try {
        if (($v['op'] ?? '') === 'balloons') $out = CcpcRules::balloonAssignments($v['data'], $v['now'], $v['secret'], $v['palette']);
        else $out = CcpcRules::project($v['data'], $v['now'], $v['secret']);
        echo json_encode($out, JSON_THROW_ON_ERROR) . "\n";
    } catch (Throwable $e) { fwrite(STDERR, get_class($e) . ': ' . $e->getMessage() . "\n"); exit(1); }
}
