/**
 * 连接线类
 */
(function() {
    'use strict';
    
    const SVG_NS = window.WebDrawConstants.SVG_NS;
    
    class Connector {
        constructor(startX, startY, endX, endY, id = null) {
            this.id = id || `connector-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
            this.startX = startX;
            this.startY = startY;
            this.endX = endX;
            this.endY = endY;
            this.startShapeId = null;
            this.endShapeId = null;
            this.startPoint = null;
            this.endPoint = null;
            this.startArrow = false;
            this.endArrow = true;
            this.element = null;
            this.lineElement = null;
            this.appInstance = null; // 将在创建时设置
        }
        
        setAppInstance(app) {
            this.appInstance = app;
        }
        
        createElement(svg) {
            const g = document.createElementNS(SVG_NS, 'g');
            g.setAttribute('class', 'connector');
            g.setAttribute('data-id', this.id);
            
            this.lineElement = document.createElementNS(SVG_NS, 'path');
            this.lineElement.setAttribute('class', 'connector-line');
            this.update();
            
            g.appendChild(this.lineElement);
            this.element = g;
            svg.appendChild(g);
            return g;
        }
        
        update() {
            if (!this.lineElement) return;
            
            let x1, y1, x2, y2;
            
            if (this.startShapeId && this.startPoint && this.appInstance) {
                const shape = window.WebDrawFinders.findShapeById(this.appInstance, this.startShapeId);
                if (shape) {
                    const connectionPoints = shape.getConnectionPoints();
                    const point = connectionPoints.find(p => p.name === this.startPoint);
                    if (point) {
                        x1 = point.x;
                        y1 = point.y;
                    } else {
                        x1 = this.startX;
                        y1 = this.startY;
                    }
                } else {
                    x1 = this.startX;
                    y1 = this.startY;
                }
            } else {
                x1 = this.startX;
                y1 = this.startY;
            }
            
            if (this.endShapeId && this.endPoint && this.appInstance) {
                const shape = window.WebDrawFinders.findShapeById(this.appInstance, this.endShapeId);
                if (shape) {
                    const connectionPoints = shape.getConnectionPoints();
                    const point = connectionPoints.find(p => p.name === this.endPoint);
                    if (point) {
                        x2 = point.x;
                        y2 = point.y;
                    } else {
                        x2 = this.endX;
                        y2 = this.endY;
                    }
                } else {
                    x2 = this.endX;
                    y2 = this.endY;
                }
            } else {
                x2 = this.endX;
                y2 = this.endY;
            }
            
            this.lineElement.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
            
            // 设置箭头
            this.lineElement.removeAttribute('marker-start');
            this.lineElement.removeAttribute('marker-end');
            if (this.startArrow) {
                this.lineElement.setAttribute('marker-start', 'url(#arrow-start)');
            }
            if (this.endArrow) {
                this.lineElement.setAttribute('marker-end', 'url(#arrow-end)');
            }
        }
        
        toJSON() {
            return {
                id: this.id,
                startX: this.startX,
                startY: this.startY,
                endX: this.endX,
                endY: this.endY,
                startShapeId: this.startShapeId,
                endShapeId: this.endShapeId,
                startPoint: this.startPoint,
                endPoint: this.endPoint,
                startArrow: this.startArrow,
                endArrow: this.endArrow
            };
        }
        
        static fromJSON(data) {
            const connector = new Connector(data.startX, data.startY, data.endX, data.endY, data.id);
            connector.startShapeId = data.startShapeId || null;
            connector.endShapeId = data.endShapeId || null;
            connector.startPoint = data.startPoint || null;
            connector.endPoint = data.endPoint || null;
            connector.startArrow = data.startArrow || false;
            connector.endArrow = data.endArrow !== undefined ? data.endArrow : true;
            return connector;
        }
        
        clone() {
            const data = this.toJSON();
            const cloned = Connector.fromJSON(data);
            cloned.id = `connector-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
            return cloned;
        }
        
        /**
         * 开始拖动整个连接线
         * @param {Object} point - 拖动起始点 {x, y}
         */
        startDrag(point) {
            this._dragStartX = this.startX;
            this._dragStartY = this.startY;
            this._dragEndX = this.endX;
            this._dragEndY = this.endY;
            this._dragOffsetX = 0;
            this._dragOffsetY = 0;
            
            // 如果连接线吸附到图形，先解除吸附并获取实际坐标
            if (this.startShapeId && this.startPoint && this.appInstance) {
                const shape = window.WebDrawFinders ? window.WebDrawFinders.findShapeById(this.appInstance, this.startShapeId) : null;
                if (shape) {
                    const connectionPoint = shape.getConnectionPoints().find(p => p.name === this.startPoint);
                    if (connectionPoint) {
                        this.startX = connectionPoint.x;
                        this.startY = connectionPoint.y;
                    }
                }
                this.startShapeId = null;
                this.startPoint = null;
            }
            
            if (this.endShapeId && this.endPoint && this.appInstance) {
                const shape = window.WebDrawFinders ? window.WebDrawFinders.findShapeById(this.appInstance, this.endShapeId) : null;
                if (shape) {
                    const connectionPoint = shape.getConnectionPoints().find(p => p.name === this.endPoint);
                    if (connectionPoint) {
                        this.endX = connectionPoint.x;
                        this.endY = connectionPoint.y;
                    }
                }
                this.endShapeId = null;
                this.endPoint = null;
            }
        }
        
        /**
         * 更新拖动位置
         * @param {Object} point - 当前点 {x, y}
         * @param {Object} dragStartPoint - 拖动起始点 {x, y}
         */
        updateDrag(point, dragStartPoint) {
            const dx = point.x - dragStartPoint.x;
            const dy = point.y - dragStartPoint.y;
            
            this.startX = this._dragStartX + dx;
            this.startY = this._dragStartY + dy;
            this.endX = this._dragEndX + dx;
            this.endY = this._dragEndY + dy;
            
            this.update();
        }
        
        /**
         * 完成拖动，尝试吸附到图形
         * @param {Object} app - WebDrawApp 实例
         * @param {Object} point - 拖动结束点 {x, y}
         */
        finishDrag(app, point) {
            const SNAP_DISTANCE = window.WebDrawConstants?.SNAP_DISTANCE || 15;
            
            // 检查起点是否可以吸附
            let nearestStartShape = null;
            let nearestStartPoint = null;
            let minStartDist = Infinity;
            
            app.shapes.forEach(shape => {
                const points = shape.getConnectionPoints();
                points.forEach(p => {
                    const dist = Math.sqrt(Math.pow(p.x - this.startX, 2) + Math.pow(p.y - this.startY, 2));
                    if (dist < minStartDist && dist <= SNAP_DISTANCE) {
                        minStartDist = dist;
                        nearestStartShape = shape;
                        nearestStartPoint = p;
                    }
                });
            });
            
            // 检查终点是否可以吸附
            let nearestEndShape = null;
            let nearestEndPoint = null;
            let minEndDist = Infinity;
            
            app.shapes.forEach(shape => {
                const points = shape.getConnectionPoints();
                points.forEach(p => {
                    const dist = Math.sqrt(Math.pow(p.x - this.endX, 2) + Math.pow(p.y - this.endY, 2));
                    if (dist < minEndDist && dist <= SNAP_DISTANCE) {
                        minEndDist = dist;
                        nearestEndShape = shape;
                        nearestEndPoint = p;
                    }
                });
            });
            
            // 应用吸附
            if (nearestStartShape && nearestStartPoint) {
                this.startShapeId = nearestStartShape.id;
                this.startPoint = nearestStartPoint.name;
                this.startX = nearestStartPoint.x;
                this.startY = nearestStartPoint.y;
            }
            
            if (nearestEndShape && nearestEndPoint) {
                this.endShapeId = nearestEndShape.id;
                this.endPoint = nearestEndPoint.name;
                this.endX = nearestEndPoint.x;
                this.endY = nearestEndPoint.y;
            }
            
            this.update();
            
            // 清理拖动状态
            this._dragStartX = null;
            this._dragStartY = null;
            this._dragEndX = null;
            this._dragEndY = null;
        }
        
        /**
         * 获取实际坐标（考虑吸附）
         * @returns {Object} {startX, startY, endX, endY}
         */
        getActualCoordinates() {
            let startX = this.startX;
            let startY = this.startY;
            let endX = this.endX;
            let endY = this.endY;
            
            if (this.startShapeId && this.startPoint && this.appInstance) {
                const shape = window.WebDrawFinders ? window.WebDrawFinders.findShapeById(this.appInstance, this.startShapeId) : null;
                if (shape) {
                    const point = shape.getConnectionPoints().find(p => p.name === this.startPoint);
                    if (point) {
                        startX = point.x;
                        startY = point.y;
                    }
                }
            }
            
            if (this.endShapeId && this.endPoint && this.appInstance) {
                const shape = window.WebDrawFinders ? window.WebDrawFinders.findShapeById(this.appInstance, this.endShapeId) : null;
                if (shape) {
                    const point = shape.getConnectionPoints().find(p => p.name === this.endPoint);
                    if (point) {
                        endX = point.x;
                        endY = point.y;
                    }
                }
            }
            
            return { startX, startY, endX, endY };
        }
    }
    
    window.WebDrawConnector = Connector;
})();

