# UnifiedRange Release Process

Use this lightweight checklist for a hosted dev/staging release. Use the [Manual QA Checklist](MANUAL_QA_CHECKLIST.md) for detailed test steps and the [Amplify Hosting Deployment guide](AMPLIFY_HOSTING_DEPLOYMENT.md) for deployment commands and environment setup. This process does not establish production readiness.

## Release record

- Release name/date and release owner:
- Target environment (safe label), branch and frontend commit:
- Backend version and last known good frontend/backend versions:
- Scope, affected routes and linked PRs/issues:
- Backend deploy required: **yes / no / unknown**; reason and affected resources:
- QA tester/date, browser/device/viewport and account roles used:
- Overall result: Pass / Pass with accepted known issues / Fail / Blocked
- Rollback owner and recovery plan:

Use synthetic test data, separate owner/non-owner accounts and route placeholders. Keep credentials, tokens, signed URLs, private storage keys, account IDs, private records and personal information out of release records, logs and screenshots. Record sanitized operation names/status codes instead of raw network dumps.

## Before deployment

- [ ] Review scope and complete the PR template, including expected/actual behavior and reproduction steps for fixes.
- [ ] Confirm the target branch, backend environment and `amplify_outputs.json` agree without copying environment identifiers into reports.
- [ ] Resolve backend deployment needs: schema, authorization, storage, function/resolver, IAM or backend dependency changes require backend review and deployment. Frontend-only changes may depend on backend capabilities already deployed. Docs/template-only changes require no backend deployment.
- [ ] Record backend dependencies and deployment order. The current hosting pipeline runs backend deployment before the frontend build, even when no backend change is needed. Follow the deployment guide; local checks do not deploy resources.
- [ ] Record the last known good versions and a recovery plan compatible with stored data and the backend. Do not assume reverting the frontend reverses backend/data changes.
- [ ] Run the following against the release candidate and record Pass / Fail with sanitized failure details:

```bash
npm run amplify:typecheck
npm run lint
npm run build
git diff --check
```

- [ ] Resolve failed checks before release. For docs/template-only PRs, runtime manual QA may be N/A with a reason; still record the command results above.
- [ ] Deploy only when explicitly requested, following the deployment guide. Verify the deployed commit and backend deployment outcome before hosted QA.

## Hosted QA

Record Pass / Fail / Blocked / Not tested / N/A for each applicable check. Explain every N/A; blocked or untested checks are not passes. Use the detailed Manual QA guide for each affected workflow and run this smoke pass for a runtime release.

- [ ] **Visitor:** directly open and refresh `/`, `/discover`, `/discover/passports/[publicPassportId]` and `/u/[username]`; verify safe missing/private states and clearly labeled demo content.
- [ ] **New user and owner:** test sign-in, required profile setup, dashboard, privacy settings, sign-out and refresh. Verify changed saved-data workflows persist.
- [ ] **Owner and second standard user:** exercise affected private CRUD/image workflows; verify the second account and visitor cannot read or mutate owner data through direct routes or backend requests.
- [ ] **Public/private boundary:** inspect both UI and network responses. Public snapshots exclude private notes, original images/keys, target photos, purchase/lot details, exact locations, maintenance/readiness records and private identity fields.
- [ ] **Publishing/images:** verify sanitized preview and text-only publishing, plus applicable consent, derivative delivery and removal flows. Only eligible processed covers render on saved public detail; Discover/profile cards remain image-free. Test text-only unpublish after removing any prepared derivative.
- [ ] **Moderator and admin:** test each role for report review/status changes; verify standard users cannot access the queue or update reports. Review does not expose private owner records or mutate reported content.
- [ ] **Regression coverage:** test affected social actions, navigation, empty/error states and desktop/mobile layouts; record console/network errors and redacted screenshots.
- [ ] File findings with reproduction steps, expected/actual results, role, route, severity, boundary results and backend deploy needs. Retest fixes against the deployed candidate and record the result.

## Severity and release gates

| Severity | Meaning | Release decision |
| --- | --- | --- |
| S1 critical | Private data exposure, authorization bypass, data loss, or widespread outage | Block release; contain and verify the fix before proceeding. |
| S2 high | Core workflow fails with no reasonable workaround | Block release until fixed and retested. |
| S3 medium | Limited functional defect with a usable workaround | Release owner may accept with a linked issue, workaround and follow-up owner. |
| S4 low | Cosmetic or minor usability defect | Track with an owner; may be accepted for release. |

Suspected privacy/authorization failures block release regardless of initial severity until investigated and resolved. Unknown backend deployment requirements and blocked or untested required boundary checks also block release.

Use **Bug report** for reproducible defects, **Privacy boundary issue** for access/disclosure concerns, and **QA finding** for failed or blocked checklist checks. Link related reports instead of duplicating evidence. For suspected live exposure, use GitHub private vulnerability reporting if enabled or an established private maintainer channel; keep public reports limited to safe synthetic details.

## Sign-off and recovery

- [ ] Release owner records the go/no-go decision, command results, hosted QA evidence and accepted S3/S4 issues with follow-up owners.
- [ ] Confirm no open S1/S2 issues, unresolved boundary failures or required untested checks remain.
- [ ] After deployment, repeat the visitor/auth/affected-route smoke checks and inspect console/network failures.
- [ ] If a blocking regression appears, stop promotion and have the release owner coordinate containment or recovery using the recorded compatible versions. Re-run affected QA and boundary checks after recovery.
- [ ] Record the final deployed versions, outcome and remaining follow-ups in the release record.
