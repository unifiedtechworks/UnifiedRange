## Change

- Problem and resulting behavior:
- Related issues:
- Affected routes (use identifier placeholders; N/A for docs-only):
- Severity of fixed issue: S1 / S2 / S3 / S4 / N/A

## Reproduction and verification

Preconditions and steps to reproduce the original issue or verify the change:

1.
2.
3.

- Expected result:
- Actual result after change:
- Account roles used: visitor / new user / owner / second standard user / moderator / admin / N/A
- Environment, commit, browser/device:
- Console/network errors: none observed, or sanitized operation/status/error
- Screenshots: redacted before/after evidence for UI changes, or N/A with reason

## Public/private boundaries

Record Pass / Fail / Blocked / N/A with a reason; use the [Manual QA Checklist](../docs/MANUAL_QA_CHECKLIST.md) for details.

- Visitor and second-user private reads/mutations:
- Sanitized public UI and network responses; private originals and target photos stay private:
- Public derivative eligibility, consent and removal (if affected):
- Moderator/admin report-review scope (if affected):

## Deployment and validation

- Backend deploy required: **yes / no / unknown**; reason and affected resources:
- Schema/auth/storage/function changes: none, or describe
- Deployment order, dependencies and rollback plan (N/A with reason for docs-only):
- Release risks, known issues and follow-up owners:

Record Pass / Fail / Not run with a reason and relevant sanitized output:

- `npm run amplify:typecheck`:
- `npm run lint`:
- `npm run build`:
- `git diff --check`:
- Manual QA sections exercised and results:

<!-- Do not attach private records, account IDs, credentials, tokens, signed URLs, private storage keys, or raw console/network dumps. See docs/RELEASE_PROCESS.md for release gates. -->
