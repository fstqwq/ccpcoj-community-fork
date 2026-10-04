/**
 * 复制粘贴相关函数
 * 提供形状和连接线的复制粘贴功能
 */
(function() {
    'use strict';
    
    const PASTE_OFFSET = window.WebDrawConstants.PASTE_OFFSET;
    const ShapeFactory = window.WebDrawShapes;
    
    window.WebDrawClipboard = {
        /**
         * 复制到剪贴板
         * @param {Object} app - WebDrawApp 实例
         */
        copyToClipboard(app) {
            if (app.selectedShapes.length === 0 && !app.selectedConnector) {
                return; // 没有选中内容，不复制
            }
            
            const data = {
                shapes: [],
                connectors: [],
                bounds: null, // 用于保持相对位置
                originalBounds: null, // 原始边界框位置（用于连续粘贴）
                pasteCount: 0 // 粘贴次数
            };
            
            // 复制选中的形状
            if (app.selectedShapes.length > 0) {
                // 计算选中形状的边界框
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                
                app.selectedShapes.forEach(shape => {
                    const bounds = shape.getBounds();
                    minX = Math.min(minX, bounds.x);
                    minY = Math.min(minY, bounds.y);
                    maxX = Math.max(maxX, bounds.x + bounds.width);
                    maxY = Math.max(maxY, bounds.y + bounds.height);
                    
                    data.shapes.push(shape.toJSON());
                });
                
                data.bounds = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };
                // 保存原始边界框位置
                data.originalBounds = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };
            }
            
            // 复制选中的连接线（如果连接线的起点和终点都在选中的形状中）
            if (app.selectedConnector) {
                data.connectors.push(app.selectedConnector.toJSON());
            } else if (app.selectedShapes.length > 0) {
                // 复制与选中形状相关的连接线
                const selectedShapeIds = new Set(app.selectedShapes.map(s => s.id));
                app.connectors.forEach(connector => {
                    if (connector.startShapeId && connector.endShapeId &&
                        selectedShapeIds.has(connector.startShapeId) &&
                        selectedShapeIds.has(connector.endShapeId)) {
                        data.connectors.push(connector.toJSON());
                    }
                });
            }
            
            app.clipboard = data;
        },
        
        /**
         * 从剪贴板粘贴
         * @param {Object} app - WebDrawApp 实例
         */
        pasteFromClipboard(app) {
            if (!app.clipboard || 
                (app.clipboard.shapes.length === 0 && app.clipboard.connectors.length === 0)) {
                return; // 剪贴板为空
            }
            
            const shapeMap = new Map(); // 旧ID -> 新形状对象
            
            // 先清除当前选择
            window.WebDrawSelection.deselectAll(app);
            
            // 粘贴形状
            app.clipboard.shapes.forEach(shapeData => {
                // 保存原始ID用于连接线映射
                const originalId = shapeData.id;
                
                // 创建新形状时，不传递ID，让构造函数生成新ID
                const shapeDataCopy = { ...shapeData };
                delete shapeDataCopy.id; // 删除ID，强制生成新ID
                
                // 使用 ShapeFactory 的 fromJSON 方法
                let shape;
                if (ShapeFactory.fromJSON) {
                    shape = ShapeFactory.fromJSON(shapeDataCopy);
                } else {
                    // 备用方法：根据类型创建形状（不传递ID）
                    switch (shapeDataCopy.type) {
                        case 'rect':
                            shape = new ShapeFactory.RectShape(shapeDataCopy.x, shapeDataCopy.y, shapeDataCopy.width, shapeDataCopy.height);
                            break;
                        case 'square':
                            shape = new ShapeFactory.SquareShape(shapeDataCopy.x, shapeDataCopy.y, shapeDataCopy.width);
                            break;
                        case 'circle':
                            shape = new ShapeFactory.CircleShape(shapeDataCopy.x, shapeDataCopy.y, shapeDataCopy.width);
                            break;
                        case 'ellipse':
                            shape = new ShapeFactory.EllipseShape(shapeDataCopy.x, shapeDataCopy.y, shapeDataCopy.width, shapeDataCopy.height);
                            break;
                        case 'diamond':
                            shape = new ShapeFactory.DiamondShape(shapeDataCopy.x, shapeDataCopy.y, shapeDataCopy.width, shapeDataCopy.height);
                            break;
                        default:
                            return;
                    }
                    shape.text = shapeDataCopy.text || '';
                    shape.textAlign = shapeDataCopy.textAlign || 'center';
                    shape.textVerticalAlign = shapeDataCopy.textVerticalAlign || 'middle';
                }
                
                // 强制生成新ID（确保粘贴的形状有独立ID，避免吸附到原始对象）
                shape.id = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
                
                // 计算偏移量（相对于原始边界框的左上角）
                if (app.clipboard.originalBounds) {
                    const offsetX = shapeData.x - app.clipboard.originalBounds.x;
                    const offsetY = shapeData.y - app.clipboard.originalBounds.y;
                    
                    // 新位置 = 原始边界框位置 + 偏移量 + (粘贴次数 + 1) * 粘贴偏移
                    const pasteOffset = (app.clipboard.pasteCount + 1) * PASTE_OFFSET;
                    shape.setPosition(
                        app.clipboard.originalBounds.x + offsetX + pasteOffset,
                        app.clipboard.originalBounds.y + offsetY + pasteOffset
                    );
                } else if (app.clipboard.bounds) {
                    // 兼容旧数据：如果没有 originalBounds，使用 bounds
                    const offsetX = shapeData.x - app.clipboard.bounds.x;
                    const offsetY = shapeData.y - app.clipboard.bounds.y;
                    const pasteOffset = (app.clipboard.pasteCount + 1) * PASTE_OFFSET;
                    shape.setPosition(
                        app.clipboard.bounds.x + offsetX + pasteOffset,
                        app.clipboard.bounds.y + offsetY + pasteOffset
                    );
                } else {
                    // 如果没有边界框，直接偏移
                    const pasteOffset = (app.clipboard.pasteCount + 1) * PASTE_OFFSET;
                    shape.move(pasteOffset, pasteOffset);
                }
                
                // 先添加到shapes数组，确保连接点计算时能找到形状
                app.shapes.push(shape);
                
                shape.createElement(app.svgGroup || app.svg);
                
                // 确保 SVG 元素的 data-id 属性使用新ID（防止吸附到原始对象）
                if (shape.element) {
                    shape.element.setAttribute('data-id', shape.id);
                }
                if (shape.groupElement) {
                    shape.groupElement.setAttribute('data-id', shape.id);
                }
                
                // 确保形状已正确更新（createElement 中已调用 update，但为了保险再调用一次）
                shape.update();
                
                window.WebDrawSelection.selectShape(app, shape);
                
                // 记录ID映射（使用原始ID）
                shapeMap.set(originalId, shape);
            });
            
            // 粘贴连接线
            const Connector = window.WebDrawConnector;
            if (Connector && app.clipboard.connectors) {
                app.clipboard.connectors.forEach(connectorData => {
                    let connector;
                    if (Connector.fromJSON) {
                        connector = Connector.fromJSON(connectorData);
                    } else {
                        // 备用方法：直接创建
                        connector = new Connector(
                            connectorData.startX || 0,
                            connectorData.startY || 0,
                            connectorData.endX || 0,
                            connectorData.endY || 0,
                            connectorData.id
                        );
                        connector.startShapeId = connectorData.startShapeId;
                        connector.endShapeId = connectorData.endShapeId;
                        connector.startPoint = connectorData.startPoint;
                        connector.endPoint = connectorData.endPoint;
                        connector.startArrow = connectorData.startArrow || false;
                        connector.endArrow = connectorData.endArrow !== undefined ? connectorData.endArrow : true;
                    }
                    
                    connector.setAppInstance(app);
                    
                    // 更新连接线的起点和终点形状ID
                    if (connectorData.startShapeId && shapeMap.has(connectorData.startShapeId)) {
                        const newShape = shapeMap.get(connectorData.startShapeId);
                        connector.startShapeId = newShape.id;
                    }
                    
                    if (connectorData.endShapeId && shapeMap.has(connectorData.endShapeId)) {
                        const newShape = shapeMap.get(connectorData.endShapeId);
                        connector.endShapeId = newShape.id;
                    }
                    
                    // 更新连接线的坐标（如果有绝对坐标）
                    if (app.clipboard.originalBounds || app.clipboard.bounds) {
                        const pasteOffset = (app.clipboard.pasteCount + 1) * PASTE_OFFSET;
                        connector.startX += pasteOffset;
                        connector.startY += pasteOffset;
                        connector.endX += pasteOffset;
                        connector.endY += pasteOffset;
                    }
                    
                    connector.createElement(app.svgGroup || app.svg);
                    app.connectors.push(connector);
                    connector.update();
                });
            }
            
            // 确保所有连接线都已更新（包括与粘贴形状相关的连接线）
            window.WebDrawConnectorManagement.updateConnectors(app);
            
            // 增加粘贴次数，为下一次粘贴做准备（实现连续粘贴时的持续偏移）
            if (app.clipboard) {
                app.clipboard.pasteCount = (app.clipboard.pasteCount || 0) + 1;
            }
            
            app.saveState();
        },
        
        /**
         * 复制选中的形状（按钮点击，立即粘贴）
         * @param {Object} app - WebDrawApp 实例
         */
        copySelectedShapes(app) {
            if (app.selectedShapes.length === 0) {
                alert('请先选择形状\nPlease select shapes first');
                return;
            }
            
            // 先复制到剪贴板（会重置 pasteCount）
            window.WebDrawClipboard.copyToClipboard(app);
            
            // 然后立即粘贴
            window.WebDrawClipboard.pasteFromClipboard(app);
        }
    };
})();

