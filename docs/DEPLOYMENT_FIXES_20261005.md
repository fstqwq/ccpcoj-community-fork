# 2026-10-05 实机部署修复

验证环境：DigitalOcean，Ubuntu 24.04 x86_64，2 vCPU / 2GB 内存，另配 2GB swap；Docker 29.1.3，Compose 2.40.3。此补丁包不含服务器 `.env`、账号密码、比赛数据或用户后续提供的题目包。

## 已修复

1. Web 的 PyMySQL 缺少 RSA 认证依赖，无法首次连接 MySQL 8.4。Dockerfile 安装 `PyMySQL[rsa]`；实机安装 cryptography 50.0.2、cffi 2.1.1、pycparser 3.0。
2. Nginx 镜像在共享配置卷内写入 `default.conf`，优先匹配而使网站和 Judge API 返回 404。Web 启动时将其重命名为 `default.conf.disabled`，保留应用配置。
3. 初始化 `judger` 使用 `password_hash`，但 Judge2 API 只按旧的可逆加密验证。现在识别标准密码哈希并使用 `password_verify`；旧账号继续走原加密验证。正确密码登录通过，错误密码仍被拒绝。
4. `users.language` 默认 1 被评测端解释为只允许 C 的位掩码，使 C++ 提交永久排队。新建 judger 设置为 0（所有已启用语言）。已有用户不被启动脚本覆盖；受影响的旧实例需在管理页面调整该评测机的语言限制。
5. Judge Compose 补齐 `cgroup: host` 和 `shm_size: 1gb`。前者满足此评测程序的 cgroup v2 内存/CPU控制需求，后者满足共享工作区要求。仍使用原项目的特权 Judge 容器，应部署在专用测试/评测机；没有新增宿主机目录挂载或 PID 共享。
6. 沙箱挂载检测把“某个祖先位于 Docker 卷”误当成“目标目录已挂载”，导致编译器和动态链接器未挂入 jail，所有程序报 `g++` 不存在。改为检查精确挂载点，并补充祖先卷/精确挂载点两个回归测试。
7. Web 重建后旧 cookie 失效，Judge 从磁盘恢复的无域 cookie 遮蔽新 cookie，进入重新登录循环。重新认证前清空此专用 HTTP 会话的 cookie，保留现有密码和权限，并补充回归测试。

## 已完成的验证

- 全栈四个服务启动；MySQL / Web 健康检查通过。
- Nginx 配置校验通过；公网比赛页返回 HTTP 200。
- PHP 规则 56 项及生产接口/权限断言 13 项通过（后者数据库边界使用桩）。
- 真实 A+B 评测：AC=4、WA=6、CE=11、TLE=7，均符合预期。
- 新增挂载检测回归测试通过；评测重新认证修复在 Web 重建后的实机链路验证。
- 比赛 1000 的线上榜单页面包含 `contest_rank_kind: "ccpc"`，并加载 `rank_ccpc.js`；保持原有 Standard / Running 标签行为。

后续比赛导入及逐题标程的结果另见交付的部署记录。上述验证不等同于正式比赛并发压测、完整权限审计、打印机验收或备份恢复演练。

## 使用修正版

### Default FAQ and toolchain

New installations include the Chinese/English FAQ without database article setup. Its commands use the active judge configuration. Defaults and judge fallbacks now use C23 / C++23 with O2. The judge Dockerfile installs the exact OpenJDK and Ubuntu base-files package revisions in `ojweb/config/judge_environment.json`, preserves the pinned base image's GCC/Python versions, and verifies all four version strings at build time. FAQ environment labels read the same manifest.

The reference is https://cpc.csgrandeur.cn/csgoj/faqs. Ubuntu's OpenJDK package revision is documented at https://packages.ubuntu.com/noble-updates/openjdk-21-jdk-headless. Existing instance configuration files are not overwritten by these new defaults. Administrator-provided FAQ articles remain available as site-specific notes.

Command consistency checks: export `php tests/faq_commands_export.php` to JSON using the web PHP runtime, then run `python3 tests/test_faq_commands.py <json-path>` using the Linux judge environment. The check compares C, C++, Java and Python commands for both default and customized settings.

全新实例按 README 操作。默认仍绑定 `127.0.0.1:20080`；需要公网临时测试时，在私有 `.env` 里设置 `OJ_BIND=0.0.0.0`、`OJ_PORT=80`。正式使用应配置 HTTPS。

已有实例保留原 `.env` 和数据卷，更新文件后运行：

```sh
docker compose --profile judge build web judge
docker compose --profile judge up -d
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
docker compose ps
```

不要删除数据卷。只改宿主机源码不能更新已运行的镜像；需重新 build。

## 可选：同机运行三个评测实例

保留默认单实例。若需要在同一服务器上超售三个实例，运行：

```sh
docker compose -f compose.yaml -f compose.workers.yaml --profile judge up -d
```

附加的两个实例使用各自独立的工作卷，共用原有判题账号和原有队列排序。三个实例共享宿主机 CPU/内存；这会提高同时处理能力，但不增加物理资源。此配置已在上述 2c2g 测试机运行。

并发限制：实机观察到两个实例可能同时领取同一提交。原 `getpending` 的查询与状态更新不是原子操作；本次按用户要求保留队列代码，没有修复这一领取竞争。三个实例的启动和完成评测验证不能替代并发可靠性验收。
