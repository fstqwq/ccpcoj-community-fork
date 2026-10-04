// Markdown 帮助弹窗
(function(){
  const helpHtml = `
  <h5 class="mb-3">Markdown 基本语法</h5>
  <ul>
    <li>标题：<code># 一级</code> <code>## 二级</code></li>
    <li>加粗 / 斜体：<code>**粗体**</code> <code>*斜体*</code></li>
    <li>列表：<code>- 无序项</code>；<code>1. 有序项</code></li>
    <li>链接：<code>[文本](https://example.com)</code></li>
  </ul>
  <div class="md-help-warning mt-3 mb-3">
    <i class="bi bi-exclamation-triangle-fill"></i>
    <div>
      <strong>关于插图：</strong>为规范考试，本系统不支持在编辑器中自由传图或插入图片，仅可在系统有要求传图时，在规定的功能区提交。
    </div>
  </div>
  <h5 class="mt-4 mb-2">数学公式</h5>
  <ul>
    <li>行内：<code>$a^2+b^2=c^2$</code></li>
    <li>独立：<code>$$E=mc^2$$</code></li>
    <li>分数：<code>$\\frac{a}{b}$</code></li>
    <li>根号：<code>$\\sqrt{x}$</code></li>
  </ul>
  <h5 class="mt-4 mb-2">代码</h5>
  <ul>
    <li>行内：<code>\`code\`</code></li>
    <li>多行：<code>\`\`\`lang</code> 开头，<code>\`\`\`</code> 结束</li>
  </ul>
  <h5 class="mt-4 mb-2">编辑模式</h5>
  <ul>
    <li><strong>所见即所得（WYSIWYG）</strong>：直接编辑渲染后的效果，适合不熟悉 Markdown 语法的用户</li>
    <li><strong>即时渲染（IR）</strong>：编辑 Markdown 源码，实时预览渲染效果，推荐使用</li>
    <li><strong>分屏预览（SV）</strong>：左侧编辑源码，右侧预览效果，适合长文本编辑</li>
  </ul>
  <div class="md-help-tip mt-3">
    <i class="bi bi-lightbulb"></i>
    <span>提示：可通过编辑器工具栏右上角的模式切换按钮切换编辑模式</span>
  </div>
  `;

  function ensureModal() {
    if (document.getElementById('md_help_modal')) return;
    const tpl = `
    <div class="modal fade" id="md_help_modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Markdown 帮助</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body md-help-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', tpl);
  }

  window.MdHelp = {
    open() {
      ensureModal();
      const modalEl = document.getElementById('md_help_modal');
      const body = modalEl.querySelector('.md-help-body');
      body.innerHTML = helpHtml;
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  };
})();

