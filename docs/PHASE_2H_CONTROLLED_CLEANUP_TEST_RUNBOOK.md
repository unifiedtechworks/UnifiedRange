# Phase 2H Controlled Public Image Cleanup Test Runbook

## Purpose and authorization boundary

This runbook prepares a future live test of `retryRemovedPublicImageCleanup`. It is not authorization to enable the operation, create a fixture, invoke cleanup, or delete an object.

The first live test must use the existing developer sandbox only. Do not use the hosted `main` branch, a production-like account, or an environment containing real user data. Every gate change, disposable-fixture action, and cleanup invocation requires a separate explicit approval at the time of execution.

The execution gate is global to the deployed cleanup Lambda. Enabling it does not restrict the function to the intended fixture: any authenticated Admin who knows another eligible generation id could request cleanup while the gate is enabled. Isolation, access control, a short approved test window, and immediate gate restoration are therefore mandatory. A selected fixture alone is not a backend scope restriction.

## Current readiness

| Area | Status |
| --- | --- |
| Read-only hosted deployment assurance | Complete for commit `5ed4a6863e8cfbd0db19f09a647ae2df394ad861`; see [Phase 2H Deployment Assurance](PUBLIC_IMAGE_PHASE_2H_DEPLOYMENT_ASSURANCE.md). |
| Mocked cleanup and inspection tests | Passed locally; no AWS records or objects were used. |
| Cleanup execution gate | Disabled. |
| Live cleanup invocation | Not performed and not approved. |
| Deterministic retained-object fixture path | Blocked pending a separately reviewed sandbox-only fault-injection or an already-existing disposable `cleanup_pending` fixture. Normal Remove may finish object deletion immediately and therefore cannot guarantee the `cleaned` test path. |

Do not forge a fixture with direct DynamoDB writes, arbitrary S3 writes, copied ownership fields, or a manually constructed canonical key. If no legitimate disposable `removed + detached` generation with a retained derivative exists, stop. A purpose-built, disabled-by-default sandbox fault-injection design must be reviewed in a separate task before continuing.

## Phase A: read-only preparation

These checks do not authorize any mutation.

1. Confirm the repository, branch, clean status, and exact source commit.
2. Confirm the AWS CLI profile with `sts get-caller-identity`. Match it to the previously verified developer account; do not continue on an unfamiliar account.
3. Resolve the Amplify environment from verified repository/deployment metadata. Confirm the Region, sandbox identifier, root stack tags, cleanup Lambda, inspection Lambda, AppSync API, relevant tables, execution roles, and processed-image bucket. Do not guess by resource name alone.
4. Read only the cleanup Lambda's state, last-update status, handler, and `REMOVED_PUBLIC_IMAGE_CLEANUP_ENABLED` value. The expected value is `false`.
5. Read only the processed-image bucket versioning state. The current implementation supports an unversioned general-purpose bucket only. `Enabled` or `Suspended` is a stop condition.
6. Inspect the cleanup and inspector role policies. Confirm no private-prefix, target-photo, bucket-list, object-put/copy, snapshot-delete, report-write, account, or Cognito permission has appeared.
7. Confirm the AppSync cleanup mutation remains Admin-only and the Lambda independently validates a trusted Cognito identity. Configuration inspection is not a substitute for the later authenticated tests.
8. Run the mocked reconciliation suite, Amplify typecheck, lint, build, and `git diff --check`.

Stop if the account, Region, branch, stack, function, bucket, gate, versioning, authorization, or IAM evidence cannot be established exactly.

## Phase B: approvals required before fixture preparation

Obtain separate explicit approval covering all of the following:

- the exact sandbox account, Region, stack, and time window;
- the dedicated test account and non-sensitive synthetic JPEG fixture;
- the approved product paths used to create, upload, verify, publish, process, and remove the fixture;
- the method that will create a legitimate retained public derivative after terminal removal;
- the one opaque public-image generation selected for the test;
- the reviewed infrastructure-only gate change and the commit that makes it;
- the single approved cleanup invocation and one idempotency retry; and
- the gate-disable deployment and evidence collection afterward.

Do not combine gate enablement, fixture creation, cleanup, and rollback into an automatically executing script. Each approval boundary must remain visible and interruptible.

## Phase C: create a legitimate disposable fixture

After approval, use only the normal sandbox product flow:

1. Sign in with the dedicated test owner and create a disposable Equipment Passport containing no real serial number, location, person, document, plate, or other sensitive detail.
2. Upload a synthetic equipment-cover JPEG through the existing private upload path.
3. Confirm the private image is registered and verified through the existing `PrivateImageAsset` workflow.
4. Publish the sanitized text/setup snapshot and explicitly consent to processing that verified cover.
5. Confirm saved Public Passport detail can resolve the processed derivative while the private original remains owner-private.
6. Through protected read-only tooling, identify the exact immutable public-image generation produced by that flow. Retain only a shortened or hashed fixture reference in test evidence; do not record the S3 key, URL, owner/source id, filename, token, or private record content.
7. Use the existing approved removal path to detach delivery and reach terminal `removed` state.

The cleanup retry's deletion path is testable only if the legitimate removed ledger row retains its canonical derivative and the snapshot is fully detached. Ordinary successful removal may delete the object and clear the key, producing only the `already_missing` path. Do not manufacture a retained object afterward. If an approved deterministic fault-injection mechanism or existing disposable `cleanup_pending` fixture is unavailable, record the live deletion test as blocked and stop.

## Phase D: authorization tests while the gate is still disabled

Before any gate change, and only with approval to invoke the mutation in a future task:

1. Test signed-out and API-key callers. AppSync must reject both.
2. Test an ordinary signed-in user and a Moderator-only user. AppSync must reject both before Lambda/application-data access.
3. Test the dedicated Admin with the exact fixture generation and explicit confirmation. With the gate disabled, the bounded result must be `disabled`, with zero DynamoDB/S3 dependency activity.

Do not perform these calls during read-only preparation. They are live integration tests and need separate approval even though the gate is expected to be disabled.

## Phase E: reviewed gate enablement

1. Confirm again that the target is the isolated developer sandbox and that no unrelated eligible assets or unapproved Admin testers are in scope.
2. Change the backend-controlled gate through reviewed infrastructure source only. Never use browser state, `NEXT_PUBLIC` configuration, direct `update-function-configuration`, console edits, or an email allowlist.
3. Review the exact diff, run all required checks, and obtain explicit deployment approval.
4. Deploy only the approved sandbox change.
5. Read back the exact deployed gate value and successful Lambda update state. Do not infer success from source or synthesis.
6. Keep the enabled window short. If the deployment identity or readback differs from the approved target, stop and restore the disabled configuration through the reviewed path.

## Phase F: one-generation cleanup test

After a final explicit deletion approval:

1. Re-read the fixture asset and snapshot through protected tooling. Confirm terminal `removed`, supported moderation state, `equipment_cover`, fully detached projection, canonical binding, no unresolved attempt, and unversioned bucket.
2. Invoke `retryRemovedPublicImageCleanup` once with only the exact fixture generation id and `confirmation: true`.
3. Expect `cleaned` only when the conditional ETag delete is followed by confirmed object absence and exact-attempt ledger completion. A merely attempted request is not success.
4. Confirm public delivery remains unavailable, sanitized text/setup remains unchanged if still published, and the private original still exists and remains private.
5. Invoke the same fixture once more only if the approval explicitly includes the idempotency check. Expect `already_missing` without a second delete.
6. Inspect bounded logs and result fields. They must not contain a key, URL, ETag, version id, owner/source id, filename, alt text, report content, token, private data, or raw AWS error.

Do not broaden the test to a second asset, hidden generation, target photo, replacement generation, malformed record, or production environment.

## Failure, interruption, and retry handling

- `not_eligible`, `state_changed`, or `manual_review`: stop. Do not change lifecycle or moderation fields to force eligibility.
- `retry_pending`: preserve the detached state and bounded attempt evidence. Do not make an unconditional S3 call or direct database correction. A retry requires a fresh approval and current-state revalidation.
- Expired credentials: stop immediately. Do not switch accounts or obtain a broader role merely to finish the test.
- Lost terminal/session or uncertain mutation result: treat the outcome as unknown. Re-establish the exact environment, inspect current state read-only, and do not repeat the mutation until separately approved.
- Test interruption while the global gate is enabled: restoring the gate to `false` through the reviewed infrastructure path is the first operational priority. Do not run cleanup merely to "finish" before disabling it.
- Conditional-delete precondition failure: treat it as state change. Do not fall back to unconditional deletion.
- S3 403 or versioning uncertainty: stop and retain for review. Do not interpret inaccessible as missing.

## Phase G: mandatory closeout

1. Restore `REMOVED_PUBLIC_IMAGE_CLEANUP_ENABLED=false` in reviewed infrastructure source.
2. Run verification and deploy the disabled configuration to the same sandbox.
3. Read back the Lambda gate and update status. Only an observed `false` value closes the enabled window.
4. Confirm the fixture's private original remains private and unchanged.
5. Record safe evidence and any bounded retry state. Do not delete historical versions, change bucket versioning/lifecycle, or clean other objects.
6. If safe product cleanup is desired for the private disposable fixture, handle it under a separate ordinary owner-data cleanup approval after the public-image test is closed.

## Evidence to retain

Retain:

- date/time and operator;
- approved environment class, Region, and commit hashes;
- shortened or hashed fixture reference;
- pre/post gate values and Lambda update status;
- AppSync caller class and bounded authorization outcome;
- bounded cleanup status/failure code/retryable flag;
- bucket versioning classification;
- confirmation that public delivery stayed detached and the private original was preserved;
- verification command exit codes; and
- approval references that contain no secret or user data.

Do not retain credentials, tokens, API keys, full environment dumps, object keys, signed URLs, ETags, version ids, full internal resource names, account ids, owner/source identifiers, usernames, filenames, alt text, report details, private record content, or image bytes.

## Actual results

No fixture was created, no gate was enabled, and no cleanup mutation was invoked while preparing this runbook. All live authorization, deletion, idempotency, retry, and closeout checks remain pending separate approval.
