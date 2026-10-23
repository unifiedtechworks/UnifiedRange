# Dependency remediation pass 1 validation

Date: October 23, 2026. **Disposition: blocked for merge under the existing pre-merge requirements; ready for review of the evidence and next validation proposal.** No residual risk is accepted here.

## Reviewed source and scope

- Repository: `UnifiedRange`; branch: `codex/release-dependency-remediation-1`.
- Exact implementation reviewed: `f6fe22a9b879f8c7080e5e8359676f46c9d553a9`.
- Fetched `origin/main`: `6d268c77b8d694385bd21128bae044ff1feffbb0`.
- At review start, HEAD was exactly the implementation commit, with a clean working tree and no unexpected later commits. The implementation changes only `package.json`, `package-lock.json`, `next-env.d.ts`, and the audit report.
- This validation adds documentation and an offline codec test only. No dependency upgrade, override, application change, infrastructure change, merge, or deployment is included.

## Linux environment: blocked

There is no approved Linux execution environment available in this session:

- `wsl --list --verbose` reports that Windows Subsystem for Linux is not installed.
- `docker` is not installed/discoverable on PATH; no Docker engine was available to query.
- Read-only GitHub API inspection found no configured Actions workflows and zero repository self-hosted runners. Hosted runner availability alone is not an existing authorized validation workflow. None was provisioned or started.

Consequently, no clean Linux checkout, install, tests, production build, loopback smoke test, or Linux `git diff --check` was performed. There is no Linux `uname`, Node, or npm output to report. Windows results below must not be relabeled Linux results.

Smallest next setup: approve access to one existing Linux x86-64/glibc host or installation of WSL/Docker locally. It needs Git, Node/npm, registry access, and disk for an isolated checkout; it needs no AWS credentials, authentication tokens, deployed resources, or new runner. First establish the actual hosted image and Node/npm versions and match them where practical. If unavailable, use an explicitly recorded Node 22/24 Linux baseline and retain the parity gap. The reconciliation script uses `--experimental-strip-types`, so an arbitrary Node 20 test runner is insufficient even though the processor Lambda targets Node 20.

Use a clean checkout of the exact implementation SHA, with the additional codec test copied from this validation commit and identified separately. Do not copy Windows `node_modules`, `.next`, `.env*`, `.aws`, or local sandbox state. Use the committed nonsecret `amplify_outputs.json` only for compilation; do not fabricate outputs, authenticate, or write to the referenced environment. Do not pass deployment credentials or user tokens. Run serially, stop/report each failed command, and record every exit status:

```bash
uname -a
node --version
npm --version
sha256sum package.json package-lock.json
npm ci
npm run test:public-image-reconciliation
node --test scripts/public-image-codec-compatibility.test.mjs
npm run amplify:typecheck
npm run lint
npm run build
git diff --check
sha256sum package.json package-lock.json
git diff --exit-code -- package.json package-lock.json
```

Compare installed package versions to lockfile entries, including platform-specific Next/SWC/Sharp packages. Then start the built app on loopback and check signed-out page loads without live sign-in or mutations. A second codec check on the processor's actual Node 20 Lambda-compatible environment is useful; neither result alone validates a deployed function.

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

## Checks performed and pipeline boundaries

Fresh standalone audits reconfirm **40 full-tree affected entries: 1 critical, 28 high, 11 moderate** (exit 1), and **0 production-scope entries** with `--omit=dev` (exit 0). Counts include inherited parent findings; zero production findings is not proof of a safe deployed app or credentialed build pipeline.

| Stage/check | Result |
| --- | --- |
| Linux `npm ci`, lockfile reproducibility, installed versions | **blocked:** no Linux environment. Prior Windows install pass is historical evidence only; no new install was run in this validation. |
| Windows installed-version comparison | **passed:** all existing installed packages represented in the lockfile matched their locked versions; not a check that every Linux optional package is present. |
| Linux reconciliation/typecheck/lint/build | **not run (blocked)**. |
| Windows reconciliation rerun | **passed:** 65/65; existing module-type performance warning, no live operations. |
| Windows synthetic JPEG/PNG codec test | **passed:** 4/4 under Node 24.14.0; see coverage below. |
| Windows backend typecheck rerun | **passed:** exit 0. |
| Windows lint rerun | **passed:** exit 0, including the new test. |
| Windows production build rerun | **failed:** exit 1 at Turbopack CSS worker startup (`node process exited before we could connect`, child exit 0). One retry outside AppContainer also exited 1. No source/config workaround, font investigation, or dependency change was made. Root cause is unverified; this result does not establish a dependency regression and does not reproduce the historical pass. |
| Windows loopback page-load checks | **not run:** no successful fresh production artifact from this rerun. |
| Linux local signed-out HTTP checks | **not run (blocked)**. |
| Backend synthesis and Lambda bundling | **not run:** no standalone supported nondeploying `ampx synth` command identified in installed CLI 1.8.3 or the [official CLI reference](https://docs.amplify.aws/react/reference/cli-commands/). Its command registry exposes generation, sandbox, pipeline-deploy, configuration, info and notices. No invented dry-run flag, sandbox, pipeline-deploy, or credentialed CDK substitute was used. |
| Amplify Hosting packaging / SSR adaptation | **requires deployment approval:** not performed for this artifact. A local `.next` build is not this stage. |
| Actual deployment / authenticated release QA | **not run / requires deployment approval**. Manual authenticated QA remains pending. |

Local test processes had AWS/auth/token environment variables removed and AWS credential/config paths redirected to nonexistent files. The codec test imports no AWS SDK and uses no user files, network calls, or publishing paths. No credentials were supplied to a Linux environment (none was created).

### Image-processing coverage and Lambda impact

`scripts/public-image-codec-compatibility.test.mjs` selects the handler's named pure codec declarations using TypeScript's parser, then executes only those declarations with codec dependencies. It does not import the Lambda handler or initialize its AWS clients. This avoids copying/reimplementing codec behavior or changing production source. Selection asserts that every expected declaration exists.

The four synthetic tests check JPEG decode/re-encode and lossy color tolerance, PNG transparency flattened to white, resize from 1800x18 to 1600x16, and orientation transforms. The real derivative parser verifies output dimensions, size cap and absence of forbidden JPEG metadata. These tests cover library compatibility, not full authorization, AWS I/O, EXIF fixture coverage, hostile-image security, all formats, or actual Lambda execution. The existing 65 reconciliation tests do not cover image decoding.

The processor imports `image-js` and `jpeg-js` directly. Thus `image-js` 1.7.0 -> 1.7.1 and reachable changed helpers can alter its bundled code and asset hash without any function-source/schema/IAM diff. Changed image-related helpers include `colord`, `cheminfo-types`, `ml-spectra-processing`, and `follow-redirects`; actual tree-shaken bundle inclusion was not measured. `jpeg-js` and the direct AWS SDK versions are unchanged. Next/SWC/Sharp/PostCSS changes affect frontend/build output; `@swc/helpers` is required by Next in the reviewed lockfile. Linux native optional-package resolution, bundle size, Node 20 execution, and real Amplify asset generation remain pending. Backend typechecking proves none of those deployment properties.

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

- **Merge:** Linux reproducibility and hosted pipeline validation required by the existing audit report are still unmet, and the supplemental Windows production build failed as recorded above. No dependency regression was established, but the failing rerun cannot be waived. Main has automatic deployment enabled, so merging this batch is operationally coupled to privileged deployment. Merge remains blocked under those requirements.
- **Inherited issues:** Next 16 managed Hosting support gaps and conflicting library documentation, React 18, unpinned hosted toolchain, Node 20 function targets, and the Handlebars chain already existed on main. They must not be misreported as newly introduced vulnerabilities. The inherited critical finding alone is not evidence that the improvement batch must be reverted; it still requires an owner decision before privileged tooling/release execution.
- **Release:** managed 16.4.3 adaptation, exact deployed SSR/runtime behavior, actual backend bundles, image/auth boundary QA and manual authenticated release tests remain unvalidated. A zero production audit and successful local build cannot waive these checks. No risk acceptance is made on the owner's behalf.

## Concrete nonproduction validation proposal — requires approval

After credential-free Linux checks pass, request approval for one temporary, isolated Amplify Gen 2 validation environment for the exact approved candidate commit. Prefer a dedicated nonproduction account/app and a manually connected validation branch, with automatic branch creation and PR previews disabled. First obtain AWS support clarification for managed Next 16 or explicitly review the continuing support gap; no hosting migration is proposed here.

Expected changes are a new app/branch and isolated backend stacks (Cognito, AppSync/DynamoDB, private S3, function/IAM/log resources), plus Hosting compute/build artifacts. Generate genuine outputs for that isolated backend; never silently reuse live outputs for a writable preview. Use synthetic data and separate disposable QA identities. Keep the cleanup gate exactly false and do not invoke cleanup or moderation mutations in this validation. Installation/tests must run without deployment credentials; a separately approved restricted deployment stage necessarily needs scoped permissions, so credential separation and the Handlebars decision must be reviewed before execution.

Collect image/Node/npm versions, synth/asset differences, backend deployment outcome, managed SSR packaging and signed-out/authenticated image/privacy QA for that exact commit. Potential costs include Amplify build/hosting/compute, CloudWatch logs, Lambda, storage and data services; set an owner-approved budget/time limit before provisioning. Rollback is to stop the isolated environment and, with approval, remove its disposable resources and retained objects/logs; never revert or delete the live app's backend/data. Record retained-resource costs. No such environment was created or deployment performed here.

## Completion checks

Local toolchain was Windows Node 24.14.0 / npm 11.9.0. The 65 reconciliation tests, four codec tests, backend typecheck and lint exited 0. Production build exited 1 in both attempts; no Linux or hosted stage is marked passed. `git diff --check` and `git diff --cached --check` passed before commit.

`package.json` and `package-lock.json` remain identical to implementation commit `f6fe22a`; no installation or dependency fix command ran in this validation. Observed file SHA-256 values are `B686FE09CA70F686FC66933CDF9A55EF7C5C8B54C0DD53383B137CE048F3367B` and `3F12EC5D463A8B1B2ABA54F1AB182FD1361649681641467B1B90A2A2BADE583D`, respectively (checkout line endings can affect hashes on Linux).

Validation changes are restricted to this document, the audit-report update, and the codec test. No raw diagnostics, resource identity, credentials, generated output, package changes, or deployment workflow is included. Commit/push identity is reported in the task completion message. Main, AWS resources, source cleanup gates, schema/auth rules, permissions, user data, and account lifecycle behavior were not changed.
