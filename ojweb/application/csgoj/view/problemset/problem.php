{include file="../../csgoj/view/problemset/problem_header" /}

{if isset($desc_display_mode) && $desc_display_mode == 'pdf' && isset($problem_pdf_embed_url) && $problem_pdf_embed_url != '' }
{include file="../../csgoj/view/public/base_pdf" /}
<div class="problem-pdf-embed-wrap mb-3" data-pdf-url="{$problem_pdf_embed_url|htmlspecialchars}">
    <div class="problem-pdf-inline-host" aria-hidden="true"></div>
    <div class="problem-pdf-fallback d-none" role="region" aria-label="题面 PDF 查看选项 PDF viewing options">
        <p class="problem-pdf-fallback-msg text-muted mb-3 csg-bilingual-stack">
            <span class="cn-text">无法在页面内显示此 PDF，请尝试在新窗口打开或下载后查看。</span>
            <span class="en-text">This PDF cannot be shown on this page. Try opening it in a new window or download it to view.</span>
        </p>
        <div class="problem-pdf-fallback-actions d-flex flex-wrap gap-2 align-items-center">
            <button type="button" class="btn btn-primary btn-sm problem-pdf-open-new csg-bilingual-stack">
                <span class="cn-text">在新窗口打开</span>
                <span class="en-text">Open in new window</span>
            </button>
            <a class="btn btn-outline-secondary btn-sm problem-pdf-download csg-bilingual-stack" href="{$problem_pdf_embed_url|htmlspecialchars}" download>
                <span class="cn-text">下载 PDF</span>
                <span class="en-text">Download PDF</span>
            </a>
        </div>
    </div>
</div>
{/if}

<div>
    <?php
    $skip_desc_blocks = isset($desc_display_mode) && $desc_display_mode === 'pdf';
    $items = [
        'description' => ['article', $problem['description'], '题目描述', 'Description'],
        'input' => ['article', $problem['input'], '输入格式', 'Input'],
        'output' => ['article', $problem['output'], '输出格式', 'Output'],
        'sample_input' => ['pre', $problem['sample_input'], 'Sample Input', 'Sample Input'],
        'sample_output' => ['pre', $problem['sample_output'], 'Sample Output', 'Sample Output'],
        'hint' => ['article', $problem['hint'], '提示', 'Hint'],
    ];
    if($controller == 'problemset') {
        if($problem['source'] == "<p>" . strip_tags($problem['source']) . "</p>") {
            $problem['source'] = strip_tags($problem['source']);
            $problem['source'] = "<a href='/csgoj/problemset#search=" . $problem['source'] . "'>" . $problem['source'] . "</a>";
        }
        if(isset($problem['author']) && $problem['author'] != null && strlen(trim($problem['author'])) > 0) {
            $items['author'] = ['article', $problem['author'], '出题', 'Author'];
        }
        $items['source'] = ['article', $problem['source'], '来源', 'Source'];
    }
    foreach($items as $key => $value)
    {
        if (!empty($skip_desc_blocks) && in_array($key, ['description', 'input', 'output', 'sample_input', 'sample_output', 'hint'], true)) {
            continue;
        }
        $type = $value[0];
        $content = $value[1];
        $title_cn = $value[2];
        $title_en = $value[3];
        ?>
        {if $key=='sample_input'}
        <div name="Sample" class="md_display_div">
            <h2 class="text-info bilingual-inline">样例<span class="en-text">Sample</span></h2>
            <div class="sample_div">
                <textarea id="sample_input_hidden" style="display: none;">{$content|htmlspecialchars}</textarea>
        {elseif $key=='sample_output'}
                <textarea id="sample_output_hidden" style="display: none;">{$content|htmlspecialchars}</textarea>
            </div>
        </div>
        {else /}
        {if !empty($content)}
        <div name="{$key}" class="md_display_div">
            <h2 class="text-info bilingual-inline">{$title_cn}<span class="en-text">{$title_en}</span></h2>
            {$content}
        </div>
        {/if}
        {/if}
        <?php
    }
    ?>
</div>
{include file="../../csgoj/view/problemset/problem_footer" /}

{if $controller == 'problemset' }
<script type="text/javascript">
    $('.disabled_problem_submit_button').on('click', function(){
        alerty.error('请先登录', 'Please login before submit!');
    });
</script>
{/if}

