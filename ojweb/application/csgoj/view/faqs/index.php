
<?php
$t = function ($cn, $en) use ($faq_english) { return $faq_english ? $en : $cn; };
$esc = function ($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); };
$common = $faq_config['common'];
$java = $faq_config['java'];
$sections = [
    'env' => $t('编译环境', 'Compiler environment'),
    'types' => $t('评测类型', 'Judging modes'),
    'io' => $t('输入输出', 'Input and output'),
    'local' => $t('本地调试', 'Local testing'),
    'status' => $t('评测结果', 'Verdicts'),
];
$examples = [
    'C' => "#include <stdio.h>\nint main(void) {\n    long long a, b;\n    while (scanf(\"%lld%lld\", &a, &b) == 2)\n        printf(\"%lld\\n\", a + b);\n    return 0;\n}",
    'C++' => "#include <iostream>\nint main() {\n    long long a, b;\n    while (std::cin >> a >> b) std::cout << a + b << '\\n';\n}",
    'Python' => "import sys\nvalues = iter(map(int, sys.stdin.buffer.read().split()))\nfor a, b in zip(values, values):\n    print(a + b)",
    'Java' => "import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        while (in.hasNextLong()) {\n            long a = in.nextLong(), b = in.nextLong();\n            System.out.println(a + b);\n        }\n    }\n}",
];
$verdicts = [
    ['PD / PR', '等待评测或重测；无需重复提交。', 'Queued for judging or rejudging; resubmission is unnecessary.'],
    ['CI / RJ', '正在编译或运行测试。', 'Compilation or test execution is in progress.'],
    ['AC', '已通过本题测试和判定程序。', 'All required tests and checker conditions passed.'],
    ['WA / PE', '输出内容或题目要求的格式不符合判定规则。', 'The output or required formatting did not pass the checker.'],
    ['TLE', '运行时间超过允许值。', 'Execution exceeded the permitted time.'],
    ['MLE', '内存用量超过允许值。', 'Memory usage exceeded the permitted limit.'],
    ['OLE', '输出量超过允许值。', 'The output exceeded its size limit.'],
    ['RE', '程序异常退出；检查越界、除零和栈溢出。', 'The program terminated abnormally; check invalid access, division by zero, and stack overflow.'],
    ['CE', '编译失败；查看提交记录中的编译器信息。', 'Compilation failed; inspect the compiler diagnostics on the submission.'],
    ['JF', '评测系统失败；请联系管理员。', 'The judging infrastructure failed; contact an administrator.'],
];
?>
<style>
.community-faq { max-width: 1080px; margin: 0 auto; }
.community-faq header { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
.community-faq nav { display:flex; gap:.6rem; flex-wrap:wrap; margin:1.5rem 0; }
.community-faq section { scroll-margin-top:5rem; margin:1.5rem 0; padding:1.4rem; border:1px solid var(--bs-border-color,#dee2e6); border-radius:.6rem; }
.community-faq pre { overflow:auto; padding:1rem; border-radius:.4rem; background:var(--bs-tertiary-bg,#f4f6f8); color:var(--bs-body-color,#212529); }
.community-faq summary { cursor:pointer; font-weight:600; padding:.6rem 0; }
.community-faq td, .community-faq th { padding:.65rem; vertical-align:top; }
.community-faq h2 { font-size:1.4rem; margin-bottom:1rem; }
</style>
<main class="community-faq">
<header>
    <h1 class="page-title"><?= $t('常见问题', 'Frequently asked questions') ?></h1>
    <div class="btn-group" aria-label="Language">
        <a class="btn btn-outline-primary" href="?lang=cn" lang="zh">中文</a>
        <a class="btn btn-outline-primary" href="?lang=other" lang="en">English</a>
    </div>
</header>
<nav aria-label="FAQ sections">
<?php foreach ($sections as $anchor => $label): ?>
    <a class="btn btn-outline-secondary btn-sm" href="#<?= $esc($anchor) ?>"><?= $esc($label) ?></a>
<?php endforeach; ?>
</nav>
<section id="env">
    <h2><?= $esc($sections['env']) ?></h2>
    <p><?= $t('默认安装环境：', 'Default installation: ') ?><?= $esc($faq_environment['os']) ?> · GCC <?= $esc($faq_environment['gcc']) ?> · Python <?= $esc($faq_environment['python']) ?> · OpenJDK <?= $esc($faq_environment['java']) ?></p>
    <p><?= $t('以下参数取自当前评测配置。C/C++ 编译时定义 ONLINE_JUDGE，使用静态链接。', 'The commands below reflect the active judge configuration. C/C++ builds define ONLINE_JUDGE and use static linking.') ?></p>
<?php foreach ($faq_commands as $language => $argv): ?>
    <h3 class="h6"><?= $esc($language) ?></h3>
    <pre><code><?= $esc(implode(' ', $argv)) ?></code></pre>
<?php endforeach; ?>
    <p><?= $t('Java 运行时 Xms、Xmx 分别取所列配置值与「题目内存限制 + 附加内存」的较大值。附加内存：', 'For Java execution, Xms and Xmx are each raised to at least the problem memory limit plus the memory allowance. Allowance: ') ?><?= (int)$java['memory_bonus'] ?> MB.</p>
    <p><?= $t('程序栈限制：', 'Stack limit: ') ?><?= (int)$common['stack_limit_mb'] ?> MB.
    <?= $t('测试组耗时统计：', 'Time across test cases: ') ?><?= $common['flg_use_max_time'] ? $t('取最大值。', 'maximum.') : $t('累计。', 'sum.') ?></p>
    <div class="table-responsive"><table class="table">
        <thead><tr><th><?= $t('语言', 'Language') ?></th><th><?= $t('运行时限', 'Runtime limit') ?></th><th><?= $t('内存限额', 'Memory limit') ?></th></tr></thead>
        <tbody>
        <tr><td>C / C++</td><td><?= $t('题目时限', 'Problem time limit') ?></td><td><?= $t('题目内存限制', 'Problem memory limit') ?></td></tr>
        <?php foreach (['java' => 'Java', 'python' => 'Python'] as $key => $label): $bonus = $faq_config[$key]; ?>
        <tr><td><?= $label ?></td><td>T × <?= $esc($bonus['time_bonus_multiply']) ?> + <?= (int)$bonus['time_bonus_plus'] ?> ms</td><td>M + <?= (int)$bonus['memory_bonus'] ?> MB</td></tr>
        <?php endforeach; ?>
        </tbody>
    </table></div>
</section>
<section id="types">
    <h2><?= $esc($sections['types']) ?></h2>
    <details open><summary><?= $t('标准评测', 'Standard judging') ?></summary><p><?= $t('输出按 token 比较，忽略 token 之间的空白。内容和数量必须一致；大小写、前导零和小数表示不会自动转换。', 'The default checker compares tokens in order, ignoring separating whitespace. Token contents and counts must match; case, leading zeroes, and numeric formatting remain significant.') ?></p></details>
    <details><summary><?= $t('特殊评测（Special Judge）', 'Special judge') ?></summary><p><?= $t('由题目自带的 checker 判断输出。允许误差或多种答案时，以题面和 checker 为准。', 'A problem-specific checker decides whether the output is acceptable. Any tolerance or alternative-answer rules are defined by the problem.') ?></p></details>
    <details><summary><?= $t('交互评测', 'Interactive judging') ?></summary><p><?= $t('程序与交互器交换输入输出；每次询问后及时刷新输出，并遵守询问次数和结束协议。', 'Your program exchanges messages with an interactor. Flush each query and follow the query limit and termination protocol.') ?></p></details>
</section>
<section id="io">
    <h2><?= $esc($sections['io']) ?></h2>
    <p><?= $t('使用标准输入和标准输出，不输出额外提示。Java 的入口类必须命名为 Main。以下示例读取若干对整数，逐对输出和；实际输入格式以题面为准。', 'Use standard input and output without extra prompts. Java submissions must use the Main entry class. These examples sum pairs of integers until EOF; follow the problem statement for actual input formats.') ?></p>
    <?php foreach ($examples as $language => $source): ?>
    <details><summary><?= $esc($language) ?></summary><pre><code><?= $esc($source) ?></code></pre></details>
    <?php endforeach; ?>
</section>
<section id="local">
    <h2><?= $esc($sections['local']) ?></h2>
    <p><?= $t('可在 Linux 中使用上面的命令编译，再重定向输入运行。使用接近评测机的工具链；本地通过样例不代表通过全部测试。', 'On Linux, build with the commands above and run with redirected input. Use a toolchain close to the judge image; passing samples does not establish correctness on all tests.') ?></p>
    <pre><code>./Main &lt; input.txt &gt; output.txt
python3 Main.py &lt; input.txt &gt; output.txt</code></pre>
</section>
<section id="status">
    <h2><?= $esc($sections['status']) ?></h2>
    <table class="table"><tbody>
    <?php foreach ($verdicts as $verdict): ?>
    <tr><th scope="row"><?= $esc($verdict[0]) ?></th><td><?= $esc($t($verdict[1], $verdict[2])) ?></td></tr>
    <?php endforeach; ?>
    </tbody></table>
</section>
<?php if (isset($news) && trim((string)$news['content']) !== ''): ?>
<section><h2><?= $t('本站补充说明', 'Site-specific notes') ?></h2>{$news['content']}</section>
<?php endif; ?>
</main>
