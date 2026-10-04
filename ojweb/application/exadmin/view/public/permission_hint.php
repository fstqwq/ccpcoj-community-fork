{/* 
  可复用：权限说明提示（放在页面大标题右侧）
  - 支持后端直接渲染文案（默认方案）
  - 支持 JS 通过 data-perm-json / data-context 统一调整（扩展方案）

  变量：
  - perm_context: string（可选，用于 JS 区分页面/模块）
  - perm_level: string（可选：success/info/warning/danger/secondary，用于 badge）
  - perm_role_cn / perm_role_en: string（可选，默认空）
  - perm_desc_cn / perm_desc_en: string（可选，默认空，描述“能做什么”）
  - perm_json: string(json)（可选，JS 可读取）
  - perm_hint_id: string（可选）
*/}

<div
    class="csg-perm-hint csg-perm-hint--{$perm_level|default='info'|htmlspecialchars}"
    {if isset($perm_hint_id) && $perm_hint_id !== ''}id="{$perm_hint_id|htmlspecialchars}"{/if}
    data-context="{$perm_context|default=''|htmlspecialchars}"
    {if isset($perm_json) && $perm_json !== ''}data-perm-json="{$perm_json|htmlspecialchars}"{/if}
>
    <div class="csg-perm-hint-title csg-bilingual-stack">
        <span class="cn-text" data-perm="current-cn">
            <span class="csg-perm-k">当前权限：</span><span class="csg-perm-v">{$perm_role_cn|default=''|htmlspecialchars}</span>
        </span>
        <span class="en-text" data-perm="current-en">
            <span class="csg-perm-k">Current:</span> <span class="csg-perm-v">{$perm_role_en|default=''|htmlspecialchars}</span>
        </span>
    </div>
    {if (isset($perm_desc_cn) && $perm_desc_cn !== '') || (isset($perm_desc_en) && $perm_desc_en !== '')}
        <div class="csg-perm-hint-desc csg-bilingual-stack">
            <span class="cn-text" data-perm="desc-cn">{$perm_desc_cn|default=''|htmlspecialchars}</span>
            <span class="en-text" data-perm="desc-en">{$perm_desc_en|default=''|htmlspecialchars}</span>
        </div>
    {/if}
</div>


