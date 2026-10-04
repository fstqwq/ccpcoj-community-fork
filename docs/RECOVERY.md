# 源码恢复记录

恢复日期：2026-10-04。源码载体为 Docker Hub 的公开镜像。检索到的 GitHub CCPCOJ 仓库是旧版源码或新版文档，不能替代本次 v2 镜像恢复。

## 固定来源

| 组件 | Docker Hub | 当时版本 | linux/amd64 manifest |
|---|---|---|---|
| Web | https://hub.docker.com/r/csgrandeur/ccpcoj-web2 | latest / 2.0.40 | `sha256:f582d949207cdb68e4bfebcb9d46ed59ed7c7c013d73b391b3815c5dc6e5e0eb` |
| Judge | https://hub.docker.com/r/csgrandeur/ccpcoj-judge2 | latest / 2.0.40 | `sha256:3812e1db74519af6e3961a91954318344b397c036a47fd08edc9234337f87852` |

原始 OCI index、manifest、config、标签元数据和代码层文件列表在 `provenance/images/`。Web 的 OCI index 为 `sha256:7baa210bf886891529b4df6386be764b8bcc6e158b7632c5dd2889df125ac4fd`；Judge 为 `sha256:926a3c304d5ffc47049b697c8b52b9b199172a956d749d1f849d5525aa2649b0`。构建固定摘要，不依赖未来发生变化的 latest。

每个下载的镜像层均校验 SHA-256，按原顺序应用，处理普通 whiteout、opaque whiteout、目录、文件与链接。拒绝路径穿越和逃离根目录的符号链接，不提取设备文件，也不执行镜像内脚本。所选源码层覆盖：Web 的 26、27、28、29、30、32 层；Judge 的 9、10、11 层（0 起始编号）。

## 单仓库映射

| 镜像路径 | 仓库路径 |
|---|---|
| `/ojweb` | `ojweb/` |
| `/SQL` | `deploy/SQL/` |
| `/nginx_conf` | `deploy/nginx_conf/` |
| `/core` | `judge/core/` |
| `/judge_lib` | `judge/judge_lib/` |

`provenance/recovered-files.sha256.json` 记录改动前 7,764 个文件的哈希，便于与恢复基线比对。它描述的是恢复阶段，当前已修改/清理的文件不应继续匹配原哈希。原文档另外保存在 `deploy/upstream/`，来源为 GitHub 上的 CCPCOJ v2 文档仓库；这些原部署脚本仅作参考，本仓库统一使用根目录 Compose。

没有携带镜像中的 Web `.env`。Judge 运行配置中的服务器地址、密码及路径被替换为部署模板，镜像残留运行日志及反向代理的进程状态、生成配置被移除；随附分发工具保留。镜像配置中的历史环境变量是来源证据，Web Dockerfile 清空原有代理变量，不把它们作为新部署配置。

没有恢复到原 Git 历史、原 Docker 构建上下文、线上数据库、比赛数据或未进入镜像的开发文件。恢复时建立了新的本地 Git 基线；交付压缩包包含最终工作树，不包含原作者不存在于镜像中的 Git 历史。框架、vendor、静态资源和评测程序均保留，构建没有依赖未知私有代码仓库。

## 可重复提取

无需 Docker daemon，可用 Python 3.9+ 再次提取固定镜像中的代码树：

```sh
python3 scripts/recover_images.py /absolute/path/to/empty-recovery-directory
```

目标目录必须为空。脚本使用 Docker Registry 的公开拉取授权、校验固定 manifest 及层摘要，只提取已确认的源码层。输出为原镜像源码，不包含本仓库新规则修改。为避免误用部署凭据，脚本会删除 Web `.env`；Judge 原始配置属于恢复证据，不能直接用作正式部署配置。

新镜像的应用构建使用本仓库内容，但运行时仍来自固定上游镜像。若以后需要完全独立重建 PHP/系统依赖/编译器环境，应单独完成运行时迁移及全量兼容性验证，不能从“恢复了源码”推断此步骤已经完成。

## 参考站

用户给出的比赛页面可以访问，1026 号榜单在未登录情况下跳转比赛登录页。没有尝试绕过登录。

读取了同源公开的 `rank.js`、`rank_page.js`、`rank_tool.js`、`rank_core.js`、`rank_ccpc.js`、`rank.css` 和 `balloon_manager.js`。其中 `rank_ccpc.js` 明确包含新赛制表现逻辑；细节和差异见 [RULES.md](RULES.md)。资源 URL、字节数与哈希见 `provenance/reference-assets.json`，未把在线站点的私有后端描述为已恢复内容。
