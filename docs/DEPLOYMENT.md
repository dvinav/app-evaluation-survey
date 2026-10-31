# Deployment and operations

## Uranus layout

Production follows the same mechanism as `imazh-web`: GitHub builds an immutable image, connects over SSH, pulls that exact revision, runs migrations, restarts the application, and waits for its health check. A failed update restores the previous application image configuration; database migrations are not reversed.

| Resource                    | Location / name                                           |
| --------------------------- | --------------------------------------------------------- |
| Public origin               | `https://uiux-survey.dvinav.ir`                           |
| Deployment directory        | `/srv/applications/app-evaluation-survey`                 |
| Installed Compose file      | `/srv/applications/app-evaluation-survey/compose.yml`     |
| Private environment         | `/srv/applications/app-evaluation-survey/.env`, mode 600  |
| Uploaded icons              | `/srv/applications/app-evaluation-survey/media`           |
| Web container / proxy alias | `app-evaluation-survey`                                   |
| Database service            | Existing `shared-postgres` on external network `database` |
| Dedicated database and role | `app_evaluation_survey`                                   |
| Reverse proxy               | Existing Caddy on external network `proxy`                |

The production Compose file deliberately does not start another PostgreSQL server or publish a host port. It uses the existing server infrastructure, with separate survey credentials and media. Caddy routes only the survey hostname to port 3000 and overwrites `X-Real-IP`. The survey trusts that header for rate limiting because its web port is accessible only inside Docker networks. Existing applications and databases are not reused for survey data.

The web image is a non-root Node.js 24.22.2 Next standalone runtime. The matching maintenance image includes Bun and the source/migration tools. Both target `linux/amd64`, matching Uranus. Local development remains independent: `compose.yaml` provides a local PostgreSQL database and optional app/maintenance builds.

## GitHub workflow behavior

`.github/workflows/publish.yml` mirrors Imazh's triggers:

| Event                               | Builds      | Publishes | Deploys                        |
| ----------------------------------- | ----------- | --------- | ------------------------------ |
| Pull request targeting `main`       | Both images | No        | No                             |
| Push to `main`                      | Both images | Yes       | Yes, after both builds succeed |
| Push a `v*` version tag             | Both images | Yes       | No                             |
| Manual workflow run                 | Both images | Yes       | No                             |
| Markdown/docs-only automatic change | Skipped     | No        | No                             |

The separate CI workflow still runs formatting, lint, TypeScript, unit tests, migrations, database integration tests, production build, and desktop/mobile Chromium tests. As in Imazh, the deployment depends on successful image builds, not on completion of the separate CI workflow. Configure required pull-request checks/branch protection if you want to enforce review and passing CI before merging to `main`.

Images are published to `ghcr.io/dvinav/app-evaluation-survey`. Main builds receive `latest` and `sha-<7-character-commit>` tags. The maintenance target appends `-migrations`. A `v1.2.3` release publishes semantic tags `1.2.3`, `1.2`, and `1`, plus corresponding maintenance tags and a commit tag. Deployments always select the commit tag, never a moving `latest` tag.

The image jobs use `GITHUB_TOKEN` with `packages: write`. The deploy job uses `packages: read` to authorize pulls through a temporary registry configuration on Uranus. The deployment script deletes that configuration when it finishes. Consequently automatic deployment also works while the GHCR package is private; making the package public is optional. No personal registry token is stored on the server by this workflow.

All third-party actions are pinned to verified commit SHAs. The workflow has separate build caches for the two image targets and produces provenance/SBOM metadata. Its deployment concurrency group does not cancel an in-progress update, and a host-side file lock also serializes manual deployments.

## Repository deployment configuration

Configure these in the repository's Actions settings:

| Setting                  | Type     | Purpose                                              |
| ------------------------ | -------- | ---------------------------------------------------- |
| `SURVEY_DEPLOY_SSH_KEY`  | Secret   | Dedicated SSH private key for the deployment account |
| `SURVEY_DEPLOY_HOST`     | Variable | SSH hostname/address                                 |
| `SURVEY_DEPLOY_USER`     | Variable | Deployment account, currently `dvin`                 |
| `SURVEY_DEPLOY_HOST_KEY` | Variable | Verified OpenSSH known-hosts line for that host      |

The public half of the deployment key belongs in that account's `authorized_keys` with the `restrict` option. This disables forwarding and PTY access while allowing the workflow's noninteractive deployment commands. The private key is never committed or printed. The workflow checks the pinned host key instead of trusting a fresh `ssh-keyscan` result during deployment.

The repository must permit Actions and package publishing. Both package images are linked to their repository by build metadata. No extra CI database secrets are required: CI uses a disposable PostgreSQL service with synthetic credentials.

## Production environment

The server environment contains:

- `APP_IMAGE=ghcr.io/dvinav/app-evaluation-survey`, without a tag.
- `APP_VERSION=sha-<commit>`, updated by the deployment script.
- `SERVER_URL=https://uiux-survey.dvinav.ir`; production submissions require this exact origin.
- `DATABASE_URL` using the dedicated role/database on `shared-postgres:5432`.
- A unique random `PAYLOAD_SECRET` of at least 32 characters.
- `NODE_ENV=production`, `MEDIA_DIR=/app/media`, and `NEXT_TELEMETRY_DISABLED=1`.
- `TRUSTED_IP_HEADER=X-Real-IP` and `SUBMISSION_RATE_LIMIT=30` per ten minutes.

Database passwords and signing secrets are generated privately on the server. Do not copy local development `.env` files, real participant data, database dumps, or uploaded production icons into Git or Docker builds. The media directory must be writable by UID 1000, the runtime's `node` user; Uranus's deployment account currently uses the same UID.

For another host, create the external `proxy`/`database` networks, a dedicated PostgreSQL role/database, private `.env`, media directory, and HTTPS proxy before using this production Compose file. Update the repository variables and host pin accordingly. Never expose PostgreSQL publicly.

## Initial setup and administration

Install the committed `compose.production.yaml` as `compose.yml` in the deployment directory. The first configuration may use `APP_VERSION=uninitialized`; the first successful main deployment replaces it with a real image tag. Do not run the web service with the placeholder tag.

The public survey starts closed. Production is never populated with demonstration questions or participant information. After the first healthy deployment, create the first administrator privately on Uranus:

```sh
ssh uranus
cd /srv/applications/app-evaluation-survey
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -p 'Admin display name: ' ADMIN_NAME
read -rs -p 'Admin password (at least 16 characters): ' ADMIN_PASSWORD
printf '\n'
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
docker compose -f compose.yml run -T --rm --no-deps \
  -e ADMIN_EMAIL -e ADMIN_NAME -e ADMIN_PASSWORD \
  --entrypoint bun migrate run admin:create
unset ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
```

Open `https://uiux-survey.dvinav.ir/admin`, sign in, configure the final research/consent content, enter approved companies/applications and both independent question sets, and open response collection only after reviewing the study. Anonymous first-user registration is deliberately disabled.

For administrator recovery, use the same private prompt procedure and invoke `admin:reset-password` instead. It needs `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Outbound email, including password-reset emails and research-result distribution, is disabled. Maintenance scripts explicitly exit after flushing output because this Payload adapter retains a reserved PostgreSQL connection after `destroy()`.

## Deployment sequence and rollback

`scripts/deploy-production.sh`:

1. Accepts only an immutable `sha-` tag followed by seven hexadecimal characters.
2. Locks the deployment directory and saves the previous private environment.
3. Changes `APP_VERSION`, validates Compose, and pulls the paired web/maintenance images.
4. Runs the committed migrations using the maintenance image.
5. Restarts only `web` and waits up to 180 seconds for health.
6. On failure, restores the old environment and attempts to start the previous image. A failed first deployment removes only the failed web container; it does not remove media or databases.
7. Removes temporary environment and registry credential files.

The health endpoint verifies database connectivity and the migrated rate-limit table. Normal production deployment does not rebuild on the VPS, reset the database, seed data, or restart other applications.

A rollback cannot undo data-destructive or incompatible schema changes. Use backward-compatible forward migrations and take a backup before schema-changing releases. A previous image may be incompatible after a migration; restore into a separate database or apply a reviewed forward fix rather than assuming an image rollback can reverse the database.

The script is sent from the checked-out GitHub revision over SSH, as in Imazh. Server Compose is initially installed separately. If you change production Compose itself, install the reviewed new file on Uranus before deploying the corresponding revision; the workflow does not silently overwrite operator-managed server configuration.

## Manual release or recovery

For a public package, or after authenticating with a least-privilege package-read credential, an operator can run the same script manually:

```sh
ssh uranus
cd /srv/applications/app-evaluation-survey
sh ./deploy-production.sh sha-123abcd
```

Replace the sample tag with an actual published commit tag and install the matching committed script first. The workflow normally supplies that script through standard input, so keeping a server copy is optional. To inspect the running deployment:

```sh
cd /srv/applications/app-evaluation-survey
docker compose -f compose.yml ps
docker compose -f compose.yml logs --tail=100 web
```

Do not log or publish participant request bodies, private `.env` values, or database dumps.

## Backup and restoration

Back up the dedicated database and media together, preferably while response writes are paused. Keep backups outside the repository, protect them with encrypted storage and institution-approved retention, and rehearse restoration into an isolated database. For Uranus, the existing `/srv/backups` area can hold protected backup files:

```sh
umask 077
mkdir -p /srv/backups/app-evaluation-survey
docker exec shared-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d app_evaluation_survey -Fc' \
  > /srv/backups/app-evaluation-survey/database.dump
tar -C /srv/applications/app-evaluation-survey -czf \
  /srv/backups/app-evaluation-survey/media.tar.gz media
```

Store secrets and backup encryption keys separately. These commands overwrite the named backup files; use timestamped filenames in a real retention schedule. A successful dump alone is not a verified restore.

Restore only into an explicitly empty destination database/media directory with matching PostgreSQL tooling and the appropriate database owner. Stop survey writes, restore using `pg_restore --no-owner --role=app_evaluation_survey` under an authorized database administrator, then restore media with ownership suitable for UID 1000. Start the matching image and verify health, record counts, icons, and a protected export. Restoring over existing study data requires an explicit operator decision; it is not part of automated deployment.

## Local container verification

For a separate local environment using `compose.yaml`:

```sh
docker compose up -d db
docker compose build app migrate
docker compose run --rm migrate
docker compose --profile app up -d app
```

This local Compose stack has its own database volume and loopback ports. It is not the shared-infrastructure production stack. `docker compose down -v` deletes local volumes and must never be used as a routine production update procedure.
