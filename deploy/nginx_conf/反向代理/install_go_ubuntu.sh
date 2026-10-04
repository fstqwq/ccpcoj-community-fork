#!/usr/bin/env bash
# 在 Ubuntu（及常见 Debian 系）上安装官方 Linux 二进制 Go 工具链，并写入系统级 PATH 配置。
#
# 联网核实（维护者于脚本内记录的默认值，与自动探测一致）：
#   - 官方 VERSION 文本：https://go.dev/VERSION?m=text  → 当前稳定标记为 go1.26.2（2026-03-27）
#   - 校验与元数据：https://go.dev/dl/?mode=json
#
# 用法：
#   sudo ./install_go_ubuntu.sh
#   sudo ./install_go_ubuntu.sh --proxy=http://192.168.1.33:10808   # 仅当提供 --proxy 时走代理（curl / Python 均用）
#   sudo GO_VERSION=1.25.9 ./install_go_ubuntu.sh
#   sudo INSTALL_ROOT=/opt ./install_go_ubuntu.sh
#
# 说明：直接写 https_proxy=... sudo bash 本脚本 时，sudo 默认不保留该环境变量；请用 --proxy 或 sudo -E。
#
# 配置变量（均可环境变量覆盖）：
set -euo pipefail

# ---- 命令行：代理（仅当显式传入 --proxy 时导出给 curl / Python）----
HTTPS_PROXY_CLI=""

# ---- 可配置：版本 ----
GO_VERSION="${GO_VERSION:-}"
GO_VERSION_FALLBACK="${GO_VERSION_FALLBACK:-1.26.2}"

# ---- 可配置：安装路径 ----
INSTALL_ROOT="${INSTALL_ROOT:-/usr/local}"

# ---- 可配置：架构 ----
ARCH="${ARCH:-}"

# ---- 可配置：行为 ----
SKIP_SHA256="${SKIP_SHA256:-0}"

# ---- 可配置：profile ----
PROFILE_D_FILE="${PROFILE_D_FILE:-/etc/profile.d/golang-go.sh}"

# EXIT 清理用：必须为全局变量，否则 main 返回后 local 已失效，set -u 下 trap 会报 unbound variable
_INSTALL_GO_TMP=""

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
用法: install_go_ubuntu.sh [选项]

  --proxy=URL    为本次安装设置 HTTPS/HTTP 代理（curl 与校验用 Python 均走此代理）
  --proxy URL    同上
  -h, --help     显示本说明

环境变量仍可用: GO_VERSION, GO_VERSION_FALLBACK, INSTALL_ROOT, ARCH, SKIP_SHA256, PROFILE_D_FILE
需 root: sudo ./install_go_ubuntu.sh [--proxy ...]
USAGE
}

parse_cli_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --proxy=*)
        HTTPS_PROXY_CLI="${1#--proxy=}"
        shift
        ;;
      --proxy)
        [[ $# -ge 2 ]] || die "--proxy 需要 URL 参数"
        HTTPS_PROXY_CLI="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "未知参数: $1（使用 -h 查看帮助）"
        ;;
    esac
  done
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令「$1」，请先 apt install（例如 curl、python3、ca-certificates）。"
}

is_ubuntu_like() {
  [[ -f /etc/os-release ]] || return 1
  grep -qiE 'ubuntu|debian|linuxmint|pop' /etc/os-release
}

detect_arch() {
  if [[ -n "${ARCH}" ]]; then
    case "${ARCH}" in
      amd64|arm64) ;;
      *) die "不支持的 ARCH=${ARCH}（仅支持 amd64、arm64）" ;;
    esac
    return
  fi
  if command -v dpkg >/dev/null 2>&1; then
    ARCH="$(dpkg --print-architecture)"
  else
    case "$(uname -m)" in
      x86_64) ARCH=amd64 ;;
      aarch64|arm64) ARCH=arm64 ;;
      *) die "无法推断架构，请显式设置 ARCH=amd64 或 arm64（uname -m=$(uname -m)）" ;;
    esac
  fi
  case "${ARCH}" in
    amd64|arm64) ;;
    *) die "本脚本仅处理 linux-amd64 / linux-arm64，当前 ARCH=${ARCH}" ;;
  esac
}

normalize_full_version() {
  local v="${1:?}"
  v="${v#v}"
  if [[ "${v}" != go* ]]; then
    v="go${v}"
  fi
  printf '%s' "${v}"
}

resolve_latest_version() {
  require_cmd curl
  local line
  line="$(curl -fsSL --max-time 30 'https://go.dev/VERSION?m=text' | head -1 | tr -d '\r')"
  [[ -n "${line}" ]] || return 1
  if [[ "${line}" != go* ]]; then
    die "VERSION 文件首行异常: ${line}"
  fi
  printf '%s' "${line}"
}

fetch_sha256_from_json() {
  local full_ver="$1" arch="$2"
  require_cmd python3
  local fn="${full_ver}.linux-${arch}.tar.gz"
  python3 - "$full_ver" "$fn" <<'PY'
import json, sys, urllib.request
version, want_name = sys.argv[1], sys.argv[2]
url = "https://go.dev/dl/?mode=json"
with urllib.request.urlopen(url, timeout=120) as r:
    data = json.load(r)
for rel in data:
    if rel.get("version") != version:
        continue
    for f in rel.get("files", []):
        if f.get("filename") == want_name and f.get("kind") == "archive":
            print(f["sha256"])
            raise SystemExit(0)
raise SystemExit("未在 go.dev/dl JSON 中找到 " + want_name)
PY
}

cleanup_install_tmp() {
  [[ -n "${_INSTALL_GO_TMP:-}" ]] && rm -rf "${_INSTALL_GO_TMP}"
}

main() {
  [[ "$(id -u)" -eq 0 ]] || die "请使用 root 运行：sudo $0 …"

  if [[ -n "${HTTPS_PROXY_CLI}" ]]; then
    export HTTPS_PROXY="${HTTPS_PROXY_CLI}"
    export HTTP_PROXY="${HTTPS_PROXY_CLI}"
    export ALL_PROXY="${HTTPS_PROXY_CLI}"
    export https_proxy="${HTTPS_PROXY_CLI}"
    export http_proxy="${HTTPS_PROXY_CLI}"
    export all_proxy="${HTTPS_PROXY_CLI}"
    log "网络：已启用 --proxy → ${HTTPS_PROXY_CLI}"
  fi

  if ! is_ubuntu_like; then
    log "警告：未识别为 Ubuntu/Debian 系，将继续按 Linux 官方 tarball 安装。"
  fi

  require_cmd curl
  require_cmd tar
  require_cmd python3

  detect_arch
  log "目标架构: linux-${ARCH}"

  local full_ver
  if [[ -z "${GO_VERSION}" ]]; then
    log "GO_VERSION 未指定，正在从 https://go.dev/VERSION?m=text 解析最新稳定版…"
    if ! full_ver="$(resolve_latest_version)"; then
      log "自动解析失败，使用 GO_VERSION_FALLBACK=${GO_VERSION_FALLBACK}"
      full_ver="$(normalize_full_version "${GO_VERSION_FALLBACK}")"
    fi
  else
    full_ver="$(normalize_full_version "${GO_VERSION}")"
  fi

  local short_ver="${full_ver#go}"
  log "将安装: ${full_ver} → ${INSTALL_ROOT}/go"

  local tarball="${full_ver}.linux-${ARCH}.tar.gz"
  local base_url="https://go.dev/dl"
  local url="${base_url}/${tarball}"

  _INSTALL_GO_TMP="$(mktemp -d)"
  trap cleanup_install_tmp EXIT

  log "下载: ${url}"
  curl -fL --retry 3 --retry-delay 2 --max-time 600 -o "${_INSTALL_GO_TMP}/${tarball}" "${url}"

  if [[ "${SKIP_SHA256}" != "1" ]]; then
    log "校验 SHA256（来源 go.dev/dl JSON）…"
    local expected
    expected="$(fetch_sha256_from_json "${full_ver}" "${ARCH}")"
    echo "${expected}  ${_INSTALL_GO_TMP}/${tarball}" | sha256sum -c -
  else
    log "已跳过 SHA256 校验（SKIP_SHA256=1）。"
  fi

  local install_go="${INSTALL_ROOT}/go"
  if [[ -d "${install_go}" ]]; then
    log "移除旧目录: ${install_go}"
    rm -rf "${install_go}"
  fi

  log "解压到 ${INSTALL_ROOT} …"
  tar -C "${INSTALL_ROOT}" -xzf "${_INSTALL_GO_TMP}/${tarball}"

  [[ -x "${install_go}/bin/go" ]] || die "安装后未找到 ${install_go}/bin/go"

  log "写入 ${PROFILE_D_FILE}（GOROOT、GOPATH、PATH）…"
  umask 022
  cat >"${PROFILE_D_FILE}" <<EOF
# Go toolchain (${full_ver}) — generated by install_go_ubuntu.sh
export GOROOT="${INSTALL_ROOT}/go"
export PATH="\${GOROOT}/bin:\${PATH}"
export GOPATH="\${HOME}/go"
export PATH="\${PATH}:\${GOPATH}/bin"
EOF
  chmod 0644 "${PROFILE_D_FILE}"

  log ""
  log "安装完成: $("${install_go}/bin/go" version)"
  log "请让当前用户重新登录 shell，或执行:  source ${PROFILE_D_FILE}"
  log "验证: command -v go  &&  go version"
}

parse_cli_args "$@"
main
