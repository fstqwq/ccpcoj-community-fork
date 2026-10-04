---
name: 自签名外榜临时 SSL
description: 由现有 HTTP 的 OJ nginx conf 派生同目录 `*-ssl.conf`（默认 listen+2）、在 attach 生成自签名证书，供 HTTPS 管理页推送外榜；脚本可 SSH 远端并 `docker restart nginx-server`。
---

# 自签名外榜临时 SSL（外榜接收端）

## 适用

- 推送源站管理页是 **HTTPS**，接收端接口必须是 **https**，且暂无正式证书。
- TLS 在 nginx 上**必须**有证书材料；**自签名**等价于「无 CA 的临时证书」，浏览器会提示风险，需用户点继续。

## 一键（不依赖 AI）

在**仓库根**或任意目录（脚本无模板依赖，单文件可复制到接收机）：

```bash
python3 deploy_files/nginx_conf/自签名外榜临时ssl/manage_outrank_temp_ssl_conf.py add oj-acm.conf csgrandeur@接收机IP --restart
```

- 默认读取远端 **`/csgoj_data/nginx/nginx_conf.d/oj-acm.conf`**，生成 **`oj-acm-ssl.conf`**，**SSL 端口 = 原 HTTP listen + 2**（如 20100→20102）。
- 证书写入 **`/csgoj_data/nginx/attach/outrank-temp-<stem>-<端口>.crt|.key`**；conf 内路径为 **`/etc/nginx/attach/…`**（与 Basic 口令同挂载，见 **`docs/guide/16.Nginx配置与局域网考试反向代理.md`** §3）。

### 常用参数

| 参数 | 含义 |
|------|------|
| `--ssl-port N` | 固定 SSL 端口（不写则用 HTTP+`--http-delta`） |
| `--http-delta 2` | 未写 `--ssl-port` 时：`ssl = http + delta` |
| `--conf-d` / `--attach` | 覆盖默认 `nginx_conf.d` / `attach` 宿主机路径 |
| `--dry-run` | 只打印，不写盘 |
| `--restart` | 成功后 **`docker restart nginx-server`**（本地或经 SSH） |

### 卸载

```bash
python3 deploy_files/nginx_conf/自签名外榜临时ssl/manage_outrank_temp_ssl_conf.py remove oj-acm-ssl.conf csgrandeur@接收机IP --delete-certs --restart
```

不加 **`--delete-certs`** 则只删 conf，保留 attach 下 crt/key。

### 自检

```bash
python3 deploy_files/nginx_conf/自签名外榜临时ssl/manage_outrank_temp_ssl_conf.py --self-test
```

## 与 `update_nginx_oj_confs.py` 的关系

- **`update_nginx_oj_confs.py`**：把 conf 与仓库 **`oj.*.template`** 对齐（HTTP / 443 等）。
- **`manage_outrank_temp_ssl_conf.py`**：以**当前 HTTP conf 正文**为蓝本生成额外 **`stem-ssl.conf`**，不改原 HTTP conf；二者职责分离。

## 推送侧配置

接收端 HTTPS 就绪后，源站「外榜接口地址」改为 **`https://主机:SSL端口/outrank/index/receive_data`**（JSONP 与 POST 均走加密）。
