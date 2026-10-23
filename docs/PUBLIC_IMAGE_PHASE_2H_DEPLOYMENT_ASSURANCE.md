# Phase 2H Hosted Deployment Assurance

## Checkpoint

This report records a read-only inspection performed on October 23, 2026. The inspected hosted `main` deployment was source commit `5ed4a6863e8cfbd0db19f09a647ae2df394ad861` (`Add disabled-by-default removed image cleanup retry`). The Amplify job for that exact commit completed successfully; its build, deploy, and verify steps all reported success.

The inspection did not enable cleanup, invoke AppSync or Lambda, create a fixture, write a record, delete an object, change infrastructure, or deploy this documentation/test commit. See the [Controlled Cleanup Test Runbook](PHASE_2H_CONTROLLED_CLEANUP_TEST_RUNBOOK.md) before considering a future sandbox-only live test.

## Assurance summary

| Evidence | Status | Result |
| --- | --- | --- |
| Repository and deployment identity | Confirmed by inspection | Amplify repository metadata matched the UnifiedRange repository, branch `main`, and the exact Phase 2H.2 commit. A name-only resource match or sandbox `amplify_outputs.json` was not used as proof. |
| Hosted deployment | Confirmed by inspection | The matched job and all of its recorded steps succeeded. The hosted root and relevant nested backend stacks were in a completed update state. |
| Hosted cleanup Lambda | Confirmed by inspection | The function was active and its last update succeeded. |
| Hosted execution gate | Confirmed by inspection | `REMOVED_PUBLIC_IMAGE_CLEANUP_ENABLED` was exactly `false` in the hosted cleanup Lambda. |
| Gate fail-closed behavior | Passed automated test | The local assurance change accepts only the exact backend string `true`; missing, non-string, differently cased, whitespace-padded, and other malformed values remain disabled. This tightening is not part of the inspected hosted commit. |
| Browser control of gate | Confirmed by inspection | The handler reads a Lambda environment value. The mutation input and browser do not supply the gate. |
| Hosted bucket versioning | Confirmed by inspection | Versioning was unconfigured/unversioned. That is compatible with the current cleanup contract; `Enabled` and `Suspended` remain unsupported. |
| AppSync mutation authorization | Confirmed by inspection | The deployed resolver path requires Cognito User Pools and the `admin` group. It did not grant moderator or API-key invocation. |
| Lambda authorization | Confirmed by source review | The handler independently requires a trusted Cognito identity with the `admin` group before entering cleanup logic. |
| Normal-client reconciliation-field writes | Confirmed by source and deployed configuration inspection | The coordination fields remain owner-readable and client-nonwritable; deployed model mutation resolver authorization also fails closed for unsupported direct writes. |
| Inspection Lambda IAM | Confirmed by inspection | Reads were limited to required attributes on the two named records and metadata access on the processed equipment-cover prefix. No data/storage write or delete permission was found. |
| Cleanup Lambda IAM | Confirmed by inspection | Permissions were limited to required attribute-scoped reads, transaction-scoped snapshot condition and asset claim/update, exact-attempt asset updates, bucket-versioning read, and processed equipment-cover metadata/delete access. |
| Mocked reconciliation suite | Passed automated test | 65 tests passed, including the exact-value gate test and existing authorization, zero-side-effect, lifecycle, concurrency, conditional-delete, retry, versioning, and dependency-boundary coverage. |
| Live authorization outcomes | Pending live test | Configuration inspection does not replace authenticated Admin, Moderator, ordinary-user, signed-out, and API-key integration tests. |
| Live cleanup and idempotency | Blocked | No deterministic retained-object fixture is currently approved. A selected fixture does not constrain the global gate, and normal Remove may complete deletion before retry can be tested. |
| Versioned-bucket cleanup | Not applicable | The hosted bucket is unversioned and the implementation intentionally refuses enabled or suspended versioning. |

## Deployment and gate evidence

The hosted app was resolved from its exact repository metadata, then the `main` branch job was matched to the full Phase 2H.2 commit. CloudFormation metadata tied the branch deployment to the inspected AppSync API, functions, roles, tables, and storage bucket. Raw account IDs, ARNs, API identifiers, resource names, and environment dumps are intentionally omitted.

The source backend configuration sets the cleanup gate to `false`. The successful Amplify job synthesized and deployed the Phase 2H.2 backend, and the separately inspected hosted Lambda configuration also contained the exact value `false`. The prior developer-sandbox observation remains separate evidence and was not used to infer the hosted value.

The deployed Phase 2H.2 handler trims environment values before comparing them with `true`. Its observed hosted value is the exact string `false`, so it remains disabled. This assurance commit adds an isolated parser that enables only for the exact raw string `true`, with mocked tests for missing and malformed values. That code belongs to the later assurance commit and was not represented as deployed during this inspection.

The gate is backend-controlled, but it is not an IAM boundary. The cleanup execution role retains its narrowly scoped delete permission while the application gate is disabled. Enabling the global gate in any future environment could permit every authorized Admin to request cleanup for any otherwise eligible generation during that window; selecting one test fixture does not limit the backend to that fixture.

## Authorization and IAM observations

The deployed AppSync API uses Cognito User Pools as its primary authorization mode and also supports API-key and IAM modes for other schema operations. The cleanup resolver's actual authorization function checked for the Cognito `admin` group and returned unauthorized otherwise. No moderator or API-key grant was present on that resolver path. Its pipeline invoked the inspected cleanup Lambda data source. The Lambda also validates trusted identity context and the Admin group.

The deployed cleanup role allowed only:

- attribute-limited, strongly scoped record reads from the named Public Passport Snapshot and Public Image Asset tables;
- the transaction operations needed to condition-check the detached snapshot and claim the exact asset attempt;
- conditional asset updates for the active attempt and bounded completion/retry fields;
- versioning inspection on the exact processed-image bucket; and
- metadata read and delete under the processed public equipment-cover prefix.

No S3 list, put, copy, private-equipment prefix, private-target prefix, snapshot delete, report write, account mutation, or Cognito administration permission was found. Platform-managed parameter-read and basic Lambda logging permissions were present. The read-only inspector role had only its required attribute-limited record reads, processed-cover metadata access, platform parameter read, and basic logging.

These are configuration observations, not proof of every runtime authorization result. Policy inspection cannot replace live calls by each caller class, and the disabled execution gate does not remove the cleanup role's underlying processed-derivative delete capability.

## Storage compatibility

The hosted processed-image bucket was resolved through the verified hosted storage stack rather than through sandbox outputs. Its versioning status was unconfigured, which is the supported unversioned state for Phase 2H.2. No object listing, lifecycle change, versioning change, delete-marker operation, or object deletion was performed.

If versioning later becomes `Enabled` or `Suspended`, the current cleanup implementation must continue returning a bounded manual-review result. Supporting versions or delete markers requires a separate design and must not be approximated with unconditional deletion.

## Automated assurance

The focused change extracts execution-gate interpretation into a pure helper and tests it directly. Only the exact string `true` enables execution. `undefined`, `null`, booleans, empty input, `false`, case variants, surrounding whitespace, numeric-like values, and arbitrary affirmative text all remain disabled.

The full mocked reconciliation suite passed 65 tests without AWS credentials or live data. It continues to cover authorization before dependency access, disabled and missing-confirmation zero-side-effect paths, trusted-state lifecycle validation, projection and generation races, canonical key and metadata checks, bucket-versioning refusal, conditional deletion, exact-attempt finalization, interrupted/stale attempts, bounded results, and prohibited dependency surfaces.

The remaining repository typecheck, lint, production build, and diff checks are recorded in the commit handoff rather than treated as hosted runtime evidence.

## Pending and blocked release evidence

The following remain pending live tests under separate approval:

- signed-out, API-key, ordinary-user, Moderator-only, and Admin mutation authorization;
- confirmation that the disabled path produces the bounded disabled result and no dependency activity in the deployed environment;
- one approved sandbox-only retained-derivative cleanup with an exact disposable generation;
- ETag-bound deletion, post-delete absence confirmation, and exact-attempt ledger completion;
- one explicitly approved idempotency retry producing `already_missing`;
- retry behavior for conditional failure, dependency interruption, expired credentials, and uncertain results; and
- readback proving the global gate was restored to `false` after any future enabled test window.

A deterministic deletion-path fixture is blocked until either a legitimate disposable `cleanup_pending` generation already exists or a separate, disabled-by-default sandbox fault-injection design is reviewed and approved. Direct table edits, forged ownership, arbitrary public object writes, and production/user data are not acceptable fixture mechanisms.

No live cleanup authorization is created by this report. Follow the [Controlled Cleanup Test Runbook](PHASE_2H_CONTROLLED_CLEANUP_TEST_RUNBOOK.md), obtain explicit approval at each write/destructive boundary, and begin in an isolated developer sandbox only.

## Scope conclusion

The hosted Phase 2H.2 checkpoint was deployed successfully with its cleanup gate disabled, an unversioned compatible bucket, Admin-gated AppSync/Lambda paths, and narrowly scoped deployed roles. This is adequate deployment/configuration assurance for leaving the feature disabled. It is not approval to enable cleanup and is not completion of authenticated or destructive release QA.

The documentation and exact-value gate test added after the inspected checkpoint must not be described as hosted until a later Amplify job for that new commit is independently observed. No deployment command or live mutation was run for this assurance checkpoint.
