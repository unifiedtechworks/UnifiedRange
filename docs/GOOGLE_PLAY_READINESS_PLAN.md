# UnifiedRange Google Play Readiness Plan

Planning baseline and policy review: September 5, 2026. Planning only; no Android app or Play submission is produced. Recheck official requirements and the actual Play Console account immediately before packaging and submission.

## Release decision

UnifiedRange is a deployed Next.js/AWS Amplify web app. It is not currently a native Android app or a verified Play release candidate. Recommend a PWA MVP, followed by a TWA if Play distribution is needed and the gates below pass. [Mobile App Readiness Plan](MOBILE_APP_READINESS_PLAN.md) compares PWA, TWA, Capacitor, and Expo/React Native and defines auth/upload/device acceptance tests.

PWA installation alone supplies no Play package. TWA, Capacitor, and Expo all need an Android release package and the same applicable store disclosures/content policies. Framework choice cannot resolve account deletion, moderation, or misleading claims.

## Known blockers and unverified prerequisites

| Area | Evidence / current gap | Required release evidence |
| --- | --- | --- |
| Account deletion | `/settings/account` is a disabled placeholder; [deletion plan](ACCOUNT_DELETION_PLAN.md) is not implementation | In-app initiation, functional public web request route, verified dependent-data cleanup, published retention and completion timing. |
| Public UGC | [Moderation policy](MODERATION_POLICY.md) records report status only; user blocking and effective enforcement are not established | Terms acceptance, reporting of users/content, user blocking, actionable moderation, and operational response coverage. |
| Privacy disclosures | Privacy settings are not a public privacy policy; no policy page established by source review | Accessible policy URL, accurate inventory of deployed processing/SDKs, and reviewed Data safety responses. |
| Android distribution | No package/signing/release workflow | Final signed AAB and successful tests through Play delivery. |
| Auth and uploads | Browser implementations exist; mobile release behavior untested | Companion device matrix, account recovery, lifecycle and interrupted-upload evidence. |
| Console/account/assets | Developer account type, verification, domain ownership, listing assets, and reviewer access not inspected | Release owner completes applicable Console prerequisites and records evidence without secrets in docs. |

These are production-release gates. Internal testing can help establish evidence, but does not waive content or privacy responsibilities.

## App package and publisher requirements

- Establish the publisher's verified Play Console account, correct personal/organization identity, required contact information, and any applicable device/developer verification. Organization verification may require business documentation; determine exact requirements in Console. Do not assume eligibility or production access from the web deployment.
- Select a stable unique application ID under a controlled naming authority. Decide supported countries, device types, minimum OS, version name, and monotonically increasing version code. Keep the application ID stable across updates.
- Produce a release Android App Bundle, enroll in Play App Signing, protect/back up the upload key outside the repository, and document authorized release/recovery ownership. Play generates installation APKs from the bundle. See [Android App Bundles](https://developer.android.com/guide/app-bundle).
- For new phone apps and updates, the current requirement is Android 16/API 36 or higher from August 31, 2026. Do not use the older API 35 rule or assume an extension applies to a new app. Set minimum OS separately and verify dependencies against the selected SDK. See [target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).
- Audit all packaged native libraries for supported ABIs and 16 KB page-size compatibility. Pure Java/Kotlin paths and packages with native plugins have different verification needs; Expo/React Native and added SDKs require particular attention. See [16 KB page-size guidance](https://developer.android.com/guide/practices/page-sizes).
- Audit the merged release manifest and SDK inventory for unexpected media, camera, microphone, location, advertising ID, or background permissions. Foreground occasional uploads should use a system picker rather than broad photo access. See [minimum-scope permission alternatives](https://support.google.com/googleplay/android-developer/answer/16935362?hl=en).
- TWA additionally needs verified Digital Asset Links with the Play app-signing certificate and stable production origin. Capacitor needs a viable bundled web build and reviewed native bridge; Expo needs a native client. See the companion plan for path-specific gates.

## Privacy policy and account lifecycle

Publish a stable, publicly accessible, non-geofenced HTML privacy policy, linked in the app and Console, naming UnifiedRange and the responsible publisher with a working privacy contact. Explain collected data, purposes, recipients/service providers, security practices, retention, deletion, and user choices. Make it readable without signing in; a settings screen or inaccessible document is insufficient. See [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).

UnifiedRange-specific policy work must cover private equipment/practice records, profile identifiers and optional location fields, private photo originals and their metadata, deliberate public snapshots/images/comments, safety reports, authentication, and operational logs. Distinguish private storage from public publication and explain that public material may be copied by others. Do not claim end-to-end encryption, no collection, universal metadata removal, or immediate deletion without evidence.

Because the app supports account creation, provide an identifiable in-app deletion path and an external web resource for account/data deletion requests. Uninstalling or deactivating an account is not deletion. A request mechanism needs real fulfillment and associated-data handling. See [account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

Use the existing [account lifecycle](ACCOUNT_DATA_LIFECYCLE_PLAN.md) and [deletion](ACCOUNT_DELETION_PLAN.md) plans as design inputs. Resolve cancellation/completion periods, retries, backups, logs, public derivatives, profile snapshots, comments, reports, and username retention before claiming readiness. Deleting Cognito alone leaves dependent data behind. Explain legitimate retained data and its duration; verify cleanup and public-link expiry before reporting success. Do not copy proposed retention choices into a policy as if implemented. Export remains a separate proposed feature, not a substitute for deletion.

## Draft Data safety inventory

This table is an audit worksheet, not a completed Console declaration. Sending private data to AWS is collection even when other users cannot see it. Inventory the web experience delivered through the Android app and all SDK/server recipients, not just wrapper-native code. Google distinguishes collection, sharing, required/optional provision, purposes, and eligible exceptions. Validate each answer against actual behavior and current form definitions. See [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

| Existing data / candidate Play category | Candidate purpose | Evidence needed before submitting |
| --- | --- | --- |
| Email, Cognito identity, username, display/legal names: Personal info, including email/name/user IDs | Account management and app functionality | Trace auth/profile payloads and distinguish required account fields from optional fields; consider signed-out access when answering required/optional. |
| City/state and any geographic data in notes/images: approximate/precise location as applicable | Optional profile or user-content functionality | Audit actual collection, EXIF GPS, inferred location in services/logs, and use. No GPS permission does not prove no location collection. |
| Private originals and public derivatives: Photos | App functionality | Confirm upload/storage/processor paths, metadata treatment, public consent, recipients, and deletion. |
| Equipment, session, maintenance, readiness notes, bios and comments: Other user-generated content; review other categories where definitions apply | App functionality | Inspect all fields and free-text handling. Do not classify sporting records as health data merely because they describe practice. |
| Reactions, publishing/reporting events: App interactions and/or other user-generated content, subject to form definitions | Functionality and safety/fraud prevention | Confirm what is stored, linked to identity, retained, and visible to moderators. |
| Logs, crash reports, performance, device identifiers: Diagnostics/device or other IDs if actually collected | Operations/security; analytics only if actually used | Audit Amplify hosting, backend logging, browser/native SDKs, network traffic, and retention. Package dependencies alone do not establish absence of telemetry. |

For each row record collected/shared status, precise purpose, optionality, retention, and evidence owner. AWS acting solely as a service provider may qualify for a sharing exception; user-directed public sharing may also have specific exceptions. Apply these only after reviewing the actual terms and flow, and still explain public visibility in the privacy policy. Confirm encryption in transit across all endpoints. Do not declare deletion support until requests work. Re-audit every SDK or web feature change; a hosted update can change the Android app's disclosures without changing its AAB.

## Policy-sensitive content and app copy

Google prohibits facilitating sales of firearms, ammunition, explosives, and certain firearm accessories, and restricts related dangerous instructions. A sporting logbook is not automatically prohibited, but discovery/comments can introduce prohibited content. Review links, public notes, images, and user behavior, not just the listing. See [Dangerous Products / Inappropriate Content](https://support.google.com/googleplay/android-developer/answer/9878810?hl=en).

Follow the project's stricter [safety boundaries](SAFETY_AND_COMPLIANCE_BOUNDARIES.md): historical user-entered records, practice logs, equipment passports, and hunting checklists; no firing solutions, aiming corrections, manufacturing instructions, tactical guidance, or firearm/ammunition marketplace. These product boundaries should not be represented as a verbatim statement of every Play rule.

Proposed listing copy, subject to verification against the release:

> UnifiedRange organizes equipment records, range sessions, target photos, maintenance notes, and hunting preparation checklists. Records are private by default, with optional sharing of selected setup information. An account and internet connection are required for private logging.

Proposed short description: **Log range sessions, equipment, target photos, and hunting preparation.**

Use accurate terms such as "practice history" and "user-entered score." Avoid "aim here," "dial this," "kill shot," "tactical solution," or promises of improved hit probability. Do not advertise offline support, automatic visual redaction, safety certification, complete anonymity, or live deletion until those claims are true. Sporting use must be described plainly rather than concealed through vague copy.

Public UGC requires accepted terms before contribution, prohibited-content rules, reporting users/content, blocking users, and effective ongoing moderation. Current status-only reports are insufficient evidence. Cover public profiles, comments, snapshots, and images; define escalation and removal/suspension authority. See [UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en). A future private-only release could reduce UGC scope only if public/community access is actually removed from all reachable app routes; hiding a menu or changing listing text does not do so.

Complete the content-rating questionnaire honestly for firearms imagery, hunting, and UGC. Select an intended audience and evaluate applicable age/child-safety rules; an adult audience is a proposed MVP choice, not an existing age gate or a guaranteed rating. If social categorization or future monetization applies, review the additional relevant policies before launch. No payment implementation is proposed here.

## Listing screenshots and assets

Prepare the following only after an Android candidate exists. Validate final formats and dimensions against [Play preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en) and Console, including any requirements for added device types.

| Asset | Planned deliverable |
| --- | --- |
| Store icon | 512 x 512 PNG, 32-bit with alpha, no more than 1024 KB; distinct from adaptive Android launcher assets. |
| Feature graphic | 1024 x 500 JPEG or 24-bit PNG without alpha. |
| Phone screenshots | At least two; plan four to six genuine captures from the release candidate. Use JPEG or 24-bit PNG without alpha; 320-3840 pixels per dimension, longest dimension at most twice the shortest. |
| Screenshot story | Private passport, session history, target-photo workflow, maintenance/readiness, privacy controls, and optional public preview only if release-ready. |
| Listing metadata | App name, short/full descriptions, category, support email, policy/deletion URLs, audience/rating declarations, and localized copy for supported markets. |
| Package assets | Adaptive launcher icon, splash/theme behavior, and TWA/PWA icons as applicable; test cropping and dark/light backgrounds. |

Use synthetic demonstration records and images with permission. Exclude real account details, serial numbers, exact locations, signed URLs, sensitive documents, and graphic harm. Do not mock unimplemented capabilities or imply Google endorsement. Produce tablet assets and test layouts if tablets are included; video is optional for this proposed phone MVP.

## Testing tracks and reviewer access

1. **Local/device qualification:** execute the companion auth/upload/accessibility matrix; inspect release permissions and link handling. Record OS/browser, package version, deployed web revision, and failures.
2. **Internal testing:** deliver the signed build through Play to a small QA group. Check signing-dependent TWA validation, cold/warm links, updates, uninstall/reinstall, expired sessions, network failure, backend outage, and public/private boundaries. Review pre-launch reports where available.
3. **Closed testing:** use representative users, gather task-based feedback, resolve failures, and retain results. Personal developer accounts created after November 13, 2023 currently need at least 12 opted-in testers continuously for 14 days before applying for production access. Account type is unverified; apply the actual Console requirements. Meeting the count/duration does not guarantee approval. See [testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
4. **Open testing, if eligible and useful:** broaden coverage after production access and policy readiness; it is not a substitute for a required closed test. Verify the Data safety form and other applicable declarations before a non-internal track.
5. **Production:** submit only with blockers resolved and a support/release owner assigned. Use a controlled launch where Console supports it, then monitor crashes, auth/upload failures, moderation, and deletion fulfillment. Plan staged subsequent updates where available.

Supply reviewers with a working, confirmed test account and precise App access instructions in Console, including gated flows and any verification steps. Store credentials securely, never in this plan. Use synthetic records; avoid requiring access to a personal mailbox, private network, or unavailable subscription. Reviewer access must persist during review and expose the real release behavior. Do not bypass ownership controls for reviewers.

## Play risk register and final gate

| Risk | Priority | Mitigation / go-no-go evidence |
| --- | --- | --- |
| Missing account deletion or inaccurate privacy claims | Blocker | Functional deletion requests/fulfillment and policy/Data safety reconciliation. |
| Public prohibited content with ineffective moderation | Blocker | Reporting, blocking, enforcement, accepted terms, and staffed response proven across reachable UGC. |
| Restricted sales/instructions introduced through links or UGC | High | Content rules and enforcement; inspect examples and all listing assets. |
| Broken or low-utility wrapper | High | Demonstrate useful logging workflows and reliable mobile behavior. Website ownership alone does not establish quality. |
| Permissions or SDK declarations exceed actual needs | High | Minimum-scope picker and release-manifest/network audit. |
| TWA verification/auth/upload failures | High | Test the Play-signed candidate on supported devices and browser providers. |
| Hosted updates change reviewed behavior | High | Release checks tied to both web revision and AAB; review policy/disclosure impact before each web deployment. |
| Misleading screenshots, ratings, or app access | High | Real captures, honest questionnaire, functioning reviewer account. |

Web-based apps are not categorically banned, but unauthorized webviews, affiliate spam, poor functionality, and misleading experiences remain risks. See [Play Spam policy](https://support.google.com/googleplay/android-developer/answer/9899034?hl=en). Native features should serve a product need, not be added as a supposed approval guarantee.

The release owner should approve only after engineering/QA, privacy, and moderation owners provide the evidence above. Maintain a rollback plan for hosted releases and a corrective Android release process; do not assume an older Android version code can overwrite a published update. Continue policy monitoring after launch.

This planning task runs `npm run amplify:typecheck`, `npm run lint`, `npm run build`, and `git diff --check`. Passing them establishes repository checks only. No Android build, device test, Console verification, legal-policy signoff, or Google Play acceptance is implied.
