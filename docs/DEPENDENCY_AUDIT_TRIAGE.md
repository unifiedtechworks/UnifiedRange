# Dependency audit triage

## Independent pass 1 validation — October 23, 2026

Implementation `f6fe22a9b879f8c7080e5e8359676f46c9d553a9` was reviewed against
freshly fetched `origin/main` at `6d268c77b8d694385bd21128bae044ff1feffbb0`.
See [the focused validation report](DEPENDENCY_REMEDIATION_PASS_1_VALIDATION.md)
for evidence, inherited risks, and the concrete nonproduction proposal.

**Merge remains blocked under the requirements below.** Linux execution is
unavailable (no WSL, Docker, configured CI workflow or self-hosted runner).
Fresh audits confirm 40 full-tree findings, including critical Handlebars, and
zero production-scope findings. Windows supplemental checks passed 65
reconciliation tests, four new synthetic codec tests, backend typecheck, and
lint. A fresh production-build rerun failed at Turbopack CSS worker startup,
including one retry outside AppContainer; the prior implementation's Windows
pass is historical evidence, not a pass for this rerun. No hosted validation,
deployment, new local HTTP smoke test, or authenticated QA was performed.

Managed Hosting documentation still lists Next.js through 15. Amplify JS has
newer maintainer evidence for Next 16 library/adapter support; those are separate
claims. The installed docs generator pins Handlebars 4.7.7, while the latest
published generator still pins 4.7.9; the newer critical advisories require
4.7.10. No supported parent fix was established or applied. Cleanup remains
disabled in source. No owner risk acceptance is implied.

## Release stabilization pass 1 — October 23, 2026

This pass applies a deliberately bounded dependency update on branch
`codex/release-dependency-remediation-1`. It does not change application
features, Amplify resources, data models, storage rules, reconciliation logic,
or the disabled cleanup gate. No sandbox, pipeline, deployment, or live cleanup
operation was run.

### Baseline and environment

- Baseline commit: `6d268c77b8d694385bd21128bae044ff1feffbb0`
  (`main`, matching `origin/main` when this branch was created).
- Local verification toolchain: Windows, Node.js `24.14.0`, npm `11.9.0`,
  lockfile version 3.
- Hosted Amplify production branch: `main`, with the baseline commit observed in
  a successful hosted job before this work. The repository does not currently
  pin an exact hosted Node/npm toolchain, so local/hosted toolchain parity remains
  a release-validation item.
- `amplify.yml` installs with `npm ci`, deploys the Amplify pipeline backend, and
  then runs the Next.js build. Dependency changes therefore require hosted
  frontend and backend-pipeline validation before merging to `main`, even when
  this pass contains no schema or infrastructure source change.
- The deployed removed-public-image cleanup function was checked read-only. It
  was active and its `REMOVED_PUBLIC_IMAGE_CLEANUP_ENABLED` gate remained exactly
  `false`. It was not invoked or modified.

### Audit comparison

Standalone npm audit JSON is the source of truth; install-summary counts differed
and are not used as evidence of remediation.

| Scope | Before | After | Change |
| --- | ---: | ---: | ---: |
| Full tree | 48 total: 2 critical, 33 high, 13 moderate | 40 total: 1 critical, 28 high, 11 moderate | 8 fewer affected package entries |
| Production (`--omit=dev`) | 8 total: 1 critical, 5 high, 2 moderate | 0 total | All currently reported production-scope findings removed |

The zero production-scope result does **not** mean the repository, build chain,
or deployed service is vulnerability-free. Forty findings remain in build,
generation, lint, and deployment tooling, including one critical finding.

### Bounded update batch

Only three related dependency families were changed:

| Family | Direct changes | Notable compatible transitive changes | Reason and validation |
| --- | --- | --- | --- |
| Next.js | `next` `16.2.10 -> 16.4.3`; `eslint-config-next` `16.2.10 -> 16.4.3` | Next packages `16.4.3`; `sharp` `0.34.5 -> 0.35.5`; Next-owned PostCSS `8.4.31 -> 8.5.23`; `baseline-browser-mapping` `2.10.43 -> 2.11.32` | Removes the reported Next/sharp/browser-mapping findings. Next 16.4.3 is a stable backport release. Build, lint, and route generation passed. |
| CSS/PostCSS | Root `postcss` `8.4.39 -> 8.5.31` | `nanoid` `3.3.16 -> 3.3.20`; `source-map-js` `1.2.1 -> 1.2.2` | Moves both PostCSS copies outside the reported vulnerable ranges and preserves the existing Tailwind/PostCSS pipeline. |
| Image processing | `image-js` `1.7.0 -> 1.7.1` | `colord` `2.9.3 -> 2.10.0`; `follow-redirects` `1.16.0 -> 1.16.1`; compatible cheminformatics helpers | Removes the reported image-processing dependency findings. The public-image processor remains the only application import site. Reconciliation tests do not cover codecs; the independent validation adds synthetic JPEG/PNG coverage. |

No dependency override was added. No Amplify, CDK, authentication, React, or
Node major migration was attempted. The Next build regenerated `next-env.d.ts`
with the expected `./.next/types/root-params.d.ts` reference; no application
source behavior was changed.

Official maintainer references used to bound this batch:

- [Next.js 16.4.3 release](https://github.com/vercel/next.js/releases/tag/v16.4.3)
- [PostCSS changelog](https://github.com/postcss/postcss/blob/main/CHANGELOG.md)
- [PostCSS security policy and advisories](https://github.com/postcss/postcss/security)

### Resolved finding groups

The final standalone audit no longer reports affected entries for:

- `next`, including the reported cache-confusion, Server Action, middleware,
  rewrite, endpoint-disclosure, and image-optimization advisory groups;
- `sharp`;
- root and Next-owned `postcss` copies;
- `nanoid` and `source-map-js`;
- `baseline-browser-mapping`;
- `colord`; and
- `follow-redirects`.

This is audit-resolution evidence, not proof that every advisory prerequisite was
reachable before the update or that future advisories cannot apply.

### Lockfile reproducibility

An initial post-update `npm ci` exposed a lockfile synchronization problem: the
targeted installs had removed four nested, bundled Amplify
`@opentelemetry/core@2.0.0` entries still required by the manifest graph. The
lockfile was repaired with `npm install --package-lock-only --ignore-scripts`;
no root OpenTelemetry dependency or override was added. A fresh `npm ci` then
passed and restored all four required nested entries.

After the clean install, `npm ls --depth=0` exited successfully but displayed
`@emnapi/runtime@1.11.3` and `@img/sharp-wasm32@0.35.5` as extraneous. Both are
platform/optional Sharp runtime packages represented in the lockfile and the
Next production build succeeded. Hosted Linux installation must still be checked
before merge because the local observation does not establish cross-platform
package behavior.

### Remaining critical and high findings

The remaining findings are absent from the final `--omit=dev` audit, but they
remain relevant to trusted code generation, lint, CI, and Amplify deployment.
They are not accepted risk or dismissed as false positives.

| Group | Evidence and exposure | Next safe action |
| --- | --- | --- |
| Critical Handlebars chain | `handlebars@4.7.7` remains reachable through Amplify backend/CLI GraphQL documentation and model generation. Current `@aws-amplify/graphql-docs-generator@4.2.2` still pins `handlebars@4.7.9`, which is inside the audit's vulnerable range through 4.7.9. Trusted local schema/templates reduce some input exposure, but generation runs in credentialed build/deploy workflows. | Review a supported Amplify toolchain release that removes the vulnerable pin, or separately validate a narrowly scoped override. Do not add a root Handlebars override without generation/synthesis compatibility evidence. |
| Amplify/GraphQL generation parents | High findings are inherited through Amplify backend/CLI, GraphQL Code Generator, GraphQL Tools, relay helpers, Immutable, Lodash, and MySQL tooling. | Handle as a separate Amplify migration batch with generated-client, synthesis, sandbox, and hosted pipeline validation. Reject npm's automated downgrade proposals. |
| General build tooling | High findings remain in `@fastify/busboy`, `brace-expansion`, `browserslist`, `fast-uri`, `js-yaml`, and their parent tools. | Trace supported parent updates in small batches. Avoid processing untrusted globs, browser stats, YAML, URI, or multipart input through affected tools while pending. |

The critical Handlebars advisories include
[GHSA-2w6w-674q-4c4q](https://github.com/advisories/GHSA-2w6w-674q-4c4q),
[GHSA-8r5x-fm3f-whwj](https://github.com/advisories/GHSA-8r5x-fm3f-whwj), and
[GHSA-p8wg-vrv2-v86f](https://github.com/advisories/GHSA-p8wg-vrv2-v86f).
The repository must not be described as secure or audit-clean while these and
the other documented findings remain.

### Deployment impact and pre-merge requirements

This review branch should not be merged to `main` until all of the following are
confirmed:

1. Hosted Amplify installs the lockfile successfully on its Linux image.
2. The Amplify pipeline backend generation/deployment completes without a
   dependency-induced change or failure.
3. The hosted Next.js application builds and the core signed-out/signed-in route
   smoke tests pass.
4. Private image verification, processing, delivery, removal, replacement,
   moderation, and protected reconciliation remain behaviorally unchanged.
5. The removed-public-image cleanup gate remains disabled and no cleanup job is
   invoked as part of dependency validation.

Next 16.4.3 warns that React 18 support is deprecated and will be removed in
Next 17. React 19 migration is intentionally outside this security-fix batch and
must be planned separately.

### Verification

| Command | Result |
| --- | --- |
| Fresh baseline `npm ci` | PASS; 1,268 packages installed. |
| Updated fresh `npm ci` | PASS; 1,269 packages installed from the synchronized lockfile. |
| `npm run test:public-image-reconciliation` | PASS; 65/65 offline tests. |
| `npm run amplify:typecheck` | PASS. |
| `npm run lint` | PASS. |
| `npm run build` | PASS on Next.js 16.4.3; compilation, TypeScript checks, and generation of 27 routes/pages completed. |
| `npm audit --json` | Findings remain (exit 1): 40 total; 1 critical, 28 high, 11 moderate. |
| `npm audit --omit=dev --json` | PASS (exit 0): 0 reported production-scope findings. |

The live processor, resolver, cleanup, and reconciliation scripts require hosted
identifiers or perform live operations and were intentionally not invoked. No
AWS resource was written, synthesized, deployed, or mutated in this pass.

## Historical September 5, 2026 assessment (superseded)

The material below preserves the earlier baseline for provenance. Its versions,
counts, and remediation candidates are superseded by the October 23 pass above.

Audit date: 2026-09-05. Environment: Windows, Node.js 24.14.0, npm 11.9.0.

## Summary

Both `npm audit --json` and `npm audit` completed with exit code 1 because findings remain: **34 affected package entries: 1 critical, 26 high, 7 moderate, 0 low**. These counts include vulnerable transitive packages and parents flagged through them; they are not 34 independent advisories or confirmed exploitable application paths.

Four flagged dependencies are direct: `next` (production), `postcss`, `@aws-amplify/backend`, and `@aws-amplify/backend-cli` (development). The other 30 flagged packages are transitive. PostCSS also has a separate transitive copy inside Next.js. Development classification does not eliminate risk to builds, generation, deployment, or CI credentials.

This change is documentation only. No dependency versions were changed, and neither audit fix command was run. npm's remediation suggestions below are recorded evidence, not commands to execute.

## Fix interpretation

- **Compatible candidate**: JSON reports `fixAvailable: true`. npm offers a normal resolution, but does not specify a target or prove compatibility. A future targeted lockfile change still needs review and testing; pinned or bundled ancestors may complicate it.
- **Amplify breaking proposal**: npm marks `@aws-amplify/backend@1.8.0` or `@aws-amplify/backend-cli@0.11.1` with `isSemVerMajor: true`. Both are downgrades from the installed versions. In particular, backend 1.23.0 to 1.8.0 is not literally a major-version increment; preserve npm's breaking classification without treating it as a safe upgrade. Do not adopt these automated downgrade proposals. Seek maintained upstream releases and assess generation/deployment compatibility separately.
- **Next outside pin**: npm proposes `next@16.3.4`, with `isSemVerMajor: false`. This is a minor update outside the exact 16.2.10 pin, so the text audit mentions force even though it is not a semver-major change. That does not prove absence of regressions. It also does not remove the need to update the independently pinned root PostCSS in a future change.

Audit reruns agreed on totals and package inventory. Some shared Amplify descendants alternated between the backend and CLI downgrade as the proposed remediation root; neither proposal is accepted here.

## Priority and recommended safe next actions

1. **Critical Amplify generation chain (A):** `backend -> backend-data -> graphql-generator -> graphql-docs-generator -> handlebars@4.7.7`; the CLI also reaches the generator through `model-generator` and `client-config`. The docs generator pins Handlebars exactly to 4.7.7. Review maintained Amplify releases for removal of that pin; assess trusted template/schema inputs and CI exposure now. Do not assume a root override is compatible. Handlebars findings include JavaScript injection, prototype pollution, access-control bypass and denial of service. Related lodash and Immutable findings affect generation helpers. A safe complete fix without breaking changes is **not established** by this audit.
2. **Application framework and image/CSS chain (N):** plan a separate reviewed Next.js update, using npm's 16.3.4 proposal as a candidate, and review alignment with `eslint-config-next`. The nine direct Next advisories report an affected 16.x range below 16.2.11, but 16.2.11 alone is not established as a complete fix for the PostCSS/sharp dependency findings. Review the deployed request handling and image path before assigning exposure. `next.config.mjs` is empty; a targeted source scan found no `use server`, `next/image`, rewrites, or middleware/proxy filenames under `src`. This reduces evidence for some advisory prerequisites but is not a runtime reachability assessment or security clearance.
3. **PostCSS (P):** plan a separate explicit update of root `postcss@8.4.39` and verify the Next-owned 8.4.31 copy is also removed. The audit's combined affected range is `<=8.5.22`; choose a maintained version outside all reported ranges and validate CSS generation/source maps. Do not treat updating only Next as proof the root pin is fixed. `nanoid` is shared through these PostCSS copies; assess a compatible targeted refresh alongside them.
4. **Remaining development tooling (T):** review targeted transitive updates for brace expansion, Browserslist, fast-uri and js-yaml. Validate lint, CSS compilation and Amplify/CDK workflows. Avoid processing untrusted glob patterns, browser stats, YAML or URI inputs in the affected tooling while remediation is pending. The fast-uri advisory class alone does not prove the application's server performs vulnerable outbound requests.
5. **Amplify telemetry (O):** review upstream construct releases or supported resolution changes for the nested OpenTelemetry 2.0.0 packages. The lockfile contains affected nested cores even though other installed cores are newer. Core's advisory affects versions below 2.8.0. The constructs pin resources to 2.0.0, so a casual top-level telemetry bump is insufficient. Validate synthesis/generation and telemetry behavior in a future dependency change.

For every future remediation: make a bounded dependency PR, inspect the lockfile diff, repeat both audits and the verification commands below, then test affected runtime or Amplify workflows. Passing builds alone does not resolve vulnerability findings. No deployment, backend synthesis or exploit testing was performed for this report.

## Complete affected-package inventory

Versions below are the affected lockfile copies reported in audit `nodes`, deduplicated. Severity is npm's package-level severity, including inherited findings; ancestor severity may differ from the leaf's severity. A/N/P/T/O refer to the next actions above.

| Package | Installed affected version(s) | Kind | Severity | Likely source / next action | Fix classification |
| --- | --- | --- | --- | --- | --- |
| `@ardatan/relay-compiler` | 12.0.0 | Transitive | high | Amplify backend/CLI generation / A | Compatible candidate; unverified |
| `@aws-amplify/appsync-modelgen-plugin` | 2.15.2 | Transitive | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend@1.8.0 |
| `@aws-amplify/backend` | 1.23.0 | Direct development | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend@1.8.0 |
| `@aws-amplify/backend-cli` | 1.8.3 | Direct development | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend-cli@0.11.1 |
| `@aws-amplify/backend-data` | 1.7.0 | Transitive | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend@1.8.0 |
| `@aws-amplify/client-config` | 1.10.2 | Transitive | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend@1.8.0 |
| `@aws-amplify/data-construct` | 1.17.7 | Transitive | moderate | Amplify data/API constructs / O | Compatible candidate; unverified |
| `@aws-amplify/form-generator` | 1.2.7 | Transitive | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend-cli@0.11.1 |
| `@aws-amplify/graphql-api-construct` | 1.22.2 | Transitive | moderate | Amplify data/API constructs / O | Compatible candidate; unverified |
| `@aws-amplify/graphql-docs-generator` | 4.2.1 | Transitive | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend@1.8.0 |
| `@aws-amplify/graphql-generator` | 0.5.3 | Transitive | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend@1.8.0 |
| `@aws-amplify/graphql-schema-generator` | 0.11.16 | Transitive | moderate | Amplify CLI schema generation / A | Amplify breaking proposal: @aws-amplify/backend-cli@0.11.1 |
| `@aws-amplify/model-generator` | 1.2.3 | Transitive | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend-cli@0.11.1 |
| `@aws-amplify/sandbox` | 2.2.1 | Transitive | high | Amplify backend/CLI generation / A | Compatible candidate; unverified |
| `@aws-amplify/schema-generator` | 1.4.1 | Transitive | moderate | Amplify CLI schema generation / A | Amplify breaking proposal: @aws-amplify/backend-cli@0.11.1 |
| `@graphql-codegen/core` | 2.6.8 | Transitive | high | Amplify backend/CLI generation / A | Compatible candidate; unverified |
| `@graphql-codegen/plugin-helpers` | 1.18.8, 3.1.2 | Transitive | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend@1.8.0 |
| `@graphql-codegen/visitor-plugin-common` | 1.22.0 | Transitive | high | Amplify backend/CLI generation / A | Compatible candidate; unverified |
| `@graphql-tools/relay-operation-optimizer` | 6.5.18 | Transitive | high | Amplify backend/CLI generation / A | Compatible candidate; unverified |
| `@opentelemetry/core` | 2.0.0 | Transitive | moderate | Amplify data/API constructs / O | Compatible candidate; unverified |
| `@opentelemetry/resources` | 2.0.0 | Transitive | moderate | Amplify data/API constructs / O | Compatible candidate; unverified |
| `@opentelemetry/sdk-trace-base` | 2.0.0 | Transitive | moderate | Amplify data/API constructs / O | Compatible candidate; unverified |
| `brace-expansion` | 1.1.16, 2.1.2, 5.0.6, 5.0.7 | Transitive | high | ESLint/config/plugins and Amplify/CDK glob tooling / T | Compatible candidate; unverified |
| `browserslist` | 4.28.6 | Transitive | high | Autoprefixer and Babel tooling / T | Compatible candidate; unverified |
| `fast-uri` | 3.1.3 | Transitive | high | Amplify CLI/CDK -> cloudformation-diff -> table -> ajv / T | Compatible candidate; unverified |
| `handlebars` | 4.7.7 | Transitive | critical | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend@1.8.0 |
| `immutable` | 3.7.6 | Transitive | high | Amplify backend/CLI generation / A | Compatible candidate; unverified |
| `js-yaml` | 4.3.0 | Transitive | high | ESLint -> @eslint/eslintrc / T | Compatible candidate; unverified |
| `lodash` | 4.17.23 | Transitive | high | Amplify backend/CLI generation / A | Amplify breaking proposal: @aws-amplify/backend@1.8.0 |
| `mysql2` | 3.9.9 | Transitive | high | Amplify CLI schema generation / A | Amplify breaking proposal: @aws-amplify/backend-cli@0.11.1 |
| `nanoid` | 3.3.16 | Transitive | high | PostCSS (root and Next.js) / P | Compatible candidate; unverified |
| `next` | 16.2.10 | Direct production | high | Next.js / N | Next outside pin: 16.3.4; not semver-major |
| `postcss` | 8.4.31, 8.4.39 | Direct development | high | Root PostCSS and Next.js / P | Next outside pin: 16.3.4; not semver-major |
| `sharp` | 0.34.5 | Transitive | high | Next.js / N | Next outside pin: 16.3.4; not semver-major |

## Advisory evidence

Source: npm registry audit responses captured during this triage, with lockfile inspection and targeted npm explain checks for provenance. These links are the advisories returned by npm; advisory content and fix availability can change. Parent-only entries in the inventory inherit findings from these leaf packages.

### @opentelemetry/core

- [OpenTelemetry Core: Unbounded memory allocation in W3C Baggage propagation](https://github.com/advisories/GHSA-8988-4f7v-96qf) — moderate.

### brace-expansion

- [brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) — high.
- [brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — high.
- [brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895) — high.

### browserslist

- [Browserslist: Uncaught crash / prototype write via untrusted browserslist-stats.json custom stats (normalizeStats)](https://github.com/advisories/GHSA-73wf-gq98-2v4g) — high.
- [Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) — high.

### fast-uri

- [fast-uri vulnerable to host confusion via skipped IDN canonicalization on scheme-relative references](https://github.com/advisories/GHSA-5jgf-p345-68v8) — high.
- [fast-uri vulnerable to host confusion via backslash authority introducer](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) — high.
- [fast-uri vulnerable to server-side request forgery via malformed IPv6 normalization](https://github.com/advisories/GHSA-f65p-4m7j-42xc) — high.
- [fast-uri vulnerable to server-side request forgery via repeated hostname percent-decoding](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) — high.
- [fast-uri vulnerable to host confusion via percent-encoded scheme normalization](https://github.com/advisories/GHSA-jqff-g426-hqxp) — high.
- [fast-uri vulnerable to host confusion via literal backslash authority delimiter](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) — high.

### handlebars

- [Handlebars.js has Prototype Pollution Leading to XSS through Partial Template Injection](https://github.com/advisories/GHSA-2qvq-rjwj-gvw9) — moderate.
- [Handlebars.js has JavaScript Injection via AST Type Confusion](https://github.com/advisories/GHSA-2w6w-674q-4c4q) — critical.
- [Handlebars.js has JavaScript Injection via AST Type Confusion by tampering @partial-block](https://github.com/advisories/GHSA-3mfm-83xf-c92r) — high.
- [Handlebars.js has a Property Access Validation Bypass in container.lookup](https://github.com/advisories/GHSA-442j-39wm-28r2) — low.
- [Handlebars.js has a Prototype Method Access Control Gap via Missing __lookupSetter__ Blocklist Entry](https://github.com/advisories/GHSA-7rx3-28cr-v5wh) — moderate.
- [Handlebars.js has Denial of Service via Malformed Decorator Syntax in Template Compilation](https://github.com/advisories/GHSA-9cx6-37pm-9jff) — high.
- [Handlebars.js has JavaScript Injection via AST Type Confusion when passing an object as dynamic partial](https://github.com/advisories/GHSA-xhpv-hc6g-r9c6) — high.
- [Handlebars.js has JavaScript Injection in CLI Precompiler via Unescaped Names and Options](https://github.com/advisories/GHSA-xjpj-3mr7-gcpf) — high.

### immutable

- [Immutable.js `List` 32-bit trie overflow → unrecoverable DoS](https://github.com/advisories/GHSA-v56q-mh7h-f735) — high.
- [Immutable is vulnerable to Prototype Pollution](https://github.com/advisories/GHSA-wf6x-7x77-mvgw) — high.
- [Immutable: Hash-collision algorithmic complexity denial of service in Immutable.Map/Set](https://github.com/advisories/GHSA-xvcm-6775-5m9r) — high.

### js-yaml

- [JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) — high.

### lodash

- [lodash vulnerable to Prototype Pollution via array path bypass in `_.unset` and `_.omit`](https://github.com/advisories/GHSA-f23m-r3pf-42rh) — moderate.
- [lodash vulnerable to Code Injection via `_.template` imports key names](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) — high.

### mysql2

- [MySQL2: Auth Plugin Downgrade to mysql_clear_password Leaks Plaintext Credentials](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr) — high.
- [MySQL2: Unbounded zlib inflate in compressed MySQL protocol handler allows decompression-bomb DoS](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3) — moderate.

### nanoid

- [nanoid: custom generators can loop indefinitely when size is zero](https://github.com/advisories/GHSA-2v37-7h3g-55p8) — high.

### next

- [Next.js: Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences](https://github.com/advisories/GHSA-4633-3j49-mh5q) — moderate.
- [Next.js: Unbounded Server Action payload in Edge runtime](https://github.com/advisories/GHSA-4c39-4ccg-62r3) — moderate.
- [Next.js: Cache confusion of response bodies for requests with bodies](https://github.com/advisories/GHSA-68g3-v927-f742) — moderate.
- [Next.js: Middleware / Proxy bypass in App Router applications using Turbopack and single locale](https://github.com/advisories/GHSA-6gpp-xcg3-4w24) — high.
- [Next.js: Server-Side Request Forgery in Server Actions on custom servers](https://github.com/advisories/GHSA-89xv-2m56-2m9x) — high.
- [Next.js: Unauthenticated disclosure of internal Server Function endpoints](https://github.com/advisories/GHSA-955p-x3mx-jcvp) — moderate.
- [Next.js: Denial of Service in App Router using Server Actions](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) — high.
- [Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname](https://github.com/advisories/GHSA-p9j2-gv94-2wf4) — high.
- [Next.js: Denial of Service in the Image Optimization API using SVGs](https://github.com/advisories/GHSA-q8wf-6r8g-63ch) — moderate.

### postcss

- [PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments](https://github.com/advisories/GHSA-6g55-p6wh-862q) — high.
- [PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) — moderate.
- [PostCSS has XSS via Unescaped </style> in its CSS Stringify Output](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) — moderate.
- [PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849) — high.

### sharp

- [sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — high.

## Verification

Checks completed in the dedicated dependency-audit worktree on branch `codex/dependency-audit-triage` on 2026-09-05.

| Command | Result |
| --- | --- |
| `npm ci` | PASS (exit 0); installed 1,268 packages in about eight minutes. Amplify peer-resolution and transitive deprecation warnings remain. |
| `npm run amplify:typecheck` | PASS (exit 0). |
| `npm run lint` | PASS (exit 0). |
| `npm run build` | PASS (exit 0); production compilation, TypeScript and generation of 27 static pages completed. |
| `git diff --check` | PASS; staged report also checked with `git diff --cached --check` before commit. |
| `npm audit --json` | Findings remain (exit 1): 34 affected packages. Confirmed before and after installation. |
| `npm audit` | Findings remain (exit 1): 1 critical, 26 high, 7 moderate. Confirmed before and after installation. |

The install-time audit summary printed 29 findings (1 critical, 26 high, 2 moderate), whereas both standalone audits after installation still reported 34. The cause of that summary discrepancy was not established. This report uses the complete standalone audit inventory; the lower install summary is not evidence of remediation.

SHA-256 hashes were identical before and after verification in this worktree:

- `package.json`: `559300780C06DD8C45206763ED29D222B026EF70337E1EA8E283F54E63AA9786`
- `package-lock.json`: `B35A150A5D6BCAB9C51789D9508AF93C2869E58198E81DEBB81EFB7471BF304C`

No dependency files or versions were changed. Neither `npm audit fix` nor `npm audit fix --force` was executed. The successful checks establish install/build compatibility of the existing tree, not absence of exploitable vulnerabilities.
