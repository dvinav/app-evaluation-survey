# Deployment and operations

## Requirements and secrets

Use Docker Engine with Compose v2, persistent disk, an HTTPS reverse proxy, and encrypted backup storage. The application image uses Node.js 24.22.2, a supported Payload/Next runtime. PostgreSQL 17.11 is pinned by image digest in Compose. The Node base uses an explicit patch tag; Docker dependency updates should be reviewed and images rebuilt regularly. The publishing workflow currently targets its Linux runner architecture (amd64).

Copy `.env.example` to `.env`. Generate a unique `PAYLOAD_SECRET` with `openssl rand -hex 32` and a strong database password with the same command. Set `SERVER_URL` to the exact HTTPS public origin. Do not reuse development credentials. Compose injects a connection URL using the internal `db` host; use a hex password or URL-encode reserved characters if configuring a URL yourself. Do not bake real secrets into builds or set them as `NEXT_PUBLIC_*` variables.

Only localhost port 3000 is published in production; PostgreSQL has no public port. Put an HTTPS reverse proxy in front. Configure request size limits around 512 KB, timeouts suitable for legitimate submissions/exports, admin/login request limiting, and HSTS at the HTTPS edge. Do not cache survey pages or authenticated APIs. Health checks use `/api/health` and report only readiness, without secrets or database details.

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

The repository includes `.github/workflows/ci.yml` and `.github/workflows/publish.yml`. CI runs on pushes to `main` and pull requests. Publication runs on `main` and version tags beginning with `v`, with SHA-pinned actions, cache, image provenance, and SBOM generation.

The publishing job needs repository `contents: read` and `packages: write`; it authenticates to `ghcr.io` with the built-in `GITHUB_TOKEN`. No extra personal token is required for publishing when repository/organization policy permits those permissions. Ensure Actions can create packages and that an existing package grants the repository access. Change the package visibility to public in GitHub package settings if anonymous production pulls are intended. Public repository visibility alone does not guarantee public package visibility.

Two image targets share the same repository and use paired tags:

- `main` and `main-migrations` for the default branch.
- `v0.1.0` and `v0.1.0-migrations` for a matching release tag.
- Commit-derived tags for reproducible rollout selection.

The maintenance image contains source, dependencies, Bun, scripts, and migrations; it runs `bun run migrate` by default. The application image contains Next standalone output/static assets and Node, runs as a non-root user, and has a persistent writable media directory. Migration images are larger maintenance tools and are not web servers.

For private image pulls, authenticate on the host using `docker login ghcr.io` with a short-lived or least-privilege token that has package read permission. Do not put that token in `.env`, Compose, or Git. No SSH hostname, deployment credential, or domain is assumed by the workflows.

## Production setup

Place `compose.production.yaml` and a protected `.env` on the host. Set `APP_IMAGE` to the published application tag or digest and `MIGRATION_IMAGE` to the matching maintenance tag or digest. Use immutable release tags/digests for controlled deployments. The two image variables are independent so digest pinning is valid.

```sh
docker compose -f compose.production.yaml pull app migrate
docker compose -f compose.production.yaml up -d db
docker compose -f compose.production.yaml run --rm migrate
docker compose -f compose.production.yaml run --rm --entrypoint bun migrate run admin:create
docker compose -f compose.production.yaml up -d app
```

Before `admin:create`, temporarily supply `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` through the protected environment file. Remove the password afterward. The command refuses an existing administrator. Additional users are created through authenticated admin. For recovery, supply `ADMIN_EMAIL` and `ADMIN_PASSWORD` privately and use:

```sh
docker compose -f compose.production.yaml run --rm --entrypoint bun migrate run admin:reset-password
```

No outbound email service is configured. Forgot-password mail is intentionally unavailable instead of logging reset tokens. No automated results distribution runs.

Named media volumes initialize with the runtime's non-root ownership. For bind mounts, set ownership to the image's `node` user (UID 1000) before starting. Multiple replicas require shared media storage or a separately configured Payload storage adapter; independent local volumes are insufficient. Back up uploaded icons with the database.

## Migrations

The application never automatically pushes a schema or runs migrations at server start. Apply committed migrations once with the maintenance image, before starting a new app revision. Schema changes are created locally with `bun run migrate:create`, reviewed, and tested on a disposable database. Generated files should use explicit `type` imports for migration argument types so native Node TypeScript loading does not request nonexistent runtime exports.

Do not edit a migration after it has been deployed. The independent `survey_rate_limits` migration owns its operational table. Migration rollback exists in source for development, but a production rollback can destroy data; prefer forward fixes and validated backup restoration. Pause response collection or stop the app for non-backward-compatible schema changes.

## Backups

Stop response writes while making a coordinated database/media backup if consistency matters. These commands create local backup files; store them only on protected encrypted storage, outside the repository, with institution-approved retention and access controls. They use Compose's configured PostgreSQL username/database rather than embedding credentials:

```sh
umask 077
mkdir -p backups
docker compose -f compose.production.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/database.dump
docker compose -f compose.production.yaml run --rm --no-deps --entrypoint tar app -C /app/media -czf - . > backups/media.tar.gz
```

Copy backups off-host through your approved encrypted mechanism. Include the application/image revision, database migration revision, and deployment configuration without plaintext secrets. Protect backup encryption keys separately. Check files are nonempty and regularly rehearse restoration into an isolated environment. A successful `pg_dump` alone is not a tested restore.

## Restore

For a new/isolated deployment with an empty database and media volume, start `db` and stop `app`, then restore before running the matching app image:

```sh
docker compose -f compose.production.yaml stop app
docker compose -f compose.production.yaml exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' < backups/database.dump
docker compose -f compose.production.yaml run -T --rm --no-deps --entrypoint tar app -C /app/media -xzf - < backups/media.tar.gz
docker compose -f compose.production.yaml up -d app
```

The restore assumes the destination is empty; restoring over existing research data requires an explicit operator decision and is not covered by a destructive one-liner. Use the same PostgreSQL major or a supported upgrade path. Verify health, admin access, collection counts, icons, and an export using protected data. Do not seed a restored production database.

## Updates

Back up first. Set both image variables to a matching release, then:

```sh
docker compose -f compose.production.yaml pull app migrate
docker compose -f compose.production.yaml stop app
docker compose -f compose.production.yaml run --rm migrate
docker compose -f compose.production.yaml up -d app
docker compose -f compose.production.yaml ps
```

Review health/logs without logging participant request bodies. Check a synthetic flow in a staging copy before collecting real responses. An incompatible migration can prevent running the prior image; restore into a new database or apply a reviewed forward fix rather than assuming an image-only rollback will work. `docker compose down -v` deletes study data and must not be used for routine updates.

## Operational limits

Rate-limit buckets expire on subsequent traffic rather than through a background scheduler. Exports and the descriptive dashboard use in-memory joins after paginated reads; benchmark large studies. File exports are downloaded directly and are not saved on the server by this configuration. The database and uploaded media still need retention, encryption, and backup controls. Production readiness additionally depends on your actual study instruments, ethics review, deployment configuration, monitoring, and an independent security review.
