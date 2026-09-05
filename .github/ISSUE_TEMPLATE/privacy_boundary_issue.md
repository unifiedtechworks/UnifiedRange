---
name: Privacy boundary issue
about: Report unexpected access, disclosure, or public/private boundary behavior safely.
title: "[Privacy] "
labels: ''
assignees: ''
---

<!-- Public issues are not a place for exposed data or live exploit details. Describe the data category and use synthetic fixtures/placeholders only. For a suspected live exposure, use GitHub private vulnerability reporting if enabled, or an established private maintainer channel. Do not attach real private records, account IDs, credentials, tokens, signed URLs, or private storage keys. -->

## Summary and impact

- Safe summary (no exposed values):
- Data category or unauthorized action involved:
- Intended access boundary and observed access:
- Environment and frontend/backend versions (if known):
- Browser/device:
- Affected route (use placeholders for identifiers):
- Account role used: visitor / new user / owner / second standard user / moderator / admin
- Severity: S1 critical / S2 high / S3 medium / S4 low (see [definitions](../../docs/RELEASE_PROCESS.md#severity-and-release-gates))
- Backend deploy required: yes / no / unknown; reason:

## Safe reproduction

Preconditions: use separate synthetic owner and non-owner accounts.

1.
2.
3.

- Expected result:
- Actual result (describe categories, not private values):
- Frequency and scope observed:

## Boundary checks

Record Pass / Fail / Blocked / N/A with a reason for each:

- Visitor cannot read or mutate private records, settings, or original images:
- Second standard user cannot read or mutate another owner's data:
- Public UI **and network responses** contain only sanitized published fields:
- Private originals, target photos, storage keys and private metadata stay private:
- Only eligible processed equipment-cover derivatives appear on saved public detail; Discover/profile cards remain image-free:
- Sign-out, refresh, visibility changes and supported unpublish/image-removal flows preserve the boundary:
- Moderator/admin report review exposes no private owner records and permits only report status updates:

## Sanitized evidence

- Console errors: sanitized message, or none observed
- Network errors: operation name, HTTP status and sanitized error; omit raw responses
- Screenshots: synthetic/redacted attachment, or explain why omitted
- Containment or workaround already taken, if any:
- Related private report reference (omit sensitive details):
