# Architecture

## Runtime boundaries

A single Next.js 16 App Router application contains the public survey and Payload 3 administration/REST API. React Server Components read CMS content through Payload's Local API. Interactive survey components receive only a sanitized catalog and signed snapshots; private notes, email contacts, and other submissions never enter the public component tree. The public route is rendered dynamically and is not cached across participants.

- `src/app/(public)`: Persian layout, next-intl provider, survey page, submission route, health route, and authenticated analytical routes.
- `src/app/(payload)`: official Payload root layout, generated import map, admin pages, and REST handlers. GraphQL is disabled.
- `src/collections` and `src/globals`: data schema, admin labels, validation hooks, and API access controls.
- `src/lib`: catalog sanitization, signing, server validation, transactions, request limits, flattened exports, and statistics.
- `src/components`: focused participant/selection/rating controls and integrated admin dashboard.
- `src/migrations`: committed Payload schema migrations plus the explicit rate-limit-table migration.

PostgreSQL is the only durable database. Uploaded application icons live in a persistent filesystem volume. No third-party analytics or participant-account service is used.

## Survey request flow

1. A server-rendered page reads research settings, agreed companies, explicitly active/public applications, and two independently ordered question collections.
2. Each available mode receives a content-hashed instrument version and an HMAC-signed session containing exact questions, scale, consent, application/company identity, a fresh UUID, and a 24-hour expiry. The version hashes the mode, ordered questions, and scale; changing the eligible application list or consent does not split an otherwise identical analytical instrument. Exact consent and applications remain in the signed snapshot.
3. React Hook Form handles participant conditionals and consent. Hidden fields are cleared on toggling and normalized again on the server. The selected mode uses exactly one question collection. Back navigation retains in-memory data; changing mode resets application answers.
4. Each selected application receives the same questions, one application at a time. Native radio inputs keep keyboard semantics and a consistent seven-point scale. Optional unanswered answers and explicit NA answers remain distinct.
5. The submission endpoint enforces origin, content type/body limit, and a PostgreSQL-backed rate limit. Zod validates input. The server verifies the signature, expiry, mode, application/question membership, required answers, integer ratings, and NA permission. Client texts and company relationships are never accepted as authoritative.
6. A serializable transaction rechecks survey availability and current application/company eligibility, creates the parent submission, evaluations, every question response, and any separate email subscription. All writes share Payload's transaction ID. Failure rolls them all back.
7. The UUID is unique in the database. The server compares a normalized request hash for retries; identical retries return success, while reuse with a changed payload returns conflict. A race loser checks for the committed winner after rollback. Serialization failures without a visible winner return a retryable server error. The UI freezes the first final request and resends its exact body after a transport failure.
8. Confirmation exposes no database identifier and clears participant/answer state. A fresh navigation can intentionally start another session.

## Authorization

Collection access is denied unless `req.user.collection === 'admin-users'`, except public read of icon media. Anonymous CMS reads of research settings, questions, companies, and applications are also denied: the public server page provides the explicit safe projection instead. Collected research data permits admin reads but no API create/update/delete; only the dedicated validated server path writes it through trusted Local API calls.

Payload Local API overrides access by default. Calls here are confined to trusted server modules; anonymous request bodies cannot supply `overrideAccess`, `context`, relationships, or collection slugs. All custom research routes authenticate with Payload before reading data. Company/application deletion is disabled through the API to protect historical relations. Deactivation and withdrawal are the supported operations.

A hook blocks unauthenticated administrator creation even through Payload's special first-user endpoint. A CLI supplies a server-only bootstrap context. The ordinary application never accepts that context from a client. Login attempts and token expiry use Payload authentication. Production admin cookies are secure and SameSite Strict. Email delivery is explicitly disabled; password recovery requires trusted server access.

## Presentation

`fa` is the sole current next-intl locale, without route prefixes or a selector. All public interface strings live in `messages/fa.json`; dynamic research text comes from CMS. `<html lang="fa" dir="rtl">`, locally bundled Vazirmatn, LTR URL/email fields, semantic controls, focus styles, responsive widths, and reduced-motion support serve the Persian interface.

The UI uses #2563EB, neutral backgrounds, restrained borders, and no decorative motion. `next-themes` follows the operating system initially and persists only the theme selection in browser storage. Participant data is never persisted as a browser draft. Theme menus use native disclosure semantics. Desktop/mobile browser tests verify direction, overflow, back navigation, submission, and theme persistence.

## Analysis and exports

Authenticated routes read paginated data under a repeatable-read, read-only transaction, then join it in memory. Exports use explicit column allowlists, keeping identity outside ordinary analysis. The official Payload plugin separately exports permitted source collections, with identity fields excluded, no imports, no saved export files, and no queued work.

Statistics first calculate each respondent/application mean from numeric answers, applying reverse adjustment separately (`8 - raw_rating`). They then aggregate respondent scores with equal respondent weight. Mode, content version, and dimension remain separate strata. Sample size, missingness, NA, and exclusions accompany descriptive ranks. These defaults are a transparent convenience, not a validated scoring instrument.

## Deliberate limits

No participant accounts, cross-session draft recovery, automatic emails, interview analysis, automated causal inference, or psychometric validation are implemented. Export/statistics memory grows with dataset size. The database rate limiter is shared across app replicas, while filesystem media requires one host or shared persistent storage across replicas. Remote/object media storage and background streaming exports are future scaling changes that need explicit design and tests.

The application has two official root layouts (public and Payload). A localized `global-not-found.tsx` uses Next's documented `experimental.globalNotFound` option to handle unmatched paths consistently across those roots. This is the sole experimental configuration; its generated Persian 404 is covered by browser tests. Revisit this option when upgrading Next. See the [Next not-found documentation](https://nextjs.org/docs/app/api-reference/file-conventions/not-found#global-not-foundjs-experimental). Payload's own [i18n support](https://payloadcms.com/docs/configuration/i18n) provides Persian/RTL administration.

## Development networking and UI motion

In development only, resource CORS permits all origins, the anonymous submission route accepts LAN/tunnel origins and OPTIONS preflights, and Payload resource CORS is open. Production submissions still require the exact `SERVER_URL` origin. Next's development asset allowlist uses `**.*` (all dotted hostnames and IPv4 addresses), the local hostname, and local interface addresses; Next deliberately rejects a standalone `*` wildcard. Local uploaded-media links are projected as relative URLs so a phone never tries to fetch icons from its own `localhost`.

Use one development server on port 3000. A stale standalone production server can compete with a development listener on another address family and serve the wrong origin policy to mobile traffic. `bun run dev` is the mobile-testing command; `bun run start` intentionally retains production origin checks.

Native checkbox/radio controls now have CSS state transitions, as do button presses, input focus/error outlines, selection cards, progress, theme surfaces, disclosures, and validation messages. Conditional fields expand and collapse with inert/ARIA-hidden content during the exit. Survey navigation uses named View Transitions with forward/back RTL direction and an entry-transition fallback; the page template also provides route entry feedback. All motion respects `prefers-reduced-motion`. Questionnaire workload text derives both counts from the administered snapshots and explicitly reports extra questions when the detailed instrument is longer.
