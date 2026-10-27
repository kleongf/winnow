#!/usr/bin/env bash
# `pnpm verify`: the one command that says whether the repo is healthy.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "backend: format, lint, types, tests"
(cd backend && uv run ruff format --check . && uv run ruff check . && uv run pyright && uv run pytest)

step "frontend: types, lint, format, tests"
pnpm --filter winnow-frontend run typecheck
pnpm --filter winnow-frontend run lint
pnpm --filter winnow-frontend run format:check
pnpm --filter winnow-frontend run test

step "scripts and e2e: types, format"
pnpm exec tsc -p tsconfig.json
pnpm exec prettier --check scripts e2e playwright.config.ts

step "generated API types are current"
bash scripts/gen-api.sh --check

step "file size limits"
python3 scripts/check_file_size.py

step "e2e: boot the app and click through it"
pnpm exec playwright test

printf '\n\033[1;32m✔ verify passed\033[0m\n'
