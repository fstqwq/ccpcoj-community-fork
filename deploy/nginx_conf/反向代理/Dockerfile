# 多阶段：build-in-docker → runtime-local（宿主 dist）或 runtime-dockerbuild（镜像内编译）
# build_image.sh 使用 --target 并 export DOCKER_BUILDKIT=1（勿依赖宿主机 daemon 是否开启 BuildKit）。
FROM golang:1.25-alpine AS build-in-docker
WORKDIR /src
RUN if ! grep -q 'dl-cdn.alpinelinux.org' /etc/apk/repositories; then \
		echo 'apk: /etc/apk/repositories 中未找到 dl-cdn.alpinelinux.org，请核对基础镜像后更新本 Dockerfile 换源步骤' >&2; \
		cat /etc/apk/repositories >&2; \
		exit 1; \
	fi && \
	sed -i 's/dl-cdn.alpinelinux.org/mirrors.tencent.com/g' /etc/apk/repositories
RUN apk add --no-cache git ca-certificates
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG http_proxy
ARG https_proxy
ARG NO_PROXY
ARG no_proxy
ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    http_proxy=$http_proxy \
    https_proxy=$https_proxy \
    NO_PROXY=$NO_PROXY \
    no_proxy=$no_proxy
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /oj-proxy .

FROM alpine:latest AS runtime-local
RUN if ! grep -q 'dl-cdn.alpinelinux.org' /etc/apk/repositories; then \
		echo 'apk: /etc/apk/repositories 中未找到 dl-cdn.alpinelinux.org，请核对基础镜像后更新本 Dockerfile 换源步骤' >&2; \
		cat /etc/apk/repositories >&2; \
		exit 1; \
	fi && \
	sed -i 's/dl-cdn.alpinelinux.org/mirrors.tencent.com/g' /etc/apk/repositories
RUN apk add --no-cache ca-certificates
COPY dist/oj-proxy /oj-proxy
ENTRYPOINT ["/oj-proxy"]
CMD ["flg_env"]

FROM alpine:latest AS runtime-dockerbuild
RUN if ! grep -q 'dl-cdn.alpinelinux.org' /etc/apk/repositories; then \
		echo 'apk: /etc/apk/repositories 中未找到 dl-cdn.alpinelinux.org，请核对基础镜像后更新本 Dockerfile 换源步骤' >&2; \
		cat /etc/apk/repositories >&2; \
		exit 1; \
	fi && \
	sed -i 's/dl-cdn.alpinelinux.org/mirrors.tencent.com/g' /etc/apk/repositories
RUN apk add --no-cache ca-certificates
COPY --from=build-in-docker /oj-proxy /oj-proxy
ENTRYPOINT ["/oj-proxy"]
CMD ["flg_env"]
