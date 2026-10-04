#!/bin/sh
set -eu
# Nginx seeds its default site into the shared configuration volume at creation.
# Keep that site from taking precedence over the application server.
if [ -f /etc/nginx/conf.d/default.conf ]; then
    mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled
fi
[ "${#CCPC_HMAC_KEY}" -ge 32 ] || { echo 'CCPC_HMAC_KEY must be at least 32 characters' >&2; exit 1; }
exec sh /ojweb/entrypoint.sh "$@"
