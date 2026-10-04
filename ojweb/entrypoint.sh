#!/bin/sh

# ============================================
# 根据 CSGOJ_DEV 动态生成 OPcache 覆盖片段（最佳实践）
# - 不直接修改 /usr/local/etc/php/php.ini（避免 bind-mount 时“改坏仓库文件”）
# - 使用 /usr/local/etc/php/conf.d/*.ini 机制覆盖配置（更标准、可叠加、易维护）
# ============================================
PHP_INI_OVERRIDE_DIR="/usr/local/etc/php/conf.d"
# 注意：conf.d 会按文件名排序加载；为了确保一定覆盖 docker-php-ext-*.ini（字母开头），这里用 zz 前缀保证最后生效
PHP_OPCACHE_OVERRIDE_FILE="$PHP_INI_OVERRIDE_DIR/zz-csgoj-opcache-runtime.ini"

mkdir -p "$PHP_INI_OVERRIDE_DIR"

if [ "$CSGOJ_DEV" = "1" ]; then
    # 开发环境：启用时间戳验证；revalidate_freq=0 表示每次请求都检查（最接近“立即生效”）
    cat > "$PHP_OPCACHE_OVERRIDE_FILE" <<'EOF'
[opcache]
opcache.validate_timestamps = 1
opcache.revalidate_freq = 0
EOF
    echo "🔧 OPcache configured for DEVELOPMENT via conf.d: validate_timestamps=1, revalidate_freq=0"
else
    # 生产环境：关闭时间戳验证（性能最优）
    cat > "$PHP_OPCACHE_OVERRIDE_FILE" <<'EOF'
[opcache]
opcache.validate_timestamps = 0
opcache.revalidate_freq = 0
EOF
    echo "⚡ OPcache configured for PRODUCTION via conf.d: validate_timestamps=0, revalidate_freq=0"
fi

# init nginx config
if [ ! -f /etc/nginx/conf.d/oj-$OJ_NAME.conf ]; then
    TARGET_CONF="/etc/nginx/conf.d/oj-$OJ_NAME.conf"

    # 规范化 SSL 开关：仅当 WEB_SSL=1/true/yes/on 时启用
    WEB_SSL_ENABLED=0
    case "${WEB_SSL:-0}" in
        1|true|TRUE|yes|YES|on|ON) WEB_SSL_ENABLED=1 ;;
        *) WEB_SSL_ENABLED=0 ;;
    esac

    # server_name：默认 localhost（保持历史行为）；开启 SSL 时也允许通过 WEB_SSL_SERVER_NAME 指定
    SERVER_NAME_VALUE="${WEB_SSL_SERVER_NAME:-}"
    if [ -z "$SERVER_NAME_VALUE" ]; then
        SERVER_NAME_VALUE="localhost"
    fi

    # 选择模板（最佳实践：少写“生成器”，多用模板做表达）
    TEMPLATE=""
    if [ "$WEB_SSL_ENABLED" = "1" ]; then
        if [ "$PORT_OJ" = "443" ]; then
            TEMPLATE="/nginx_conf/oj.ssl443.with80redir.conf.template"
        else
            TEMPLATE="/nginx_conf/oj.ssl.singleport.conf.template"
        fi
    else
        TEMPLATE="/nginx_conf/oj.http.conf.template"
    fi

    TMP_MAIN="$(mktemp)"
    cp -rf "$TEMPLATE" "$TMP_MAIN"

    # 统一替换占位符
    sed -i "s#__SERVER_NAME__#${SERVER_NAME_VALUE}#g" "$TMP_MAIN" 2>/dev/null || true
    sed -i "s#__LISTEN__#${PORT_OJ}#g" "$TMP_MAIN" 2>/dev/null || true
    sed -i "s#__SSL_CERT__#${WEB_SSL_CERT}#g" "$TMP_MAIN" 2>/dev/null || true
    sed -i "s#__SSL_KEY__#${WEB_SSL_KEY}#g" "$TMP_MAIN" 2>/dev/null || true
    sed -i "s#__SSL_PORT__#${PORT_OJ}#g" "$TMP_MAIN" 2>/dev/null || true

    # 业务替换（保持历史逻辑：通过替换 csgoj / upload 路径实现多实例）
    sed -i "s#public/csgoj/upload/#public/$BELONG_TO/upload/#g" "$TMP_MAIN"
    sed -i "s#csgoj#$OJ_NAME#g"                                 "$TMP_MAIN"

    cp -rf "$TMP_MAIN" "$TARGET_CONF"
    rm -f "$TMP_MAIN" 2>/dev/null || true
    chmod 744 "$TARGET_CONF"
fi
# init db：须成功后再起 fpm / worker；本脚本未全局 set -e，须显式校验退出码
PATH_OJWEB_BASE=/ojweb
if ! python3 "$PATH_OJWEB_BASE/dbinit.py"; then
    echo "❌ 数据库初始化失败，中止启动（不会启动 php-fpm / backtask worker）" >&2
    exit 1
fi
if ! php /ojweb/cli/bootstrap_accounts.php; then
    echo 'Account initialization failed' >&2
    exit 1
fi
# init ojweb：baseoj/static 供 nginx 共享；写入 $PATH_DATA/var/www（持久卷）
# OJ_UPDATE_STATIC=1：仅在本容器生命周期内首次 entrypoint 时强制从镜像覆盖；docker restart 不重复
# OJ_UPDATE_STATIC=0：卷上尚无 static 时首次复制；已有则保留
BASEOJ_STATIC="/var/www/baseoj/public/static"
# marker 放在容器可写层（非 $PATH_DATA 持久卷），随 docker rm 消失、docker restart 保留
# 勿用 /tmp：PHP session/upload_tmp_dir 同目录，且部分环境会对 /tmp 做清理或 tmpfs 挂载
BASEOJ_MARKER="/var/lib/csgoj/.baseoj_static_initialized"

if [ -f "$BASEOJ_MARKER" ]; then
    echo "[baseoj] static seed skipped (already done this container lifecycle)"
else
    need_copy=0
    if [ "$OJ_UPDATE_STATIC" = "1" ]; then
        echo "[baseoj] OJ_UPDATE_STATIC=1: force refresh on first container start"
        rm -rf "$BASEOJ_STATIC"
        need_copy=1
    elif [ ! -L "$BASEOJ_STATIC" ] && [ ! -e "$BASEOJ_STATIC" ]; then
        echo "[baseoj] no static on volume, initial copy from image"
        need_copy=1
    else
        echo "[baseoj] static exists on volume, skipping copy (OJ_UPDATE_STATIC=0)"
    fi
    if [ "$need_copy" = "1" ]; then
        mkdir -p "$BASEOJ_STATIC"
        cp -ruf "$PATH_OJWEB_BASE/public/static/." "$BASEOJ_STATIC/"
    fi
    mkdir -p "$(dirname "$BASEOJ_MARKER")"
    touch "$BASEOJ_MARKER"
fi
# init env 文件不存在或为空时写入配置
mkdir -p /var/www/$OJ_NAME
chown www-data:www-data /var/www/$OJ_NAME
chmod 777 /var/www/$OJ_NAME
if [ ! -f "/var/www/$OJ_NAME/.env" ] || [ ! -s "/var/www/$OJ_NAME/.env" ]; then
    echo "app_debug = false" > /var/www/$OJ_NAME/.env
    echo "OJ_SESSION=$OJ_SESSION"   >> /var/www/$OJ_NAME/.env
    echo "OJ_NAME=$(echo $OJ_NAME | tr '[:lower:]' '[:upper:]')" >> /var/www/$OJ_NAME/.env
    echo "OJ_CDN=$OJ_CDN"           >> /var/www/$OJ_NAME/.env
    echo "OJ_MODE=$OJ_MODE"         >> /var/www/$OJ_NAME/.env
    echo "OJ_STATUS=$OJ_STATUS"     >> /var/www/$OJ_NAME/.env
    echo "OJ_STATIC=$OJ_STATIC"     >> /var/www/$OJ_NAME/.env
    echo "DB_HOSTNAME=$DB_HOSTNAME" >> /var/www/$OJ_NAME/.env
    echo "DB_DATABASE=$DB_DATABASE" >> /var/www/$OJ_NAME/.env
    echo "DB_USERNAME=$DB_USERNAME" >> /var/www/$OJ_NAME/.env
    echo "DB_PASSWORD=$DB_PASSWORD" >> /var/www/$OJ_NAME/.env
    echo "DB_HOSTPORT=$DB_HOSTPORT" >> /var/www/$OJ_NAME/.env
    echo "app_timezone=${APP_TIMEZONE:-${TZ:-Asia/Shanghai}}" >> /var/www/$OJ_NAME/.env
fi
# 已有 .env 但未配置 app_timezone 时补写一行（不覆盖已有）
ENV_FILE="/var/www/$OJ_NAME/.env"
if [ -f "$ENV_FILE" ] && ! grep -q '^[[:space:]]*app_timezone[[:space:]]*=' "$ENV_FILE"; then
    echo "app_timezone=${APP_TIMEZONE:-${TZ:-Asia/Shanghai}}" >> "$ENV_FILE"
fi
if [ -f "$PATH_OJWEB_BASE/.env" ] || [ -L "$PATH_OJWEB_BASE/.env" ]; then
    rm "$PATH_OJWEB_BASE/.env"
fi
ln -s /var/www/$OJ_NAME/.env $PATH_OJWEB_BASE/.env
chmod 777 /var/www/$OJ_NAME/.env

chown www-data:www-data $PATH_OJWEB_BASE
chmod 777 $PATH_OJWEB_BASE
# 题目包导入/导出（与 config/OjPath.php 一致；各 PHP 容器内 /ojweb，非宿主机持久化卷）
mkdir -p "$PATH_OJWEB_BASE/PROBLEM_EXPORT/EXPORT" \
    "$PATH_OJWEB_BASE/PROBLEM_EXPORT/FILE_TEMP" \
    "$PATH_OJWEB_BASE/PROBLEM_EXPORT/IMPORT_TEMP"
chmod 777 "$PATH_OJWEB_BASE/PROBLEM_EXPORT" \
    "$PATH_OJWEB_BASE/PROBLEM_EXPORT/EXPORT" \
    "$PATH_OJWEB_BASE/PROBLEM_EXPORT/FILE_TEMP" \
    "$PATH_OJWEB_BASE/PROBLEM_EXPORT/IMPORT_TEMP" 2>/dev/null || true

mkdir -p "$PATH_OJWEB_BASE/CONTEST_EXPORT/EXPORT" \
    "$PATH_OJWEB_BASE/CONTEST_EXPORT/FILE_TEMP" \
    "$PATH_OJWEB_BASE/CONTEST_EXPORT/IMPORT_TEMP"
chmod 777 "$PATH_OJWEB_BASE/CONTEST_EXPORT" \
    "$PATH_OJWEB_BASE/CONTEST_EXPORT/EXPORT" \
    "$PATH_OJWEB_BASE/CONTEST_EXPORT/FILE_TEMP" \
    "$PATH_OJWEB_BASE/CONTEST_EXPORT/IMPORT_TEMP" 2>/dev/null || true

# 与 config/OjPath.php 一致的可写工作目录（可被宿主机卷覆盖为「同 BELONG_TO 多容器共享」）
mkdir -p "$PATH_OJWEB_BASE/CONTEST_SUMMARY/FILE_TEMP" \
    "$PATH_OJWEB_BASE/CONTEST_SUMMARY/SUMMARY" \
    "$PATH_OJWEB_BASE/CHUNK_TEMP" \
    "$PATH_OJWEB_BASE/CPC_CLIENT_RECORD"
chmod 777 "$PATH_OJWEB_BASE/CONTEST_SUMMARY" \
    "$PATH_OJWEB_BASE/CONTEST_SUMMARY/FILE_TEMP" \
    "$PATH_OJWEB_BASE/CONTEST_SUMMARY/SUMMARY" \
    "$PATH_OJWEB_BASE/CHUNK_TEMP" \
    "$PATH_OJWEB_BASE/CPC_CLIENT_RECORD" 2>/dev/null || true

# init upload public
fix_perms_tree_once() {
    # 递归修复权限在数据量大时会非常慢，所以默认仅“首次启动”执行一次
    # 可通过环境变量 CSGOJ_FIX_PERMS 控制：
    # - CSGOJ_FIX_PERMS=1  : 每次启动都强制递归修复（最慢，但最保险）
    # - CSGOJ_FIX_PERMS=0  : 跳过递归修复（最快；只确保目录本身可写）
    # - 未设置/其他值     : 自动模式：仅当 marker 不存在时递归修复一次（默认）
    dir="$1"
    marker="$2"

    mkdir -p "$dir"
    chown www-data:www-data "$dir" 2>/dev/null || true
    chmod 777 "$dir" 2>/dev/null || true

    case "${CSGOJ_FIX_PERMS:-auto}" in
        1|force|true|yes)
            echo "🔧 Fix permissions recursively (forced): $dir"
            chmod 777 -R "$dir" 2>/dev/null || true
            touch "$marker" 2>/dev/null || true
            ;;
        0|skip|false|no)
            echo "⚡ Skip recursive permissions fix: $dir"
            ;;
        *)
            if [ -f "$marker" ]; then
                # 已修复过：跳过递归 chmod，避免每次启动都扫描整个数据目录
                :
            else
                echo "🔧 Fix permissions recursively (first run): $dir"
                chmod 777 -R "$dir" 2>/dev/null || true
                touch "$marker" 2>/dev/null || true
            fi
            ;;
    esac
}

mkdir -p /var/www/public
chown www-data:www-data /var/www/public 2>/dev/null || true
# marker 放在 /var/www 下，避免落在 Web 公开目录里
fix_perms_tree_once /var/www/public /var/www/.csgoj_perms_public_fixed

# init judge data folder
mkdir -p /home/judge/data
chown www-data:www-data /home/judge/data 2>/dev/null || true
fix_perms_tree_once /home/judge/data /home/judge/.csgoj_perms_judge_data_fixed

# ── backtask worker ──────────────────────────────────────
# 副实例：BELONG_TO 为主站数据命名空间（与 DB/public 一致），OJ_NAME 为当前 Web 入口实例名；
# 此时默认不启 Python worker，避免与「主实例」php-$BELONG_TO 抢同一 backtask 队列。
# 需要例外时在容器环境设 CSGOJ_BACKTASK_ON_SECONDARY=1（不推荐共库双 worker）。
if [ -n "${BELONG_TO:-}" ] && [ -n "${OJ_NAME:-}" ] && [ "$BELONG_TO" != "$OJ_NAME" ] \
    && [ "${CSGOJ_BACKTASK_ON_SECONDARY:-0}" != "1" ]; then
    CSGOJ_BACKTASK=0
    echo "[backtask] satellite (BELONG_TO=$BELONG_TO, OJ_NAME=$OJ_NAME): worker disabled (no queue steal from php-$BELONG_TO)"
fi
# 由 CSGOJ_BACKTASK 控制（默认 1 = 启动）；设为 0 可临时关闭 worker。start_ojweb/csgoj_deploy 对副实例会传 CSGOJ_BACKTASK=0。
if [ "${CSGOJ_BACKTASK:-1}" = "1" ]; then
    if command -v python3 >/dev/null 2>&1; then
        export PYTHONUNBUFFERED=1
        echo "[backtask] starting worker (pid will follow)..."
        python3 /ojweb/backtask/start_worker.py &
        BACKTASK_PID=$!
        echo "[backtask] worker started, pid=$BACKTASK_PID"
    else
        echo "[backtask] WARNING: python3 not found, worker NOT started"
    fi
else
    echo "[backtask] worker disabled (CSGOJ_BACKTASK=${CSGOJ_BACKTASK})"
fi

exec docker-php-entrypoint "$@"
