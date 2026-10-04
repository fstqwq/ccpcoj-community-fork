# 评测机调试指南（Cursor AI 助手专用）

## 容器代称说明

本文档中的容器名称使用以下代称：
- `<judge-container>`：评测机容器名称（如：judge-fusion、judge-xxx 等）
- `<php-container>`：PHP Web 后端容器名称（如：php-fusion、php-xxx 等）

请根据实际部署环境替换为对应的容器名称。

## pytest 源码单测（仓库 `unit_tests`）

对 **`deploy_files/judge2/core` 当前分支** 做自动化实测（import + 子进程 `judge_client`）时，使用宿主机上的 **`deploy_files/unit_tests/judge2_core_local/`**。WSL 下推荐：**`start_judge2.sh` 已把源码挂到容器 `/core`**，再额外挂载 `unit_tests` 后 **`docker exec`** 执行 pytest，并设置 **`JUDGE2_CORE_LOCAL_SOURCE=/core`**。详见该目录 **`README.md`（WSL 与 Docker 评测容器）**。

## 快速调试流程

### 1. 进入评测机容器
```bash
docker exec -it <judge-container> sh -c "cd /core && bash"
```

### 2. 重置提交状态（用于反复测试）
```bash
# 单个提交
python debug/reset_solution.py <solution_id>

# 批量重置
for sid in 416395 415326 415322; do python debug/reset_solution.py $sid; done
```

### 3. 测试完整评测流程
```bash
# 测试单个提交（包含 checkout -> judge_client -> 状态检查）
python debug/test_judge_flow.py <solution_id>

# 启用详细日志
CSGOJ_LOG_LEVEL=DEBUG python debug/test_judge_flow.py <solution_id>
```

### 4. 直接执行评测客户端（跳过 checkout）
```bash
# 直接评测指定提交（用于测试 judge_client 逻辑）
python judge_client.py <solution_id> debug

# 启用详细日志
CSGOJ_LOG_LEVEL=DEBUG python judge_client.py <solution_id> debug
```

### 5. 启动评测机主进程（自动获取任务）
```bash
# 启动 judge_host（自动从后端获取 pending 任务并评测）
python judge_host.py debug

# 启用详细日志
CSGOJ_LOG_LEVEL=DEBUG python judge_host.py debug
```

## 调试脚本说明

### `reset_solution.py`
- **功能**：将提交状态重置为 Pending，用于反复测试
- **用法**：`python debug/reset_solution.py <solution_id>`
- **场景**：需要重复测试同一个提交时使用

### `test_judge_flow.py`
- **功能**：模拟完整评测流程（checkout -> judge_client -> 状态检查）
- **用法**：`python debug/test_judge_flow.py <solution_id>`
- **场景**：调试 "pending 变为 compiling 后不再变化" 等问题

### `test_similarity.py`
- **功能**：测试查重逻辑（完整流程）
- **用法**：`python debug/test_similarity.py <solution_id> [debug]`
- **场景**：调试查重功能相关问题
- **说明**：会重置提交、执行评测、触发查重，并检查查重结果

### `test_similarity_direct.py`
- **功能**：直接测试查重逻辑（不经过评测流程）
- **用法**：`python debug/test_similarity_direct.py <solution_id>`
- **场景**：快速测试查重算法本身，不涉及评测流程

### `test_similarity_with_exclude.py`
- **功能**：测试排除用户ID的查重逻辑
- **用法**：`python debug/test_similarity_with_exclude.py <solution_id>`
- **场景**：验证查重时是否正确排除当前用户的历史提交

### `check_sim_records.py`
- **功能**：检查数据库中的查重记录
- **用法**：`python debug/check_sim_records.py <solution_id>`
- **场景**：验证查重结果是否正确保存到数据库

### `debug_similarity_237031.py`
- **功能**：详细分析指定提交的查重问题（示例：237031）
- **用法**：`python debug/debug_similarity_237031.py`
- **场景**：当查重无法检测到已知的雷同代码时，使用此脚本进行详细分析
- **说明**：会逐个比较所有历史代码的相似度，找出最相似的代码，并分析为什么没有超过阈值

## 访问 Web 后端调试

### 查看提交状态
```bash
docker exec <php-container> sh -c "cd /var/www/html && php -r \"
require 'vendor/autoload.php';
\\\$app = new think\\App();
\\\$app->initialize();
\\\$s = db('solution')->where('solution_id', <solution_id>)->find();
echo json_encode(\\\$s, JSON_PRETTY_PRINT);
\""
```

### 查看评测机日志
```bash
# 评测机日志目录：/judge/logs
docker exec <judge-container> tail -f /judge/logs/judge_client.log
docker exec <judge-container> tail -f /judge/logs/judge_host.log
```

## 自动测试与修正流程

当遇到 "pending 变为 compiling 后不再变化" 等问题时：

1. **重置提交状态**：
   ```bash
   docker exec <judge-container> sh -c "cd /core && python debug/reset_solution.py <solution_id>"
   ```

2. **测试评测流程**：
   ```bash
   docker exec <judge-container> sh -c "cd /core && CSGOJ_LOG_LEVEL=DEBUG python debug/test_judge_flow.py <solution_id> 2>&1 | tail -100"
   ```

3. **检查语法错误**：
   ```bash
   docker exec <judge-container> sh -c "cd /core && python -m py_compile judge_client.py"
   ```

4. **直接测试 judge_client**：
   ```bash
   docker exec <judge-container> sh -c "cd /core && python judge_client.py <solution_id> debug 2>&1 | grep -E '(ERROR|Exception|评测完成|状态更新)'"
   ```

5. **检查后端状态更新**：
   - 查看日志中的 "任务 XXX 评测完成" 消息
   - 检查数据库中的 `result` 字段是否已更新

## 查重功能调试

### 查重功能测试流程

1. **测试完整查重流程**：
   ```bash
   docker exec <judge-container> sh -c "cd /core && python debug/test_similarity.py 415236 debug"
   ```

2. **直接测试查重算法**（跳过评测流程）：
   ```bash
   docker exec <judge-container> sh -c "cd /core && python debug/test_similarity_direct.py 415236"
   ```

3. **检查查重结果**：
   ```bash
   docker exec <judge-container> sh -c "cd /core && python debug/check_sim_records.py 415236"
   ```

### 查重相关日志

查重过程中的关键日志：
- `开始查重`：查重流程开始
- `缓存增量更新完成`：显示从缓存加载的数量、新计算的数量等
- `Winnowing 查重性能`：显示查重耗时和性能指标
- `找到 X 个相似代码`：查重结果
- `查重信息已提交`：查重结果已保存到数据库

### 查重缓存调试

查重使用增量缓存机制，缓存文件位置：
- 缓存目录：`/judge/code/{problem_id}/`
- 缓存文件：`.winnowing_cache_{language}.json`

查看缓存信息：
```bash
# 查看缓存文件
docker exec <judge-container> cat /judge/code/1203/.winnowing_cache_cpp.json | python3 -m json.tool | head -50

# 检查缓存中的代码数量
docker exec <judge-container> python3 -c "
import json
with open('/judge/code/1203/.winnowing_cache_cpp.json', 'r') as f:
    cache = json.load(f)
    print(f'缓存中的代码数量: {len(cache.get(\"fingerprints\", {}))}')
    print(f'算法版本: {cache.get(\"algorithm_version\")}')
    print(f'最后更新: {cache.get(\"last_updated\")}')
"
```

### 查重增量更新机制

查重使用增量更新机制，避免重复计算：
- **首次查重**：计算所有代码的指纹并保存到缓存
- **后续查重**：
  - 从缓存加载已有的指纹（不重新计算）
  - 只计算新增代码的指纹
  - 合并并保存到缓存

示例：200个代码 → 220个代码
- 从缓存加载200个（不计算）
- 只计算新增的20个
- 保存全部220个到缓存

查看增量更新日志：
```bash
docker exec <judge-container> sh -c "cd /core && python judge_client.py 415236 debug 2>&1 | grep -E '缓存增量更新|从缓存加载|新计算'"
```

## 常见问题排查

### 评测相关问题

- **状态卡在 compiling**：检查 `judge_client.py` 是否有语法错误或异常未捕获
- **无法 checkout**：检查 `getpending` 接口的查询条件和评测机配置
- **状态更新失败**：检查 `update_task_status` 的调用和 `updatesolution` 接口

### 查重相关问题

- **查重失败**：
  - 检查 `similarity_checker.py` 的错误日志
  - 确认查重开关已开启（`similarity_check=1`）
  - 检查代码同步是否成功（`sync_ac_codes`）
  - 验证缓存文件是否损坏（算法版本不匹配会自动清除）

- **查重结果不准确**：
  - 检查算法版本号是否匹配（`ALGORITHM_VERSION`）
  - 验证缓存是否有效（查看缓存验证日志）
  - 确认语言过滤是否正确（Python只与Python比较）
  - **相似度阈值过高**：如果代码逻辑相似但变量名不同，可能相似度较低。可以使用调试脚本测试不同阈值下的结果
  - **算法改进**：算法已优化为降低对变量名的依赖，增强代码结构相似性识别。如果仍无法检测到相似代码，可能需要进一步调整阈值

- **查重性能问题**：
  - 检查缓存是否正常工作（应该从缓存加载大部分指纹）
  - 查看增量更新日志（应该只计算新增代码）
  - 确认倒排索引是否正常（索引筛选应该大幅减少候选数量）

- **缓存相关问题**：
  - 缓存文件不存在：首次查重会创建，后续会增量更新
  - 缓存验证失败：算法版本不匹配或缓存损坏，会自动清除并重新计算
  - 增量更新异常：检查文件修改时间比较逻辑

## 关键文件位置

### 评测机容器
- **工作目录**：`/core`
- **日志目录**：`/judge/logs/`
- **代码存储目录**：`/judge/code/{problem_id}/`
- **查重缓存文件**：`/judge/code/{problem_id}/.winnowing_cache_{language}.json`

### Web 后端容器
- **容器名称**：`<php-container>`
- **工作路径**：`/var/www/html`
- **查重记录表**：`sim` 表（存储查重结果）

## 调试技巧

### 快速定位问题

1. **查看最新错误**：
   ```bash
   docker exec <judge-container> tail -100 /judge/logs/judge_client.log | grep -E "ERROR|Exception"
   ```

2. **跟踪查重流程**：
   ```bash
   docker exec <judge-container> sh -c "cd /core && python judge_client.py <solution_id> debug 2>&1 | grep -E '查重|similarity|Winnowing|缓存'"
   ```

3. **检查数据库查重记录**：
   ```bash
   docker exec <php-container> sh -c "cd /var/www/html && php -r \"
   require 'vendor/autoload.php';
   \\\$app = new think\\App();
   \\\$app->initialize();
   \\\$sim = db('sim')->where('s_id', <solution_id>)->find();
   echo json_encode(\\\$sim, JSON_PRETTY_PRINT);
   \""
   ```

### 性能分析

查看查重性能指标：
```bash
docker exec <judge-container> sh -c "cd /core && python judge_client.py <solution_id> debug 2>&1 | grep 'Winnowing 查重性能'"
```

输出示例：
```
Winnowing 查重性能: 总耗时=2.57ms, 指纹计算=0.74ms, 索引筛选=0.06ms (候选: 518/518), 精确比较=1.77ms, 找到1个相似代码
```

- **总耗时**：整个查重过程的耗时
- **指纹计算**：计算新代码指纹的耗时
- **索引筛选**：使用倒排索引筛选候选代码的耗时
- **精确比较**：对候选代码进行精确相似度计算的耗时

