# Contributing

Read the [README](README.md) and [architecture](docs/ARCHITECTURE.md) before changing the application. Use Node.js 24.22.1+ in the 24 LTS line and Bun 1.4.2. Install with `bun install --frozen-lockfile`, copy `.env.example` to `.env`, start PostgreSQL with `docker compose up -d db`, and run `bun run migrate` and `bun run dev`.

## Conventions

- Keep TypeScript strict and use generated Payload types. Keep business rules in `src/lib`, schema/access controls in collections, and rendering in focused components.
- Use English for source identifiers, comments, and documentation. Put all public interface strings in `messages/fa.json`; questions and consent are CMS content. Preserve RTL and isolate URLs/emails as LTR.
- Use native accessible controls, visible keyboard focus, and mobile layouts. Review light and dark themes. Do not store participant drafts in browser storage or add analytics/tracking without a reviewed research and privacy decision.
- Maintain independent question collections and immutable historical answers. Never silently transform raw ratings. Keep modes and instrument versions separate in analysis.
- Prettier uses two spaces, single quotes, no semicolons, trailing commas, and Tailwind sorting. Run `bun run format` before committing.

## Validation

Run `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build`. For persistence or security changes, run `bun run test:integration` with an explicitly disposable `TEST_DATABASE_URL` ending in `_test`. That command destroys and recreates the test database's public schema. For survey UI changes run `bun run test:e2e` on synthetic data; Chromium desktop/mobile cover both modes and themes.

When schemas change, run `bun run generate:types`, `bun run generate:importmap`, and `bun run migrate:create`, review SQL, apply it to a disposable database, and commit generated files. Do not enable automatic schema push or edit an already deployed migration. Test forward migration and recovery from backup when a change is destructive.

## Pull requests

Open a focused pull request describing the concrete behavior, relevant research/data implications, and commands actually run. Include screenshots for visual changes with synthetic content only. Add meaningful coverage for changed invariants rather than tests that repeat implementation. Explain migration and deployment steps where relevant.

Never commit participant information, database dumps, private notes, real contact information, credentials, `.env`, or media from actual companies without permission. Report security issues privately according to [SECURITY.md](SECURITY.md). Before external contributions are accepted, the owner must select the source license and contributor terms; MIT is recommended but has not been granted by this repository.
