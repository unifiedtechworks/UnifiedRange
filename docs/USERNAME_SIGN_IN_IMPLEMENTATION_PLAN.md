# Username Sign-In Implementation Plan

Status: design only. Reviewed against repository code and AWS documentation on 2026-09-05.

This expands [the earlier username sign-in outline](USERNAME_SIGN_IN_PLAN.md). Email/password remains the supported sign-in method. This change adds documentation only: no schema changes, auth runtime changes, infrastructure, deployment, or data migration.

## Decision and security boundary

Recommend a backend authentication broker that accepts either email or an app username plus a password, resolves identity privately, and lets Cognito verify credentials. Prefer resolving to the stable Cognito username rather than to email. Never return a username-to-email lookup result, including a masked email, to an unauthenticated caller.

The broker is a proposed architecture, conditional on the identity-integrity and session-integration gates below. It introduces server-side password handling and cannot be added as a small wrapper around the existing browser `signIn` call. If those gates cannot be met, retain email-only sign-in.

The protection target is an unauthenticated caller or another signed-in account. The account owner may still receive their own email in authorized Cognito attributes or token claims after full authentication. Public usernames and authenticated username-availability checks already reveal some username existence; this design does not promise to make public identities secret. It must not reveal their email mappings or add an account-status oracle.

## Current repository flow

| Area | Observed behavior |
| --- | --- |
| `amplify/auth/resource.ts` | `loginWith.email: true`; admin and moderator groups. No app-username authentication or custom-auth triggers are declared here. |
| `src/lib/amplifyClient.ts` | Configures Amplify using generated outputs. `getAuthErrorMessage` currently passes most exception messages through to the UI. |
| `src/components/AuthForm.tsx` | Email input; sign-up sends trimmed email as Cognito `username` and email attribute; confirmation uses email and a code. Sign-in calls `signIn({ username: email.trim(), password })`. |
| Installed Amplify Auth implementation | The omitted `authFlowType` defaults to SRP in `signIn.mjs`. Current browser password authentication therefore uses the SDK's SRP flow, rather than an application password endpoint. |
| Post-sign-in | The form refreshes shared auth state and checks the owner-scoped profile to route incomplete profiles to setup. It handles `CONFIRM_SIGN_UP` explicitly, but does not implement a complete MFA/password-change challenge loop. |
| `src/hooks/useAuthUser.ts` | Reads current user, attributes, and session. Canonical owner key is Cognito `currentUser.username`; aliases include verified session user ID/sub and token username. An authorized owner can see their email as the session label. |
| `UsernameReservation` | Stores normalized username, owner ID, and creation time, keyed by normalized username in application code. Authenticated users can read reservations; owner rules permit create/read/delete. No email field. |
| `UserProfile.username` | App-level permanent identity, separate from Cognito login. Normalization trims and lowercases; validation permits 3–24 ASCII letters, digits, underscores, or hyphens. |

Sources: `amplify/data/resource.ts`, `src/lib/userProfileData.ts`, `src/lib/usernameReservationData.ts`, and the files above. [Reservation repair documentation](USERNAME_RESERVATION_REPAIR.md) describes accepted legacy aliases and the explicit conflict-repair exception to normal username immutability.

These observations do not establish the deployed pool's MFA, alias/case settings, enabled app-client flows, WAF rules, or `PreventUserExistenceErrors` value. Inspect deployed configuration in a future implementation task without copying identifiers or private configuration into this document.

## Why browser lookup is unsafe

A lookup that returns email and then calls browser `signIn` exposes the mapping in network responses, browser state, telemetry, extensions, and scraping tools. Hiding the field in the UI, encoding it, requiring an API key, or requiring an ordinary signed-in account does not solve the disclosure. A masked address or deterministic identifier derived from email can also reveal information.

Do not add emails to reservations, public snapshots, availability responses, diagnostics, URLs, or generated frontend configuration. Do not broaden private `UserProfile` authorization. Returning an internal Cognito identifier as a lookup response is also undesirable: it becomes a correlation identifier and may itself be email-shaped in legacy data. An opaque handle helps only when it is random, short-lived, and usable solely inside a protected authentication transaction.

## Backend and Lambda options

| Option | Assessment |
| --- | --- |
| API Gateway REST endpoint with Lambda broker | Preferred exploration. Provides a clear public ingress for WAF, throttling, bounded requests, and narrowly scoped IAM. Resolution and all Cognito challenge continuation remain server-side. |
| Next.js server route/BFF | Viable if the deployed hosting runtime supports server execution and equivalent edge protection, secret storage, distributed limits, and session handling. A browser-only route is insufficient. |
| AppSync custom resolver backed by Lambda | Possible future transport, but sign-in happens before user-pool authentication. Requires separately reviewed unauthenticated invocation rules, operation-level controls, and a schema/API change; not authorized by this documentation task. An API key is not an abuse defense. |
| Lambda returning an email to the browser | Reject. Moving only the lookup server-side still discloses its result. |

### Proposed broker transaction

1. Accept HTTPS POST with a bounded identifier and password. Do not place either in query strings. Enforce content type, body limits, origin policy, and rate controls before expensive work. CORS is not authentication or bot protection.
2. Classify identifiers containing `@` as email; otherwise use existing username normalization and validation. Do not support an optional leading `@` in the first release, which would create ambiguity. Trim email as today and preserve deployed Cognito case semantics; do not invent provider-specific email rewriting. Never trim or normalize the password.
3. For username input, perform an exact reservation-key read and verify its binding to the same account's profile and Cognito identity. Resolve legacy aliases only using trusted backend evidence. Do not accept caller-supplied owner IDs, email mappings, pool IDs, client IDs, or identity aliases. No table scans or Cognito directory searches on the public request path.
4. Use a fixed server-side app client and Cognito username for authentication. The candidate flow is `AdminInitiateAuth` with `ADMIN_USER_PASSWORD_AUTH`, followed by `AdminRespondToAuthChallenge` as necessary. This requires the corresponding enabled app-client flow and IAM permission. A client secret, if used, and its `SECRET_HASH` remain server-side. Cognito continues to own password verification; no application password database or password-verification algorithm is introduced. See [AdminInitiateAuth](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminInitiateAuth.html).
5. Resolve email sign-in within the same broker for consistent policy after rollout. Keep any returned canonical identity in server state. Unknown, conflicted, deleted, or ineligible bindings follow the generic failure path with comparable bounded work. Never authenticate a missing binding as a shared fallback account.
6. If Cognito requires another step, hold its session and canonical identity in encrypted, expiring server state. Return only an allowlisted step and random transaction handle bound to the initiating browser, environment, app client, and attempt. Enforce expiration, attempt limits, atomic advancement, replay prevention, and session rotation. Do not proxy raw challenge parameters, delivery destinations, user attributes, or Cognito session strings.
7. Establish an application session only after Cognito completes all required challenges and the resolved binding is still valid. Unknown challenges fail closed. A successful password stage is not a completed sign-in. Do not send confirmation/recovery messages automatically on every failed login.

The Lambda role should have exact-table reads and necessary index queries, and only required authentication/identity-read operations on the intended pool. It must not have reservation writes, user administration, group changes, table scans, or broad directory listing. Any migration role must be separate. Select only necessary profile fields and discard unnecessary Cognito attributes immediately.

### Reservation integrity is a release gate

Current reservations are a uniqueness mechanism, not automatically an authentication trust registry. Username immutability and normalization are enforced in application workflows; the model also allows owner deletion/recreation. Before relying on this data, test direct API calls that bypass the UI: mismatched record ID/username, arbitrary claims, self-deletion/recreation, forged owner fields, duplicate profiles, and stale conflict-repair reservations.

Require agreement among normalized reservation ID/username, one eligible profile, and a verified Cognito principal. Use bounded indexed queries, reject ambiguity, and revalidate near session issuance. A stale reservation alone must never enable login. A profile index can be eventually consistent; re-read the selected base record and fail closed on inconsistency. Do not claim a cross-service atomic snapshot.

If existing controls cannot guarantee binding integrity, a future reviewed server-managed registry or write-authorization change is required before launch. Such a registry should bind normalized username to stable Cognito identity, not email, and be inaccessible to clients. It is not created by this plan. Legacy sub-only rows that cannot be resolved safely with bounded operations remain email-only until an offline verified reconciliation; never guess or reinterpret an unverified owner string as email.

### Session compatibility is a release gate

The existing app depends on Amplify `getCurrentUser`, `fetchAuthSession`, authenticated AppSync calls, and Identity Pool credentials for private storage. A server response containing tokens does not automatically create a supported Amplify session. Do not manually populate undocumented Amplify local-storage keys.

Preferred security posture is an opaque Secure, HttpOnly, SameSite session cookie, with tokens retained server-side and CSRF/login-CSRF protection. That requires a broader BFF integration for existing data/storage callers, attribute reads, groups, refresh, sign-out, expiry, and multiple tabs. Preserve the same Cognito subject and ownership claims. Cookie sessions alone cannot drive today's browser SDK calls.

A supported SDK token-provider integration is an alternative only after a dedicated compatibility prototype and review of browser token exposure, refresh/revocation, and Identity Pool behavior. Choose and document one session model before implementing the broker. Verify any new app client's token audience is accepted by intended consumers without widening trust to unrelated clients. Keep existing email sessions valid during migration.

## Cognito custom authentication alternatives

Cognito custom auth provides Define Auth Challenge, Create Auth Challenge, and Verify Auth Challenge Response triggers. It requires a custom client challenge loop and does not run in managed login. SRP can precede custom challenges so Cognito still verifies passwords. See [custom authentication triggers](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-challenge.html).

This is not a username-alias rewrite hook: the authentication request still identifies a Cognito user. Do not assume pre-auth or custom triggers can replace an arbitrary app username with another principal or safely mint tokens for a different user. Resolve identity before initiating Cognito authentication, or separately design a supported native-identity migration.

`CUSTOM_WITH_SRP` could add a genuine additional challenge, but still needs mapping resolution. SRP responses can include `USER_ID_FOR_SRP`; do not forward them blindly or rewrite SRP identity inputs, which are part of the protocol. A browser SRP design needs a protocol/privacy review of canonical identifiers and cannot be assumed compatible with an opaque broker handle.

`CUSTOM_WITHOUT_SRP` replaces password proof unless another factor is deliberately designed; it is not a shortcut for this email-or-username/password goal. Never accept reservation ownership, successful lookup, or a CAPTCHA as sufficient proof to issue tokens. Define/verify logic must reject missing, failed, replayed, out-of-order, and unknown challenges, including nonexistent-user simulations.

Native Cognito username/preferred-username alias options are a separate migration investigation. Existing pool sign-in attributes cannot be assumed to be switchable in place, and a Cognito alias does not automatically inherit app immutability or reservation rules. Do not create duplicate accounts or replace the pool to implement this plan.

## Enumeration resistance and generic errors

Explicitly enable and verify `PreventUserExistenceErrors` for each relevant future app client. It is defense in depth, not an application-wide guarantee: AWS documents SRP alias caveats and custom-trigger handling for nonexistent users. Independently test sign-up, confirmation, and recovery behavior. See [Cognito user-existence responses](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-managing-errors.html).

Proposed public contract:

| Outcome | Public response |
| --- | --- |
| Wrong password, unknown identifier, unresolved reservation, disabled/deleted account, unsupported pre-auth account state | Same HTTP 401, bounded code `SIGN_IN_FAILED`, and “Unable to sign in. Check your email or username and password.” |
| Structurally invalid/oversized request | Fixed HTTP 400/413 based only on input, with no lookup details. |
| Rate policy exceeded | HTTP 429, “Too many attempts. Try again later.” Coarse retry interval; no remaining account-attempt count. |
| Service unavailable | HTTP 503, “Sign-in is temporarily unavailable. Try again later.” Apply consistently across identifiers during a dependency outage. |
| Proven credential stage needs continuation | Allowlisted challenge and opaque transaction handle; no destination hint or identity attributes. Only expose a real account-specific continuation after sufficient credential proof. |
| Completed authentication | Session established; return only required authenticated application state. |

Keep failure bodies, headers, redirects, cookies, and response sizes consistent within each class. Disable caching with `Cache-Control: no-store` throughout. Remove raw exception forwarding from future auth paths; the current helper is a documented future remediation, unchanged here.

Measure failed-login timing distributions for existing/unknown accounts, missing/conflicted reservations, cold/warm Lambdas, and cache hits/misses. Avoid an immediate return for lookup misses. Use bounded equivalent work and a measured minimum response envelope; jitter alone cannot defeat repeated statistical probing. Avoid fixed sleeps that consume unbounded concurrency and avoid real dummy accounts that could lock out or accidentally authenticate. Resolve the exact negative-path strategy in an isolated prototype before release.

Keep recovery email-based initially, with a neutral instruction to use the account email. A future username recovery/resend endpoint must independently satisfy uniform responses, no masked destinations, delivery cooldowns, and anti-spam controls. Account-specific unconfirmed/reset states must not be exposed merely because a username resolves. Distinct success after valid credentials is expected; failed guesses must not reveal the mapping.

## Rate limiting and abuse monitoring

Use layered controls: edge/WAF by trusted source network, distributed application counters by keyed identifier digest and browser transaction, and global concurrency/cost limits. Derive IP only from trusted ingress metadata, never arbitrary forwarded headers. Apply limits to unknown identifiers too, before resolution, to avoid existence-dependent throttling.

Suggested staging starting points, subject to load and shared-network testing: 30 start requests per minute per source, 5 failed attempts per 15 minutes per identifier/source pair, and 5 challenge submissions per transaction with a maximum five-minute lifetime bounded by Cognito's session expiry. Use atomic counters with expiration across Lambda instances, not in-memory counters. Monitor identifier-wide distributed attacks; use progressive risk friction rather than an attacker-triggered permanent account lock. Where privately resolved, correlate email/username attempts to one principal without exposing account counters or changing public responses based on account existence. CAPTCHA is a risk control, not identity proof.

Protect the broker ingress separately. Cognito pool WAF covers public user-pool APIs, not IAM-authorized admin authentication calls. Existing direct email authentication can bypass broker limits, so retain pool-side protections and review every enabled app client. See [Cognito WAF coverage](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-waf.html). Do not treat service quotas or SDK retries as abuse controls. Fail closed if the broker's distributed limiter is unavailable, with a generic service response; do not silently fall through to an unprotected username path.

Track aggregate failure/success/challenge rates, throttles, latency, dependency failures, transaction replays, binding inconsistencies, and concurrency/cost. Alert on password spraying, distributed attacks on one identifier, sudden success after repeated failures, unusual recovery volume, and sustained errors. Use bounded internal outcome categories and keyed pseudonyms for restricted correlation, never per-user metric labels. Consider Cognito threat protection only after validating the selected flow's coverage, configuration, and cost.

Assign an operational owner before rollout. Response actions: tighten source/risk controls, disable username sign-in with a kill switch, preserve restricted sanitized evidence, and investigate binding corruption. Test alerts with synthetic identities. Do not use automatic permanent account disabling as the default abuse response.

## Logging restrictions

- Never log passwords, codes, token contents, refresh tokens, cookies, authorization headers, Cognito sessions, transaction handles, raw emails/usernames/owner IDs, or username-to-email pairs. No raw Lambda events, SDK responses, request bodies, user attributes, or exception dumps.
- Use an allowlist: timestamp, random non-secret request correlation ID, component, bounded outcome, duration bucket, and rate-rule category. For short-lived correlation use a secret-key HMAC of the normalized identifier or trusted source; plain hashes of guessable identifiers are insufficient. Rotate keys and treat pseudonyms as sensitive.
- Disable auth-page session replay and sensitive analytics capture. Review browser error reporting, API Gateway execution/access logs, WAF sampled requests, CDN logs, Lambda tracing, and downstream collectors. Redaction must happen before ingestion, including failure and timeout paths.
- Proposed operational retention: 14 days for restricted sanitized events and 90 days for aggregate metrics; shorter TTLs for limiter/transaction state. Final retention and incident exceptions require review before launch. Encrypt storage and limit reads/decryption to designated operators.
- Audit AWS-managed Cognito/CloudTrail event contents separately; application redaction cannot guarantee their fields. Use narrowly controlled access and retention without disabling required audit trails. Never copy sensitive events into source control, tickets, or routine reports.

## Migration and rollout

1. Inventory deployed auth settings and enabled clients; verify ownership claims, email changes, legacy alias forms, and existing public API exposure. Do not record actual mappings in documentation.
2. In a separate authorized implementation, validate server-enforced reservation integrity. Produce aggregate reconciliation counts for missing, conflicted, orphaned, and ambiguous rows. Preserve email login and existing ownership keys. No automatic reservation transfer or login-time repair.
3. Resolve ambiguous legacy bindings through the established verified repair process. If a private registry becomes necessary, define its authorization and conditional-write/backfill design in a separate change; do not change the existing schema under this plan. Process idempotently and check live conflicts.
4. Prototype the chosen backend flow and session integration in an isolated environment using synthetic users. Pass privacy, challenge, failure-timing, and direct-API abuse tests. Evaluate current raw error behavior as a separate runtime remediation before unified sign-in rollout.
5. Add future feature flags for backend capability and UI exposure. Test internally, then enable a small cohort, then expand based on success rates, false-positive throttles, latency, and mapping-integrity metrics. No shadow authentication that copies production passwords into a second path.
6. Keep unbackfilled accounts email-capable. Email updates must not break username login or transfer identity; use stable Cognito binding. Coordinate deletion, conflict repair, and any future username reuse/tombstone policy to invalidate stale transactions and registry entries. Reconcile races; fail closed when uncertain.
7. Rehearse rollback: disable username ingress/UI, invalidate pending username transactions, retain valid existing sessions under the chosen policy, and restore the supported email entry point. Do not delete reservations, recreate users, or roll back pool identity. Keep protection and sanitized monitoring active during rollback.

Launch requires an approved session model, binding integrity evidence, explicit client-flow settings, tested challenge/recovery behavior, active limits/alerts, log review, and a working rollback. None of these future changes are authorized or implemented by this document.

## Future implementation test plan

| Category | Required cases and acceptance evidence |
| --- | --- |
| Input | Email trim/case compatibility; username lowercasing, boundaries, invalid Unicode, leading `@`, empty and oversized input; password whitespace preserved. No lookup for malformed input. |
| Identity integrity | Matching canonical and verified legacy aliases; missing/stale/conflicted rows; duplicate profiles; forged ownership; wrong environment; direct create/delete/recreate attacks; stale profile index; deletion/repair race. Never sign in as a different principal or repair data during login. |
| Credentials/challenges | Both identifiers reach the same account; valid/invalid passwords; disabled/deleted/unconfirmed/reset-required states; enabled MFA and setup; new-password challenge; wrong/expired codes; unknown challenge; replay, expiry, parallel submissions, and handle swapping. No session before all proof succeeds. |
| Privacy | Capture browser traffic, headers, redirects, errors, caches, challenge payloads, and logs for all failures. No email, masked destination, canonical identity, or mapping before authentication. Confirm ordinary signed-in users cannot resolve someone else's email. |
| Enumeration | Repeated existing/unknown/conflict failures have the same status/body/size behavior; statistically compare timing across cold/warm and outage cases. Examine rate responses and side effects as well as UI messages. Audit direct Cognito, sign-up, confirmation, recovery, and availability surfaces. |
| Abuse | Shared NAT, IPv6/source rotation, spoofed forwarding headers, distributed spraying, unknown usernames, alternate identifiers, concurrent Lambda instances, limiter outage, CAPTCHA bypass, and origin bypass. Verify atomic limits and global caps without permanent victim lockout. |
| Session regression | Same owner key/sub/groups through email and username; private AppSync and storage access; onboarding; refresh, expiry, sign-out/revocation, multiple tabs, cookie/CSRF properties, and app-client audience handling. No widened access to another account's data. |
| Operations | Dependency timeout/throttle, corrupt transaction state, alert delivery, log redaction, TTL/retention, load/cost limits, canary rollout, rollback, and email-only accounts. Synthetic evidence only. |
| Custom-auth alternative | If selected, test every define/create/verify transition and nonexistent-user simulation, including SRP identity fields; missing proof never issues tokens. |

Record explicit pass/fail results in the later implementation task. Local lint/build/typechecking cannot verify deployed IAM, Cognito behavior, timing resistance, or abuse controls.

## Verification for this documentation change

Run the requested repository checks after creating this file:

```text
npm run amplify:typecheck
npm run lint
npm run build
git diff --check
```

Also inspect the new file and final Git status to confirm only this document changed. These checks validate repository health and formatting; they do not mean username sign-in has been implemented or security-tested.
