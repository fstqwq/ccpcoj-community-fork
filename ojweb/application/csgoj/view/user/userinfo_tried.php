<div class="problem-section">
    <div class="section-header">
        <h4 class="section-title">
            已尝试题目<span class="en-text">Problem Tried</span>
        </h4>
        <span class="badge bg-warning"><?php echo count($triedlist); ?></span>
    </div>
    <p class="text-muted small">
        {if $OJ_STATUS == 'exp'}
        (竞赛题目不计入，但练习中的提交计入总数)<span class="en-text">(Contests not included, but practice submissions are counted)</span>
        {else /}
        (竞赛题目不计入)<span class="en-text">(Contests not included)</span>
        {/if}
    </p>
    <div class="problem-grid">
        <?php
        $i = 0;
        foreach($triedlist as $solved)
        {
            echo "<a href='/csgoj/problemset/problem?pid=".$solved['problem_id']."' class='problem-link tried'>".$solved['problem_id']."</a>";
            $i++;
            if($i == $problem_oneline)
            {
                $i = 0;
                echo "<br>";
            }
        }
        ?>
    </div>
</div>