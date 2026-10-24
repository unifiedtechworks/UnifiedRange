# Dependency remediation pass 1 validation

## Offline Lambda bundle/runtime validation — October 24, 2026

**Disposition: offline validation passed; deployment remains unapproved. The declared Node 20 runtime is
deprecated. Node 24 is the recommended separately reviewed migration target;
offline compatibility does not establish deployed or managed Hosting support.**

### Exact source and scope

- Implementation tested: `1656d7cc243151c9ee42e31598620bef72d6edb7`.
- Starting review HEAD: `b1f721e9fd69670eb790fb4aafb2391333e4b168`.
- Immutable harness: `05790294dd7293f4c7db9e12ddee7b5e7963aeb1`.
- Workflow: `c096a21672eae87b69b3506dfab142de1610a803`.
- [Lambda validation run 40139591853](https://github.com/unifiedtechworks/UnifiedRange/actions/runs/40139591853): completed successfully; actual results below.
- Branch: `codex/release-dependency-remediation-1`; main remained
  `6d268c77b8d694385bd21128bae044ff1feffbb0`.

The starting checkout was clean. Later commits between the implementation and
starting HEAD contain workflow/support and documentation changes, not runtime
changes. This task adds only test/build harnesses, a workflow, and this report.
There is no comparison baseline in this run. The two earlier successful Linux
comparison runs below remain separate historical evidence; this workflow checks
out the exact Handlebars-remediated implementation, not the older candidate.

### Runtime inventory and supported target

All eight custom functions explicitly declare `runtime: 20` in their respective
`amplify/functions/<name>/resource.ts` files:

| Function | Declared runtime | Effective architecture |
| --- | --- | --- |
| create-public-image-report | Node 20 | x86_64 default |
| inspect-public-image-cleanup | Node 20 | x86_64 default |
| moderate-public-passport-image | Node 20 | x86_64 default |
| process-public-passport-image | Node 20 | x86_64 default |
| remove-public-passport-image | Node 20 | x86_64 default |
| resolve-public-passport-image | Node 20 | x86_64 default |
| retry-removed-public-image-cleanup | Node 20 | x86_64 default |
| verify-private-image | Node 20 | x86_64 default |

None overrides architecture, layers, or bundling. Installed
`@aws-amplify/backend-function@1.18.1` supplies x86_64 and a Node 22 default
(overridden here). Its NodeVersion type and runtime map include 18/20/22/24,
including `Runtime.NODEJS_24_X` from installed `aws-cdk-lib@2.261.0`.
No toolchain upgrade is needed to express Node 24. The processor specifies
45 seconds, 1024 MB memory, 512 MB ephemeral storage, and the data resource group.

The [official AWS runtime table](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html),
checked October 24, 2026, lists the following Amazon Linux 2023 runtimes. AWS
forecast dates can change; recheck at deployment approval.

| Runtime | Deprecation | Block new functions | Block function updates |
| --- | --- | --- | --- |
| Node 20 | April 30, 2026 | July 29, 2027 | August 31, 2027 |
| Node 22 | April 30, 2027 | July 29, 2027 | August 31, 2027 |
| Node 24 | April 30, 2028 | June 1, 2028 | July 1, 2028 |

Node 20 compatibility is historical evidence, not release clearance. Prefer
Node 24: AWS and this installed toolchain support it, the bundled SDKs declare
Node >=20, and the container results below assess the real handler dependencies.
Node 22 is an available intermediate target but was not container-tested here.

Local diagnostic tools and GitHub build/tests use Node 24.14.0/npm 11.9.0.
Those versions do not establish the deployed function runtime. The exact
Amplify Hosting build Node and managed SSR runtime/support remain unverified;
neither a successful local/CI Next build nor this Lambda test resolves them.

### Representative bundling and precise equivalence limits

Actual Amplify deployment artifact generation: **not achieved**. The documented
[Amplify CLI commands](https://docs.amplify.aws/react/reference/cli-commands/)
provide no supported standalone artifact/synthesis command used here. No
invented synth/dry-run flag, sandbox, pipeline deploy, or CDK deployment ran.

`scripts/lambda-runtime/build.mjs` compiles the unchanged real
`amplify/functions/process-public-passport-image/handler.ts`, export `handler`,
using installed esbuild 0.25.12. It mirrors the inspected Amplify factory/CDK
settings: platform node, targets node20 and node24 separately, ESM, minification,
source maps with source content, AWS SDK bundled, empty configured externals,
`.node` file loader, actual installed CJS shim injection, and actual installed
SSM resolution/invocation banner. Outputs are `index.mjs`, `index.mjs.map`, a
metafile, and dependency/size/checksum reports in a temporary directory.

The factory's generated environment module exports `process.env`; the processor
reads process.env directly and does not import `$amplify/env`. Its Schema import
is type-only and erased. The test supplies synthetic table/bucket names. It
does not generate or verify synthesized resource names, permissions, environment
bindings, asset staging/hashes, packaging, or managed-runtime configuration.

Metafile externals are Node builtins only; no native `.node` input is present.
The raw Amplify banner additionally has a conditional dynamic
`@aws-sdk/client-ssm` import outside the esbuild dependency graph. Tests use empty
`AMPLIFY_SSM_ENV_CONFIG` and the processor declares no secret; a nonempty deployed
configuration's SSM lookup, package availability, permissions, and refresh
behavior remain untested. This limitation is not hidden by the builtin-only
metafile check.

The plain representative `index.mjs` independently loads with its banner and
exports the handler; invalid-ID and missing-identity events reject before I/O.
Successful processing runs in a second compiled test bundle containing the
same complete production handler, real SDKs, fixtures, and mocked SDK `send`
boundaries, with the CJS shim and without the SSM banner. Production logic is
not copied, bypassed, or altered. The second bundle enables SDK prototype mocks;
its size is not reported as deployment size. This is full-handler behavior
coverage but not byte-for-byte execution of the plain artifact's successful
AWS-I/O path. Neither bundle is an Amplify-generated deployment asset.

### Container isolation and coverage

The standard GitHub-hosted Ubuntu 24.04 runner prepares dependencies/images,
then executes [official AWS Lambda Node images](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-image.html)
pinned to these resolved linux/amd64 digests:

- Node 20: `public.ecr.aws/lambda/nodejs@sha256:7113432fbe93b701792a659c515a9501822b95b0c3070d27565f22b8422aee3d`
- Node 24: `public.ecr.aws/lambda/nodejs@sha256:b157a991e174a3696e77c991727001756bb4d4ea4bba426d3401e515b9285b0d`

Install/build runs with a fresh HOME, explicit environment allowlist, nonexistent
AWS/npm user config paths, no deployment credentials or inherited GitHub token,
and nonpersisted checkout credentials. Official actions use pinned commit SHAs;
permissions are contents:read only, without OIDC, secrets, deployment
environments, or larger runners. No artifacts or private configuration upload.

Each container has network disabled, read-only root and bundle mount, no other
host mount, user 1000:1000, dropped capabilities, no-new-privileges, 2 CPUs,
1024 MB memory, 128 PID limit, 64 MB temporary /tmp, and 180-second test timeout.
The job has a 30-minute bound. These controls are test bounds, not a simulation
of Lambda's exact CPU/timeout/ephemeral-storage allocation. The entrypoint is
the image's `/var/lang/bin/node`: this exercises the AWS base-image userspace,
not the Runtime Interface Client, emulator invocation, or a deployed Lambda.
SDK mocks reject unexpected calls and record violations so swallowed errors
still fail tests. No real images, users, resources, or live APIs are used.

There are 14 checks per runtime: three plain-bundle initialization/export/early
rejection checks and eleven complete-handler processing/rejection checks. They
cover successful JPEG and transparent PNG to JPEG; white flattening; EXIF
orientation 6 with pixel-position checks; removal of EXIF/comment metadata;
1800-to-1600 pixel resizing; a high-entropy derivative under 2 MiB; invalid image,
unsupported format, source >6 MiB, excessive dimensions, cross-owner access,
and absent explicit consent. Successful paths check ready status, public ID,
JPEG dimensions, one encrypted S3 write, and six transaction actions. This is
representative coverage, not exhaustive malformed-image/fallback/codec coverage
or proof of DynamoDB conditional semantics, AppSync authorization, or IAM.

The existing four codec tests exercise selected pure helpers; they are reported
separately under build Node 24. The 65 TypeScript reconciliation tests also use
their supported Node 24 runner, not the Lambda runtime container. Local Windows
diagnostic execution of the node20-target bundle passed 14 checks under Node 24;
that result is not Node 20 or Linux evidence.

### Hosted results

Run 40139591853 concluded **success**. Runner image was
`ubuntu24/20261023.334.3`; build Node v24.14.0/npm 11.9.0, linux/x64.

| Check | Actual result | Exit |
| --- | --- | --- |
| npm ci | Passed | 0 |
| Generator compatibility | 5 passed | 0 |
| Reconciliation, build Node 24 | 65 passed | 0 |
| Pure codec helpers, build Node 24 | 4 passed | 0 |
| Amplify typecheck | Passed | 0 |
| Lint | Passed | 0 |
| Production web build | Passed | 0 |
| Representative bundles, node20/node24 targets | Both built | 0 |
| Node 20.20.2, Amazon Linux 2023.10.20260302, x64 | 14 checks passed | 0 |
| Node 24.22.1, Amazon Linux 2023.12.20260914, x64 | 14 checks passed | 0 |
| git diff --check | Passed | 0 |
| Manifest/lockfile diff and before/after SHA-256 | Unchanged, both files | 0 |

Both official image pulls and architecture checks succeeded. The configured
Node 20 image remains available, but its successful result does not reverse
deprecation. The supported-target test ran under actual Node 24.22.1 inside
its pinned Lambda image, independently of build Node 24.14.0.

This run's npm ci advisory summary reported 50 vulnerabilities (45 high,
5 moderate). The earlier explicit full-audit report recorded 53 (45 high,
8 moderate). No dependency files changed, and this task did not capture a new
full audit JSON to reconcile advisory/platform differences. Preserve both
observations; neither constitutes acceptance or additional remediation.

| Target | Plain JS bytes | Source map bytes | Package/version inputs | Native inputs |
| --- | --- | --- | --- | --- |
| node20 | 1,000,709 | 5,004,584 | 70 | 0 |
| node24 | 1,000,709 | 5,004,584 | 70 | 0 |

Both plain JS outputs have SHA-256
`8b066007011fa56b684812753839a181b4eb1395e88c9fb8eebb6aeaaf703b18`.
The targets happen to emit identical JavaScript; that does not make their
runtime versions interchangeable. These are uncompressed JS/map sizes, not a
deployment ZIP size. The Windows source map was 5,010,664 bytes; the table uses
the actual Linux result, not the local diagnostic measurement.

The CI log and job summary retain all 70 package/version inputs. Principal
inputs are `image-js@1.7.1`, `jpeg-js@0.4.4`, `fast-jpeg@3.0.1`,
`fast-png@8.0.0`, `tiff@7.1.3`, `fflate@0.8.3`,
`@aws-sdk/client-s3@3.1090.0`, `@aws-sdk/client-dynamodb@3.1090.0`, AWS/Smithy
support modules, image/matrix utilities, and the Amplify CJS shim. Presence as a
metafile input does not imply every export is retained after tree shaking.
There is no Sharp/native codec in this handler bundle. Dependency engine
requirements and versions are captured by the builder; the relevant AWS clients
require Node >=20.0.0. The successful real-handler image tests provide evidence
beyond package engine declarations.

Recorded builtin externals: `module`, `node:async_hooks`, `node:child_process`,
`node:crypto`, `node:fs`, `node:fs/promises`, `node:http`, `node:http2`,
`node:https`, `node:module`, `node:os`, `node:path`, `node:process`,
`node:stream`, `node:url`, `node:util`, and `node:zlib`. The separate conditional
SSM-banner requirement remains as described above. No artifacts were uploaded.

### Separately reviewed migration and deployment proposal

The smallest processor migration changes only
`amplify/functions/process-public-passport-image/resource.ts` from runtime 20 to
24. A supported whole-backend release requires separately reviewing the same
runtime declaration in all eight resource files listed above. The other seven
handlers were typechecked but did not receive this processor-specific full
runtime test suite. Review their runtime behavior before approving that broader
migration. No resource definition or dependency was changed in this task.

The exact validated implementation candidate is
`1656d7cc243151c9ee42e31598620bef72d6edb7`; harness/workflow commits are identified
above. A deployable candidate still needs a separately reviewed migration commit
whose full SHA must be recorded and validated before approval. There is no
approved final deployment SHA yet. This report is ready to inform that decision,
not authorization to deploy the existing Node 20 candidate.

Proposed next stage, **not executed**:

1. Review and validate the runtime migration, remaining dependency risk (the
   prior audit retained 45 high/8 moderate, zero critical findings), and managed
   Next/Amplify Hosting support gap. This task accepts none of those risks.
2. Approve a dedicated isolated nonproduction app/backend and test branch with
   no connection to main or live user data. Use dedicated synthetic identities,
   images and data; do not reuse live outputs or credentials. Review the actual
   plan and permissions before provisioning.
3. Expect Cognito, AppSync, DynamoDB tables/indexes, S3, Lambda, IAM policies/roles,
   logs, and Hosting/build resources according to the synthesized backend.
   Confirm precise resources, region, retention, quotas and access boundaries
   from the future plan; no plan/resources were created here.
4. Log the final source SHA, Node/npm and Amplify/CDK/esbuild versions, Hosting
   build image/Node and SSR adaptation, generated function artifacts/checksums,
   architecture/runtime and environment binding names without secrets. Execute
   actual deployed Lambda and authenticated release QA in that isolated setup.
   Keep cleanup execution disabled unless separately approved.
5. Before provisioning, approve potential Hosting/build, Lambda, AppSync,
   DynamoDB, S3, log-retention and data-transfer costs and monitoring/budget
   controls. Set retention and a teardown owner/window. No cost amount is
   assumed from offline tests.
6. On failure, stop isolated builds/traffic and revert only that isolated
   candidate. Teardown requires reviewing the dedicated resources and retention
   policy first; remove only the approved test resources and verify residual
   storage/log costs. Main/live data remain outside rollback/cleanup scope.

Actual deployed Lambda execution, deployed IAM/auth/resource bindings, Amplify
Hosting packaging/support and authenticated release QA remain pending. Before
the CI push, read-only AWS checks confirmed the review branch was unconnected,
automatic branch creation was disabled, and the sole connected main branch had
previews disabled. No PR, deployment, AWS mutation, runtime migration, live
processor/moderation/cleanup invocation, or main push was performed.

## Handlebars remediation — October 24, 2026

**Disposition: targeted critical finding resolved; local and Linux compatibility
passed. Ready for the next separately approved deployment-validation decision.
This does not approve merge, deployment, or remaining dependency risk.**

Starting HEAD: `e035ca80235976b457340e09c79e6472ec19b993`, clean on
`codex/release-dependency-remediation-1`. Fetched main remained
`6d268c77b8d694385bd21128bae044ff1feffbb0`. The prior successful run
[40031472320](https://github.com/unifiedtechworks/UnifiedRange/actions/runs/40031472320)
is preserved below and does not validate this new dependency change.

### Decision and dependency evidence

Use the authorized exact override `@aws-amplify/graphql-docs-generator@4.2.1`
-> `handlebars: 4.7.10`. Registry checks still show latest docs-generator 4.2.2
pinning 4.7.9 and graphql-generator 0.5.4 pinning docs-generator 4.2.2.
The [upstream generator changelog](https://github.com/aws-amplify/amplify-codegen/blob/main/packages/graphql-docs-generator/CHANGELOG.md)
records that July update; it does not resolve the newer October advisories.
The [official Handlebars 4.7.10 release](https://github.com/handlebars-lang/handlebars.js/releases/tag/v4.7.10)
is the current stable patched 4.x release. Its iterable `each` behavior change
is included in the compatibility review; this generator supplies ordinary
arrays and does not mutate an iterable during rendering.

This is a project-maintained override, not upstream certification. Remove it
once the supported parent chain naturally adopts a version outside all current
advisory ranges, with no vulnerable copy on any importer path, and repeat these
checks without the override. No generator/Amplify/framework version changed.
`npm install --package-lock-only --ignore-scripts --no-audit --no-fund`
generated a diff confined to the Handlebars entry (version, official tarball,
integrity, and its minimist/neo-async dependency ranges); all other locked
versions stayed identical. No lockfile entries were edited by hand.

The single normal, nonbundled copy changes from `node_modules/handlebars@4.7.7`
to `node_modules/handlebars@4.7.10`. Every ancestor path listed in the historical
Handlebars section below remains the same through docs-generator 4.2.1; only
the leaf changes. `graphql-generator/lib/statements.js` invokes the public
`generateGraphQLDocuments(schema, options)` entry point. It resolves the same
docs-generator as form-generator. That entry imports
`handlebars/dist/handlebars`, compiles fixed bundled template strings with
`noEscape`/`preventIndent`, and supplies schema-derived data. It neither imports
an AWS client nor performs network/schema introspection. This inspected benign
path does not establish whether an advisory was exploitable in every possible
generation/deployment context.

The full pre-change audit reports 11 Handlebars advisories at this one path.
An additional GitHub advisory API query for exact `handlebars@4.7.10` returned
zero current matching advisories. The pre-change 55-entry full audit was also
reconfirmed with pinned npm 11.9.0 against temporary original manifest/lockfile
copies, without installing or executing the older dependency tree.
The complete advisory IDs are:

- [GHSA-3mfm-83xf-c92r](https://github.com/advisories/GHSA-3mfm-83xf-c92r),
  [GHSA-2w6w-674q-4c4q](https://github.com/advisories/GHSA-2w6w-674q-4c4q),
  [GHSA-2qvq-rjwj-gvw9](https://github.com/advisories/GHSA-2qvq-rjwj-gvw9),
  [GHSA-7rx3-28cr-v5wh](https://github.com/advisories/GHSA-7rx3-28cr-v5wh),
  [GHSA-442j-39wm-28r2](https://github.com/advisories/GHSA-442j-39wm-28r2),
  [GHSA-xhpv-hc6g-r9c6](https://github.com/advisories/GHSA-xhpv-hc6g-r9c6),
  [GHSA-9cx6-37pm-9jff](https://github.com/advisories/GHSA-9cx6-37pm-9jff), and
  [GHSA-xjpj-3mr7-gcpf](https://github.com/advisories/GHSA-xjpj-3mr7-gcpf):
  reported ranges end before 4.7.9.
- [GHSA-xw65-4hp5-5hc7](https://github.com/advisories/GHSA-xw65-4hp5-5hc7),
  [GHSA-8r5x-fm3f-whwj](https://github.com/advisories/GHSA-8r5x-fm3f-whwj), and
  [GHSA-p8wg-vrv2-v86f](https://github.com/advisories/GHSA-p8wg-vrv2-v86f):
  reported ranges extend through 4.7.9; patched in 4.7.10.

After the override, Handlebars and the inherited docs-generator entry disappear
from the fresh audit. All other affected package nodes and direct advisory IDs
are unchanged. Full-tree counts are 55 -> 53 (critical 1 -> 0, high 46 -> 45,
moderate 8 -> 8); production remains 0 -> 0. The full audit's exit 1 is a valid
vulnerability report, not a registry failure. The older 40-entry result is
historical. Remaining findings include Amplify/GraphQL parents, Zod,
OpenTelemetry, Lodash, Immutable, MySQL, busboy, brace expansion, Browserslist,
fast-uri, js-yaml, csv-parse and Tailwind/PostCSS tooling. No tree-wide security
clearance or residual-risk acceptance is implied.

### Offline generator compatibility

`scripts/graphql-generator-compatibility.test.mjs` calls the installed public
entry point used by the parent; it does not reimplement generator behavior.
It resolves from the tested source checkout's graphql-generator and also checks
form-generator resolves the same docs-generator. The test verifies the actual
distribution module's Handlebars version, installed manifest, and every
lockfile Handlebars copy. CI supplies an independent expected version per job.

The adjacent synthetic schema has three queries, three mutations, and two
subscriptions, with nested/recursive models, enum/optional/list fields, list
arguments, and a custom mutation result. Subscriptions cover the generator's
supported model-operation output; no active application subscription client was
identified in the source scan. Four scenarios cover defaults, metadata/depth 4,
typename-disabled/depth 3, and locally constructed introspection/depth 4.
All 32 generated operations are parsed and validated against the synthetic
schema and compared byte-for-byte with benign pre-change expected output.
The expected JSON records its pre-change source, generator and Handlebars
versions; tests cannot regenerate it. No intentional output change is expected.

Baseline capture ran with an allowlisted child environment, fresh HOME/profile,
and nonexistent AWS/npm credential paths. Output was first written to temporary
storage, then reviewed and saved as the synthetic fixture. No live introspection,
untrusted template, exploit payload, AWS credential, token, production schema,
or generated application source was used. The test itself only returns results
in memory. These tests do not cover all schema shapes, S3 fragments, other
language formatters, deployment synthesis, actual Lambda bundles or hosted auth.

### Current verification

Local ordinary-host checks explicitly used Node 24.14.0 and npm 11.9.0 from
their executable paths, with allowlisted child environments and temporary
HOME/profile/credential-config paths. This avoids the ordinary host's different
default Node selection. No concurrent installs/builds ran in this checkout.

- `npm ci`: passed, exit 0; 1,269 packages installed. Peer/deprecation warnings
  remain; no force or legacy-peer-deps flag was supplied.
- `npm explain handlebars` and `npm ls handlebars --all`: passed, exit 0;
  one overridden 4.7.10 copy, preserved after the clean install.
- Standalone full/production audits repeated after installation: exits 1/0,
  respectively, confirming 53/0 findings. Install-summary counts differed;
  standalone reports are used throughout this document.
- Generator tests: 5/5 passed. Initial resolution assertion attempted to read
  form-generator's unexported package manifest; it was corrected to resolve
  from its public exported entry, then passed. All four output comparisons
  passed before and after that test-only correction.
- Reconciliation: 65/65 passed; codec: 4/4 passed; backend typecheck and lint:
  passed, exit 0.
- A structured lockfile comparison found exactly one changed package entry,
  `node_modules/handlebars`; no other locked version/metadata changed.

- Windows `npm run build`: passed, exit 0 on Next 16.4.3/Turbopack. The earlier
  worker-startup error did not recur with this ordinary-host clean install and
  pinned toolchain. Its prior root cause remains unproven; this is not a claim
  that Handlebars fixed that issue. No compiler/configuration change was made.
- `git diff --check` and staged whitespace checks: passed.

Source remediation commit: `1656d7cc243151c9ee42e31598620bef72d6edb7`
(`Remediate Amplify Handlebars dependency`). It changes only package.json,
package-lock.json, the generator test and its two fixtures. The separate
workflow/support commit is `9e1c8fe4d56cd2890b48628f065c65256ccfe232`.
Both were pushed only to the existing review branch.

The new Linux comparison uses control `dbc5f575eb636a7da279a390bd2b6f3629e8fce7`
and candidate `1656d7cc243151c9ee42e31598620bef72d6edb7`, with the latter also
the separately identified immutable test-harness commit. Generator test/fixtures
are supplemental in control. Both jobs resolve imports from their own source
checkout after a clean install; the harness checkout has no installed packages.
The prior main-versus-pass-1 comparison remains separate below.

The workflow retains Ubuntu 24.04 x64, exact Node/npm versions, the same official
action SHA pins, read-only contents permission, no OIDC/environment/secrets,
nonpersisted checkout credentials, credential-free application environments,
no caches/artifacts, bounded timeouts and two jobs with fail-fast disabled.
Its trigger remains restricted to the review branch and the two CI files.
Before pushing, read-only checks confirmed automatic Amplify branch creation
off, previews off, and only main connected; the review branch was unconnected.

### New Linux comparison — passed

[Run 40134500422](https://github.com/unifiedtechworks/UnifiedRange/actions/runs/40134500422)
completed successfully on its first attempt, October 24, 2026,
14:30:15–14:33:19 America/Los_Angeles, workflow commit
`9e1c8fe4d56cd2890b48628f065c65256ccfe232`. No rerun was needed.

- [Control job 120993038290](https://github.com/unifiedtechworks/UnifiedRange/actions/runs/40134500422/job/120993038290):
  source `dbc5f575eb636a7da279a390bd2b6f3629e8fce7`.
- [Candidate job 120993038387](https://github.com/unifiedtechworks/UnifiedRange/actions/runs/40134500422/job/120993038387):
  source `1656d7cc243151c9ee42e31598620bef72d6edb7`.
- Both: Ubuntu 24.04.5 LTS x64, image `ubuntu24 / 20261023.334.3`,
  Node 24.14.0 and npm 11.9.0. This image revision differs from the October 23
  run; both new jobs used the same image. It does not establish Amplify parity.

Every command/check in this table exited **0** in both jobs:

| Check | Control | Candidate |
| --- | --- | --- |
| `uname -a`, Node/npm version checks and npm pin | passed | passed |
| `npm ci` | passed | passed |
| Installed/optional native versions | 1,691 matched; SWC/Sharp loaded | 1,691 matched; SWC/Sharp loaded |
| Importer-resolved Handlebars | 4.7.7 | 4.7.10 |
| `node --test scripts/graphql-generator-compatibility.test.mjs` | 5/5; supplemental harness | 5/5 |
| `npm run test:public-image-reconciliation` | 65/65 | 65/65 |
| `node --test scripts/public-image-codec-compatibility.test.mjs` | 4/4 | 4/4 |
| `npm run amplify:typecheck` | passed | passed |
| `npm run lint` | passed | passed |
| `npm run build` | passed | passed |
| Loopback production HTTP `/` and `/auth/sign-in` | HTTP 200, expected HTML | HTTP 200, expected HTML |
| `git diff --check` | passed | passed |
| `git diff --exit-code -- package.json package-lock.json` | passed | passed |
| Before/after manifest and lockfile hashes | identical | identical |

Both importer checks resolved `node_modules/handlebars/dist/handlebars.js`
within their own checkout. Both generated identical reviewed outputs for all
32 operations. Both native checks loaded Sharp 0.35.5/libvips 8.18.7 and SWC;
all required Linux x64 GNU optional-package versions matched their lock entries.
HTTP checks were bounded, loopback-only, with no browser JavaScript or sign-in.

| File | Control SHA-256 before/after | Candidate SHA-256 before/after |
| --- | --- | --- |
| `package.json` | `b686fe09ca70f686fc66933cdf9a55ef7c5c8b54c0dd53383b137ce048f3367b` | `2983b86da50eca4a4ee1fdbb59883c8df3a2c095edf7157a9064a5d36c516a8a` |
| `package-lock.json` | `3f12ec5d463a8b1b2aba54f1ab182fd1361649681641467b1b90a2a2bade583d` | `39571f3d4f9d8fdd4153c8e64e58bda9ac6f89bcbad7bb98906df72b225e6ffe` |

The new remediation's Linux installation/generation/test/build checks are
cleared for these exact revisions. Amplify Hosting packaging/managed Next
support, actual Lambda bundles and Node 20 execution, browser/authenticated
release QA, and the remaining noncritical dependency findings are still separate
decisions. The earlier Windows failure remains historical and unexplained,
although this task's Windows build passed. No Handlebars risk acceptance is
needed to describe the resolved audit entry; no other risk is accepted here.

The results follow-up edits only the two existing reports and does not match
the CI path filter. No main push/merge, PR, AWS deployment/resource/permission
change, live operation, cleanup-gate change, or schema/auth/storage change was
performed. Final documentation commit/push identity is recorded in the task
completion message; the source and workflow commits above remain immutable.

## Historical pass 1 and first Linux comparison — October 23, 2026

The following records the earlier checkpoints. Its unresolved Handlebars status
is superseded by the October 24 remediation above; deployment boundaries remain.

Date: October 23, 2026. **Disposition: Linux comparison passed; merge/release remain blocked on the separate hosted validation and deployment-toolchain requirements.** No residual risk is accepted here.

## Original source review and scope

- Repository: `UnifiedRange`; branch: `codex/release-dependency-remediation-1`.
- Exact implementation reviewed: `f6fe22a9b879f8c7080e5e8359676f46c9d553a9`.
- Fetched `origin/main`: `6d268c77b8d694385bd21128bae044ff1feffbb0`.
- At review start, HEAD was exactly the implementation commit, with a clean working tree and no unexpected later commits. The implementation changes only `package.json`, `package-lock.json`, `next-env.d.ts`, and the audit report.
- This validation adds documentation and an offline codec test only. No dependency upgrade, override, application change, infrastructure change, merge, or deployment is included.

## Approved GitHub-hosted Linux comparison — passed

The owner subsequently approved a standard GitHub-hosted Ubuntu workflow. This supersedes the earlier lack of an approved Linux environment; no local WSL/Docker installation or AWS provisioning was needed. The workflow ran once, with two separate clean jobs, and both succeeded.

- Workflow: `.github/workflows/dependency-linux-validation.yml`.
- Driver: `.github/scripts/dependency-linux-validation.mjs`.
- Trigger: push only to `codex/release-dependency-remediation-1`, and only changes to those two files. No main/PR/schedule/manual trigger; documentation-only follow-up commits do not trigger it.
- Workflow/support commit: `e41831b82bc36cdd2c75ba9575dd1705153d4daf`.
- [Run 40031472320](https://github.com/unifiedtechworks/UnifiedRange/actions/runs/40031472320), attempt 1, push event, **success**, October 23, 2026, 15:06:50–15:09:21 America/Los_Angeles.
- [Baseline job](https://github.com/unifiedtechworks/UnifiedRange/actions/runs/40031472320/job/120680489180): `6d268c77b8d694385bd21128bae044ff1feffbb0`.
- [Candidate job](https://github.com/unifiedtechworks/UnifiedRange/actions/runs/40031472320/job/120680489114): `dbc5f575eb636a7da279a390bd2b6f3629e8fce7`, containing implementation `f6fe22a9b879f8c7080e5e8359676f46c9d553a9` plus only two validation documents and the codec test. No unexpected runtime changes were present.
- Codec harness in both jobs: `dbc5f575eb636a7da279a390bd2b6f3629e8fce7`. It was explicitly copied as a supplemental test into baseline; it was not represented as baseline source.
- `origin/main` still resolved to the agreed baseline when fetched before this run. The baseline was not silently advanced.

### Runner and permissions

Both jobs recorded standard `ubuntu-24.04` x64, Ubuntu **24.04.5 LTS**, runner image **ubuntu24 / 20261012.334.1**, Linux kernel **6.17.0-1022-azure**, Node **24.14.0**, npm **11.9.0**. `uname -a` and both version commands exited 0. Ephemeral hostnames are omitted from this report. Ubuntu is not claimed to match Amplify's still-unverified build image or deployed runtime.

Official action tags were resolved through their upstream Git APIs and pinned:

| Action release | Verified commit |
| --- | --- |
| `actions/checkout` v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |

Node 24.14.0 was available from its [official distribution](https://nodejs.org/download/release/v24.14.0/SHASUMS256.txt). npm 11.9.0 was installed into a temporary toolchain prefix from the official npm registry, with lifecycle scripts disabled for that toolchain installation. Neither action restored a dependency cache, and each source checkout started without `node_modules` or `.next`. Jobs had 30-minute limits, a maximum of two parallel jobs and `fail-fast: false`; no automatic reruns were used.

Read-only repository inspection confirmed public visibility, Actions enabled, allowed actions `all`, and default workflow permissions `read`. The workflow explicitly sets only `contents: read`; it grants no OIDC or write permission and uses no deployment environment. Checkout/setup may use GitHub platform authentication. Checkout credentials are not persisted, and application processes receive an explicit `env -i` allowlist with a fresh HOME and empty AWS/npm credential configuration paths. No GITHUB_TOKEN, PAT, user token, AWS credential, repository secret, or Windows environment/configuration is passed to install/tests/build. No repository-security setting was changed.

The committed nonsecret outputs are used for compilation only and never printed. The reviewed commands do not invoke the live processor/resolver/cleanup scripts, sandbox, pipeline-deploy, or CDK. The codec tests execute selected pure functions; reconciliation tests use injected offline fakes. HTTP checks use only loopback GETs, do not run browser JavaScript, and do not authenticate or invoke mutations. Job summaries/logs contain command outcomes and hashes; no `.next`, dependencies, outputs, environment dumps, or user-data artifacts were uploaded.

### Per-command results

Every command below exited **0** in both jobs. The driver retained real exit codes and would fail the job for any failed command or invariant.

| Command/check | Baseline | Candidate |
| --- | --- | --- |
| `uname -a`, `node --version`, `npm --version` | passed | passed |
| `npm ci` | passed; clean install | passed; clean install |
| Installed/native package verification | passed; 1,690 installed entries compared | passed; 1,691 installed entries compared |
| `npm run test:public-image-reconciliation` | passed; 65/65 | passed; 65/65 |
| `node --test scripts/public-image-codec-compatibility.test.mjs` | passed; 4/4 supplemental tests | passed; 4/4 |
| `npm run amplify:typecheck` | passed | passed |
| `npm run lint` | passed | passed |
| `npm run build` | passed; Next 16.2.10, Turbopack | passed; Next 16.4.3, Turbopack |
| Loopback production HTTP | passed; `/` and `/auth/sign-in` returned 200 and expected HTML | passed; same checks |
| `git diff --check` | passed | passed |
| `git diff --exit-code -- package.json package-lock.json` | passed | passed |
| Before/after SHA-256 equality | passed; both files unchanged | passed; both files unchanged |

Both production builds generated 27 static pages and completed TypeScript checks. Smoke checks started the production artifact on `127.0.0.1`, used bounded readiness/request timeouts, then stopped the server. These are basic signed-out HTTP checks, not browser hydration or authenticated release QA. Existing audit/deprecation and module-type warnings were not treated as evidence of remediation.

### Lockfile and native-package reproducibility

| Revision / file | SHA-256 before and after (identical) |
| --- | --- |
| Baseline `package.json` | `f1c53ab4e4d4658bd26c8dda7107c619c956f0c079f43614d672c63ceeafa597` |
| Baseline `package-lock.json` | `20f0ea0de3f48004d878db257d51954148576dcc4b28cfb3a31dcc98ce638ed7` |
| Candidate `package.json` | `b686fe09ca70f686fc66933cdf9a55ef7c5c8b54c0dd53383b137ce048f3367b` |
| Candidate `package-lock.json` | `3f12ec5d463a8b1b2aba54f1ab182fd1361649681641467b1b90a2a2bade583d` |

All existing installed package manifests represented in each lockfile matched its version; all direct dependencies were present. Unmaterialized entries for other platforms/bundled layouts were not asserted to be installed. Required Linux x64 GNU native packages were explicitly present, version-matched, and SWC/Sharp loaded successfully:

| Package | Baseline | Candidate |
| --- | --- | --- |
| `next` / `@next/swc-linux-x64-gnu` | 16.2.10 | 16.4.3 |
| `image-js` | 1.7.0 | 1.7.1 |
| Root `postcss` | 8.4.39 | 8.5.31 |
| `@img/sharp-linux-x64` / Sharp | 0.34.5 | 0.35.5 |
| `@img/sharp-libvips-linux-x64` | 1.2.4 | 1.3.4 |
| Loaded libvips | 8.17.3 | 8.18.7 |

No lockfile repair, dependency upgrade, override, compiler change, cache reuse, or automatic repeat run was needed. **Linux install/test/build validation is cleared for these exact revisions and this environment.** The earlier Windows CSS-worker startup failure did not reproduce here; its Windows-specific cause remains unverified, and this run does not claim to fix it. Amplify adaptation, managed-version support, actual Lambda bundles/Node 20 execution, authenticated QA and the critical Handlebars decision remain pending as described below.

## Hosted configuration observed read-only

The Amplify app was identified by its repository association, not local sandbox outputs. Resource identifiers, environment values unrelated to toolchain selection, signed log URLs, and raw logs are deliberately omitted.

| Item | Evidence / status |
| --- | --- |
| Hosting platform | **passed inspection:** `WEB_COMPUTE`, framework `Next.js - SSR`. |
| Connected branches | Only `main`, labeled `PRODUCTION`, with automatic builds enabled. This operational label does not establish release readiness. |
| Preview controls | Automatic branch creation disabled; automatic branch configuration absent; main PR previews disabled. Review branch is not connected. Rechecked before push. |
| Build specification | App-level specification matches repository `amplify.yml`; main has no overriding build specification. |
| Pipeline | Backend: `npm ci`, then `npx ampx pipeline-deploy`; frontend: `npm run build`; artifact directory `.next`; dependency/build caches enabled. |
| Build image | **unverified:** no `_BUILD_IMAGE` override returned at app or main branch scope. This absence does not identify the actual default image revision, OS, architecture, or digest. |
| Node/npm overrides | No `_LIVE_UPDATES`, `NODE_VERSION`, or `NPM_VERSION` values returned at app/main scope. No `.nvmrc`, `.node-version`, `.npmrc`, `.tool-versions`, root engines/package-manager pin, or version-selection commands were found in the repository. |
| Recent successful job | Latest job observed succeeded at baseline `6d268c7`, with BUILD, DEPLOY, and VERIFY succeeded. Filtered build log explicitly identifies Next.js `16.2.10` and successful backend deployment/build. It did not establish exact Node/npm versions. |
| Deployed SSR runtime | **unverified:** not inferred from Windows Node or backend Lambda source. AWS documents that managed Next compute selects a runtime matching the build Node major, but that build major was not established here. |
| Backend Lambda runtime | Source explicitly sets `runtime: 20` for the processor and the other custom functions. This is distinct from Hosting SSR and is not a fresh inspection of deployed Lambda configuration. |

No hosted settings were changed. Main's prior successful Next 16.2.10 deployment is evidence for that artifact only; it does not validate this 16.4.3 artifact or resolve a documented support gap.

## Official support evidence and inherited risks

Sources checked October 23, 2026:

1. [AWS managed Next.js support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html) still lists versions 12 through 15 for managed SSR. No authoritative managed Hosting support statement for 16.4.3 was established. This gap is **inherited** from main's Next 16.2.10, while the 16.4.3 packaging/runtime change is new and still needs validation.
2. [AWS SSR Node support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html) lists Node 20, 22, and 24 and maps compute runtime major to the build Node major. [Build-image requirements](https://docs.aws.amazon.com/amplify/latest/userguide/custom-build-image.html) describe Linux/glibc x86-64 requirements; they do not prove this app's selected image.
3. [Next 16 upgrade guidance](https://nextjs.org/docs/app/guides/upgrading/version-16) requires Node >=20.9 and TypeScript >=5.1. The installed 16.4.3 manifest confirms the Node floor; TypeScript remains 5.5.3. [The 16.4.3 release](https://github.com/vercel/next.js/releases/tag/v16.4.3) is the exact upstream version reference. Windows Node 24.14.0 meets the engine floor but does not establish Linux or hosted parity.
4. [Amplify JS SSR documentation](https://docs.amplify.aws/javascript/frontend/server-side-rendering/) still states `>=13.5.0 <16.0.0`, but newer maintainer evidence contradicts that library limit: [PR 14639](https://github.com/aws-amplify/amplify-js/pull/14639), merged January 8, 2026, expands adapter peer support to `>=13.5.0 <17.0.0`. The [January maintainer update](https://github.com/aws-amplify/amplify-js/issues/14600#issuecomment-3729880251) confirms the merge and release preparation. This establishes library support work, not a managed Hosting guarantee. No `@aws-amplify/adapter-nextjs` entry exists in this lockfile and no server adapter calls were found. The app configures Amplify in its client helper. No adapter release is installed or being validated; library compatibility and Hosting compatibility remain separate questions.
5. [Next installation guidance](https://nextjs.org/docs/app/getting-started/installation) distinguishes App Router's built-in React canary from Pages Router's package React. This project uses App Router with root React/React DOM 18.3.1. The installed Next manifest accepts `^18.2.0`, but the 16.4.3 build warns React 18 support is deprecated and scheduled for removal in 17. React 18 and the App Router are inherited; this is not permission to migrate React or a substitute for authenticated/browser validation.

`next.config.mjs` remains an empty config, production build remains `next build` (Turbopack), and local Inter loading is preserved. No architecture change, automatic downgrade, or repeat Google Fonts investigation was undertaken.

## Earlier local checks and current pipeline boundaries

Standalone audits in the earlier review confirmed **40 full-tree affected entries: 1 critical, 28 high, 11 moderate** (exit 1), and **0 production-scope entries** with `--omit=dev` (exit 0). Counts include inherited parent findings; zero production findings is not proof of a safe deployed app or credentialed build pipeline.

| Stage/check | Result |
| --- | --- |
| Linux `npm ci`, lockfile reproducibility, installed versions | **passed** for both pinned revisions in the hosted comparison above. |
| Windows installed-version comparison | **passed:** all existing installed packages represented in the lockfile matched their locked versions; not a check that every Linux optional package is present. |
| Linux reconciliation/typecheck/lint/build | **passed** in both hosted jobs; exact commands and exit statuses above. |
| Windows reconciliation rerun | **passed:** 65/65; existing module-type performance warning, no live operations. |
| Windows synthetic JPEG/PNG codec test | **passed:** 4/4 under Node 24.14.0; see coverage below. |
| Windows backend typecheck rerun | **passed:** exit 0. |
| Windows lint rerun | **passed:** exit 0, including the new test. |
| Windows production build rerun | **failed:** exit 1 at Turbopack CSS worker startup (`node process exited before we could connect`, child exit 0). One retry outside AppContainer also exited 1. No source/config workaround, font investigation, or dependency change was made. Root cause is unverified; this result does not establish a dependency regression and does not reproduce the historical pass. |
| Windows loopback page-load checks | **not run:** no successful fresh production artifact from this rerun. |
| Linux loopback signed-out HTTP checks | **passed** for `/` and `/auth/sign-in` in both jobs; no browser JS or authenticated QA. |
| Backend synthesis and Lambda bundling | **not run:** no standalone supported nondeploying `ampx synth` command identified in installed CLI 1.8.3 or the [official CLI reference](https://docs.amplify.aws/react/reference/cli-commands/). Its command registry exposes generation, sandbox, pipeline-deploy, configuration, info and notices. No invented dry-run flag, sandbox, pipeline-deploy, or credentialed CDK substitute was used. |
| Amplify Hosting packaging / SSR adaptation | **requires deployment approval:** not performed for this artifact. A local `.next` build is not this stage. |
| Actual deployment / authenticated release QA | **not run / requires deployment approval**. Manual authenticated QA remains pending. |

Local test processes had AWS/auth/token environment variables removed and AWS credential/config paths redirected to nonexistent files. The codec test imports no AWS SDK and uses no user files, network calls, or publishing paths. The subsequently approved hosted Linux jobs used separate clean checkouts and allowlisted application environments as recorded above.

### Image-processing coverage and Lambda impact

`scripts/public-image-codec-compatibility.test.mjs` selects the handler's named pure codec declarations using TypeScript's parser, then executes only those declarations with codec dependencies. It does not import the Lambda handler or initialize its AWS clients. This avoids copying/reimplementing codec behavior or changing production source. Selection asserts that every expected declaration exists.

The four synthetic tests check JPEG decode/re-encode and lossy color tolerance, PNG transparency flattened to white, resize from 1800x18 to 1600x16, and orientation transforms. The real derivative parser verifies output dimensions, size cap and absence of forbidden JPEG metadata. These tests cover library compatibility, not full authorization, AWS I/O, EXIF fixture coverage, hostile-image security, all formats, or actual Lambda execution. The existing 65 reconciliation tests do not cover image decoding.

The processor imports `image-js` and `jpeg-js` directly. Thus `image-js` 1.7.0 -> 1.7.1 and reachable changed helpers can alter its bundled code and asset hash without any function-source/schema/IAM diff. Changed image-related helpers include `colord`, `cheminfo-types`, `ml-spectra-processing`, and `follow-redirects`; actual tree-shaken bundle inclusion was not measured. `jpeg-js` and the direct AWS SDK versions are unchanged. Next/SWC/Sharp/PostCSS changes affect frontend/build output; `@swc/helpers` is required by Next in the reviewed lockfile. Linux x64 GNU optional-package installation/loading passed in both jobs. Bundle size, Node 20 execution, and real Amplify asset generation remain pending. Backend typechecking proves none of those deployment properties.

## Remaining critical Handlebars finding

Fresh audit and `npm explain handlebars --json` identify one installed vulnerable copy, `node_modules/handlebars@4.7.7`. It is a **normally resolved dependency**, not marked `inBundle`; `@aws-amplify/graphql-docs-generator@4.2.1` pins it exactly to `4.7.7`. The package contains its own distributed compiler files, which should not be confused with npm bundled dependencies.

| Critical advisory | Affected range | First patched version | Relevant trigger |
| --- | --- | --- | --- |
| [GHSA-2w6w-674q-4c4q / CVE-2026-33937](https://github.com/advisories/GHSA-2w6w-674q-4c4q) | >=4.0.0 <=4.7.8 | 4.7.9 | Untrusted pre-parsed AST passed to compile. |
| [GHSA-8r5x-fm3f-whwj / CVE-2026-106446](https://github.com/advisories/GHSA-8r5x-fm3f-whwj) | >=4.0.0 <=4.7.9 | 4.7.10 | Untrusted AST object passed to compile/precompile; bypass of earlier validation. |
| [GHSA-p8wg-vrv2-v86f / CVE-2026-106445](https://github.com/advisories/GHSA-p8wg-vrv2-v86f) | >=3.0.0 <=4.7.9 | 4.7.10 | Attacker-controlled template with permissive prototype-method access. |

The aggregate audit range for Handlebars extends through 4.7.9; 4.7.9 is not sufficient for the newer critical advisories. A maintained release >=4.7.10 must be assessed against the then-current full advisory set. Other lower-severity Handlebars advisories also remain; the single critical package count is not a single advisory.

Complete installed ancestor paths (every path ends in docs generator 4.2.1 -> Handlebars 4.7.7):

```text
backend-cli@1.8.3 -> form-generator@1.2.7 -> graphql-docs-generator@4.2.1 -> handlebars@4.7.7
backend@1.23.0 -> backend-data@1.7.0 -> graphql-generator@0.5.3 -> graphql-docs-generator@4.2.1 -> handlebars@4.7.7
backend-cli@1.8.3 -> model-generator@1.2.3 -> graphql-generator@0.5.3 -> graphql-docs-generator@4.2.1 -> handlebars@4.7.7
backend@1.23.0 -> client-config@1.10.2 -> model-generator@1.2.3 -> graphql-generator@0.5.3 -> graphql-docs-generator@4.2.1 -> handlebars@4.7.7
backend-cli@1.8.3 -> client-config@1.10.2 -> model-generator@1.2.3 -> graphql-generator@0.5.3 -> graphql-docs-generator@4.2.1 -> handlebars@4.7.7
backend-cli@1.8.3 -> sandbox@2.2.1 -> client-config@1.10.2 -> model-generator@1.2.3 -> graphql-generator@0.5.3 -> graphql-docs-generator@4.2.1 -> handlebars@4.7.7
```

All names except `handlebars` above carry the `@aws-amplify/` scope. Responsible direct dependencies are backend and backend-cli; their devDependency classification does not remove credentialed pipeline exposure.

Read-only registry checks found current backend 1.25.1, CLI 1.10.0, graphql-generator 0.5.4, docs-generator 4.2.2, form-generator 1.2.8, and model-generator 1.2.5. The latest graphql-generator pins docs-generator 4.2.2; that docs-generator still pins Handlebars 4.7.9. Form/model generation also reaches these packages. **No supported parent release fixing this chain was established.** Merely upgrading to the latest parent or root Handlebars would not demonstrate resolution of every pinned nested copy. None was installed.

Installed docs-generator source calls `handlebars.compile` with fixed template strings from `lib/generator/utils/templates.js`, and options `noEscape` and `preventIndent`. The inspected calls do not pass external AST objects or enable `allowProtoMethodsByDefault`; schema-derived operations are template data. This is evidence against the listed prerequisites in that inspected path, not proof of non-exploitability across the entire generation/deployment toolchain. Dynamic invocation in hosted deployment, other consumers/global registrations, and trust in schema/build inputs have not been exhaustively established. No exploit or untrusted template was executed.

Supported next action: track/request an upstream Amplify docs-generator release using a patched Handlebars and a corresponding supported parent chain; validate that as a separate batch with generation, Linux bundling and approved isolated deployment. Do not use npm's downgrade proposal, a root dependency, or a forced override to manipulate audit counts. Until remediated or explicitly reviewed by the owner, do not treat privileged deployment execution or public release as approved.

## Merge versus release blockers

- **Merge:** the Linux reproducibility/test/build requirement is now satisfied for the exact compared revisions. Hosted pipeline requirements remain unmet. The Windows CSS-worker failure is still an unresolved local diagnostic, but did not reproduce in either Linux job; no Linux candidate regression was found. Main has automatic deployment enabled, so merging remains coupled to privileged deployment and is not approved by this validation.
- **Inherited issues:** Next 16 managed Hosting support gaps and conflicting library documentation, React 18, unpinned hosted toolchain, Node 20 function targets, and the Handlebars chain already existed on main. They must not be misreported as newly introduced vulnerabilities. The inherited critical finding alone is not evidence that the improvement batch must be reverted; it still requires an owner decision before privileged tooling/release execution.
- **Release:** managed 16.4.3 adaptation, exact deployed SSR/runtime behavior, actual backend bundles, image/auth boundary QA and manual authenticated release tests remain unvalidated. A zero production audit and successful local build cannot waive these checks. No risk acceptance is made on the owner's behalf.

## Concrete nonproduction validation proposal — requires approval

The credential-free Linux checks have now passed. Separately request approval for one temporary, isolated Amplify Gen 2 validation environment for the exact approved candidate commit. Prefer a dedicated nonproduction account/app and a manually connected validation branch, with automatic branch creation and PR previews disabled. First obtain AWS support clarification for managed Next 16 or explicitly review the continuing support gap; no hosting migration is proposed here.

Expected changes are a new app/branch and isolated backend stacks (Cognito, AppSync/DynamoDB, private S3, function/IAM/log resources), plus Hosting compute/build artifacts. Generate genuine outputs for that isolated backend; never silently reuse live outputs for a writable preview. Use synthetic data and separate disposable QA identities. Keep the cleanup gate exactly false and do not invoke cleanup or moderation mutations in this validation. Installation/tests must run without deployment credentials; a separately approved restricted deployment stage necessarily needs scoped permissions, so credential separation and the Handlebars decision must be reviewed before execution.

Collect image/Node/npm versions, synth/asset differences, backend deployment outcome, managed SSR packaging and signed-out/authenticated image/privacy QA for that exact commit. Potential costs include Amplify build/hosting/compute, CloudWatch logs, Lambda, storage and data services; set an owner-approved budget/time limit before provisioning. Rollback is to stop the isolated environment and, with approval, remove its disposable resources and retained objects/logs; never revert or delete the live app's backend/data. Record retained-resource costs. No such environment was created or deployment performed here.

## Earlier local completion checks (historical)

Local toolchain was Windows Node 24.14.0 / npm 11.9.0. The 65 reconciliation tests, four codec tests, backend typecheck and lint exited 0. The earlier Windows production build exited 1 in both attempts. The later GitHub-hosted Linux passes are recorded above; no Amplify stage is marked passed. `git diff --check` and `git diff --cached --check` passed before commit.

`package.json` and `package-lock.json` remain identical to implementation commit `f6fe22a`; no local installation or dependency fix command ran in the earlier review. The later Linux jobs ran only the approved clean installs, without changing either file. Observed file SHA-256 values are `B686FE09CA70F686FC66933CDF9A55EF7C5C8B54C0DD53383B137CE048F3367B` and `3F12EC5D463A8B1B2ABA54F1AB182FD1361649681641467B1B90A2A2BADE583D`, respectively (checkout line endings can affect hashes on Linux).

Validation changes are restricted to this document, the audit-report update, and the codec test. No raw diagnostics, resource identity, credentials, generated output, package changes, or deployment workflow is included. Commit/push identity is reported in the task completion message. Main, AWS resources, source cleanup gates, schema/auth rules, permissions, user data, and account lifecycle behavior were not changed.

## Linux follow-up completion boundary

This follow-up changes only the branch-only workflow, its dedicated driver, and this results document. The workflow commit was pushed to `codex/release-dependency-remediation-1`; the documentation-only follow-up uses the same branch and does not match the workflow path filter. No PR was created. Automatic Amplify branch creation and PR previews were checked disabled, and the review branch remained unconnected before the workflow push. No AWS deployment/resources/permissions, cleanup gate, application/dependency version, or main commit was changed. No WSL, Docker, CodeBuild, EC2, larger runner, or self-hosted runner was provisioned. No residual Handlebars risk was accepted and no privileged Amplify tooling was executed.
