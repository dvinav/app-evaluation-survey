# app-evaluation-survey

Collect Persian academic questionnaires that evaluate software applications through UI/UX ratings, and export reproducible datasets for subsequent research.

Researchers enroll companies that agree to hiring-manager interviews, explicitly publish eligible applications, and ask participants to evaluate applications they have used. Recruitment interviews and qualitative analysis take place separately. Application scores are not employer rankings and do not establish causal relationships with recruitment practices.

## Features

- **Persian survey:** RTL, mobile-first, accessible native controls, seven-point agreement scales, independent general and detailed instruments, and persistent light/dark theme preference.
- **Research integrity:** signed 24-hour questionnaire snapshots, exact question and consent history, raw ratings, separate missing and non-applicable responses, transactional persistence, and retry idempotency.
- **Administration:** integrated Persian Payload CMS, company enrollment, icon uploads, question ordering and automatic revisions, survey availability, and restricted participant records.
- **Analysis:** CSV/JSON exports, normalized answer datasets without participant identity, respondent-weighted descriptive rankings separated by mode, instrument version, and dimension.
- **Operations:** PostgreSQL migrations, Docker deployment, GHCR publishing, CI, and unit, database integration, and browser tests.

## Contents

- [Getting started](#getting-started)
- [Survey configuration](#survey-configuration)
- [Environment](#environment)
- [Development and tests](#development-and-tests)
- [Exports and analysis](#exports-and-analysis)
- [Deployment](#deployment)
- [Security and limitations](#security-and-limitations)
- [Documentation](#documentation)
- [License](#license)

## Getting started

Requirements: Node.js 24.22.1 or later in the Node 24 LTS line (the image uses 24.22.2), Bun 1.4.2, and Docker Compose v2. PostgreSQL 17 is the tested database. Next.js 16.4.3 and all Payload packages at 3.92.1 are pinned together; `bun.lock` fixes transitive dependencies. Compatibility was checked against the [Payload installation documentation](https://payloadcms.com/docs/getting-started/installation) and the installed `@payloadcms/next` peer requirements. The local `node` development dependency also supplies a supported binary if your system Node differs; select it with `export PATH="$PWD/node_modules/node/bin:$PATH"` after installing.

After cloning this repository, run these commands from its root:

```sh
bun install --frozen-lockfile
cp .env.example .env
docker compose up -d db
bun run migrate
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). An empty installation displays the survey-unavailable state. Create an administrator in a second terminal:

```sh
read -r ADMIN_EMAIL
read -r ADMIN_NAME
read -rs ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
bun run admin:create
unset ADMIN_PASSWORD
```

Enter the email, display name, and a password of at least 16 characters, one per prompt. The password is read without echoing. This command works only before the first administrator exists; add subsequent administrators through authenticated Payload administration. Open [http://localhost:3000/admin](http://localhost:3000/admin) to sign in. Anonymous first-user registration is blocked by a collection hook, including Payload's special bootstrap endpoint.

For a disposable demonstration, before creating any companies:

```sh
ALLOW_DEMO_SEED=true bun run seed
```

Seeding creates two synthetic applications and two clearly marked demonstration questions in each mode, then opens the survey. These questions are **not validated research instruments**. Seeding refuses production mode and a nonempty company collection. Do not collect real participant information in the demonstration installation.

## Survey configuration

1. Configure research settings: title, introduction, informed consent, consent version, contact information, and availability. The consent must describe voluntary participation, collected information, research use, retention, optional identity handling, and applicable withdrawal arrangements. Have the relevant academic ethics process review the actual study.
2. Create companies and record both participation agreement and interview agreement.
3. Upload application icons, associate applications with companies, set display order, and explicitly enable both active and public flags. Company agreement never publishes applications automatically.
4. Enter the final researcher-supplied questions in **General Questions** and **Detailed Questions** independently. Stable identifiers cannot change; edits increment question versions automatically. Configure required status, optional non-applicable answers, dimension, and reverse-scoring metadata.
5. Activate the intended questions, review both modes, and open the survey in research settings. Change the consent version whenever the consent changes.

Public URLs have no locale prefix. All interface strings live in `messages/fa.json`; research content comes from Payload. The current locale is only `fa`, using next-intl without locale routing.

## Environment

See [.env.example](.env.example) for all configuration. `.env` is ignored by Git and Docker builds.

| Variable                                            | Purpose                                                                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAYLOAD_SECRET`                                    | Required private signing/encryption key, at least 32 characters; generate with `openssl rand -hex 32`. Rotating it invalidates sessions and admin tokens. |
| `DATABASE_URL`                                      | Required PostgreSQL connection URL for local scripts and application. Compose overrides the host to `db`.                                                 |
| `SERVER_URL`                                        | Exact public origin, including scheme and port; used for origin/CSRF checks. Use HTTPS in production.                                                     |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Compose database initialization. URL-encode special characters in connection URLs; prefer a hex-generated password for Compose interpolation.             |
| `MEDIA_DIR`                                         | Writable media directory; default `media`, `/app/media` in containers.                                                                                    |
| `TRUSTED_IP_HEADER`                                 | Optional single-IP header overwritten by a trusted reverse proxy. Empty uses an installation-wide limit.                                                  |
| `SUBMISSION_RATE_LIMIT`                             | Submission attempts per ten minutes; defaults to 30 per trusted IP or 300 installation-wide.                                                              |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`       | Temporary bootstrap-script inputs; password must be at least 16 characters.                                                                               |
| `TEST_DATABASE_URL`                                 | Disposable integration database URL whose database name ends in `_test`. **The integration suite resets its public schema.**                              |
| `APP_IMAGE`, `MIGRATION_IMAGE`                      | Production application image and matching maintenance image, respectively; support separate immutable digests.                                            |

## Development and tests

```sh
bun run format
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
bun run start
```

The build does not require a running database. Runtime pages and health checks do. Run only one development or production server on port 3000.

For integration tests, create a separate disposable database:

```sh
docker compose exec db createdb -U survey survey_test
TEST_DATABASE_URL=postgres://survey:local-development-password@localhost:5432/survey_test bun run test:integration
```

That URL matches the local sample configuration; use your configured password if changed. Integration tests apply the committed migrations to a clean schema, seed synthetic data, and exercise real transactions, rollback, idempotency, historical snapshots, access controls, normalized exports, and HTTP validation. They never reset the ordinary `survey` database.

For browser tests against a locally seeded database:

```sh
bunx playwright install chromium
bun run build
bun run test:e2e
```

Playwright starts the production server when one is not running. To include authenticated admin browser checks, supply `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` for a synthetic test administrator; otherwise that additional test is skipped. `PLAYWRIGHT_EXECUTABLE_PATH` can select an installed Chrome executable if the bundled Chromium download is unavailable. Desktop and mobile Chromium cover both modes, multiple applications, back navigation, RTL, conditional fields, theme persistence, and retry after a lost response. Browser tests submit synthetic responses to their configured database. CI uses only the disposable database for both integration and browser tests.

After schema changes, generate and review migrations and generated types:

```sh
bun run generate:types
bun run generate:importmap
bun run migrate:create
bun run migrate
```

Automatic schema push is disabled in all environments. Review the generated SQL and commit migrations, their schema snapshots, generated types, and the import map together. The custom rate-limit table has its own explicit migration.

## Exports and analysis

The Payload admin dashboard includes date and questionnaire-mode filters, descriptive results, and working CSV/JSON downloads for participants, evaluations, answers, companies, applications, and both question collections. Dates are inclusive UTC calendar dates. Company/application/question configuration datasets ignore response date and mode filters. The export endpoint also accepts an `application` numeric ID filter for response datasets.

The official Payload import/export plugin adds raw collection exports with list filters and selections. Import, saved exports, and queued exports are disabled. Identity fields and submission snapshots are excluded from the plugin's submission exports; email contacts are not enabled for export. The custom flattened exports are the preferred analytical format. CSV uses UTF-8 BOM, quoted fields, CRLF, and spreadsheet formula protection. JSON preserves numbers, booleans, and nulls.

Scores are descriptive means of separately reverse-adjusted answers, first per respondent/application, then averaged across respondents. Raw scores remain untouched. General and detailed results and different instrument versions are never pooled. Dimensions also have separate rows. Rankings show sample sizes and warn for fewer than ten valid evaluations; ten is a display heuristic, not a scientific adequacy threshold. See [research methodology and columns](docs/RESEARCH.md).

## Deployment

Use the [deployment guide](docs/DEPLOYMENT.md) for local Docker builds, GHCR image publication, production Compose, administrator setup, migrations, encrypted backups, restoration, and pull/restart updates. Production uses a non-root Node.js standalone image and persistent database/media volumes. Maintenance runs from a separate matching image, before application startup.

The GitHub workflow checks formatting, lint, types, and unit tests on pull requests. On `main`, it also builds and publishes application and maintenance images to GHCR, then deploys their exact digests through a restricted SSH key. Production connection details live in Actions secrets; application secrets stay on the server. See the [Actions setup and deployment guide](docs/DEPLOYMENT.md#github-actions-setup) for required secrets and manual configuration.

## Security and limitations

Private collections, exports, and statistics require authenticated administrators at the API level. Research records are immutable through the admin API. Deactivate applications or withdraw companies rather than deleting them. Optional identity is held only in restricted submission records; results-request emails are stored separately and omitted from analytical exports. The system does not promise anonymity when optional names or profile URLs are supplied.

Use TLS, encrypted storage/backups, least-privilege database credentials, restricted admin access, and a retention policy appropriate to your institution. Email delivery is intentionally disabled, including admin reset emails; use `bun run admin:reset-password` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` supplied privately for recovery. No email body or reset token is logged by a fallback email adapter. Research-result distribution is not implemented.

Sessions expire after 24 hours. Closing or reloading the page discards unsubmitted answers. A final submission attempt locks editing and retries its identical payload after network failure. Eligibility withdrawal or survey closure rejects uncommitted sessions; question edits do not alter them. Idempotency prevents retry duplicates, while a fresh page permits intentional repeat participation.

Exports and statistics read all matching records into server memory using paginated reads under a consistent database snapshot. This design suits moderate academic datasets; benchmark your expected size and add streaming/background analysis before very large deployments. No statistical significance testing, psychometric validation, interview analysis, automated retention purge, or participant recovery token is provided. Use an institution-approved manual deletion procedure as described in the data-model guide. The software cannot validate a questionnaire or resolve sampling bias.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data model and retention](docs/DATA_MODEL.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
- [Research methodology and exports](docs/RESEARCH.md)
- [Contributing](CONTRIBUTING.md)
- [Responsible security reporting](SECURITY.md)
- [Verification record and environment limitations](docs/VERIFICATION.md)

GitHub repository description:

> Open-source questionnaire platform for evaluating and ranking software applications based on UI/UX ratings. Built with Next.js and Payload CMS.

## License

MIT is recommended for the source code. The repository owner has not selected a license, so no license grant is made and no `LICENSE` file is fabricated. Decide and add a license before inviting reuse or representing the repository as licensed open source. Research instruments, company icons, and research data may require separate permissions.
