# Dependency audit triage

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
