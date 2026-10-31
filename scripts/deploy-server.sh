#!/usr/bin/env bash
# Install alongside the production Compose file, mode 700.
# A dedicated SSH key invokes this through a forced-command entrypoint.
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
umask 077

readonly deploy_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

fail() {
  echo "$1" >&2
  exit 1
}

[[ $# -eq 1 ]] || fail 'Expected one SSH command.'
cd "$deploy_dir"
[[ -f .env && -f compose.production.yaml ]] || fail 'Server configuration is missing.'
[[ -f .env.deploy ]] || fail 'Private deployment configuration is missing.'
# This administrator-owned file exists only on the deployment host.
source .env.deploy
readonly image_repository="${IMAGE_REPOSITORY:?Set IMAGE_REPOSITORY in the server-only .env.deploy}"

compose() {
  local files=(-f compose.production.yaml)
  if [[ -f compose.server.yaml ]]; then files+=(-f compose.server.yaml); fi
  docker compose --project-name "$(basename "$deploy_dir")" "${files[@]}" "$@"
}

if [[ "$1" == check ]]; then
  docker compose version
  compose config --quiet
  echo 'Deployment connection ready.'
  exit 0
fi

# No eval, shell commands, filenames, image repositories, or tags from SSH input.
[[ "$1" != *$'\n'* && "$1" != *$'\r'* ]] || fail 'Invalid command.'
read -r command app_digest migration_digest registry_user extra <<< "$1"
[[ "$command" == deploy && -z "$extra" ]] || fail 'Only deploy and check are supported.'
[[ "$app_digest" =~ ^sha256:[a-f0-9]{64}$ ]] || fail 'Invalid application digest.'
[[ "$migration_digest" =~ ^sha256:[a-f0-9]{64}$ ]] || fail 'Invalid migration digest.'
[[ "$registry_user" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*(\[bot\])?$ ]] || fail 'Invalid registry user.'

exec 9>.deploy.lock
flock -n 9 || fail 'Another deployment is running.'
export APP_IMAGE="$image_repository@$app_digest"
export MIGRATION_IMAGE="$image_repository@$migration_digest"

# The workflow pipes its short-lived, read-only GITHUB_TOKEN over SSH stdin.
# Never persist registry credentials in the deploy user's home or application env.
DOCKER_CONFIG=$(mktemp -d)
export DOCKER_CONFIG
env_tmp=
cleanup() {
  rm -rf "$DOCKER_CONFIG"
  if [[ -n "$env_tmp" ]]; then rm -f "$env_tmp"; fi
}
trap cleanup EXIT
docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null

# Pull before interrupting the running application. Do not touch other stacks.
compose pull db app migrate
compose up -d --wait --wait-timeout 120 db
compose stop app

# Keep pre-migration backups private. Retention and off-host copies are operator tasks.
backup_dir="backups/$(date -u +%Y%m%dT%H%M%SZ)-${app_digest:7:12}"
mkdir -p "$backup_dir"
compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_dir/database.dump"
compose run -T --rm --no-deps --entrypoint tar app -C /app/media -czf - . > "$backup_dir/media.tar.gz"
[[ -s "$backup_dir/database.dump" && -s "$backup_dir/media.tar.gz" ]] || fail 'Backup failed; application remains stopped.'

# No automatic rollback: the previous image may not support the migrated schema.
compose run -T --rm --no-deps migrate
compose up -d --no-deps --wait --wait-timeout 180 app

# Record only a healthy revision, preserving server-only configuration and secrets.
env_tmp=$(mktemp "$deploy_dir/.env.XXXXXX")
sed '/^APP_IMAGE=/d; /^MIGRATION_IMAGE=/d' .env > "$env_tmp"
printf '\nAPP_IMAGE=%s\nMIGRATION_IMAGE=%s\n' "$APP_IMAGE" "$MIGRATION_IMAGE" >> "$env_tmp"
mv "$env_tmp" .env
env_tmp=
echo 'Deployment healthy; image digests saved in the server environment.'
