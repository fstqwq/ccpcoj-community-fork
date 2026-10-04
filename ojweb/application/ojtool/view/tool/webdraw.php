{__NOLAYOUT__}
<!DOCTYPE html>
<html>
<head lang="en">
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="__IMG__/global/favicon.ico" />
    <title>Web Draw 绘图工具 / Web Draw Tool</title>
    {include file="../../examsys/view/public/global_css" /}
    {include file="../../examsys/view/public/global_js" /}
    {css href="__STATIC__/ojtool/webdraw/webdraw.css" /}
</head>
<body>
<div class="container-fluid p-3">
<div class="d-flex align-items-center gap-3 mb-3">
    <h1 class="page-title bilingual-inline mb-0">Web Draw 绘图工具<span class="en-text">Web Draw Tool</span></h1>
    
    <!-- 数据提示 -->
    <div class="alert alert-warning alert-dismissible fade show mb-0 flex-grow-1" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        <strong><span class="cn-text">重要提示</span><span class="en-text">Important Notice</span></strong>
        <span class="cn-text">所有数据仅存储在浏览器本地，不会上传到服务器。如需备份，请点击"保存"按钮导出，避免数据丢失。</span>
        <span class="en-text">All data is stored locally in your browser only, not uploaded to the server. Please regularly use the "Save" button to export JSON files for backup to avoid data loss.</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
</div>

<div class="webdraw-container">
    <!-- 工具栏 -->
    <div class="webdraw-toolbar">
        <div class="btn-group" role="group">
            <button type="button" class="btn btn-outline-secondary active" data-shape="select" title="选择/管理 Select/Manage">
                <i class="bi bi-cursor"></i> <span class="cn-text">选择</span><span class="en-text">Select</span>
            </button>
        </div>
        <div class="btn-group ms-2" role="group">
            <button type="button" class="btn btn-outline-primary" data-shape="rect" title="矩形 Rectangle">
                <i class="bi bi-square"></i> <span class="cn-text">矩形</span><span class="en-text">Rect</span>
            </button>
            <button type="button" class="btn btn-outline-primary" data-shape="square" title="正方形 Square">
                <i class="bi bi-square-fill"></i> <span class="cn-text">正方形</span><span class="en-text">Square</span>
            </button>
            <button type="button" class="btn btn-outline-primary" data-shape="circle" title="正圆 Circle">
                <i class="bi bi-circle"></i> <span class="cn-text">正圆</span><span class="en-text">Circle</span>
            </button>
            <button type="button" class="btn btn-outline-primary" data-shape="ellipse" title="椭圆 Ellipse">
                <i class="bi bi-circle-fill"></i> <span class="cn-text">椭圆</span><span class="en-text">Ellipse</span>
            </button>
            <button type="button" class="btn btn-outline-primary" data-shape="diamond" title="菱形 Diamond">
                <i class="bi bi-diamond"></i> <span class="cn-text">菱形</span><span class="en-text">Diamond</span>
            </button>
            <button type="button" class="btn btn-outline-success" data-shape="line" title="连接线 Connector">
                <i class="bi bi-arrow-left-right"></i> <span class="cn-text">连接线</span><span class="en-text">Line</span>
            </button>
            <button type="button" class="btn btn-outline-info" data-shape="freetext" title="自由文字 Free Text">
                <i class="bi bi-type"></i> <span class="cn-text">自由文字</span><span class="en-text">Text</span>
            </button>
        </div>
        
        <div class="btn-group ms-2" role="group">
            <button type="button" class="btn btn-outline-info dropdown-toggle" data-bs-toggle="dropdown" id="btn-freedraw" title="自由绘制 Free Draw">
                <i class="bi bi-pencil"></i> <span class="cn-text">自由绘制</span><span class="en-text">Free Draw</span>
            </button>
            <ul class="dropdown-menu" id="freedraw-brush-menu">
                <li><h6 class="dropdown-header"><span class="cn-text">笔刷粗细</span><span class="en-text">Brush Size</span></h6></li>
                <li><a class="dropdown-item" href="#" data-brush="2"><span class="cn-text">细</span><span class="en-text">Thin</span> (2px)</a></li>
                <li><a class="dropdown-item" href="#" data-brush="4"><span class="cn-text">中</span><span class="en-text">Medium</span> (4px)</a></li>
                <li><a class="dropdown-item" href="#" data-brush="6"><span class="cn-text">粗</span><span class="en-text">Thick</span> (6px)</a></li>
            </ul>
        </div>
        
        <div class="btn-group ms-2" role="group" id="line-arrow-settings" style="display: none;">
            <button type="button" class="btn btn-outline-secondary" id="btn-line-start-arrow" title="起点箭头 Start Arrow">
                <i class="bi bi-arrow-left"></i> <span class="cn-text">起点</span><span class="en-text">Start</span>
            </button>
            <button type="button" class="btn btn-outline-secondary active" id="btn-line-end-arrow" title="终点箭头 End Arrow">
                <i class="bi bi-arrow-right"></i> <span class="cn-text">终点</span><span class="en-text">End</span>
            </button>
        </div>
        
        <div class="btn-group ms-2" role="group">
            <button type="button" class="btn btn-outline-secondary" id="btn-zoom-in" title="放大 Zoom In">
                <i class="bi bi-zoom-in"></i> <span class="cn-text">放大</span><span class="en-text">Zoom In</span>
            </button>
            <button type="button" class="btn btn-outline-secondary" id="btn-zoom-out" title="缩小 Zoom Out">
                <i class="bi bi-zoom-out"></i> <span class="cn-text">缩小</span><span class="en-text">Zoom Out</span>
            </button>
            <button type="button" class="btn btn-outline-secondary" id="btn-zoom-reset" title="重置缩放 Reset Zoom">
                <i class="bi bi-zoom-reset"></i> <span class="cn-text">重置</span><span class="en-text">Reset</span>
            </button>
        </div>
        
        <div class="btn-group ms-2" role="group">
            <button type="button" class="btn btn-outline-secondary" id="btn-copy" title="复制形状 Copy Shape">
                <i class="bi bi-files"></i> <span class="cn-text">复制</span><span class="en-text">Copy</span>
            </button>
            <button type="button" class="btn btn-outline-danger" id="btn-delete" title="删除选中 Delete Selected">
                <i class="bi bi-trash-fill"></i> <span class="cn-text">删除</span><span class="en-text">Delete</span>
            </button>
            <button type="button" class="btn btn-outline-danger" id="btn-clear" title="清空 Clear">
                <i class="bi bi-trash"></i> <span class="cn-text">清空</span><span class="en-text">Clear</span>
            </button>
            <button type="button" class="btn btn-outline-secondary" id="btn-undo" title="撤销 Undo">
                <i class="bi bi-arrow-counterclockwise"></i> <span class="cn-text">撤销</span><span class="en-text">Undo</span>
            </button>
            <button type="button" class="btn btn-outline-secondary" id="btn-redo" title="重做 Redo">
                <i class="bi bi-arrow-clockwise"></i> <span class="cn-text">重做</span><span class="en-text">Redo</span>
            </button>
        </div>
        
        <div class="btn-group ms-2" role="group">
            <button type="button" class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" title="对齐 Align">
                <i class="bi bi-align-center"></i> <span class="cn-text">对齐</span><span class="en-text">Align</span>
            </button>
            <ul class="dropdown-menu">
                <li><h6 class="dropdown-header"><span class="cn-text">水平对齐</span><span class="en-text">Horizontal</span></h6></li>
                <li><a class="dropdown-item" href="#" data-align="left"><i class="bi bi-align-start"></i> <span class="cn-text">左对齐</span><span class="en-text">Left</span></a></li>
                <li><a class="dropdown-item" href="#" data-align="center"><i class="bi bi-align-center"></i> <span class="cn-text">居中</span><span class="en-text">Center</span></a></li>
                <li><a class="dropdown-item" href="#" data-align="right"><i class="bi bi-align-end"></i> <span class="cn-text">右对齐</span><span class="en-text">Right</span></a></li>
                <li><hr class="dropdown-divider"></li>
                <li><h6 class="dropdown-header"><span class="cn-text">垂直对齐</span><span class="en-text">Vertical</span></h6></li>
                <li><a class="dropdown-item" href="#" data-align="top"><i class="bi bi-align-top"></i> <span class="cn-text">顶部对齐</span><span class="en-text">Top</span></a></li>
                <li><a class="dropdown-item" href="#" data-align="middle"><i class="bi bi-align-middle"></i> <span class="cn-text">垂直居中</span><span class="en-text">Middle</span></a></li>
                <li><a class="dropdown-item" href="#" data-align="bottom"><i class="bi bi-align-bottom"></i> <span class="cn-text">底部对齐</span><span class="en-text">Bottom</span></a></li>
            </ul>
        </div>
        
        <div class="btn-group ms-2" role="group">
            <button type="button" class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" title="分布 Distribute">
                <i class="bi bi-distribute-horizontal"></i> <span class="cn-text">分布</span><span class="en-text">Distribute</span>
            </button>
            <ul class="dropdown-menu">
                <li><a class="dropdown-item" href="#" data-distribute="horizontal"><i class="bi bi-distribute-horizontal"></i> <span class="cn-text">横向分布</span><span class="en-text">Horizontal</span></a></li>
                <li><a class="dropdown-item" href="#" data-distribute="vertical"><i class="bi bi-distribute-vertical"></i> <span class="cn-text">纵向分布</span><span class="en-text">Vertical</span></a></li>
            </ul>
        </div>
        
        <div class="btn-group ms-2" role="group">
            <button type="button" class="btn btn-info dropdown-toggle" data-bs-toggle="dropdown" title="导出 Export">
                <i class="bi bi-download"></i> <span class="cn-text">导出</span><span class="en-text">Export</span>
            </button>
            <ul class="dropdown-menu">
                <li><a class="dropdown-item" href="#" data-export="svg">SVG</a></li>
                <li><a class="dropdown-item" href="#" data-export="png">PNG</a></li>
                <li><a class="dropdown-item" href="#" data-export="jpg">JPG (默认)</a></li>
            </ul>
        </div>
        
        <div class="btn-group ms-2" role="group">
            <div class="input-group" style="width: 200px;">
                <select class="form-select form-select-sm" id="record-select" title="选择图形记录 Select Record">
                    <option value="">加载中...</option>
                </select>
                <button type="button" class="btn btn-outline-primary btn-sm" id="btn-new-record" title="新建图形记录 New Drawing Record">
                    <i class="bi bi-plus-lg"></i>
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" id="btn-rename-record" title="重命名当前图形记录 Rename Current Record">
                    <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm" id="btn-delete-record" title="删除当前图形记录 Delete Current Record">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
        
        <div class="btn-group ms-2" role="group">
            <button type="button" class="btn btn-outline-warning" id="btn-save" title="保存 Save">
                <i class="bi bi-save"></i> <span class="cn-text">保存</span><span class="en-text">Save</span>
            </button>
            <button type="button" class="btn btn-outline-warning" id="btn-load" title="加载 Load">
                <i class="bi bi-folder-open"></i> <span class="cn-text">加载</span><span class="en-text">Load</span>
            </button>
            <button type="button" class="btn btn-outline-info" id="btn-help" title="帮助 Help" data-bs-toggle="modal" data-bs-target="#helpModal">
                <i class="bi bi-question-circle"></i> <span class="cn-text">帮助</span><span class="en-text">Help</span>
            </button>
        </div>
    </div>
    
    <!-- 画布容器 -->
    <div class="webdraw-canvas-container" id="canvas-container">
        <svg id="webdraw-svg" class="webdraw-svg"></svg>
    </div>
</div>

{js href="__STATIC__/ojtool/webdraw/utils/constants.js" /}
{js href="__STATIC__/ojtool/webdraw/shapes/Shape.js" /}
{js href="__STATIC__/ojtool/webdraw/shapes/RectShape.js" /}
{js href="__STATIC__/ojtool/webdraw/shapes/SquareShape.js" /}
{js href="__STATIC__/ojtool/webdraw/shapes/CircleShape.js" /}
{js href="__STATIC__/ojtool/webdraw/shapes/EllipseShape.js" /}
{js href="__STATIC__/ojtool/webdraw/shapes/DiamondShape.js" /}
{js href="__STATIC__/ojtool/webdraw/shapes/FreeDrawPath.js" /}
{js href="__STATIC__/ojtool/webdraw/shapes/FreeText.js" /}
{js href="__STATIC__/ojtool/webdraw/shapes/index.js" /}
{js href="__STATIC__/ojtool/webdraw/connectors/Connector.js" /}
{js href="__STATIC__/ojtool/webdraw/utils/export.js" /}
{js href="__STATIC__/ojtool/webdraw/utils/storage.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/utils.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/finders.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/selection.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/alignment.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/clipboard.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/connectorManagement.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/drawing.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/canvas.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/history.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/selectionBox.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/textEdit.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/connectorEndpoints.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/recordManagement.js" /}
{js href="__STATIC__/ojtool/webdraw/funcs/importExport.js" /}
{js href="__STATIC__/ojtool/webdraw/WebDrawApp.js" /}
{js href="__STATIC__/ojtool/webdraw/webdraw.js" /}

<!-- 帮助 Modal -->
<div class="modal fade" id="helpModal" tabindex="-1" aria-labelledby="helpModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="helpModalLabel">
                    <i class="bi bi-question-circle-fill me-2"></i>
                    <span class="cn-text">使用帮助</span><span class="en-text">User Guide</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="help-content">
                    <!-- 基本操作 -->
                    <section class="mb-4">
                        <h6 class="fw-bold mb-3">
                            <i class="bi bi-cursor me-2"></i>
                            <span class="cn-text">基本操作</span><span class="en-text">Basic Operations</span>
                        </h6>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" disabled>
                                        <i class="bi bi-cursor"></i> <span class="cn-text">选择</span><span class="en-text">Select</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">选择模式</strong><strong class="en-text">Select Mode</strong>
                                        <p class="mb-0 small text-muted cn-text">点击选择图形，Ctrl+点击多选，拖拽圈选多个图形</p>
                                        <p class="mb-0 small text-muted en-text">Click to select, Ctrl+click for multi-select, drag to select multiple shapes</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-primary btn-sm me-2" disabled>
                                        <i class="bi bi-square"></i> <span class="cn-text">矩形</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">绘制图形</strong><strong class="en-text">Draw Shapes</strong>
                                        <p class="mb-0 small text-muted cn-text">点击图形按钮，在画布上拖拽绘制</p>
                                        <p class="mb-0 small text-muted en-text">Click shape button, drag on canvas to draw</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-success btn-sm me-2" disabled>
                                        <i class="bi bi-arrow-left-right"></i> <span class="cn-text">连接线</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">绘制连接线</strong><strong class="en-text">Draw Connector</strong>
                                        <p class="mb-0 small text-muted cn-text">点击连接线按钮，从起点拖拽到终点</p>
                                        <p class="mb-0 small text-muted en-text">Click connector button, drag from start to end</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <span class="badge bg-secondary me-2">双击</span>
                                    <div>
                                        <strong class="cn-text">编辑文本</strong><strong class="en-text">Edit Text</strong>
                                        <p class="mb-0 small text-muted cn-text">双击图形，直接在图形内输入文字</p>
                                        <p class="mb-0 small text-muted en-text">Double-click shape to edit text directly inside</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-info btn-sm me-2" disabled>
                                        <i class="bi bi-pencil"></i> <span class="cn-text">自由绘制</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">自由绘制</strong><strong class="en-text">Free Draw</strong>
                                        <p class="mb-0 small text-muted cn-text">点击自由绘制按钮，选择笔刷粗细，在画布上自由绘制曲线</p>
                                        <p class="mb-0 small text-muted en-text">Click free draw button, select brush size, draw curves freely on canvas</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-info btn-sm me-2" disabled>
                                        <i class="bi bi-type"></i> <span class="cn-text">自由文字</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">自由文字</strong><strong class="en-text">Free Text</strong>
                                        <p class="mb-0 small text-muted cn-text">点击自由文字按钮，在画布上点击位置插入无边框文本框</p>
                                        <p class="mb-0 small text-muted en-text">Click free text button, click on canvas to insert borderless text box</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- 工具栏按钮 -->
                    <section class="mb-4">
                        <h6 class="fw-bold mb-3">
                            <i class="bi bi-tools me-2"></i>
                            <span class="cn-text">工具栏按钮</span><span class="en-text">Toolbar Buttons</span>
                        </h6>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" disabled>
                                        <i class="bi bi-files"></i> <span class="cn-text">复制</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">复制</strong><strong class="en-text">Copy</strong>
                                        <p class="mb-0 small text-muted cn-text">复制选中的图形（Ctrl+C）</p>
                                        <p class="mb-0 small text-muted en-text">Copy selected shapes (Ctrl+C)</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-danger btn-sm me-2" disabled>
                                        <i class="bi bi-trash-fill"></i> <span class="cn-text">删除</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">删除</strong><strong class="en-text">Delete</strong>
                                        <p class="mb-0 small text-muted cn-text">删除选中的图形（Delete/Backspace）</p>
                                        <p class="mb-0 small text-muted en-text">Delete selected shapes (Delete/Backspace)</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" disabled>
                                        <i class="bi bi-trash"></i> <span class="cn-text">清空</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">清空画布</strong><strong class="en-text">Clear Canvas</strong>
                                        <p class="mb-0 small text-muted cn-text">清空所有图形和连接线</p>
                                        <p class="mb-0 small text-muted en-text">Clear all shapes and connectors</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" disabled>
                                        <i class="bi bi-arrow-counterclockwise"></i> <span class="cn-text">撤销</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">撤销</strong><strong class="en-text">Undo</strong>
                                        <p class="mb-0 small text-muted cn-text">撤销上一步操作（Ctrl+Z）</p>
                                        <p class="mb-0 small text-muted en-text">Undo last operation (Ctrl+Z)</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" disabled>
                                        <i class="bi bi-arrow-clockwise"></i> <span class="cn-text">重做</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">重做</strong><strong class="en-text">Redo</strong>
                                        <p class="mb-0 small text-muted cn-text">重做操作（Ctrl+Y 或 Ctrl+Shift+Z）</p>
                                        <p class="mb-0 small text-muted en-text">Redo operation (Ctrl+Y or Ctrl+Shift+Z)</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" disabled>
                                        <i class="bi bi-align-center"></i> <span class="cn-text">对齐</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">对齐</strong><strong class="en-text">Align</strong>
                                        <p class="mb-0 small text-muted cn-text">对齐多个选中的图形（左/中/右/上/中/下）</p>
                                        <p class="mb-0 small text-muted en-text">Align multiple selected shapes (left/center/right/top/middle/bottom)</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" disabled>
                                        <i class="bi bi-distribute-horizontal"></i> <span class="cn-text">分布</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">分布</strong><strong class="en-text">Distribute</strong>
                                        <p class="mb-0 small text-muted cn-text">均匀分布多个选中的图形（横向/纵向）</p>
                                        <p class="mb-0 small text-muted en-text">Evenly distribute multiple selected shapes (horizontal/vertical)</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-info btn-sm me-2" disabled>
                                        <i class="bi bi-download"></i> <span class="cn-text">导出</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">导出</strong><strong class="en-text">Export</strong>
                                        <p class="mb-0 small text-muted cn-text">导出为 SVG、PNG 或 JPG 格式</p>
                                        <p class="mb-0 small text-muted en-text">Export as SVG, PNG or JPG format</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-warning btn-sm me-2" disabled>
                                        <i class="bi bi-save"></i> <span class="cn-text">保存</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">保存</strong><strong class="en-text">Save</strong>
                                        <p class="mb-0 small text-muted cn-text">下载当前图形为 JSON 文件</p>
                                        <p class="mb-0 small text-muted en-text">Download current drawing as JSON file</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- 快捷键 -->
                    <section class="mb-4">
                        <h6 class="fw-bold mb-3">
                            <i class="bi bi-keyboard me-2"></i>
                            <span class="cn-text">键盘快捷键</span><span class="en-text">Keyboard Shortcuts</span>
                        </h6>
                        <div class="table-responsive">
                            <table class="table table-sm table-bordered">
                                <thead>
                                    <tr>
                                        <th><span class="cn-text">快捷键</span><span class="en-text">Shortcut</span></th>
                                        <th><span class="cn-text">功能</span><span class="en-text">Function</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><kbd>Ctrl</kbd> + <kbd>Z</kbd></td>
                                        <td><span class="cn-text">撤销</span><span class="en-text">Undo</span></td>
                                    </tr>
                                    <tr>
                                        <td><kbd>Ctrl</kbd> + <kbd>Y</kbd></td>
                                        <td><span class="cn-text">重做</span><span class="en-text">Redo</span></td>
                                    </tr>
                                    <tr>
                                        <td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></td>
                                        <td><span class="cn-text">重做</span><span class="en-text">Redo</span></td>
                                    </tr>
                                    <tr>
                                        <td><kbd>Ctrl</kbd> + <kbd>C</kbd></td>
                                        <td><span class="cn-text">复制选中图形</span><span class="en-text">Copy selected shapes</span></td>
                                    </tr>
                                    <tr>
                                        <td><kbd>Ctrl</kbd> + <kbd>V</kbd></td>
                                        <td><span class="cn-text">粘贴图形</span><span class="en-text">Paste shapes</span></td>
                                    </tr>
                                    <tr>
                                        <td><kbd>Delete</kbd> / <kbd>Backspace</kbd></td>
                                        <td><span class="cn-text">删除选中图形（包括连接的箭头）</span><span class="en-text">Delete selected shapes (including connected connectors)</span></td>
                                    </tr>
                                    <tr>
                                        <td><kbd>Enter</kbd></td>
                                        <td><span class="cn-text">完成文本编辑</span><span class="en-text">Finish text editing</span></td>
                                    </tr>
                                    <tr>
                                        <td><kbd>Esc</kbd></td>
                                        <td><span class="cn-text">取消文本编辑</span><span class="en-text">Cancel text editing</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <!-- 图形记录管理 -->
                    <section class="mb-4">
                        <h6 class="fw-bold mb-3">
                            <i class="bi bi-folder me-2"></i>
                            <span class="cn-text">图形记录管理</span><span class="en-text">Record Management</span>
                        </h6>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <select class="form-select form-select-sm me-2" style="width: 150px;" disabled>
                                        <option>图形列表</option>
                                    </select>
                                    <div>
                                        <strong class="cn-text">选择图形</strong><strong class="en-text">Select Record</strong>
                                        <p class="mb-0 small text-muted cn-text">在下拉列表中选择要编辑的图形</p>
                                        <p class="mb-0 small text-muted en-text">Select a record from dropdown to edit</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-primary btn-sm me-2" disabled>
                                        <i class="bi bi-plus-lg"></i>
                                    </button>
                                    <div>
                                        <strong class="cn-text">新建图形</strong><strong class="en-text">New Record</strong>
                                        <p class="mb-0 small text-muted cn-text">创建新的图形记录</p>
                                        <p class="mb-0 small text-muted en-text">Create a new drawing record</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" disabled>
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <div>
                                        <strong class="cn-text">重命名</strong><strong class="en-text">Rename</strong>
                                        <p class="mb-0 small text-muted cn-text">重命名当前图形</p>
                                        <p class="mb-0 small text-muted en-text">Rename current record</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-danger btn-sm me-2" disabled>
                                        <i class="bi bi-trash"></i>
                                    </button>
                                    <div>
                                        <strong class="cn-text">删除</strong><strong class="en-text">Delete</strong>
                                        <p class="mb-0 small text-muted cn-text">删除当前图形（至少保留一个）</p>
                                        <p class="mb-0 small text-muted en-text">Delete current record (at least one must remain)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- 连接线箭头设置 -->
                    <section class="mb-4">
                        <h6 class="fw-bold mb-3">
                            <i class="bi bi-arrow-left-right me-2"></i>
                            <span class="cn-text">连接线箭头设置</span><span class="en-text">Connector Arrow Settings</span>
                        </h6>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" disabled>
                                        <i class="bi bi-arrow-left"></i> <span class="cn-text">起点</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">起点箭头</strong><strong class="en-text">Start Arrow</strong>
                                        <p class="mb-0 small text-muted cn-text">点击切换起点箭头显示/隐藏</p>
                                        <p class="mb-0 small text-muted en-text">Click to toggle start arrow on/off</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="d-flex align-items-start">
                                    <button type="button" class="btn btn-outline-secondary btn-sm active me-2" disabled>
                                        <i class="bi bi-arrow-right"></i> <span class="cn-text">终点</span>
                                    </button>
                                    <div>
                                        <strong class="cn-text">终点箭头</strong><strong class="en-text">End Arrow</strong>
                                        <p class="mb-0 small text-muted cn-text">点击切换终点箭头显示/隐藏（默认开启）</p>
                                        <p class="mb-0 small text-muted en-text">Click to toggle end arrow on/off (default on)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- 操作技巧 -->
                    <section class="mb-4">
                        <h6 class="fw-bold mb-3">
                            <i class="bi bi-lightbulb me-2"></i>
                            <span class="cn-text">操作技巧</span><span class="en-text">Tips & Tricks</span>
                        </h6>
                        <ul class="small">
                            <li class="cn-text"><strong>调整大小：</strong>选中图形后，拖拽边缘可以改变图形大小（圆形、矩形等所有图形都支持）。矩形、椭圆、菱形支持 Visio 风格：从边拖动只调整该边方向，从顶点拖动自由调整，从顶点拖动+<kbd>Shift</kbd>等比缩放</li>
                            <li class="en-text"><strong>Resize:</strong> After selecting a shape, drag the edge to resize (all shapes including circles and rectangles support this). Rectangles, ellipses, and diamonds support Visio-style: drag from edge to resize in one direction, drag from vertex for free resize, drag from vertex+<kbd>Shift</kbd> for proportional scaling</li>
                            <li class="cn-text"><strong>移动图形：</strong>选中图形后，可以直接拖拽移动图形位置</li>
                            <li class="en-text"><strong>Move Shape:</strong> After selecting a shape, drag to move it</li>
                            <li class="cn-text"><strong>多选操作：</strong>使用 Ctrl+点击可以多选图形，然后进行对齐或分布操作</li>
                            <li class="en-text"><strong>Multi-select:</strong> Use Ctrl+click to multi-select shapes, then align or distribute them</li>
                            <li class="cn-text"><strong>圈选功能：</strong>在空白区域拖拽可以圈选多个图形</li>
                            <li class="en-text"><strong>Box Select:</strong> Drag in blank area to select multiple shapes with selection box</li>
                            <li class="cn-text"><strong>删除图形：</strong>选中图形后，按 <kbd>Delete</kbd> 或 <kbd>Backspace</kbd> 键可以删除图形，连接到该图形的箭头也会一并删除</li>
                            <li class="en-text"><strong>Delete Shape:</strong> After selecting a shape, press <kbd>Delete</kbd> or <kbd>Backspace</kbd> to delete it, connected connectors will also be deleted</li>
                            <li class="cn-text"><strong>连续绘制：</strong>绘制图形后保持当前绘制模式，可以连续绘制相同类型的图形</li>
                            <li class="en-text"><strong>Continuous Draw:</strong> After drawing, the current draw mode is maintained, allowing continuous drawing of the same type</li>
                            <li class="cn-text"><strong>自由绘制：</strong>点击自由绘制按钮后，在画布上点击并拖拽即可绘制曲线，支持三种笔刷粗细</li>
                            <li class="en-text"><strong>Free Draw:</strong> After clicking free draw button, click and drag on canvas to draw curves, supports three brush sizes</li>
                            <li class="cn-text"><strong>自由文字：</strong>点击自由文字按钮后，在画布上点击位置即可插入文本框，点击已存在的自由文字可立即编辑</li>
                            <li class="en-text"><strong>Free Text:</strong> After clicking free text button, click on canvas to insert text box, click existing free text to edit immediately</li>
                            <li class="cn-text"><strong>连接线端点：</strong>选中连接线后，拖拽起点或终点的蓝色圆点可以调整连接位置，支持吸附到其他图形的关键点。选中连接线时，起点/终点箭头按钮会高亮显示</li>
                            <li class="en-text"><strong>Connector Endpoints:</strong> After selecting a connector, drag the blue dots at start or end to adjust position, with snapping to shape connection points. When a connector is selected, the start/end arrow buttons are highlighted</li>
                            <li class="cn-text"><strong>自由连接线：</strong>连接线可以不吸附任何图形，在画布上自由绘制</li>
                            <li class="en-text"><strong>Free Connector:</strong> Connectors can be drawn freely on canvas without snapping to any shapes</li>
                            <li class="cn-text"><strong>自动保存：</strong>所有操作都会自动保存到浏览器本地存储</li>
                            <li class="en-text"><strong>Auto Save:</strong> All operations are automatically saved to browser local storage</li>
                            <li class="cn-text"><strong>恢复记录：</strong>刷新页面后会自动打开上次编辑的图形</li>
                            <li class="en-text"><strong>Restore Record:</strong> After page refresh, automatically opens the last edited record</li>
                            <li class="cn-text"><strong>画布平移：</strong>按住 <kbd>空格</kbd> 键并拖拽画布可以平移视图，或使用鼠标中键拖拽</li>
                            <li class="en-text"><strong>Pan Canvas:</strong> Hold <kbd>Space</kbd> and drag the canvas to pan the view, or use middle mouse button to drag</li>
                            <li class="cn-text"><strong>画布缩放：</strong>按住 <kbd>Ctrl</kbd> 键并滚动鼠标滚轮可以缩放视图，或使用工具栏的缩放按钮（放大、缩小、重置）</li>
                            <li class="en-text"><strong>Zoom Canvas:</strong> Hold <kbd>Ctrl</kbd> and scroll mouse wheel to zoom the view, or use toolbar zoom buttons (zoom in, zoom out, reset)</li>
                            <li class="cn-text"><strong>连接线拖动：</strong>选中连接线后，可以拖动整个连接线移动位置，松开时会自动吸附到附近的图形连接点</li>
                            <li class="en-text"><strong>Connector Dragging:</strong> After selecting a connector, you can drag the entire connector to move it, it will automatically snap to nearby shape connection points when released</li>
                            <li class="cn-text"><strong>连续粘贴：</strong>多次粘贴时，每次粘贴都会自动偏移一定距离，避免重叠</li>
                            <li class="en-text"><strong>Continuous Paste:</strong> When pasting multiple times, each paste automatically offsets by a certain distance to avoid overlap</li>
                            <li class="cn-text"><strong>记录有效期：</strong>每个图形记录有3小时有效期，从最后一次修改时开始计算，超过有效期的记录会自动删除</li>
                            <li class="en-text"><strong>Record Expiry:</strong> Each drawing record has a 3-hour validity period, calculated from the last modification time, expired records are automatically deleted</li>
                        </ul>
                    </section>

                    <!-- 注意事项 -->
                    <section>
                        <h6 class="fw-bold mb-3">
                            <i class="bi bi-exclamation-triangle me-2 text-warning"></i>
                            <span class="cn-text">注意事项</span><span class="en-text">Important Notes</span>
                        </h6>
                        <div class="alert alert-warning mb-0">
                            <ul class="mb-0 small">
                                <li class="cn-text">所有数据仅存储在浏览器本地，不会上传到服务器</li>
                                <li class="en-text">All data is stored locally in browser, not uploaded to server</li>
                                <li class="cn-text">请定期使用"保存"按钮导出 JSON 文件进行备份</li>
                                <li class="en-text">Please regularly use "Save" button to export JSON files for backup</li>
                                <li class="cn-text">清除浏览器数据会导致所有图形记录丢失</li>
                                <li class="en-text">Clearing browser data will cause all records to be lost</li>
                            </ul>
                        </div>
                    </section>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <span class="cn-text">关闭</span><span class="en-text">Close</span>
                </button>
            </div>
        </div>
    </div>
</div>

