<?php
namespace app\common\funcs;

/** Public documentation of the language handlers, using the active judge config. */
class FaqEnvironment
{
    public static function commands(array $config): array
    {
        $common = $config['common'];
        $c = $config['c'];
        $cpp = $config['cpp'];
        $java = $config['java'];
        $stack = (int)$common['stack_limit_mb'];
        $compileHeap = max((int)$java['xms'], (int)$java['xmx']);
        $native = ['-Wall', '-Wextra', '-DONLINE_JUDGE', '-static',
            '-Wl,--no-relax', '-Wl,--no-pie', '-mcmodel=medium', '-o', 'Main'];
        return [
            'C' => array_merge(['gcc', $c['cc_std'], $c['cc_opt']], $native, ['Main.c']),
            'C++' => array_merge(['g++', $cpp['cpp_std'], $cpp['cpp_opt']], $native, ['Main.cpp']),
            'Java compile' => ['javac', '-J-Xms'.$compileHeap.'M', '-J-Xmx'.(int)$java['xmx'].'M',
                '-J-Xss'.$stack.'M', '-encoding', 'UTF-8', 'Main.java'],
            'Java run' => ['java', '-Dfile.encoding=UTF-8', '-XX:+UseSerialGC', '-Xss'.$stack.'M',
                '-Xms'.(int)$java['xms'].'M', '-Xmx'.(int)$java['xmx'].'M', '-cp', '.', 'Main'],
            'Python compile' => ['python3', '-m', 'py_compile', 'Main.py'],
            'Python run' => ['python3', 'Main.py'],
        ];
    }
}
