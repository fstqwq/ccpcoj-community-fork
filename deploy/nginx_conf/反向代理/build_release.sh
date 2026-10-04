#!/usr/bin/env bash
# 交叉编译 Linux / Windows 64 位 release（需本机 Go 支持 toolchain 或已安装对应版本）。
# Linux 产物为「sh 自解压壳 + Go 二进制」单文件：chmod +x 后可用 ./ 执行，亦可用 bash 显式解释执行。
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
export CGO_ENABLED=0
LDFLAGS='-s -w'

PAYLOAD="dist/ccpcoj-intranet-proxy-linux-amd64.payload"
FINAL="dist/ccpcoj-intranet-proxy-linux-amd64"
LAUNCHER_TMP=$(mktemp)
trap 'rm -f "$LAUNCHER_TMP"' EXIT

cat >"$LAUNCHER_TMP" <<'EOS'
#!/bin/sh
set -e
f=$(CDPATH= cd -- "$(dirname "$0")" && pwd)/$(basename "$0")
o=$(grep -abo '^#LANEXAMBUNDLEv1$' "$f" | head -n1 | cut -d: -f1) || o=
if [ -z "${o}" ]; then
	echo "ccpcoj-intranet-proxy: 包内标记缺失，文件可能损坏" >&2
	exit 1
fi
# 标记行（字节）：#LANEXAMBUNDLEv1 + 换行；首字节在 0 基 o+17，GNU tail -c+N 为 1 基故 N=o+18
skip=$((o + 18))
out="${f}.bin"
if [ ! -x "$out" ] || [ "$f" -nt "$out" ]; then
	tail -c"+${skip}" "$f" >"${out}.tmp"
	mv -f "${out}.tmp" "$out"
	chmod +x "$out"
fi
exec "$out" "$@"
EOS

go build -trimpath -ldflags="$LDFLAGS" -o "$PAYLOAD" .
{
	cat "$LAUNCHER_TMP"
	printf '%s\n' '#LANEXAMBUNDLEv1'
	cat "$PAYLOAD"
} >"$FINAL"
# 与壳包内 ELF 相同的一份裸二进制，供 Docker runtime-local / docker_run.sh dev 挂载（一次编译，不重复 go build）
cp "$PAYLOAD" dist/oj-proxy
chmod +x dist/oj-proxy
rm -f "$PAYLOAD"
chmod +x "$FINAL"

GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="$LDFLAGS" -o dist/ccpcoj-intranet-proxy-windows-amd64.exe .

echo "输出: dist/ccpcoj-intranet-proxy-linux-amd64、dist/oj-proxy（Docker/开发挂载）与 dist/ccpcoj-intranet-proxy-windows-amd64.exe"
echo "Linux: 已 chmod +x；支持 ./ccpcoj-intranet-proxy-linux-amd64 或 bash ccpcoj-intranet-proxy-linux-amd64（首次同目录生成 .bin 缓存，更新主文件后会自动刷新）"
