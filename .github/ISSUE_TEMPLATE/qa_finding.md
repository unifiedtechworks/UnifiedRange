---
name: QA finding
about: Record a failed, blocked, or unexpected release QA check.
title: "[QA] "
labels: ''
assignees: ''
---

<!-- Use synthetic fixtures and redact evidence. Do not attach personal/private records, account IDs, credentials, tokens, signed URLs, private storage keys, or unredacted console/network dumps. -->

## Test context

- Release/commit and environment:
- Backend version (if known):
- Tester and date:
- Browser/device/viewport:
- Checklist section or test case from [Manual QA](../../docs/MANUAL_QA_CHECKLIST.md):
- Result: Fail / Blocked / unexpected behavior
- Affected route (use identifier placeholders):
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
- Frequency or blocker preventing execution:

## Public/private boundary checks

Record Pass / Fail / Blocked / N/A with a reason for each:

- Visitor and second-user access to private data/mutations is denied:
- Public UI and network responses contain only sanitized published data and eligible derivatives:
- Private originals/target photos remain private; moderator/admin permissions remain scoped:

## Evidence and follow-up

- Console errors: sanitized message, or none observed
- Network errors: operation name, HTTP status and sanitized error
- Screenshots: redacted attachment, or explain why unavailable
- Related bug/privacy issue and workaround:
- Retest: commit/environment, date, role, result, and evidence (complete after a fix)
