# Web Draw 模块化结构说明

## 目录结构

```
webdraw/
├── shapes/              # 形状相关类
│   ├── Shape.js        # 形状基类
│   ├── RectShape.js    # 矩形
│   ├── SquareShape.js  # 正方形
│   ├── CircleShape.js  # 正圆
│   ├── EllipseShape.js # 椭圆
│   ├── DiamondShape.js # 菱形
│   └── index.js        # 形状工厂（统一导出）
├── connectors/          # 连接线相关
│   └── Connector.js    # 连接线类
├── utils/              # 工具函数
│   ├── constants.js    # 常量定义
│   ├── export.js       # 导出功能
│   └── storage.js      # 存储功能
├── funcs/              # 通用功能函数模块
│   ├── finders.js     # 查找相关函数
│   ├── selection.js    # 选择管理相关函数
│   ├── alignment.js   # 对齐和分布相关函数
│   ├── clipboard.js   # 复制粘贴相关函数
│   └── connectorManagement.js  # 连接线管理相关函数
├── WebDrawApp.js       # 主应用类
├── webdraw.js          # 入口文件
├── webdraw.css         # 样式文件
└── README.md           # 本文件
```

## 模块说明

### shapes/
所有形状类的基类和实现，使用面向对象设计，支持：
- 坐标和尺寸管理
- 文本内容和对齐方式
- JSON 序列化/反序列化
- 连接点管理

### connectors/
连接线类，支持：
- 形状之间的连接
- 箭头设置
- 自动吸附到形状连接点

### utils/
工具函数模块：
- `constants.js`: 全局常量
- `export.js`: 导出为 SVG/PNG/JPG
- `storage.js`: IndexedDB 存储管理

### funcs/
通用功能函数模块，提供可复用的功能：
- `finders.js`: 形状和连接线的查找功能
- `selection.js`: 形状和连接线的选择管理
- `alignment.js`: 形状的对齐和分布功能
- `clipboard.js`: 复制粘贴功能
- `connectorManagement.js`: 连接线的选择、更新、端点管理等功能

### WebDrawApp.js
主应用类，负责：
- 事件处理
- 形状和连接线的管理
- 撤销/重做
- UI 交互
- 调用 funcs/ 中的通用函数模块

## 加载顺序

在视图文件中，需要按以下顺序加载模块：

1. `utils/constants.js` - 常量定义
2. `shapes/Shape.js` - 形状基类
3. `shapes/*.js` - 各个形状子类
4. `shapes/index.js` - 形状工厂
5. `connectors/Connector.js` - 连接线类
6. `utils/export.js` - 导出工具
7. `utils/storage.js` - 存储工具
8. `funcs/finders.js` - 查找相关函数
9. `funcs/selection.js` - 选择管理相关函数
10. `funcs/alignment.js` - 对齐和分布相关函数
11. `funcs/clipboard.js` - 复制粘贴相关函数
12. `funcs/connectorManagement.js` - 连接线管理相关函数
13. `WebDrawApp.js` - 主应用类
14. `webdraw.js` - 入口文件（初始化）

## 优势

1. **模块化**: 每个功能独立成文件，便于维护
2. **可扩展**: 添加新形状只需创建新的形状类文件
3. **可测试**: 每个模块可以独立测试
4. **清晰的结构**: 目录结构清晰，易于理解
5. **面向对象**: 使用类继承，代码复用性高

