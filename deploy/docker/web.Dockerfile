# Verified CCPCOJ 2.0.40 runtime; application code always comes from this repository.
FROM csgrandeur/ccpcoj-web2@sha256:f582d949207cdb68e4bfebcb9d46ed59ed7c7c013d73b391b3815c5dc6e5e0eb
ENV PROXY="" HTTP_PROXY="" HTTPS_PROXY="" http_proxy="" https_proxy="" ALL_PROXY="" all_proxy="" NO_PROXY="" no_proxy=""
RUN python3 -m pip install --no-cache-dir 'PyMySQL[rsa]'
RUN rm -rf /ojweb /SQL /nginx_conf && rm -f /etc/nginx/conf.d/*.conf
COPY ojweb /ojweb
COPY deploy/SQL /SQL
COPY deploy/nginx_conf /nginx_conf
COPY deploy/docker/start-web.sh /usr/local/bin/start-ccpcoj
COPY deploy/docker/zz-ccpc-fpm.conf /usr/local/etc/php-fpm.d/zz-ccpc-fpm.conf
COPY tests /tests
RUN find /ojweb -type d -exec chmod 755 {} + && \
    find /ojweb -type f -exec chmod 644 {} + && \
    find /ojweb -type f -name '*.sh' -exec chmod 755 {} + && \
    chmod +x /usr/local/bin/start-ccpcoj /ojweb/think
WORKDIR /ojweb
ENTRYPOINT ["/usr/local/bin/start-ccpcoj"]
CMD ["php-fpm"]
