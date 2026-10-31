# Deployment and operations

## Requirements and secrets

Use Docker Engine with Compose v2, persistent disk, an HTTPS reverse proxy, and encrypted backup storage. The application image uses Node.js 24.22.2, a supported Payload/Next runtime. PostgreSQL 17.11 is pinned by image digest in Compose. The Node base uses an explicit patch tag; Docker dependency updates should be reviewed and images rebuilt regularly. The publishing workflow currently targets its Linux runner architecture (amd64).

Copy `.env.example` to `.env`. Generate a unique `PAYLOAD_SECRET` with `openssl rand -hex 32` and a strong database password with the same command. Set `SERVER_URL` to the exact HTTPS public origin. Do not reuse development credentials. Compose injects a connection URL using the internal `db` host; use a hex password or URL-encode reserved characters if configuring a URL yourself. Do not bake real secrets into builds or set them as `NEXT_PUBLIC_*` variables.

The production example binds the app to localhost only. Keep actual reverse-proxy networks, aliases, domains, and other host-specific wiring in a server-only `compose.server.yaml` override. This file is excluded from Git and Docker build contexts. Do not cache survey pages or authenticated APIs. Health checks use `/api/health` and report only readiness.

Leave `TRUSTED_IP_HEADER` empty for an installation-wide rate limit unless the proxy **overwrites** a dedicated header with exactly one verified client IP and the application cannot be reached around the proxy. Set the variable to that header name only after this arrangement exists. A comma-separated forwarding chain is deliberately rejected. Configure `SUBMISSION_RATE_LIMIT` for your study; retries count as requests. This storage-backed limiter supports multiple processes but does not replace network-level DoS protections.

## Local image build

From the configured repository:

```sh
docker compose up -d db
docker compose build app migrate
docker compose run --rm migrate
docker compose --profile app up -d app
```

The `migrate` service builds the maintenance target and executes the committed migrations before the standalone server starts. Host development can instead use `bun run migrate` before starting the application container. The runtime intentionally does not include Bun, application source, or the migration CLI.

## GitHub Container Registry

The repository includes `.github/workflows/deploy.yml`. Pull requests run formatting, lint, type, and unit checks without deployment secrets. Pushes to `main` and manual runs on `main` also build both Docker targets, publish them to GHCR, and deploy their exact digests. Forks do not publish or deploy. Actions are pinned by commit, with build cache, image provenance, and SBOM generation. Integration/browser testing remains available through the commands in the README; it is not part of this workflow.

The publishing job needs repository `contents: read` and `packages: write`; it authenticates to `ghcr.io` with the built-in `GITHUB_TOKEN`. The deployment job has only `packages: read` and sends its temporary token over SSH stdin. The server uses a temporary Docker credential directory, removed on exit. No personal access token or permanent server registry login is needed. Ensure Actions can create packages and that an existing package grants the repository access. Optionally change the package visibility to public in GitHub package settings for anonymous pulls. Public repository visibility alone does not guarantee public package visibility.

Two image targets share the same repository and use paired tags:

- `main` and `main-migrations` for the default branch.
- `sha-<full-commit>` and `sha-<full-commit>-migrations` for each published revision.

Deployment uses the two build outputs' `sha256` digests rather than either mutable `main` tag.

The maintenance image contains source, dependencies, Bun, scripts, and migrations; it runs `bun run migrate` by default. The application image contains Next standalone output/static assets and Node, runs as a non-root user, and has a persistent writable media directory. Migration images are larger maintenance tools and are not web servers.

The workflow keeps the SSH host, port, user, private key, and pinned host key in Actions secrets. No production hostname, IP address, domain, or credentials belong in this repository or its build context.

## GitHub Actions setup

In **Settings → Secrets and variables → Actions**, add these repository secrets (or environment secrets under the `production` environment):

| Secret               | Value                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| `DEPLOY_HOST`        | Server SSH IPv4 address or DNS hostname                                         |
| `DEPLOY_USER`        | Your existing SSH account, which must already have Docker access                |
| `DEPLOY_PORT`        | SSH port; optional, defaults to `22`                                            |
| `DEPLOY_SSH_KEY`     | Complete dedicated Ed25519 private key, including header/footer and newlines    |
| `DEPLOY_KNOWN_HOSTS` | Verified host-key line(s) for that exact host/port, copied over a trusted login |

Never add these values as workflow literals, build arguments, public repository variables, issues, or committed files. Verify host keys through an existing trusted SSH session; the workflow deliberately does not run `ssh-keyscan` or disable host verification. For a nondefault SSH port, the known-hosts hostname must be `[host]:port`.

Create the `production` environment in repository settings and restrict deployment branches to `main`. Add required reviewers if desired. Protect `main` and review workflow, Dockerfile, dependency, and migration changes: code merged there can run in production. Under **Settings → Actions → General**, permit the pinned actions and the workflow's declared token permissions. Do not enable write tokens for pull requests from forks.

After the dedicated key has been generated outside the checkout, the CLI can upload it without printing it:

```sh
gh secret set DEPLOY_SSH_KEY < "$HOME/.ssh/app-evaluation-survey-actions_ed25519"
gh secret set DEPLOY_KNOWN_HOSTS < "$HOME/.ssh/app-evaluation-survey-actions.known_hosts"
```

Set the other secrets in the UI, then push `main` or choose **Actions → Build, publish, and deploy → Run workflow** on `main`. The package is created by the first successful publishing job, before SSH deployment. An existing private package must grant this repository Actions access. The workflow does not configure DNS or create the first application administrator.

## Restricted SSH deployment

Install the two deployment scripts beside the production Compose file on the server, with directory mode `700`, script mode `700`, and configuration mode `600`. Keep their actual installation path, image repository, proxy wiring, domain, and application secrets on the server. The scripts derive their directory from their own location.

A server-only `.env.deploy` supplies `IMAGE_REPOSITORY`, the allowed GHCR package. A server-only `compose.server.yaml` supplies any host-specific Docker wiring. Neither file belongs in the public repository. The SSH key's `authorized_keys` entry uses `restrict` and forces the installed `deploy-ssh-entrypoint.sh` at its actual server path. That entrypoint invokes `deploy-server.sh`; the dedicated key cannot request a general shell, port forwarding, or file uploads.

The deploy script accepts only `check` or `deploy <app-digest> <migration-digest> <registry-user>`. A lock prevents overlapping deployments. It pulls images, starts PostgreSQL, stops the app, backs up the database and media, runs migrations, starts the app, waits for Docker health, and records successful digests in `.env`. Expect a brief maintenance window. Migration/startup failures may leave the app stopped; use the normal administrator key to investigate. It does not automatically revert database changes.

Review and update installed scripts and Compose files through the normal administrator SSH key when changing them. The deployment key cannot upload replacements. Remove its single `authorized_keys` entry and delete the GitHub secret to revoke it.

## Production setup

For manual operation, log in with the normal administrator key and change to the private deployment directory. Set `APP_IMAGE` and `MIGRATION_IMAGE` in the protected `.env` to matching published digests. The commands below include the server-only Compose override; omit its `-f` argument for installations without an override.

```sh
docker compose -f compose.production.yaml -f compose.server.yaml pull app migrate
docker compose -f compose.production.yaml -f compose.server.yaml up -d db
docker compose -f compose.production.yaml -f compose.server.yaml run --rm migrate
docker compose -f compose.production.yaml -f compose.server.yaml run --rm --entrypoint bun migrate run admin:create
docker compose -f compose.production.yaml -f compose.server.yaml up -d app
```

Before `admin:create`, temporarily supply `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` through the protected environment file. Remove the password afterward. The command refuses an existing administrator. Additional users are created through authenticated admin. For recovery, supply `ADMIN_EMAIL` and `ADMIN_PASSWORD` privately and use:

```sh
docker compose -f compose.production.yaml -f compose.server.yaml run --rm --entrypoint bun migrate run admin:reset-password
```

No outbound email service is configured. Forgot-password mail is intentionally unavailable instead of logging reset tokens. No automated results distribution runs.

Named media volumes initialize with the runtime's non-root ownership. The automated deployment's pre-start media backup also initializes that volume from the runtime image. For bind mounts, set ownership to the image's `node` user (UID 1000) before starting. Multiple replicas require shared media storage or a separately configured Payload storage adapter; independent local volumes are insufficient. Back up uploaded icons with the database.

## Migrations

The application never automatically pushes a schema or runs migrations at server start. Apply committed migrations once with the maintenance image, before starting a new app revision. Schema changes are created locally with `bun run migrate:create`, reviewed, and tested on a disposable database. Generated files should use explicit `type` imports for migration argument types so native Node TypeScript loading does not request nonexistent runtime exports.

Do not edit a migration after it has been deployed. The independent `survey_rate_limits` migration owns its operational table. Migration rollback exists in source for development, but a production rollback can destroy data; prefer forward fixes and validated backup restoration. Pause response collection or stop the app for non-backward-compatible schema changes.

## Backups

Automated deployments make owner-only pre-migration database and media backups under the deployment directory's `backups/<UTC-time>-<digest-prefix>/`. They contain sensitive application data. Configure off-host encrypted copies, monitor available disk space, and establish retention; the deploy script intentionally does not delete previous backups.

For additional manual backups, stop response writes while making a coordinated database/media backup if consistency matters. These commands create local backup files; store them only on protected encrypted storage, outside the repository, with institution-approved retention and access controls. They use Compose's configured PostgreSQL username/database rather than embedding credentials:

```sh
umask 077
mkdir -p backups
docker compose -f compose.production.yaml -f compose.server.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/database.dump
docker compose -f compose.production.yaml -f compose.server.yaml run --rm --no-deps --entrypoint tar app -C /app/media -czf - . > backups/media.tar.gz
```

Copy backups off-host through your approved encrypted mechanism. Include the application/image revision, database migration revision, and deployment configuration without plaintext secrets. Protect backup encryption keys separately. Check files are nonempty and regularly rehearse restoration into an isolated environment. A successful `pg_dump` alone is not a tested restore.

## Restore

For a new/isolated deployment with an empty database and media volume, start `db` and stop `app`, then restore before running the matching app image:

```sh
docker compose -f compose.production.yaml -f compose.server.yaml stop app
docker compose -f compose.production.yaml -f compose.server.yaml exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' < backups/database.dump
docker compose -f compose.production.yaml -f compose.server.yaml run -T --rm --no-deps --entrypoint tar app -C /app/media -xzf - < backups/media.tar.gz
docker compose -f compose.production.yaml -f compose.server.yaml up -d app
```

The restore assumes the destination is empty; restoring over existing research data requires an explicit operator decision and is not covered by a destructive one-liner. Use the same PostgreSQL major or a supported upgrade path. Verify health, admin access, collection counts, icons, and an export using protected data. Do not seed a restored production database.

## Updates

Back up first. Set both image variables to a matching release, then:

```sh
docker compose -f compose.production.yaml -f compose.server.yaml pull app migrate
docker compose -f compose.production.yaml -f compose.server.yaml stop app
docker compose -f compose.production.yaml -f compose.server.yaml run --rm migrate
docker compose -f compose.production.yaml -f compose.server.yaml up -d app
docker compose -f compose.production.yaml -f compose.server.yaml ps
```

Review health/logs without logging participant request bodies. Check a synthetic flow in a staging copy before collecting real responses. An incompatible migration can prevent running the prior image; restore into a new database or apply a reviewed forward fix rather than assuming an image-only rollback will work. `docker compose down -v` deletes study data and must not be used for routine updates.

## Operational limits

Rate-limit buckets expire on subsequent traffic rather than through a background scheduler. Exports and the descriptive dashboard use in-memory joins after paginated reads; benchmark large studies. File exports are downloaded directly and are not saved on the server by this configuration. The database and uploaded media still need retention, encryption, and backup controls. Production readiness additionally depends on your actual study instruments, ethics review, deployment configuration, monitoring, and an independent security review.
