# コックピット デモを配信するコンテナイメージ（nginx で静的ファイルを配る）
#   docker build -t cockpit-demo .
#   docker run --rm -p 8080:8080 cockpit-demo   → http://localhost:8080/

# 1) シナリオを検証し、builtin.js と使い方ページを作り直す
#    （Python イメージに Node.js 本体だけを持ち込む。パッケージの追加ダウンロードは不要）
FROM node:22-slim AS node
FROM python:3.12-slim AS build
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /src
COPY . .
RUN node tools/validate.mjs \
 && python3 tools/bundle.py \
 && python3 tools/build_docs.py \
 && mkdir -p /site /zip/cockpit-demo \
 && cp -r index.html readme.html story js scenarios assets voice docs README.md /site/ \
 && cp -r index.html readme.html story js scenarios assets voice docs tools README.md /zip/cockpit-demo/ \
 && (cd /zip && python3 -m zipfile -c /site/cockpit-demo-platform.zip cockpit-demo)

# 2) 配信用（root 以外のユーザーで 8080 番を待ち受ける nginx）
FROM nginxinc/nginx-unprivileged:1.27-alpine
LABEL org.opencontainers.image.title="cockpit-demo" \
      org.opencontainers.image.description="コックピット デモプラットフォーム（静的サイト）" \
      org.opencontainers.image.source="https://github.com/kenscafe/Cockpitnaviation-"
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
