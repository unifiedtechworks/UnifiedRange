# Account Data Lifecycle Plan

## Status and Scope

UnifiedRange does not currently provide account export or account deletion. The Settings placeholder at `/settings/account` describes the intended experience but performs no action. This plan defines a future backend-controlled lifecycle without changing the current schema or deployment.

The lifecycle must preserve the product's private-by-default boundary. A browser client must never be trusted to enumerate, export, or delete all account data on its own. Future workflows should run with narrowly scoped server-side authorization, an auditable job record, idempotent steps, and explicit failure/retry states.

## Data Inventory and Ownership

| Data | Lifecycle responsibility |
| --- | --- |
| `UserProfile` | Export as account data; delete after dependent cleanup succeeds. |
| `EquipmentPassport` | Export; delete as private owner data. |
| `ProjectileProfile` | Export; delete as private owner data. |
| `OpticSightProfile` | Export; delete as private owner data. |
| `RangeSession` | Export; delete as private owner data. |
| `TargetPhoto` | Export record metadata; delete record and referenced private S3 object. |
| `MaintenanceLogEntry` | Export; delete as private owner data. |
| `HuntingChecklist` | Export; delete as private owner data. |
| Private S3 images | Include inventory references in JSON; future ZIP may include image bytes. Delete objects through the backend cleanup job. |
| `PublicPassportSnapshot` | Export when owned by the user; unpublish and delete by default during deletion. |
| `PublicUserProfileSnapshot` | Export as public identity metadata; delete or tombstone with the approved username policy. |
| `Comment` | Export comments authored by the user; anonymize or delete under the selected deletion policy. |
| `Reaction` | Export reactions created by the user when useful; delete during account deletion. |
| `Report` | Export the user's submitted reports subject to safety review; preserve moderation facts while anonymizing reporter identity after deletion. |
| `UsernameReservation` | Include username in export; release or tombstone after deletion according to abuse policy. |

## Proposed Lifecycle States

Possible future `UserProfile` or dedicated job fields include `accountStatus`, `deletionRequestedAt`, `deletedAt`, `exportRequestedAt`, and `exportStatus`. A dedicated account-lifecycle job model may be safer than putting operational details on `UserProfile`, because it can retain audit and retry state after the profile is removed.

Suggested account states are `active`, `pendingDeletion`, `deletionInProgress`, `deleted`, and `deletionFailed`. Suggested export states are `requested`, `processing`, `ready`, `expired`, and `failed`. These are planning concepts only; no fields are added in the current task.

## Security and Privacy Requirements

- Require a fresh Cognito session, re-authentication, or comparably strong confirmation before a future deletion request.
- Perform export and deletion server-side with least-privilege access; do not rely on a sequence of client-side AppSync deletes.
- Resolve records by verified Cognito identity, never by a user-supplied owner ID alone.
- Preserve private/public boundaries in generated exports and status pages.
- Never publish private data, private image keys, signed image URLs, or export download locations on public pages.
- Use short-lived, authenticated download authorization for completed exports.
- Include private S3 object cleanup and verify it before completing deletion.
- Make deletion idempotent so retries do not skip data or corrupt moderation records.
- Keep job logs free of private record contents, credentials, signed URLs, and image data.
- Preserve reports or other safety records when deletion would break moderation integrity; remove or pseudonymize the account link exposed to reviewers.

## Recommended Delivery Order

1. Approve deletion, public-content, report-retention, and username-reuse policies.
2. Design a dedicated server-side lifecycle job and least-privilege IAM permissions.
3. Implement JSON export before deletion so ownership queries and completeness checks are exercised safely.
4. Add re-authentication, confirmation, cancellation window, and job-status UI.
5. Implement deletion in dependency order with dry-run inventory and idempotency tests.
6. Test partial failures, retries, expired exports, S3 cleanup, and moderation anonymization before enabling destructive controls.

See `ACCOUNT_DELETION_PLAN.md` and `DATA_EXPORT_PLAN.md` for the proposed MVP policies.
