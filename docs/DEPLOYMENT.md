# 部署与运行

2026-10-05 实机修正版已修复启动、账号兼容及评测沙箱配置；首次部署前同时阅读 [部署修复记录](DEPLOYMENT_FIXES_20261005.md)。

## 1. 环境与边界

目标为 Linux x86_64。Compose 中 Web、Judge、MySQL、Nginx 均锁定 linux/amd64 镜像摘要；ARM 主机没有在本次工作中验证。宿主机需要 Docker Engine、Compose v2，首次启动需要访问 Docker Hub。Python 3 仅用于生成配置与本地测试。

Web 保留镜像原有 PHP 7.4/ThinkPHP 5.1 运行时；Judge 保留原 Ubuntu 运行时。Dockerfile 将本仓库源码覆盖到 `/ojweb`、`/core`、`/judge_lib`，所以修改后必须重新 build。该方案能复现应用源码构建，仍依赖上游运行时镜像可用。正式部署前可将固定摘要镜像同步到自己的镜像仓库。

Judge profile 继承评测程序对特权容器的需求；用于运行参赛代码的主机应专用、隔离，不挂载宿主机敏感目录。默认 Compose 适合单机验收，正式比赛按实际队伍数和提交峰值做压测；本次没有给出未经测量的容量承诺。

## 2. 首次启动

在仓库根目录执行：

```sh
python3 scripts/init_env.py
docker compose config --quiet
docker compose up -d --build
docker compose --profile judge up -d --build judge
docker compose ps
docker compose logs --tail=100 web judge
```

`init_env.py` 创建权限 0600 的 `.env`，为数据库、管理员、评测机和 CCPC HMAC 独立生成随机值。文件已存在时退出，防止误换密钥。不要直接把 `.env.example` 的占位符用于部署。

默认站点为 `http://127.0.0.1:20080/cpcsys/contest`。需要局域网直连时，在 `.env` 中设置 `OJ_BIND=0.0.0.0` 后重新 `docker compose up -d`；对外提供服务时由自己的 HTTPS 反向代理转发到该端口。Compose 不发布 MySQL 和 PHP-FPM 端口。

启动次序为数据库健康检查 → Web 建表/迁移/初始化账号 → FPM → Nginx。Web 初始化失败会退出，不会启动一个未完成建表的应用。

| 配置 | 用途 |
|---|---|
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码，用于数据库维护 |
| `DB_PASSWORD` | 应用 `ccpcoj` 数据库用户密码 |
| `ADMIN_PASSWORD` | 首次创建全局 `admin` 账号的密码 |
| `JUDGER_PASSWORD` | 首次创建全局 `judger` 账号的密码，同时传给 Judge |
| `CCPC_HMAC_KEY` | 隐藏题匿名键和队伍气球颜色排列的稳定密钥，至少 32 字符 |
| `APP_TIMEZONE` | 默认 `Asia/Macau`；Web、数据库与评测机保持一致 |
| `OJ_BIND`、`OJ_PORT` | 默认 `127.0.0.1:20080` |

已有 `admin` 或 `judger` 时，初始化程序既不改密码也不追加权限。升级已有站点需要使用站点现有管理员/评测账号，并使 `JUDGER_PASSWORD` 与实际账号一致。只改环境变量不能修改已存在的数据库用户密码。

原入口脚本会把应用配置持久化到 Web 卷内 `.env`。**已有实例修改数据库连接或时区时，也要同步修改卷中的 `/var/www/ccpc/.env`**，再重建 Web 容器；仅改 Compose 环境变量可能造成 Python 与 PHP 配置不一致。`CCPC_HMAC_KEY` 由 FPM 环境传入，无需写入应用 `.env`。

## 3. 比赛与气球设置

1. 使用全局管理员进入比赛管理，创建 CPC 比赛，导入题目、参赛队伍及工作人员。
2. 在比赛编辑页选择 `CCPC 2026`。保存后固定比赛最后 60 分钟封榜；旧比赛默认 `ICPC / XCPC`。
3. 揭示策略默认 `min(50, floor(20% × 队伍数))`，下限为 1，与参考站前端默认值一致；也可明确选择固定 50 或仅 20%。队伍数包含参赛与打星队，排除工作人员。比赛中不要变更参赛名单或策略。
4. 设置 `frozen_after`：0 表示比赛结束时公布结果，正数表示结束后继续封榜相应分钟。裁判视图始终可以查看真实结果；公开预览遵守匿名和封榜规则。
5. 在 **比赛开始前** 确定 `ojweb/config/ccpc_palette.json`。普通气球必须至少有题目数那么多种不同颜色/名称；默认提供 26 种。黑色 `#000000`、名称 `FB` 预留给全场首血。实际采购、编号和打印标签要与文件对应。
6. 完成比赛前的测试后固定 `CCPC_HMAC_KEY`、题目顺序及色板。它们在整场比赛与重启间保持不变；队伍不知道预先映射。首血统一使用黑色 `FB`，普通 AC 使用各队独立的确定性随机排列。

色板是配置文件，修改后重新 build Web。如需挂载自定义色板，可在自有 Compose override 中只读挂载文件，并设置 `CCPC_PALETTE_FILE` 为容器内绝对路径。

封榜开始时，服务端停止返回可发放气球队列，并拒绝通知、分配和发放操作；可退回已有气球。打印模块也会根据服务器时钟偏移拒绝处理过期队列。封榜前已经打印的小票和已在配送途中的实物，需要现场工作人员按停止发放规则处理。

## 4. 启动后的验收

本节是部署主机上需要执行的验收步骤，**不是已在当前工作环境完成的结果**。

```sh
docker compose ps
docker compose exec -T nginx nginx -t
curl -f http://127.0.0.1:20080/cpcsys/contest
docker compose exec -T web php /tests/ccpc_rules_test.php
docker compose exec -T web php /tests/ccpc_endpoint_test.php
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW COLUMNS FROM contest LIKE '\''contest_rank_kind'\''; SHOW COLUMNS FROM contest LIKE '\''ccpc_reveal_policy'\'';"'
```

用一个独立测试比赛做以下验收；可缩短距离封榜的等待时间，但比赛总时长应大于 1 小时。

| 场景 | 预期 |
|---|---|
| 10 队、5 题，尚无提交 | 公开榜保留全部队伍和 5 个空白格；题号尚未公开 |
| 两支队伍 AC 同一题 | 默认阈值 2，该题成为左侧按题号对齐的公开列 |
| 不同题先后 AC / WA | 隐藏区先 AC，按首次 AC 时间；再未 AC 提交，按最后提交时间；空白格最后 |
| 同队 AC 后再次 WA/AC | 数量、罚时、格子顺序、气球队列均不增加 |
| 恰好封榜时 AC | 所有题号恢复标准排列；该提交保持 pending，总解题数与罚时不公开变化 |
| 封榜期间实际 AC 后重复提交 | 只计到第一条真实 AC，后续仍忽略 |
| 打星队先 AC、正式队后 AC | 首血只有最早一队；正式队得到普通的队伍专属颜色 |
| 封榜后的旧气球页面 | 刷新后无待发队列；即使旧页发送操作也被服务端拒绝 |
| 普通队伍查询其他队伍提交 | 比赛列表只返回自己的提交，单条查询拒绝；公开 CCS 原始事件接口拒绝 |
| 裁判榜与公开预览 | 裁判有真实题号/结果，公开预览仍隐藏 |
| 重启 Web/Judge | 排名、匿名题键、气球配色不变 |
| ICPC 比赛回归 | 传统题号对齐、罚时、提交与榜单继续工作 |

还应导入一个有可靠答案的 A+B 题，用 AC、WA、编译错误、超时程序分别走一遍实际评测，查看 Web/Judge 日志与返回状态。浏览器检查比赛编辑保存、公开榜、裁判榜、直播榜、气球队列及打印预览；打印机连接和实物色板也要现场确认。

## 5. 持久化与备份

Compose 默认项目名为 `ccpcoj`，主要卷如下：

| 卷 | 内容 |
|---|---|
| `ccpcoj_mysql-data` | MySQL 数据 |
| `ccpcoj_web-data` | 应用配置、上传文件、共享静态资源 |
| `ccpcoj_judge-data` | Web 侧题目测试数据 |
| `ccpcoj_nginx-conf` | 生成的 Nginx 站点配置 |
| `ccpcoj_judge-work` | Judge 工作目录、同步数据与日志 |

备份数据库、上传文件、题目数据和 **`.env` 中的 HMAC 密钥**。以下示例以停机一致性备份为目标，正式比赛中不要执行停机命令。

```sh
mkdir -p backup
chmod 700 backup
docker compose stop nginx judge web
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root --single-transaction --routines --triggers --no-tablespaces "$MYSQL_DATABASE"' > backup/database.sql
docker compose run --rm --no-deps --entrypoint sh -v "$PWD/backup:/backup" web -c 'tar czf /backup/web-and-problems.tar.gz /var/www /home/judge/data /etc/nginx/conf.d'
cp .env backup/deployment.env
chmod 600 backup/*
docker compose up -d
docker compose --profile judge up -d judge
```

备份应复制到另一台机器并演练恢复。不要使用 `docker compose down -v` 作为普通重启命令，它会删除持久卷。

恢复到已有空初始化实例时，先停 Web/Nginx/Judge，再导入数据库并解包文件；恢复与该备份一致的 `.env`，确保数据库密码也匹配。

```sh
docker compose stop nginx judge web
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root "$MYSQL_DATABASE"' < backup/database.sql
docker compose run --rm --no-deps --entrypoint sh -v "$PWD/backup:/backup:ro" web -c 'tar xzf /backup/web-and-problems.tar.gz -C /'
docker compose up -d --force-recreate web nginx
docker compose --profile judge up -d --force-recreate judge
```

## 6. 从已有 2.0.40 升级与回滚

先备份并在副本验收。将现有数据库和上传/题目数据导入上述实例，或自行通过 Compose override 连接现有数据库及卷。不要对有数据的数据库手工导入基线 SQL。

Web 启动的 `ccpc_migrate.py` 使用数据库锁和 `information_schema` 检查，只补充 `contest.contest_rank_kind`、`contest.ccpc_reveal_policy` 两列。可重复执行，已有比赛默认仍为 `icpc`，不会自动改变比赛赛制。镜像没有提供完整的历史 `db_update.sql`，因此本迁移只承诺基于恢复出的 2.0.40 数据库，不承诺直接升级任意更老版本。

升级应用：

```sh
docker compose build web judge
docker compose up -d --force-recreate web nginx
docker compose --profile judge up -d --force-recreate judge
```

重新创建 Web 容器会更新共享静态资源，修改过的 JS 引用也已更新版本号。若仍看见旧榜单，确认浏览器载入 `?v=20261004_ccpc1` 的脚本，并强制刷新。生产 OPcache 关闭时间戳检测，不能仅在正在运行的容器里改 PHP 文件后期待立即生效。

仅停用新赛制时，在比赛编辑中改回 ICPC 即可。回滚应用版本需要同时恢复对应静态资源；两列扩展字段可保留。涉及已经发生的比赛数据变更时，使用完整备份恢复，避免只回滚代码而保留不匹配的状态。维护操作应安排在比赛外。

## 7. 常见定位

- Web 不健康：检查日志中的 MySQL 连接、DDL 权限、账号初始化、`CCPC_HMAC_KEY` 长度错误。
- 502：检查 `web` 健康状态、Nginx `php-ccpc:9000` 解析以及共享配置卷；`nginx -t` 后重启 Nginx。
- 配色错误：确认 Web 密钥与色板未改变、题目顺序未改变；检查普通色板数量、重复颜色和预留 `FB`。
- Judge 容器 Up 但没有评测：原 Judge 入口在 Python 退出后保留容器用于调试，必须检查日志，不能仅依赖容器 Up 状态；检查评测账号、特权模式与站点连接。
- 公开榜没有原始提交事件：这是 CCPC 公开快照接口的行为。公开榜不提供历史拖动回放；需要全量数据的 CCS/滚榜工具使用裁判凭据，在受控环境中操作。

本次验证与剩余限制见 [VERIFICATION.md](VERIFICATION.md)。
