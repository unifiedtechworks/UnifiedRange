---
name: Bug report
about: Report a reproducible UnifiedRange defect.
title: "[Bug] "
labels: ''
assignees: ''
---

<!-- Use synthetic data and route placeholders. Redact screenshots and logs; never attach credentials, tokens, signed URLs, private storage keys, account IDs, or personal/private records. -->

## Summary and context

- Summary:
- Environment: local / hosted dev / staging / other
- Frontend commit and backend version (if known):
- Browser/device:
- Affected route (for example, `/passports/[passportId]`):
- Account role used: visitor / new user / owner / second standard user / moderator / admin
- Severity: S1 critical / S2 high / S3 medium / S4 low (see [definitions](../../docs/RELEASE_PROCESS.md#severity-and-release-gates))
- Backend deploy required: yes / no / unknown; reason:

## Reproduction

Preconditions and synthetic fixtures:

1.
2.
3.

- Expected result:
- Actual result:
- Frequency: always / intermittent (include attempts)

## Public/private boundary checks

Record Pass / Fail / Blocked / N/A with a reason for each:

- Signed-out access to the affected route and its network responses:
- Second user's access to the owner's private records/images and mutations:
- Public pages expose only sanitized snapshots and eligible public derivatives:
- Moderator/admin access remains within the intended report-review scope (if applicable):

## Evidence

- Console errors: sanitized message, or none observed
- Network errors: operation name, HTTP status and sanitized error; no raw payloads or URLs
- Screenshots: redacted attachment, or explain why unavailable
- Workaround and related issues:
