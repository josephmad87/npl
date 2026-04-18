#!/usr/bin/env bash
# Option A: deploy only api/ from the monorepo when Heroku builds from GitHub (full repo clone).
# Prerequisites: Heroku CLI (https://devcenter.heroku.com/articles/heroku-cli), `heroku login`.
#
# Usage:
#   ./scripts/configure-heroku-subdir-buildpack.sh YOUR_HEROKU_APP_NAME
#   HEROKU_APP_NAME=YOUR_HEROKU_APP_NAME ./scripts/configure-heroku-subdir-buildpack.sh
#
# Optional: override folder (default api):
#   SUBDIR=api ./scripts/configure-heroku-subdir-buildpack.sh YOUR_APP

set -euo pipefail

SUBDIR="${SUBDIR:-api}"
APP="${HEROKU_APP_NAME:-${1:-}}"

if [[ -z "$APP" ]]; then
  echo "Usage: $0 <heroku-app-name>" >&2
  echo "   or: HEROKU_APP_NAME=<heroku-app-name> $0" >&2
  exit 1
fi

SUBDIR_BUILDPACK="${SUBDIR_BUILDPACK:-https://github.com/timanovsky/subdir-heroku-buildpack}"

echo "App: $APP"
echo "Setting buildpacks: (1) subdir → (2) heroku/python"
echo "Config var: PROJECT_PATH=$SUBDIR"
echo

heroku buildpacks:set "$SUBDIR_BUILDPACK" --app "$APP"
heroku buildpacks:add heroku/python --app "$APP"
heroku config:set "PROJECT_PATH=$SUBDIR" --app "$APP"

echo
echo "Configured. Redeploy from GitHub (push to main) or: heroku builds:create --app $APP"
echo "Current buildpacks:"
heroku buildpacks --app "$APP"
