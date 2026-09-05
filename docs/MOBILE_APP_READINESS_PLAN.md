# UnifiedRange Mobile App Readiness Plan

Planning baseline: September 5, 2026. Documentation only; no wrapper, native project, runtime change, schema change, or deployment is authorized by this plan.

## Recommendation

Use a mobile web/PWA MVP first. If Google Play distribution becomes a requirement, evaluate a Trusted Web Activity (TWA) over the same production site after the release gates in [Google Play Readiness Plan](GOOGLE_PLAY_READINESS_PLAN.md) pass. A PWA alone is not a Play submission package. Neither installation nor a wrapper establishes Play policy compliance.

This recommendation favors the existing Next.js/AWS Amplify investment and current foreground logging workflows. Choose Capacitor only when validated native requirements justify its integration work. Choose Expo/React Native when a dedicated native experience, substantial offline work, or broader native capabilities justify rebuilding the interface. These are project judgments, not guarantees of store acceptance or delivery estimates.

## Current evidence and gaps

- The deployed product is a Next.js web app, per the project baseline. `package.json` contains web and Amplify commands, with no Android packaging workflow. `next.config.mjs` uses the default configuration; static export compatibility is not established. No application manifest or service-worker implementation was found in the source inventory. Mobile installability and device behavior remain unverified.
- `amplify/auth/resource.ts` enables email authentication. `src/components/AuthForm.tsx` implements email/password sign-up, email-code confirmation, and sign-in through Amplify. A public username is not a replacement login method. `src/hooks/useAuthUser.ts` uses browser lifecycle APIs and Cognito session state; it cannot move unchanged into React Native.
- `src/lib/privateImageStorage.ts` and `src/components/PrivateImageUploadCard.tsx` use browser `File` input and Amplify uploads. JPEG, PNG, and WebP are accepted up to 8 MiB; HEIC is not accepted. Files require a saved source record. Private URLs expire after one hour.
- Private originals are stored unchanged, including embedded metadata. Public equipment-cover derivatives use a separate consent/verification/processing flow; target photos are excluded. Owner removal exists for the current public derivative, but broader account cleanup is incomplete. See [image lifecycle plan](PUBLIC_IMAGE_PHASE_2F_LIFECYCLE_CLEANUP_PLAN.md).
- Account export and deletion are placeholders. Moderation reports support workflow status changes, not content removal or account suspension. These gaps are independent of the mobile framework.

Repository evidence is not a production audit. Before implementation, reconcile the deployed revision, configured services, and actual mobile behavior without placing credentials or infrastructure identifiers in these documents.

## Path comparison

| Path | Delivery and package | Reuse and effort | Auth and image behavior | Main limits / decision trigger |
| --- | --- | --- | --- | --- |
| PWA | HTTPS site with web app manifest and install assets; browser installation, no developer-built AAB | Highest reuse; lowest relative effort | Existing origin-based Amplify auth and file picker; browser governs permissions and background suspension | Best MVP. Installation varies by browser/platform; offline writes and reliable background uploads require separate design. |
| Trusted Web Activity | Android shell displaying the owned site through a supporting browser; signed AAB for Play and Digital Asset Links | High web reuse; adds Android signing, link verification, store operations | Uses the browser's web session context; verify shared-session behavior on target providers. Browser handles file selection; shell cannot assume direct access to web cookies/storage | Preferred first Play candidate if core workflows work well on mobile. Depends on site availability, browser support, and verified origins. |
| Capacitor | Android WebView plus optional native plugins; packaged web assets and signed AAB | High potential UI reuse, but material build/auth/plugin integration | WebView session storage is separate from normal Chrome. Native picker results need conversion into an uploadable payload compatible with existing validation | Consider for a concrete camera/share/native feature need. Next.js server behavior does not run inside the package; static/client build feasibility must be audited. |
| Expo/React Native | Native Android app, built locally or with EAS; signed AAB | Largest effort: rebuild DOM/Tailwind/Next navigation UI; reuse suitable types, validation, backend contracts | Configure Amplify for native runtime, storage, and lifecycle. Picker returns native assets/URIs rather than browser `File` objects | Consider when native UX/offline requirements dominate. Separate client maintenance and end-to-end parity testing are substantial. |

Technical basis: [PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Android TWA overview](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities), [Capacitor configuration](https://capacitorjs.com/docs/config), and [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/).

## Package preparation, if separately approved

### PWA

Plan a stable HTTPS origin, manifest identity, name/short name, start URL, scope, standalone display, theme/background colors, and ordinary/maskable icons (including 192 and 512 pixel variants). Validate actual install behavior on Android Chrome and iOS Safari. A service worker is not universally required for installation, but an intentional offline/error experience is an MVP readiness gate here. Initially cache only a reviewed public shell; exclude authenticated responses, tokens, private images, signed URLs, and user records. Do not advertise offline logging until durable storage, ownership separation, conflict handling, and synchronization have been designed and tested.

### TWA

Plan a stable application ID, Android build toolchain, launcher/splash assets, versioning, upload-key custody, Play App Signing, and release AAB. Host `/.well-known/assetlinks.json` on the canonical site and associate it with the final package and Play app-signing certificate. Debug/upload certificates do not substitute for the certificate used on installed Play builds. Verify each owned origin needing fullscreen behavior; unverified external origins may display browser UI. Amplify rewrites must not turn the association file into an HTML fallback. Test installed Play-track builds, browser fallback, Android Back, deep links, and domain changes. See [TWA integration](https://developer.chrome.com/docs/android/trusted-web-activity/integration-guide).

### Capacitor / Expo

Both require Android package identity, version codes, signing, SDK/permission review, release builds, and ongoing native dependency updates. For Capacitor, inventory Next.js dynamic routes, server rendering, and API assumptions before proposing bundled assets. Its remote `server.url` option is documented for live reload, not production; pointing it at Amplify is not the default production plan. For Expo, plan a separate client using the existing backend contracts, not an automatic Next.js conversion. Review native SDK compatibility, ABI support, and 16 KB page-size requirements as described in the companion plan.

## Authentication acceptance plan

Retain existing Cognito identities and owner authorization. Do not create a second account system or change schema as part of packaging. For every candidate, verify:

1. Sign-up, email-code confirmation after switching to the mail app, sign-in, profile completion, and username-conflict handling.
2. Session refresh after idle/background, process termination, relaunch, expired credentials, offline launch, sign-out, and switching between two test accounts. A stale private screen must not expose another account's records.
3. Password-manager/autofill behavior, keyboard layout, accessible error messages, and a usable recovery path. Password reset is not implemented in the inspected auth form and must be resolved before release.
4. Links opened from mail or public setup shares: cold launch, warm launch, signed out, and signed in. Resume only validated internal destinations after auth.
5. WebView/native token persistence and sign-out clearing. Choose and test an appropriate native storage adapter; installation does not automatically make stored tokens secure. Never put tokens in links or logs.

The current form is not federated OAuth. If federated sign-in is later introduced, use an appropriate external browser authorization flow, PKCE, registered redirect/logout URLs, and validated app links. Do not assume embedded provider login or shared Chrome cookies. Expo requires a development/release build to validate native OAuth redirects; see [Expo authentication guidance](https://docs.expo.dev/guides/authentication/).

## Image-upload acceptance plan

Preserve private-first storage and the separate public-consent boundary across all paths. Start with user-selected foreground uploads and request no broad photo-library, location, microphone, or background permissions without an approved feature need. A native system picker is preferable to broad media access; test the resulting release manifest, not just source configuration.

| Scenario | Required outcome before mobile release |
| --- | --- |
| Gallery, cloud-backed picker, camera where offered | Selected bytes reach the existing authenticated upload/verification workflow. Camera availability is tested, not promised from a file input. Native URI access survives long enough to read the file. |
| Cancel, denied access, unsupported HEIC, corrupt file, oversized image | Clear recoverable message; no false saved/uploaded state. HEIC conversion is a future decision, not current support. Validate decoded content server-side as well as client type/size. |
| Rotation/orientation and large photos | Preview/rendering is correct and memory use acceptable. Compression or format conversion, if proposed later, must preserve readability and enforce limits after conversion. |
| Network loss, backgrounding, process death, retry | No claim of background completion or offline queueing. Reconcile uploaded objects and failed metadata saves; avoid duplicate records and identify orphan cleanup needs. |
| Session expiry, account switch, expired image URL | Fail safely; refresh authorization as appropriate; never expose another owner's file or retain private previews after sign-out. |
| Public cover selection/removal | Explicit consent; only verified eligible covers; metadata-stripped derivative; target photos remain private; verify removal and bounded existing-link expiry. |

Metadata stripping does not redact visible serial numbers, faces, documents, or locations in image pixels. Do not describe public processing as automatic visual anonymization. Private originals can contain GPS metadata; this affects privacy disclosures even without requesting device location permission.

## Mobile quality and privacy gates

Test real small and large Android phones, a lower-memory device, the selected minimum Android version, and the current target version. Add iOS Safari for the PWA path. Check keyboard overlap, touch targets, zoom/large text, TalkBack, contrast, portrait/landscape, safe areas, Android Back, long forms, and upload progress. Test weak connectivity and unavailable backend states with no misleading success indicators.

Privacy policy, data inventory, deletion, public UGC controls, review access, screenshots, and store copy are specified in [Google Play Readiness Plan](GOOGLE_PLAY_READINESS_PLAN.md). These obligations cover web functionality reachable through a wrapper. PWA distribution also needs accurate privacy/retention communication even without a Play Data safety form.

## Proposed sequence and decision gates

| Stage | Proposed owner | Reviewable exit evidence |
| --- | --- | --- |
| 1. Product decision | Product owner | Confirm online-first MVP, target devices, whether Play is needed, stable domain, audience, and public-community scope. |
| 2. Web readiness | Web engineering / QA | Device matrix results for auth, logging, images, accessibility, and install/offline behavior; no critical failures. Future implementation requires a separate task. |
| 3. Trust and lifecycle | Product / backend / moderation | Published accurate privacy policy, working account deletion request/fulfillment, effective UGC reporting/blocking/enforcement, and approved retention decisions. |
| 4. Packaging decision | Mobile engineering | If Play is required, approve TWA proof of concept only after stages 1-3. Reconsider Capacitor if browser capability tests fail on a required native feature. |
| 5. Store candidate | Release owner / QA | Companion checklist complete; signed-track device evidence, finalized disclosures/assets, and release/rollback ownership. |

No native build, wrapper dependency, manifest, service worker, auth setting, schema, or store entry is created by this document. The repository verification commands are `npm run amplify:typecheck`, `npm run lint`, `npm run build`, and `git diff --check`; these validate the web repository, not Android or Play acceptance.
