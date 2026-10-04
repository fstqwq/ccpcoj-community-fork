/**
 * Web Draw 主应用类
 * 负责事件处理、形状管理、UI 交互等核心功能
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    const COPY_OFFSET = window.WebDrawConstants.COPY_OFFSET;
    const MAX_HISTORY = window.WebDrawConstants.MAX_HISTORY;
    const ShapeFactory = window.WebDrawShapes;
    const Connector = window.WebDrawConnectors ? window.WebDrawConnectors.Connector : null;
    
    class WebDrawApp {
        constructor() {
            this.svg = null;
            this.svgContainer = null;
            this.shapes = [];
            this.connectors = [];
            this.selectedShapes = [];
            this.selectedConnector = null;
            this.currentMode = 'select'; // 默认选择模式
            this.isDrawing = false;
            this.isDragging = false;
            this.isResizing = false;
            this.isSelecting = false; // 圈选状态
            this.selectionBox = null; // 选择框元素
            this.dragStart = { x: 0, y: 0 };
            this.currentShape = null;
            this.currentConnector = null;
            this.history = [];
            this.historyIndex = -1;
            this.editingShape = null;
            this.instance = null;
            this.clipboard = null; // 剪贴板数据
            this.currentRecordId = null; // 当前记录ID
            this.canvasScale = 1.0; // 画布缩放比例
            this.canvasOffsetX = 0; // 画布偏移X
            this.canvasOffsetY = 0; // 画布偏移Y
            this.isPanning = false; // 是否正在平移画布
            this.panStart = { x: 0, y: 0 }; // 平移起始点
            this.svgGroup = null; // SVG 内容组（用于缩放和平移）
            this.spaceKeyPressed = false; // 空格键是否按下
            this.isDraggingConnectorEndpoint = false; // 是否正在拖拽连接线端点
            this.draggingEndpoint = null; // 正在拖拽的端点：'start' 或 'end'
            this.isDraggingConnector = false; // 是否正在拖动整个连接线
            this.resizeStartRadius = null; // 调整大小开始时的半径（用于圆形）
            this.resizeStartCenter = null; // 调整大小开始时的中心点（用于所有形状）
            this.resizeStartSize = null; // 调整大小开始时的尺寸（用于非圆形）
            this.resizeDragStartPoint = null; // 调整大小开始时的拖拽点（用于菱形等）
            this.resizeEdge = null; // 调整大小开始时的边缘（'left', 'right', 'top', 'bottom'）
            this.resizeDragInfo = null; // 调整大小的拖拽信息（用于菱形区分顶点和边）
            this.pendingDrawStart = null; // 待开始的绘制起始点（用于检测拖动阈值）
            this.hasExceededDrawThreshold = false; // 是否已超过绘制阈值
            this.currentFreeDrawPath = null; // 当前自由绘制路径
            this.freeDrawBrushSize = 2; // 自由绘制笔刷大小（默认细）
            this.justFinishedResizing = false; // 是否刚刚完成缩放操作（用于防止点击事件清除选择）
        }
        
        static getInstance() {
            if (!this.instance) {
                this.instance = new WebDrawApp();
            }
            return this.instance;
        }
        
        init() {
            this.svg = document.getElementById('webdraw-svg');
            this.svgContainer = document.getElementById('canvas-container');
            
            if (!this.svg || !this.svgContainer) {
                console.error('WebDraw: SVG elements not found');
                return;
            }
            
            // 创建内容组用于缩放和平移
            this.svgGroup = document.createElementNS(SVG_NS, 'g');
            this.svgGroup.setAttribute('id', 'canvas-content-group');
            this.svg.appendChild(this.svgGroup);
            
            // 将现有的 defs 移到组外（如果存在）
            const existingDefs = this.svg.querySelector('defs');
            if (existingDefs) {
                this.svg.insertBefore(existingDefs, this.svgGroup);
            }
            
            window.WebDrawCanvas.updateSVGSize(this);
            window.WebDrawCanvas.updateCanvasTransform(this);
            window.addEventListener('resize', () => {
                window.WebDrawCanvas.updateSVGSize(this);
                window.WebDrawCanvas.updateCanvasTransform(this);
            });
            
            this.setupEventListeners();
            window.WebDrawCanvas.createArrowMarkers(this);
            window.WebDrawRecordManagement.initRecordManagement(this);
            window.WebDrawUtils.updateDeleteButtonState(this);
        }
        
        
        
        setupEventListeners() {
            // 工具栏事件
            document.querySelectorAll('[data-shape]').forEach(btn => {
                btn.addEventListener('click', () => {
                    // 移除所有按钮的 active 类
                    document.querySelectorAll('[data-shape]').forEach(b => b.classList.remove('active'));
                    // 添加当前按钮的 active 类
                    btn.classList.add('active');
                    this.setMode(btn.dataset.shape);
                });
            });
            
            // 自由绘制笔刷选择事件
            document.querySelectorAll('[data-brush]').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const brushSize = parseInt(item.dataset.brush);
                    this.freeDrawBrushSize = brushSize;
                    // 更新按钮文本显示当前笔刷大小
                    const btnFreedraw = document.getElementById('btn-freedraw');
                    if (btnFreedraw) {
                        const sizeText = brushSize === 2 ? '细' : (brushSize === 4 ? '中' : '粗');
                        const sizeTextEn = brushSize === 2 ? 'Thin' : (brushSize === 4 ? 'Medium' : 'Thick');
                        btnFreedraw.innerHTML = `<i class="bi bi-pencil"></i> <span class="cn-text">自由绘制 (${sizeText})</span><span class="en-text">Free Draw (${sizeTextEn})</span>`;
                    }
                    // 设置自由绘制模式
                    document.querySelectorAll('[data-shape]').forEach(b => b.classList.remove('active'));
                    this.setMode('freedraw');
                });
            });
            
            const btnCopy = document.getElementById('btn-copy');
            if (btnCopy) {
                btnCopy.addEventListener('click', () => {
                    window.WebDrawClipboard.copySelectedShapes(this);
                });
            }
            const btnDelete = document.getElementById('btn-delete');
            if (btnDelete) btnDelete.addEventListener('click', () => this.deleteSelectedShapes());
            const btnClear = document.getElementById('btn-clear');
            if (btnClear) btnClear.addEventListener('click', () => this.clearCanvas());
            const btnUndo = document.getElementById('btn-undo');
            if (btnUndo) btnUndo.addEventListener('click', () => window.WebDrawHistory.undo(this));
            const btnRedo = document.getElementById('btn-redo');
            if (btnRedo) btnRedo.addEventListener('click', () => window.WebDrawHistory.redo(this));
            const btnSave = document.getElementById('btn-save');
            if (btnSave) btnSave.addEventListener('click', () => {
                window.WebDrawImportExport.downloadJSON(this);
            });
            const btnLoad = document.getElementById('btn-load');
            if (btnLoad) btnLoad.addEventListener('click', () => {
                window.WebDrawImportExport.loadFromJSONFile(this);
            });
            
            // 记录管理事件
            const recordSelect = document.getElementById('record-select');
            if (recordSelect) recordSelect.addEventListener('change', (e) => {
                window.WebDrawRecordManagement.switchRecord(this, e.target.value);
            });
            const btnNewRecord = document.getElementById('btn-new-record');
            if (btnNewRecord) btnNewRecord.addEventListener('click', () => {
                window.WebDrawRecordManagement.createNewRecord(this);
            });
            const btnRenameRecord = document.getElementById('btn-rename-record');
            if (btnRenameRecord) btnRenameRecord.addEventListener('click', () => {
                window.WebDrawRecordManagement.renameCurrentRecord(this);
            });
            const btnDeleteRecord = document.getElementById('btn-delete-record');
            if (btnDeleteRecord) btnDeleteRecord.addEventListener('click', () => {
                window.WebDrawRecordManagement.deleteCurrentRecord(this);
            });
            
            document.querySelectorAll('[data-export]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.WebDrawImportExport.exportImage(this, btn.dataset.export);
                });
            });
            
            // 对齐功能
            document.querySelectorAll('[data-align]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.WebDrawAlignment.alignShapes(this, btn.dataset.align);
                });
            });
            
            // 分布功能
            document.querySelectorAll('[data-distribute]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.WebDrawAlignment.distributeShapes(this, btn.dataset.distribute);
                });
            });
            
            // 连接线箭头设置（按钮）
            const btnLineStartArrow = document.getElementById('btn-line-start-arrow');
            if (btnLineStartArrow) {
                btnLineStartArrow.addEventListener('click', () => {
                    btnLineStartArrow.classList.toggle('active');
                    window.WebDrawUtils.updateConnectorArrows(this);
                });
            }
            const btnLineEndArrow = document.getElementById('btn-line-end-arrow');
            if (btnLineEndArrow) {
                btnLineEndArrow.addEventListener('click', () => {
                    btnLineEndArrow.classList.toggle('active');
                    window.WebDrawUtils.updateConnectorArrows(this);
                });
            }
            
            // 缩放按钮
            const btnZoomIn = document.getElementById('btn-zoom-in');
            if (btnZoomIn) {
                btnZoomIn.addEventListener('click', () => {
                    const rect = this.svg.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    window.WebDrawCanvas.zoomCanvas(this, 1, centerX, centerY);
                });
            }
            const btnZoomOut = document.getElementById('btn-zoom-out');
            if (btnZoomOut) {
                btnZoomOut.addEventListener('click', () => {
                    const rect = this.svg.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    window.WebDrawCanvas.zoomCanvas(this, -1, centerX, centerY);
                });
            }
            const btnZoomReset = document.getElementById('btn-zoom-reset');
            if (btnZoomReset) {
                btnZoomReset.addEventListener('click', () => {
                    this.canvasScale = 1.0;
                    this.canvasOffsetX = 0;
                    this.canvasOffsetY = 0;
                    window.WebDrawCanvas.updateCanvasTransform(this);
                });
            }
            
            // SVG 事件 - 使用捕获阶段确保能捕获到所有事件
            this.svg.addEventListener('mousedown', (e) => this.onMouseDown(e), true);
            this.svg.addEventListener('mousemove', (e) => this.onMouseMove(e), true);
            this.svg.addEventListener('mouseup', (e) => this.onMouseUp(e), true);
            this.svg.addEventListener('dblclick', (e) => this.onDoubleClick(e), true);
            this.svg.addEventListener('click', (e) => this.onCanvasClick(e), true);
            
            // 键盘快捷键
            document.addEventListener('keydown', (e) => this.onKeyDown(e));
            document.addEventListener('keyup', (e) => this.onKeyUp(e));
            
            // 鼠标滚轮缩放（Ctrl+滚轮）
            this.svgContainer.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
            
            // 中键拖拽平移
            this.svg.addEventListener('mousedown', (e) => {
                if (e.button === 1) { // 中键
                    e.preventDefault();
                    const rect = this.svg.getBoundingClientRect();
                    const point = {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                    };
                    window.WebDrawCanvas.startPanning(this, point);
                }
            });
            
            // 阻止中键默认行为（打开新标签页）
            this.svg.addEventListener('auxclick', (e) => {
                if (e.button === 1) {
                    e.preventDefault();
                }
            });
            
            // 文本编辑现在直接在图形内进行，不需要额外的事件监听
        }
        
        // 键盘快捷键
        onKeyDown(e) {
            // 如果正在编辑文本，不处理快捷键
            if (this.editingShape && this.editingShape.isEditing) {
                return;
            }
            
            // 空格键：开始平移（如果按下）
            if (e.key === ' ' || e.key === 'Spacebar') {
                if (!this.isPanning && this.currentMode === 'select') {
                    e.preventDefault();
                    this.svg.style.cursor = 'grab';
                    // 标记空格键按下
                    this.spaceKeyPressed = true;
                }
            }
            
            // Ctrl+Z 或 Cmd+Z: 撤销
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                window.WebDrawHistory.undo(this);
                return;
            }
            
            // Ctrl+Y 或 Ctrl+Shift+Z 或 Cmd+Shift+Z: 重做
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                window.WebDrawHistory.redo(this);
                return;
            }
            
            // Ctrl+C 或 Cmd+C: 复制
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                window.WebDrawClipboard.copyToClipboard(this);
                return;
            }
            
            // Ctrl+V 或 Cmd+V: 粘贴
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                window.WebDrawClipboard.pasteFromClipboard(this);
                return;
            }
            
            // Delete 或 Backspace: 删除选中的图形
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedShapes.length > 0 || this.selectedConnector) {
                    e.preventDefault();
                    this.deleteSelectedShapes();
                    return;
                }
            }
        }
        
        onKeyUp(e) {
            // 释放空格键时停止平移
            if (e.key === ' ' || e.key === 'Spacebar') {
                this.spaceKeyPressed = false;
                if (this.isPanning) {
                    window.WebDrawCanvas.stopPanning(this);
                }
                if (this.currentMode === 'select') {
                    this.svg.style.cursor = 'default';
                }
            }
        }
        
        onWheel(e) {
            // Ctrl+滚轮缩放
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                window.WebDrawCanvas.zoomCanvas(this, -e.deltaY, e.clientX, e.clientY);
            }
        }
        
        setMode(mode) {
            this.currentMode = mode;
            const lineArrowSettings = document.getElementById('line-arrow-settings');
            if (lineArrowSettings) {
                if (mode === 'line') {
                    lineArrowSettings.style.display = 'flex';
                } else {
                    lineArrowSettings.style.display = 'none';
                    lineArrowSettings.classList.remove('connector-selected');
                }
            }
            
            // 更新 SVG 光标
            if (mode === 'select') {
                this.svg.style.cursor = 'default';
            } else if (mode === 'line') {
                this.svg.style.cursor = 'crosshair';
            } else {
                this.svg.style.cursor = 'crosshair';
            }
            
            // 更新工具栏按钮状态
            document.querySelectorAll('[data-shape]').forEach(btn => {
                btn.classList.remove('active');
            });
            const activeBtn = document.querySelector(`[data-shape="${mode}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
            
            // 选择模式下不清除选择，其他模式清除
            if (mode !== 'select') {
                window.WebDrawSelection.deselectAll(this);
            }
        }
        
        
        onMouseDown(e) {
            // 如果点击在文本编辑器内，不处理
            if (e.target.closest('.text-editor-foreign') || 
                e.target.closest('.freetext-editor') ||
                e.target.classList.contains('shape-text-input') ||
                e.target.classList.contains('freetext-input') ||
                e.target.tagName === 'INPUT') {
                return;
            }
            
            // 中键、空格+左键：开始平移
            if (e.button === 1 || (e.button === 0 && this.spaceKeyPressed)) {
                e.preventDefault();
                const rect = this.svg.getBoundingClientRect();
                const point = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
                window.WebDrawCanvas.startPanning(this, point);
                this.svg.style.cursor = 'grabbing';
                return;
            }
            
            const point = window.WebDrawCanvas.getSVGPoint(this, e);
            this.dragStart = point;
            
            // 选择模式下的处理
            if (this.currentMode === 'select') {
                // 检查是否点击了形状或形状组
                let shape = null;
                if (e.target.classList.contains('shape')) {
                    shape = window.WebDrawFinders.findShapeByElement(this, e.target);
                } else if (e.target.classList.contains('shape-group') || e.target.closest('.shape-group')) {
                    // 点击了形状组或组内的元素（如文本）
                    const groupElement = e.target.classList.contains('shape-group') ? e.target : e.target.closest('.shape-group');
                    if (groupElement) {
                        const shapeId = groupElement.getAttribute('data-id');
                        shape = window.WebDrawFinders.findShapeById(this, shapeId);
                    }
                } else if (e.target.classList.contains('freetext-text') || e.target.classList.contains('shape-text')) {
                    // 点击了自由文本的文本元素
                    const groupElement = e.target.closest('.shape-group');
                    if (groupElement) {
                        const shapeId = groupElement.getAttribute('data-id');
                        shape = window.WebDrawFinders.findShapeById(this, shapeId);
                    }
                }
                
                // 如果没有直接点击到形状，但点击的是 SVG 或空白区域，且已选中单个形状，检查是否在边缘附近
                if (!shape && this.selectedShapes.length === 1) {
                    const selectedShape = this.selectedShapes[0];
                    if (typeof selectedShape.isPointNearEdge === 'function') {
                        const edgeThreshold = window.WebDrawConstants?.CIRCLE_EDGE_THRESHOLD || 15;
                        const edgeResult = selectedShape.isPointNearEdge(point, edgeThreshold);
                        
                        // 对于菱形，edgeResult 是一个对象 {near: true, type: 'vertex'|'edge', name: '...'}
                        // 对于其他形状，edgeResult 可能是布尔值或对象 {near: true, edge: 'left'|'right'|'top'|'bottom'}
                        const isNearEdge = edgeResult && (typeof edgeResult === 'object' ? edgeResult.near : edgeResult);
                        const edge = (typeof edgeResult === 'object' && edgeResult.edge) ? edgeResult.edge : null;
                        
                        if (isNearEdge) {
                            // 在边缘附近，开始调整大小
                            this.isResizing = true;
                            this.dragStart = point;
                            this.resizeDragStartPoint = point; // 记录拖拽起始点
                            this.resizeEdge = edge; // 记录边缘信息
                            
                            // 对于菱形和矩形，记录拖拽信息（顶点还是边）
                            if ((selectedShape.type === 'diamond' || selectedShape.type === 'rect' || selectedShape.type === 'ellipse') && typeof edgeResult === 'object' && edgeResult.type) {
                                this.resizeDragInfo = { type: edgeResult.type, name: edgeResult.name };
                                selectedShape._lastDragInfo = this.resizeDragInfo; // 保存到形状对象中
                            } else if (typeof edgeResult === 'object' && edgeResult.edge) {
                                // 对于其他形状，只记录边缘信息
                                this.resizeEdge = edgeResult.edge;
                            }
                            
                            // 记录初始状态
                            const bounds = selectedShape.getBounds();
                            if (selectedShape.type === 'circle') {
                                this.resizeStartRadius = bounds.radius;
                                this.resizeStartCenter = { x: bounds.centerX, y: bounds.centerY };
                            } else {
                                this.resizeStartCenter = { x: bounds.centerX, y: bounds.centerY };
                                this.resizeStartSize = { width: bounds.width, height: bounds.height };
                            }
                            
                            if (this.svg) {
                                this.svg.style.cursor = 'nwse-resize';
                            }
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                    }
                }
                
                if (shape) {
                    // 如果正在编辑其他形状的文本，先完成编辑
                    if (this.editingShape && this.editingShape.isEditing && this.editingShape !== shape) {
                        this.editingShape.finishTextEdit();
                        this.editingShape = null;
                    }
                    
                    // Ctrl/Cmd 点击：切换选择状态
                    if (e.ctrlKey || e.metaKey) {
                        window.WebDrawSelection.toggleShapeSelection(this, shape);
                        this.isDragging = this.selectedShapes.includes(shape);
                    } else {
                        // 普通点击：如果已选中则准备拖拽，否则选中
                        const isSelected = this.selectedShapes.includes(shape);
                        if (isSelected) {
                            // 已选中：检查是否点击在边缘（用于调整大小）
                            // 使用统一的 isPointNearEdge 方法，所有形状都支持
                            if (typeof shape.isPointNearEdge === 'function') {
                                // 使用常量中的阈值，确保与鼠标图标变化一致
                                const edgeThreshold = window.WebDrawConstants?.CIRCLE_EDGE_THRESHOLD || 15;
                                const edgeResult = shape.isPointNearEdge(point, edgeThreshold);
                                // 处理返回值为对象或布尔值的情况（向后兼容）
                                const isNearEdge = edgeResult && (typeof edgeResult === 'object' ? edgeResult.near : edgeResult);
                                const edge = (typeof edgeResult === 'object' && edgeResult.edge) ? edgeResult.edge : null;
                                if (isNearEdge) {
                                    // 点击在边缘，开始调整大小
                                    this.isResizing = true;
                                    this.dragStart = point;
                                    this.resizeDragStartPoint = point; // 记录拖拽起始点
                                    this.resizeEdge = edge; // 记录边缘信息
                                    
                                    // 记录初始状态，用于计算新的尺寸
                                    const bounds = shape.getBounds();
                                    // 对于圆形，记录半径和圆心；对于其他形状，记录中心点和尺寸
                                    if (shape.type === 'circle') {
                                        this.resizeStartRadius = bounds.radius;
                                        this.resizeStartCenter = { x: bounds.centerX, y: bounds.centerY };
                                    } else {
                                        this.resizeStartCenter = { x: bounds.centerX, y: bounds.centerY };
                                        this.resizeStartSize = { width: bounds.width, height: bounds.height };
                                    }
                                    
                                    // 设置 resize 光标
                                    if (this.svg) {
                                        this.svg.style.cursor = 'nwse-resize';
                                    }
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                }
                            }
                            // 不在边缘，准备拖拽
                            this.isDragging = true;
                        } else {
                            // 未选中：清除其他选择，选中当前形状
                            window.WebDrawSelection.deselectAll(this);
                            window.WebDrawSelection.selectShape(this, shape);
                            // 自由文字在单击时只选中，不进入编辑模式，双击时才进入编辑模式
                            this.isDragging = true;
                        }
                    }
                    return;
                }
                
                if (e.target.classList.contains('connector-line')) {
                    // 如果正在编辑文本，先完成编辑
                    if (this.editingShape && this.editingShape.isEditing) {
                        this.editingShape.finishTextEdit();
                        this.editingShape = null;
                    }
                    const connectorElement = e.target.parentElement;
                    const connector = window.WebDrawFinders.findConnectorByElement(this, connectorElement);
                    
                    if (connector) {
                        // 检查是否点击在端点附近（如果是，则拖拽端点）
                        const SNAP_DISTANCE = window.WebDrawConstants?.SNAP_DISTANCE || 15;
                        const startDist = Math.sqrt(
                            Math.pow(connector.startX - point.x, 2) + 
                            Math.pow(connector.startY - point.y, 2)
                        );
                        const endDist = Math.sqrt(
                            Math.pow(connector.endX - point.x, 2) + 
                            Math.pow(connector.endY - point.y, 2)
                        );
                        
                        // 如果点击在端点附近，拖拽端点
                        if (startDist <= SNAP_DISTANCE || endDist <= SNAP_DISTANCE) {
                            this.selectedConnector = connector;
                            this.isDraggingConnectorEndpoint = true;
                            this.draggingEndpoint = startDist < endDist ? 'start' : 'end';
                            
                            // 如果端点当前吸附到形状，先获取实际坐标并解除吸附
                            if (this.draggingEndpoint === 'start' && connector.startShapeId && connector.startPoint && connector.appInstance) {
                                const shape = window.WebDrawFinders.findShapeById(connector.appInstance, connector.startShapeId);
                                if (shape) {
                                    const connectionPoint = shape.getConnectionPoints().find(p => p.name === connector.startPoint);
                                    if (connectionPoint) {
                                        connector.startX = connectionPoint.x;
                                        connector.startY = connectionPoint.y;
                                    }
                                }
                                connector.startShapeId = null;
                                connector.startPoint = null;
                            } else if (this.draggingEndpoint === 'end' && connector.endShapeId && connector.endPoint && connector.appInstance) {
                                const shape = window.WebDrawFinders.findShapeById(connector.appInstance, connector.endShapeId);
                                if (shape) {
                                    const connectionPoint = shape.getConnectionPoints().find(p => p.name === connector.endPoint);
                                    if (connectionPoint) {
                                        connector.endX = connectionPoint.x;
                                        connector.endY = connectionPoint.y;
                                    }
                                }
                                connector.endShapeId = null;
                                connector.endPoint = null;
                            }
                            
                            // 选中连接线并显示端点手柄
                            window.WebDrawConnectorManagement.selectConnector(this, connectorElement);
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                        
                        // 如果点击在连接线中间，准备拖动整个连接线
                        // 选中连接线
                        window.WebDrawConnectorManagement.selectConnector(this, connectorElement);
                        // 准备拖动整个连接线
                        this.isDraggingConnector = true;
                        this.dragStart = point;
                        connector.startDrag(point);
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                }
                
                // 检测是否点击了连接线端点手柄
                if (e.target.classList.contains('connector-endpoint-handle')) {
                    const endpoint = e.target.getAttribute('data-endpoint');
                    const connectorId = e.target.getAttribute('data-connector-id');
                    const connector = this.connectors.find(c => c.id === connectorId);
                    if (connector) {
                        this.selectedConnector = connector;
                        this.isDraggingConnectorEndpoint = true;
                        this.draggingEndpoint = endpoint; // 'start' 或 'end'
                        
                        // 如果端点当前吸附到形状，先获取实际坐标并解除吸附
                        if (endpoint === 'start' && connector.startShapeId && connector.startPoint && connector.appInstance) {
                            const shape = window.WebDrawFinders.findShapeById(connector.appInstance, connector.startShapeId);
                            if (shape) {
                                const connectionPoint = shape.getConnectionPoints().find(p => p.name === connector.startPoint);
                                if (connectionPoint) {
                                    // 获取当前吸附点的实际坐标
                                    connector.startX = connectionPoint.x;
                                    connector.startY = connectionPoint.y;
                                }
                            }
                            // 解除吸附关系，允许自由拖拽
                            connector.startShapeId = null;
                            connector.startPoint = null;
                        } else if (endpoint === 'end' && connector.endShapeId && connector.endPoint && connector.appInstance) {
                            const shape = window.WebDrawFinders.findShapeById(connector.appInstance, connector.endShapeId);
                            if (shape) {
                                const connectionPoint = shape.getConnectionPoints().find(p => p.name === connector.endPoint);
                                if (connectionPoint) {
                                    // 获取当前吸附点的实际坐标
                                    connector.endX = connectionPoint.x;
                                    connector.endY = connectionPoint.y;
                                }
                            }
                            // 解除吸附关系，允许自由拖拽
                            connector.endShapeId = null;
                            connector.endPoint = null;
                        }
                        
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    return;
                }
                
                if (e.target.classList.contains('resize-handle')) {
                    this.isResizing = true;
                    return;
                }
                
                // 空白区域：开始圈选
                // 检查是否点击在空白区域
                const targetTag = e.target.tagName.toLowerCase();
                const targetClassList = e.target.classList;
                
                // 检查是否点击在可交互元素上
                const isShape = targetClassList.contains('shape');
                const isShapeText = targetClassList.contains('shape-text');
                const isConnector = targetClassList.contains('connector') ||
                                   targetClassList.contains('connector-line');
                const isHandle = targetClassList.contains('resize-handle') ||
                                targetClassList.contains('connection-point');
                
                // 检查是否是SVG内部的结构元素（defs, marker等）
                const isStructureElement = targetTag === 'defs' || 
                                          targetTag === 'marker' ||
                                          targetTag === 'path' && e.target.closest('defs');
                
                // 空白区域判断：不是形状、连接线、文本、手柄，或者是SVG本身或结构元素
                const isBlankArea = !isShape && !isShapeText && !isConnector && !isHandle &&
                                   (e.target === this.svg || 
                                    targetTag === 'svg' ||
                                    isStructureElement ||
                                    (targetTag === 'g' && !targetClassList.length));
                
                if (isBlankArea) {
                    // 如果正在编辑文本，先取消编辑
                    if (this.editingShape && this.editingShape.isEditing) {
                        this.editingShape.finishTextEdit();
                        this.editingShape = null;
                    }
                    
                    // Ctrl+点击空白区域：不清除选择，允许继续多选
                    if (!e.ctrlKey && !e.metaKey) {
                        window.WebDrawSelection.deselectAll(this);
                    }
                    this.isSelecting = true;
                    window.WebDrawSelectionBox.startSelectionBox(this, point);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            
            // 绘制模式（包括图形和连接线）
            if (this.currentMode && this.currentMode !== 'select') {
                // 自由绘制模式：点击后立即开始绘制
                if (this.currentMode === 'freedraw') {
                    // 检查是否点击了已存在的图形或连接线
                    let clickedShape = null;
                    let clickedConnector = null;
                    
                    if (e.target.classList.contains('shape')) {
                        clickedShape = window.WebDrawFinders.findShapeByElement(this, e.target);
                    } else if (e.target.classList.contains('shape-group') || e.target.closest('.shape-group')) {
                        const groupElement = e.target.classList.contains('shape-group') ? e.target : e.target.closest('.shape-group');
                        if (groupElement) {
                            const shapeId = groupElement.getAttribute('data-id');
                            clickedShape = window.WebDrawFinders.findShapeById(this, shapeId);
                        }
                    }
                    
                    if (e.target.classList.contains('connector-line')) {
                        const connectorElement = e.target.parentElement;
                        clickedConnector = window.WebDrawFinders.findConnectorByElement(this, connectorElement);
                    }
                    
                    // 如果点击了图形或连接线，切换到选择模式并选中
                    if (clickedShape) {
                        this.setMode('select');
                        window.WebDrawSelection.deselectAll(this);
                        window.WebDrawSelection.selectShape(this, clickedShape);
                        document.querySelectorAll('[data-shape]').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        const selectBtn = document.querySelector('[data-shape="select"]');
                        if (selectBtn) {
                            selectBtn.classList.add('active');
                        }
                        return;
                    }
                    
                    if (clickedConnector) {
                        this.setMode('select');
                        this.deselectAll();
                        window.WebDrawConnectorManagement.selectConnector(this, clickedConnector.element || e.target.parentElement);
                        document.querySelectorAll('[data-shape]').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        const selectBtn = document.querySelector('[data-shape="select"]');
                        if (selectBtn) {
                            selectBtn.classList.add('active');
                        }
                        return;
                    }
                    
                    // 点击空白区域，立即开始自由绘制
                    window.WebDrawDrawing.startDrawingShape(this, point);
                    this.isDrawing = true;
                    return;
                }
                
                // 自由文字模式：点击后立即创建文本并进入编辑模式
                if (this.currentMode === 'freetext') {
                    // 检查是否点击了已存在的图形或连接线
                    let clickedShape = null;
                    let clickedConnector = null;
                    
                    if (e.target.classList.contains('shape')) {
                        clickedShape = window.WebDrawFinders.findShapeByElement(this, e.target);
                    } else if (e.target.classList.contains('shape-group') || e.target.closest('.shape-group')) {
                        const groupElement = e.target.classList.contains('shape-group') ? e.target : e.target.closest('.shape-group');
                        if (groupElement) {
                            const shapeId = groupElement.getAttribute('data-id');
                            clickedShape = window.WebDrawFinders.findShapeById(this, shapeId);
                        }
                    } else if (e.target.classList.contains('freetext-text') || e.target.classList.contains('shape-text')) {
                        // 点击了自由文本的文本元素
                        const groupElement = e.target.closest('.shape-group');
                        if (groupElement) {
                            const shapeId = groupElement.getAttribute('data-id');
                            clickedShape = window.WebDrawFinders.findShapeById(this, shapeId);
                        }
                    }
                    
                    if (e.target.classList.contains('connector-line')) {
                        const connectorElement = e.target.parentElement;
                        clickedConnector = window.WebDrawFinders.findConnectorByElement(this, connectorElement);
                    }
                    
                    // 如果点击了图形或连接线，切换到选择模式并选中
                    if (clickedShape) {
                        this.setMode('select');
                        window.WebDrawSelection.deselectAll(this);
                        window.WebDrawSelection.selectShape(this, clickedShape);
                        // 自由文字模式：点击已存在的自由文字时，切换到选择模式并选中（不立即编辑）
                        // 双击时才进入编辑模式
                        document.querySelectorAll('[data-shape]').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        const selectBtn = document.querySelector('[data-shape="select"]');
                        if (selectBtn) {
                            selectBtn.classList.add('active');
                        }
                        return;
                    }
                    
                    if (clickedConnector) {
                        this.setMode('select');
                        this.deselectAll();
                        window.WebDrawConnectorManagement.selectConnector(this, clickedConnector.element || e.target.parentElement);
                        document.querySelectorAll('[data-shape]').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        const selectBtn = document.querySelector('[data-shape="select"]');
                        if (selectBtn) {
                            selectBtn.classList.add('active');
                        }
                        return;
                    }
                    
                    // 点击空白区域，立即创建自由文字
                    window.WebDrawDrawing.startDrawingShape(this, point);
                    return;
                }
                
                // 统一的绘制逻辑：
                // 1. 如果鼠标起始位置在已绘制的图形上，不立即触发选中
                // 2. 记录起始点，在 mousemove 中判断是否超过阈值
                // 3. 如果超过阈值，立即开始绘制（在 mousemove 中）
                // 4. 如果未超过阈值，在 mouseup 时检查是否在图形上，如果是则选中
                
                let clickedShape = null;
                let clickedConnector = null;
                
                    // 检查是否点击了图形
                    if (e.target.classList.contains('shape')) {
                        clickedShape = window.WebDrawFinders.findShapeByElement(this, e.target);
                    } else if (e.target.classList.contains('shape-group') || e.target.closest('.shape-group')) {
                        const groupElement = e.target.classList.contains('shape-group') ? e.target : e.target.closest('.shape-group');
                        if (groupElement) {
                            const shapeId = groupElement.getAttribute('data-id');
                            clickedShape = window.WebDrawFinders.findShapeById(this, shapeId);
                        }
                    }
                    
                    // 检查是否点击了连接线
                    if (e.target.classList.contains('connector-line')) {
                        const connectorElement = e.target.parentElement;
                        clickedConnector = window.WebDrawFinders.findConnectorByElement(this, connectorElement);
                    }
                
                // 记录起始点（无论是否点击在图形上）
                // 同时记录点击的对象，用于 mouseup 时判断
                this.pendingDrawStart = point;
                this.pendingDrawStartShape = clickedShape; // 记录起始位置的图形
                this.pendingDrawStartConnector = clickedConnector; // 记录起始位置的连接线
                this.hasExceededDrawThreshold = false;
                this.dragStart = point;
                
                // 不立即选中，等待拖动判断
            }
        }
        
        onMouseMove(e) {
            // 画布平移
            if (this.isPanning) {
                const rect = this.svg.getBoundingClientRect();
                const point = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
                window.WebDrawCanvas.updatePanning(this, point);
                return;
            }
            
            const point = window.WebDrawCanvas.getSVGPoint(this, e);
            
            if (this.isSelecting && this.selectionBox) {
                // 圈选优先级最高
                window.WebDrawSelectionBox.updateSelectionBox(this, point);
            } else if (this.isDraggingConnectorEndpoint && this.selectedConnector) {
                // 拖拽连接线端点
                window.WebDrawConnectorEndpoints.updateConnectorEndpoint(this, point);
            } else if (this.isDraggingConnector && this.selectedConnector) {
                // 拖动整个连接线
                this.selectedConnector.updateDrag(point, this.dragStart);
            } else if (this.isDrawing && this.currentFreeDrawPath) {
                // 自由绘制：添加点（优先级高于其他绘制逻辑）
                // 使用更大的距离阈值（25px），使采样点更稀疏
                this.currentFreeDrawPath.addPoint(point, 25);
                this.currentFreeDrawPath.update();
            } else if (this.pendingDrawStart && this.currentMode && this.currentMode !== 'select') {
                // 绘制模式（包括图形和连接线）：检测是否超过阈值
                if (!this.hasExceededDrawThreshold) {
                    const dx = point.x - this.pendingDrawStart.x;
                    const dy = point.y - this.pendingDrawStart.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const threshold = window.WebDrawConstants?.DRAW_START_THRESHOLD || 10;
                    
                    if (distance >= threshold) {
                        // 超过阈值，开始绘制
                        this.hasExceededDrawThreshold = true;
                        this.isDrawing = true;
                        if (this.currentMode === 'line') {
                            window.WebDrawDrawing.startDrawingLine(this, this.pendingDrawStart);
                            window.WebDrawDrawing.updateDrawingLine(this, point);
                        } else {
                            window.WebDrawDrawing.startDrawingShape(this, this.pendingDrawStart);
                            window.WebDrawDrawing.updateDrawingShape(this, point);
                        }
                    }
                } else {
                    // 已经超过阈值，继续绘制
                    if (this.currentMode === 'line') {
                        window.WebDrawDrawing.updateDrawingLine(this, point);
                    } else {
                        window.WebDrawDrawing.updateDrawingShape(this, point);
                    }
                }
            } else if (this.isDrawing && this.currentShape) {
                window.WebDrawDrawing.updateDrawingShape(this, point);
            } else if (this.isDrawing && this.currentConnector) {
                window.WebDrawDrawing.updateDrawingLine(this, point);
            } else if (this.isDragging && this.selectedShapes.length > 0) {
                const dx = point.x - this.dragStart.x;
                const dy = point.y - this.dragStart.y;
                this.selectedShapes.forEach(shape => shape.move(dx, dy));
                this.dragStart = point;
                window.WebDrawConnectorManagement.updateConnectors(this);
            } else if (this.isResizing && this.selectedShapes.length === 1) {
                const shape = this.selectedShapes[0];
                
                // 使用统一的边缘调整大小逻辑
                if (this.resizeStartCenter) {
                    // 如果是圆形，使用特殊逻辑（从圆心计算半径）
                    if (shape.type === 'circle' && this.resizeStartRadius !== undefined) {
                        // 计算从圆心到当前鼠标位置的距离作为新半径
                        const newRadius = Math.sqrt(
                            Math.pow(point.x - this.resizeStartCenter.x, 2) + 
                            Math.pow(point.y - this.resizeStartCenter.y, 2)
                        );
                        
                        const MIN_SIZE = window.WebDrawConstants.MIN_SHAPE_SIZE || 20;
                        const diameter = Math.max(MIN_SIZE, newRadius * 2);
                        
                        // 更新大小，保持圆心不变
                        shape.width = diameter;
                        shape.height = diameter;
                        const r = diameter / 2;
                        shape.x = this.resizeStartCenter.x - r;
                        shape.y = this.resizeStartCenter.y - r;
                        
                        shape.update();
                    } else if (typeof shape.resizeFromEdge === 'function') {
                        // 如果形状实现了 resizeFromEdge 方法，使用它
                        // 传递拖拽起始点（用于菱形等需要区分顶点和边的形状）
                        // 检测Shift键状态（用于等比缩放）
                        const shiftKey = e.shiftKey || false;
                        shape.resizeFromEdge(point, this.resizeDragStartPoint || point, this.resizeStartCenter, this.resizeStartRadius, this.resizeStartSize, this.resizeEdge, shiftKey);
                    } else {
                        // 默认逻辑：计算增量并调整大小
                        const dx = point.x - this.dragStart.x;
                        const dy = point.y - this.dragStart.y;
                        shape.resize(dx, dy);
                        this.dragStart = point;
                    }
                } else {
                    // 如果没有起始中心点，使用默认逻辑
                    const dx = point.x - this.dragStart.x;
                    const dy = point.y - this.dragStart.y;
                    shape.resize(dx, dy);
                    this.dragStart = point;
                }
                
                window.WebDrawConnectorManagement.updateConnectors(this);
            } else if (!this.isDragging && !this.isResizing && !this.isDrawing && !this.isSelecting && 
                       this.currentMode === 'select' && !this.isDraggingConnectorEndpoint) {
                // 在非拖拽/调整大小状态下，检测圆形边缘以改变鼠标样式
                // 注意：放在最后，避免干扰其他操作
                if (this.selectedShapes.length === 1) {
                    const shape = this.selectedShapes[0];
                    // 使用统一的 isPointNearEdge 方法，所有形状都支持
                    if (typeof shape.isPointNearEdge === 'function') {
                        // 使用常量中的阈值，确保与点击边缘调整大小一致
                        const edgeThreshold = window.WebDrawConstants?.CIRCLE_EDGE_THRESHOLD || 15;
                        if (shape.isPointNearEdge(point, edgeThreshold)) {
                            // 在边缘附近，显示 resize 光标
                            if (this.svg) {
                                this.svg.style.cursor = 'nwse-resize';
                            }
                        } else {
                            // 不在边缘，恢复默认光标
                            if (this.svg) {
                                this.svg.style.cursor = 'default';
                            }
                        }
                    } else {
                        // 非圆形，恢复默认光标
                        if (this.svg) {
                            this.svg.style.cursor = 'default';
                        }
                    }
                } else {
                    // 没有选中或选中多个，恢复默认光标
                    if (this.svg) {
                        this.svg.style.cursor = 'default';
                    }
                }
            }
        }
        
        onMouseUp(e) {
            // 如果点击在文本编辑器内，不处理
            if (e.target.closest('.text-editor-foreign') || 
                e.target.closest('.freetext-editor') ||
                e.target.classList.contains('shape-text-input') ||
                e.target.classList.contains('freetext-input') ||
                e.target.tagName === 'INPUT') {
                return;
            }
            
            // 停止平移
            if (this.isPanning) {
                window.WebDrawCanvas.stopPanning(this);
                if (this.currentMode === 'select') {
                    this.svg.style.cursor = this.spaceKeyPressed ? 'grab' : 'default';
                }
                return;
            }
            
            // 停止拖拽连接线端点
            if (this.isDraggingConnectorEndpoint) {
                this.isDraggingConnectorEndpoint = false;
                this.draggingEndpoint = null;
                // 更新端点手柄位置
                if (this.selectedConnector) {
                    window.WebDrawConnectorEndpoints.updateConnectorEndpoints(this);
                }
                window.WebDrawHistory.saveState(this);
                return;
            }
            
            // 停止拖动整个连接线
            if (this.isDraggingConnector && this.selectedConnector) {
                const point = window.WebDrawCanvas.getSVGPoint(this, e);
                this.selectedConnector.finishDrag(this, point);
                window.WebDrawConnectorEndpoints.updateConnectorEndpoints(this);
                this.isDraggingConnector = false;
                window.WebDrawHistory.saveState(this);
                return;
            }
            
            if (this.isSelecting) {
                // 圈选优先级最高
                window.WebDrawSelectionBox.finishSelectionBox(this);
                this.isSelecting = false;
            } else if (this.isDrawing) {
                if (this.currentFreeDrawPath) {
                    // 完成自由绘制
                    this.currentFreeDrawPath.finishDrawing();
                    this.shapes.push(this.currentFreeDrawPath);
                    this.currentFreeDrawPath = null;
                    this.currentShape = null;
                    this.hasExceededDrawThreshold = false;
                    this.pendingDrawStart = null;
                    this.pendingDrawStartShape = null;
                    this.pendingDrawStartConnector = null;
                    this.isDrawing = false;
                    window.WebDrawHistory.saveState(this);
                } else if (this.currentShape) {
                    window.WebDrawDrawing.finishDrawingShape(this);
                } else if (this.currentConnector) {
                    // 连接线绘制完成：在 mouseup 时检查起点和终点的图形吸附
                    const point = window.WebDrawCanvas.getSVGPoint(this, e);
                    
                    // 检查起点是否在图形上（如果之前没有设置）
                    if (!this.currentConnector.startShapeId) {
                        const startShape = window.WebDrawFinders.findShapeAtPoint(this, { x: this.currentConnector.startX, y: this.currentConnector.startY });
                        if (startShape) {
                            this.currentConnector.startShapeId = startShape.id;
                            this.currentConnector.startPoint = startShape.findNearestConnectionPoint({ x: this.currentConnector.startX, y: this.currentConnector.startY });
                        }
                    }
                    
                    // 检查终点是否在图形上
                    const endShape = window.WebDrawFinders.findShapeAtPoint(this, point);
                    if (endShape && endShape.id !== this.currentConnector.startShapeId) {
                        this.currentConnector.endShapeId = endShape.id;
                        this.currentConnector.endPoint = endShape.findNearestConnectionPoint(point);
                    }
                    
                    // 完成连接线绘制（不选中任何对象）
                    window.WebDrawDrawing.finishDrawingLine(this);
                }
                this.isDrawing = false;
                window.WebDrawHistory.saveState(this);
            } else if (this.isDragging && this.selectedShapes.length > 0) {
                // 拖动图形结束后保存状态
                window.WebDrawConnectorManagement.updateConnectors(this);
                window.WebDrawHistory.saveState(this);
            } else if (this.isResizing && this.selectedShapes.length === 1) {
                // 调整图形大小结束后保存状态
                window.WebDrawConnectorManagement.updateConnectors(this);
                window.WebDrawHistory.saveState(this);
                // 标记刚刚完成缩放，防止后续点击事件清除选择
                this.justFinishedResizing = true;
                // 在下一个事件循环中重置标志，避免影响后续操作
                setTimeout(() => {
                    this.justFinishedResizing = false;
                }, 100);
            }
            
            // 处理待开始的绘制：
            // 如果已经进入绘制状态（isDrawing = true），说明在 mousemove 中已经超过阈值并开始绘制
            // 此时在 mouseup 中完成绘制，不选中任何对象
            // 如果未进入绘制状态（isDrawing = false），且未超过阈值，检查是否在图形上，如果是则选中
            if (this.pendingDrawStart && !this.isDrawing) {
                // 未进入绘制状态，检查是否在图形或连接线上，如果是则选中
                const point = window.WebDrawCanvas.getSVGPoint(this, e);
                
                // 检查终点是否在图形上
                const endShape = window.WebDrawFinders.findShapeAtPoint(this, point);
                const endConnector = e.target.classList.contains('connector-line') 
                    ? window.WebDrawFinders.findConnectorByElement(this, e.target.parentElement) 
                    : null;
                
                // 如果起始位置或结束位置在图形/连接线上，则选中
                const shapeToSelect = this.pendingDrawStartShape || endShape;
                const connectorToSelect = this.pendingDrawStartConnector || endConnector;
                
                if (shapeToSelect) {
                    // 切换到选择模式并选中图形
                    this.setMode('select');
                    window.WebDrawSelection.deselectAll(this);
                    window.WebDrawSelection.selectShape(this, shapeToSelect);
                    // 更新工具栏按钮状态
                    document.querySelectorAll('[data-shape]').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    const selectBtn = document.querySelector('[data-shape="select"]');
                    if (selectBtn) {
                        selectBtn.classList.add('active');
                    }
                } else if (connectorToSelect) {
                    // 切换到选择模式并选中连接线
                    this.setMode('select');
                    window.WebDrawSelection.deselectAll(this);
                    window.WebDrawConnectorManagement.selectConnector(this, connectorToSelect.element || e.target.parentElement);
                    // 更新工具栏按钮状态
                    document.querySelectorAll('[data-shape]').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    const selectBtn = document.querySelector('[data-shape="select"]');
                    if (selectBtn) {
                        selectBtn.classList.add('active');
                    }
                }
                
                // 重置状态
                this.pendingDrawStart = null;
                this.pendingDrawStartShape = null;
                this.pendingDrawStartConnector = null;
                this.hasExceededDrawThreshold = false;
            } else if (this.pendingDrawStart && this.isDrawing) {
                // 已经进入绘制状态（在 mousemove 中已超过阈值并开始绘制）
                // 此时在 mouseup 中完成绘制，重置状态（不选中任何对象）
                // 注意：绘制完成逻辑已在上面处理（finishDrawingShape/finishDrawingLine）
                this.pendingDrawStart = null;
                this.pendingDrawStartShape = null;
                this.pendingDrawStartConnector = null;
                this.hasExceededDrawThreshold = false;
            }
            
            this.isDragging = false;
            this.isResizing = false;
            this.isDraggingConnector = false;
            this.resizeStartRadius = null;
            this.resizeStartCenter = null;
            this.resizeStartSize = null;
            this.resizeDragStartPoint = null;
            this.resizeEdge = null;
            this.resizeDragInfo = null;
            
            // 恢复鼠标样式（如果不在调整大小状态）
            if (this.svg && this.currentMode === 'select' && !this.isResizing) {
                this.svg.style.cursor = 'default';
            }
        }
        
        onDoubleClick(e) {
            // 检查是否点击了形状或形状组
            let shape = null;
            if (e.target.classList.contains('shape')) {
                shape = window.WebDrawFinders.findShapeByElement(this, e.target);
            } else if (e.target.classList.contains('shape-group') || e.target.closest('.shape-group')) {
                const groupElement = e.target.classList.contains('shape-group') ? e.target : e.target.closest('.shape-group');
                if (groupElement) {
                    const shapeId = groupElement.getAttribute('data-id');
                    shape = window.WebDrawFinders.findShapeById(this, shapeId);
                }
            } else if (e.target.classList.contains('freetext-text') || e.target.classList.contains('shape-text')) {
                // 点击了文本元素，查找对应的形状
                const groupElement = e.target.closest('.shape-group');
                if (groupElement) {
                    const shapeId = groupElement.getAttribute('data-id');
                    shape = window.WebDrawFinders.findShapeById(this, shapeId);
                }
            }
            
            if (shape) {
                window.WebDrawTextEdit.startTextEdit(this, shape);
            }
        }
        
        onCanvasClick(e) {
            if (this.currentMode === 'select') {
                // 选择模式下，点击空白区域不清除选择（除非没有按住 Ctrl）
                if (e.target === this.svg && !e.ctrlKey && !e.metaKey) {
                    // 只有在没有开始拖拽、没有选择、且没有刚刚完成缩放的情况下才清除选择
                    if (!this.isDragging && !this.isSelecting && !this.justFinishedResizing) {
                        window.WebDrawSelection.deselectAll(this);
                    }
                }
            } else {
                if (e.target === this.svg || e.target.classList.contains('connection-point')) {
                    if (!e.ctrlKey && !e.metaKey) {
                        window.WebDrawSelection.deselectAll(this);
                    }
                }
            }
        }
        

        
        selectConnector(connectorElement) {
            window.WebDrawSelection.deselectAll(this);
            const connector = window.WebDrawFinders.findConnectorByElement(this, connectorElement);
            if (connector) {
                this.selectedConnector = connector;
                if (connector.lineElement) {
                    connector.lineElement.classList.add('selected');
                }
                // 更新箭头按钮状态
                const btnLineStartArrow = document.getElementById('btn-line-start-arrow');
                const btnLineEndArrow = document.getElementById('btn-line-end-arrow');
                if (btnLineStartArrow) {
                    if (connector.startArrow) {
                        btnLineStartArrow.classList.add('active');
                    } else {
                        btnLineStartArrow.classList.remove('active');
                    }
                }
                if (btnLineEndArrow) {
                    if (connector.endArrow) {
                        btnLineEndArrow.classList.add('active');
                    } else {
                        btnLineEndArrow.classList.remove('active');
                    }
                }
                // 显示箭头设置按钮组并添加醒目样式
                const lineArrowSettings = document.getElementById('line-arrow-settings');
                if (lineArrowSettings) {
                    lineArrowSettings.style.display = 'flex';
                    lineArrowSettings.classList.add('connector-selected');
                }
                // 添加端点手柄
                window.WebDrawConnectorEndpoints.updateConnectorEndpoints(this);
                // 更新删除按钮状态
                window.WebDrawUtils.updateDeleteButtonState(this);
            }
        }

        
        
        // 删除选中的图形和连接线
        deleteSelectedShapes() {
            if (this.selectedShapes.length === 0 && !this.selectedConnector) {
                return;
            }
            
            // 收集要删除的图形 ID
            const shapeIdsToDelete = new Set();
            if (this.selectedShapes.length > 0) {
                this.selectedShapes.forEach(shape => {
                    shapeIdsToDelete.add(shape.id);
                });
            }
            
            // 收集要删除的连接线（选中的连接线，或连接到要删除图形的连接线）
            const connectorsToDelete = [];
            
            // 如果选中了连接线，也要删除
            if (this.selectedConnector) {
                connectorsToDelete.push(this.selectedConnector);
            }
            
            // 查找所有连接到要删除图形的连接线
            this.connectors.forEach(connector => {
                if (connector.startShapeId && shapeIdsToDelete.has(connector.startShapeId)) {
                    if (!connectorsToDelete.includes(connector)) {
                        connectorsToDelete.push(connector);
                    }
                }
                if (connector.endShapeId && shapeIdsToDelete.has(connector.endShapeId)) {
                    if (!connectorsToDelete.includes(connector)) {
                        connectorsToDelete.push(connector);
                    }
                }
            });
            
            // 删除连接线
            connectorsToDelete.forEach(connector => {
                if (connector.element && connector.element.parentNode) {
                    connector.element.parentNode.removeChild(connector.element);
                }
                const index = this.connectors.indexOf(connector);
                if (index > -1) {
                    this.connectors.splice(index, 1);
                }
            });
            
            // 删除图形
            this.selectedShapes.forEach(shape => {
                const elementToRemove = shape.groupElement || shape.element;
                if (elementToRemove && elementToRemove.parentNode) {
                    elementToRemove.parentNode.removeChild(elementToRemove);
                }
                const index = this.shapes.indexOf(shape);
                if (index > -1) {
                    this.shapes.splice(index, 1);
                }
            });
            
            // 清除选择状态
            window.WebDrawSelection.deselectAll(this);
            
            // 保存状态
            window.WebDrawHistory.saveState(this);
            // 更新删除按钮状态
            window.WebDrawUtils.updateDeleteButtonState(this);
        }
        
        // 清空画布
        clearCanvas() {
            if (confirm('确定要清空画布吗？\nAre you sure you want to clear the canvas?')) {
                this.shapes.forEach(s => {
                    const elementToRemove = s.groupElement || s.element;
                    if (elementToRemove && elementToRemove.parentNode) {
                        elementToRemove.parentNode.removeChild(elementToRemove);
                    }
                });
                this.connectors.forEach(c => {
                    if (c.element && c.element.parentNode) {
                        c.element.parentNode.removeChild(c.element);
                    }
                });
                this.shapes = [];
                this.connectors = [];
                window.WebDrawSelection.deselectAll(this);
                window.WebDrawHistory.saveState(this);
            }
        }
        
    }
    
    window.WebDrawApp = WebDrawApp;
})();




