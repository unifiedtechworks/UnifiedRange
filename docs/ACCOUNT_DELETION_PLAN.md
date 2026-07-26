# Account Deletion Plan

## Current Status

Destructive account deletion is not implemented. The `/settings/account` control is disabled and must remain so until a backend-controlled workflow, retention policy, and recovery behavior are reviewed.

## Proposed MVP Policy

1. The signed-in user chooses **Delete my account** and sees an impact summary.
2. The app requires re-authentication or another strong confirmation and records a deletion request.
3. The account enters `pendingDeletion` for a short cancellation window. Sign-in behavior during this state must be defined explicitly.
4. A backend job inventories records by the verified Cognito identity and records an idempotency key.
5. The job unpublishes public snapshots, deletes private database records, deletes private S3 objects, and applies the approved social/moderation policies.
6. The job verifies cleanup before disabling or deleting the Cognito user.
7. Minimal operational audit data is retained without private content or reusable credentials.

Deleting Cognito first is unsafe because it can make owner-scoped records and private objects harder to identify and clean up. The identity should be disabled or deleted only after dependent cleanup reaches a verified terminal state.

## Proposed Data Treatment

- `UserProfile`: delete after dependent data cleanup.
- Private equipment, projectile, optic, range-session, target-photo, maintenance, and readiness records: delete.
- Private S3 equipment and target images: delete by exact backend-resolved keys; record completion without logging keys publicly.
- `PublicPassportSnapshot`: unpublish immediately when deletion processing begins, then delete. An anonymized preservation option should require a later explicit product decision.
- Comments: recommended MVP policy is anonymization when conversation integrity matters, otherwise deletion. An anonymized comment must not retain `authorId`, username, display name, or a reversible public identifier.
- Reactions: delete because they have little independent retention value.
- Reports: preserve reason, target, timestamps, status, and review history needed for safety operations; replace reporter identity with an irreversible deletion marker or restricted pseudonymous reference.
- `UsernameReservation`: tombstone for a defined anti-impersonation/abuse period, then release if policy permits. Immediate reuse risks impersonation; permanent retention prevents legitimate reuse and requires clear disclosure.

## Ordering and Failure Safety

Recommended order: freeze new writes, inventory, unpublish public snapshots, process social identity, delete private S3 objects, delete dependent private records, delete profile, finalize username policy, then disable/delete Cognito. Each step should be idempotent and resumable.

A failed job must not claim the account is deleted. It should enter `deletionFailed`, deny unsafe repeated client submissions, alert operations without exposing private content, and resume from recorded step state.

## Confirmation and Abuse Controls

- Require a recent authenticated session and explicit confirmation text or equivalent high-friction confirmation.
- Explain loss of private records and images, treatment of public content, report retention, username reuse, and cancellation timing.
- Notify the verified account channel when a request is created, canceled, or completed.
- Rate-limit requests and protect lifecycle endpoints from cross-account owner-ID substitution.
- Define legal, safety, fraud, and abuse holds before launch; retained data must be narrowly scoped and access controlled.

## Acceptance Criteria Before Enablement

- Complete inventory tests for every owner-scoped model and S3 prefix.
- Verified public snapshot removal and public cache invalidation.
- Verified report anonymization without loss of moderation status/history.
- Successful retry tests after failures at every cleanup stage.
- Proof that one account cannot request or observe another account's deletion.
- Clear support and recovery runbook for stuck jobs.
