# Security policy

Do not report vulnerabilities containing exploit details or personal data in public issues. Use GitHub's **Security → Report a vulnerability** private advisory mechanism when the repository owner enables it. If unavailable, contact the repository owner privately through the contact channel on their GitHub profile; no reporting address is invented here. The owner should enable private vulnerability reporting before deploying publicly.

Include affected revision, a minimal reproduction using synthetic data, impact, and proposed remediation if available. Do not send production participant records, database dumps, passwords, or tokens. Do not test against somebody else's live study without their explicit permission. Acknowledgment and remediation times are not promised until maintainers establish a support policy.

The application restricts private collection APIs, analytical exports, administrator registration, and mutation of collected research data. Signed snapshots and server-side eligibility/scale validation protect questionnaire integrity. PostgreSQL transactions and a unique submission key protect persistence and retries. Abuse limits use short-lived keyed IP hashes only when a trusted proxy supplies a single verified IP; otherwise they apply installation-wide.

Deployment operators are responsible for HTTPS, reverse-proxy header rewriting, operating-system/container patching, secrets, encrypted storage/backups, database roles, administrator accounts, retention and deletion decisions, and applicable institutional ethics requirements. Never expose PostgreSQL publicly. Keep production debug logs disabled and avoid logging request bodies. Do not interpret administrator UI visibility as an access-control boundary.

Email delivery is disabled. Use the documented server-side recovery script instead of exposing a bootstrap endpoint. Review dependency updates for Payload/Next compatibility and keep all Payload packages at the same release. This repository has not undergone an independent security audit or penetration test.
