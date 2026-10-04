#!/usr/bin/env bash
# 构建 Docker 镜像 csgrandeur/oj-proxy:latest（Alpine + 静态 oj-proxy）
#
# 默认：bash build_release.sh → docker build --target runtime-local（COPY dist/oj-proxy）
# --in-docker：docker build --target runtime-dockerbuild（镜像内 go build；宿主不出现 dist/）
# --in-docker --proxy URL：build-arg 注入 HTTP(S) 代理，仅 go mod / go build 使用；apk 已换 mirrors.tencent.com
#
# 本脚本 export DOCKER_BUILDKIT=1：兼容 Docker 20.x 未在 daemon 开启 BuildKit 的主机（如仅改脚本、不动服务器配置）。
# 环境变量：IMAGE（默认 csgrandeur/oj-proxy:latest）
set -euo pipefail
cd "$(dirname "$0")"

# 无 BuildKit 时 `docker build --target` 仍可能构建无关 stage（例如无 dist 却执行 COPY dist）；勿依赖宿主机 daemon.json
export DOCKER_BUILDKIT=1

IMAGE="${IMAGE:-csgrandeur/oj-proxy:latest}"
IN_DOCKER=0
PROXY_URL=""

usage() {
	echo "用法: $0 [--help] | [--in-docker [--proxy <URL>]]" >&2
	echo "  默认              bash build_release.sh && docker build --target runtime-local" >&2
	echo "  --in-docker       docker build --target runtime-dockerbuild（不写宿主 dist/）" >&2
	echo "  --in-docker --proxy <URL>  同上，go mod/go build 走代理" >&2
}

while [ $# -gt 0 ]; do
	case "$1" in
	--help|-h)
		usage
		exit 0
		;;
	--in-docker|in-docker)
		IN_DOCKER=1
		shift
		;;
	--proxy=*)
		PROXY_URL="${1#*=}"
		shift
		;;
	--proxy)
		if [ $# -lt 2 ]; then
			echo "错误: --proxy 需要 URL 参数（例: http://127.0.0.1:7890）" >&2
			exit 1
		fi
		PROXY_URL="$2"
		shift 2
		;;
	*)
		echo "未知参数: $1" >&2
		usage
		exit 1
		;;
	esac
done

if [ -n "$PROXY_URL" ] && [ "$IN_DOCKER" -eq 0 ]; then
	echo "错误: --proxy 仅可与 --in-docker 一起使用" >&2
	usage
	exit 1
fi

if [ "$IN_DOCKER" -eq 1 ]; then
	BUILD_ARGS=()
	if [ -n "$PROXY_URL" ]; then
		BUILD_ARGS+=(
			--build-arg "HTTP_PROXY=${PROXY_URL}"
			--build-arg "HTTPS_PROXY=${PROXY_URL}"
			--build-arg "http_proxy=${PROXY_URL}"
			--build-arg "https_proxy=${PROXY_URL}"
		)
	fi
	docker build "${BUILD_ARGS[@]}" --target runtime-dockerbuild -t "$IMAGE" .
else
	bash build_release.sh
	docker build --target runtime-local -t "$IMAGE" .
fi
