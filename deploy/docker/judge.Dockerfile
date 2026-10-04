FROM csgrandeur/ccpcoj-judge2@sha256:3812e1db74519af6e3961a91954318344b397c036a47fd08edc9234337f87852
ENV HTTP_PROXY="" HTTPS_PROXY="" http_proxy="" https_proxy="" ALL_PROXY="" all_proxy=""
COPY ojweb/config/judge_environment.json /etc/ccpcoj-toolchain.json
COPY scripts/verify_toolchain.py /usr/local/bin/verify-ccpcoj-toolchain
# Keep the GCC/Python versions supplied by the pinned base; install the FAQ's JDK.
RUN sed -i 's#http://mirrors.aliyun.com/ubuntu/#http://archive.ubuntu.com/ubuntu/#g' /etc/apt/sources.list.d/ubuntu.sources && \
    apt-get update && \
    jdk_version="$(python3 -c 'import json; print(json.load(open("/etc/ccpcoj-toolchain.json"))["openjdk_package"])')" && \
    base_version="$(python3 -c 'import json; print(json.load(open("/etc/ccpcoj-toolchain.json"))["base_files_package"])')" && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        "openjdk-21-jdk-headless=$jdk_version" "openjdk-21-jre-headless=$jdk_version" "base-files=$base_version" && \
    rm -rf /var/lib/apt/lists/* && \
    python3 /usr/local/bin/verify-ccpcoj-toolchain /etc/ccpcoj-toolchain.json
RUN rm -rf /core /judge_lib
COPY judge/core /core
COPY judge/judge_lib /judge_lib
RUN g++ -O2 -o /core/default_check /core/default_check.cc && chmod +x /core/*.sh
WORKDIR /core
CMD ["/bin/bash", "/core/entrypoint.sh"]
