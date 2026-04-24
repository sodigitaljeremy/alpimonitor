# ---------- Build stage ----------
# Python Alpine keeps the builder small and only holds the build-time
# MkDocs + mkdocs-material + plugins (~100 MB). The runtime image never
# carries any Python.
FROM python:3.12-alpine AS build

WORKDIR /app

# Pinned dependencies first, for layer caching. A content change in
# requirements-docs.txt invalidates the pip install layer; changes in
# docs/ content do not.
COPY requirements-docs.txt ./
RUN pip install --no-cache-dir -r requirements-docs.txt

# mkdocs.yml lives at the repo root, not inside docs/. Copy it alongside
# the content tree so `mkdocs build` resolves `docs_dir: docs` correctly.
COPY mkdocs.yml ./
COPY docs ./docs

# The build emits site/ next to mkdocs.yml by default. `--strict` fails
# the build on any warning (dead link, orphan page) — mirrors the
# local gate used by the contributor.
RUN mkdocs build --strict --site-dir /build/site

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS runtime

COPY apps/docs/nginx-docs.conf /etc/nginx/conf.d/default.conf
COPY apps/docs/nginx-docs-security-headers.conf /etc/nginx/docs-security-headers.conf
COPY --from=build /build/site /usr/share/nginx/html

EXPOSE 80

# nginx base image already defines a proper CMD and signal handling.
