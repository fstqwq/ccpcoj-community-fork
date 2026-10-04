<?php
// +----------------------------------------------------------------------
// | ThinkPHP [ WE CAN DO IT JUST THINK ]
// +----------------------------------------------------------------------
// | Copyright (c) 2006~2018 http://thinkphp.cn All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( http://www.apache.org/licenses/LICENSE-2.0 )
// +----------------------------------------------------------------------
// | Author: liu21st <liu21st@gmail.com>
// +----------------------------------------------------------------------

use think\facade\Route;

Route::get('think', function () {
    return 'hello,ThinkPHP5!';
});

Route::get('hello/:name', 'index/hello');

// ICPC CCS Contest API (2026-01)
// Routes ordered from most-specific to least-specific.
Route::any('api/contests/:cid/submissions/:sub_id/files', 'cpcsys/icpc_api/dispatch')
     ->pattern(['cid' => '[\w\.\-]+', 'sub_id' => '[\w\.\-]+']);
Route::any('api/contests/:cid/:endpoint/:sub_id', 'cpcsys/icpc_api/dispatch')
     ->pattern(['cid' => '[\w\.\-]+', 'endpoint' => '[\w\-]+', 'sub_id' => '[\w\.\-]+']);
Route::any('api/contests/:cid/:endpoint', 'cpcsys/icpc_api/dispatch')
     ->pattern(['cid' => '[\w\.\-]+', 'endpoint' => '[\w\-]+']);
Route::any('api/contests/:cid', 'cpcsys/icpc_api/dispatch')
     ->pattern(['cid' => '[\w\.\-]+']);
Route::any('api/contests', 'cpcsys/icpc_api/dispatch');
Route::any('api', 'cpcsys/icpc_api/dispatch');

return [

];
