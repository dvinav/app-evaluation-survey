#!/bin/sh
set -eu
umask 077
image_tag=${1:-}
case "$image_tag" in
  sha-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
  *) echo "Invalid production image tag" >&2; exit 2 ;;
esac
cd "${SURVEY_DEPLOY_DIR:-/srv/applications/app-evaluation-survey}"
exec 9>.deploy.lock
flock 9
previous_tag=$(sed -n 's/^APP_VERSION=//p' .env | head -n 1)
test -n "$previous_tag"
previous_container=$(docker compose -f compose.yml ps -q web)
backup=$(mktemp .env.deploy.XXXXXX)
cp -p .env "$backup"
if [ -f .registry/config.json ]; then
  export DOCKER_CONFIG="$PWD/.registry"
fi
finish() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    echo "Deployment failed; restoring $previous_tag" >&2
    cp -p "$backup" .env
    if [ -n "$previous_container" ]; then
      docker compose -f compose.yml up -d --no-deps --wait --wait-timeout 180 web || true
    else
      docker compose -f compose.yml rm -sf web || true
    fi
  fi
  rm -f "$backup"
  # The workflow's registry token expires with its job; never retain it on the host.
  rm -rf .registry
  exit "$status"
}
trap finish EXIT
sed -i "s/^APP_VERSION=.*/APP_VERSION=$image_tag/" .env
docker compose -f compose.yml config --quiet
docker compose -f compose.yml pull web migrate
# Forward migrations must remain compatible with the previous application image.
docker compose -f compose.yml run -T --rm --no-deps migrate </dev/null
docker compose -f compose.yml up -d --no-deps --wait --wait-timeout 180 web
echo "Deployed $image_tag"
