# UnifiedRange Manual QA Checklist

Last updated: August 9, 2026

Use this checklist for a complete hosted-development release review. It starts from the current MVP, including Phase 2A owner-only `PrivateImageAsset` candidate registration, Phase 2B trusted private source verification, and the Phase 2C backend-only derivative foundation. It does not assume that public image publishing UI/delivery, account deletion/export, username sign-in, notifications, or destructive moderation actions exist.

## Test session record

Record the environment before testing:

- Hosted URL:
- Frontend branch/commit:
- Amplify backend environment:
- Browser and version:
- Desktop operating system:
- Mobile devices or emulated viewport sizes:
- Tester:
- Date:
- Overall result: Pass / Pass with known issues / Fail / Blocked

Use `Pass`, `Fail`, `Blocked`, or `Not tested` for each section. Capture the route, account role, time, visible error, console error, and network request ID for failures. Do not put passwords, tokens, private S3 keys, signed URLs, private images, legal names, exact locations, or other private record data in screenshots or bug reports.

## Test accounts and data

Prepare separate accounts so authorization boundaries can be tested:

- **Visitor:** signed-out browser or private/incognito window.
- **User A — new:** standard Cognito account that has not completed profile setup.
- **User B — established:** standard account with a valid username reservation and saved test records.
- **Conflict account:** legacy/dev account whose `UserProfile.username` is reserved by another account. Use only if the fixture is intentionally available.
- **Original username owner:** account that legitimately owns the conflicting reservation.
- **Moderator:** Cognito account in the `moderator` group.
- **Admin:** Cognito account in the `admin` group.
- **Backend inspector:** optional developer with authorized sandbox or Amplify data access for private-registry verification. This is not a public or moderator role.

Use synthetic test data and non-sensitive test images. Do not use real serial numbers, legal documents, faces of bystanders, license plates, exact private locations, live ammunition lot data, purchase records, or personal account information.

Before beginning:

- [ ] Confirm the intended frontend is connected to the intended Amplify backend.
- [ ] Confirm the Phase 2B verifier and Phase 2C processor schema, functions, index, IAM grants, and Storage paths have been deployed before testing those backend operations.
- [ ] Confirm User A, User B, moderator, and admin use separate Cognito accounts.
- [ ] Confirm at least one sanitized Public Passport is available for signed-out testing.
- [ ] Confirm at least one test report is available, or plan to create one during social testing.
- [ ] Open browser developer tools with Console and Network recording enabled.

## 1. Hosted app load

### Account type

Visitor first, then User B.

### Steps

- [ ] Open `/` in a fresh signed-out/incognito session.
- [ ] Confirm the landing page loads without a blank screen, redirect loop, or missing styles.
- [ ] Confirm the landing page explains the private range logbook, Equipment Passports, Hunting Readiness, sanitized setup discovery, and privacy-first sharing.
- [ ] Open `/discover`, a known `/discover/passports/[publicPassportId]`, and a known `/u/[username]` directly in the address bar.
- [ ] Refresh each public route and confirm direct navigation still works.
- [ ] Open an invalid route and confirm the application shows a usable not-found state.
- [ ] Sign in as User B, return to `/`, and confirm the page provides a clear route to Dashboard rather than presenting the signed-out call to action as the primary next step.
- [ ] Hard-refresh `/dashboard` and one private detail route.

### Expected results

- [ ] Pages render with the expected UnifiedRange navigation, typography, and styling.
- [ ] Public routes work without authentication; private routes preserve or re-establish authenticated state after refresh.
- [ ] Broken routes fail safely without leaking framework, backend, or identity details.
- [ ] User-facing copy feels product-like and contains no stale “mock-only,” “future-wired,” internal deployment, or developer instruction language.

### Privacy and safety checks

- [ ] The signed-out landing page contains no account-specific counts, usernames, records, or private image requests.
- [ ] Public pages describe documentation and discovery without calculators, aiming adjustments, scope outputs, holds, field corrections, or sight-in instructions.

## 2. Auth, sign-in, and sign-out

### Account type

User A, User B, and Visitor.

### Steps

- [ ] Open `/auth/sign-in` signed out.
- [ ] Create User A with an email/password test credential and complete the Cognito confirmation flow.
- [ ] Confirm successful authentication sends the new account into required profile setup before private workflows.
- [ ] Sign out, then sign in as User B using the current email/password flow.
- [ ] Refresh the page and open a second tab to confirm the session persists.
- [ ] Submit an invalid password and confirm the form recovers cleanly.
- [ ] Confirm an immutable app username is not presented as a currently supported Cognito login credential.
- [ ] Sign out from a private route, use browser Back, and refresh.
- [ ] Attempt to open `/dashboard`, `/profile`, `/settings`, and a saved private detail route while signed out.

### Expected results

- [ ] Sign-up, confirmation, sign-in, session persistence, and sign-out work without loops.
- [ ] Invalid credentials produce a useful error without breaking the form.
- [ ] Signed-out visits to private routes show the intended sign-in state or safe public/demo fallback.
- [ ] Signing out clears private navigation and private page content in all open tabs after refresh.
- [ ] Login remains email/password; username sign-in is clearly not implemented.

### Privacy and safety checks

- [ ] Passwords, confirmation codes, Cognito tokens, and full internal identifiers never appear in the UI, URL, console, or screenshots.
- [ ] Authentication errors do not reveal another account’s private profile or records.
- [ ] Signing out does not leave private content visible from a stale rendered page after refresh.

## 3. Profile setup, username reservation, and username repair

### Account type

User A, User B, Conflict account, and Original username owner.

### Steps

- [ ] As User A, attempt to open a private workflow before completing `/profile/setup`.
- [ ] Enter invalid usernames and confirm format/length validation appears.
- [ ] Enter mixed-case input and confirm the username is normalized to lowercase.
- [ ] Attempt to reserve User B’s existing username and confirm it is rejected.
- [ ] Reserve an available username and complete profile setup.
- [ ] Refresh `/profile` and confirm the profile and username persist.
- [ ] Open `/profile/edit` and confirm the username is read-only while permitted profile fields can be saved.
- [ ] Sign in as User B and confirm an existing reservation owned by one of the current Cognito identity aliases does not block profile loading.
- [ ] If a conflict fixture exists, sign in as the Conflict account and confirm the diagnostic panel reports manual ownership review without exposing private identity data.
- [ ] Confirm **Choose a different username** appears only for the true conflict state and opens `/profile/username-repair`.
- [ ] Attempt the existing reserved username and another duplicate; confirm both are blocked.
- [ ] Choose an available replacement and confirm the Conflict account returns to a working `/profile`.
- [ ] Sign in as the Original username owner and confirm its username reservation is unchanged.
- [ ] Attempt to open `/profile/username-repair` as a normal non-conflicted account.

### Expected results

- [ ] Profile setup is required once and succeeds only after valid username ownership is established.
- [ ] Normal users cannot change usernames after setup.
- [ ] Alias-compatible existing reservations are accepted without a false conflict.
- [ ] A genuine conflicting legacy account can reserve a different available username without overwriting or deleting the original reservation.
- [ ] The repair route is unavailable or non-actionable outside a verified conflict state.

### Privacy and safety checks

- [ ] Conflict diagnostics show only normalized username, shortened technical identifiers, reservation presence, and profile presence to the signed-in owner.
- [ ] Diagnostics never show email, first/last name, location, private activity, images, or another user’s profile fields.
- [ ] No flow overwrites or automatically deletes another account’s `UsernameReservation`.

## 4. Settings, privacy, and account lifecycle placeholders

### Account type

User B and Visitor.

### Steps

- [ ] Open `/settings` and confirm the privacy and account destinations are clear.
- [ ] Open `/settings/privacy`, record the current values, change each supported setting, save, refresh, and confirm persistence.
- [ ] Verify account visibility and default passport visibility controls use privacy-first language.
- [ ] Verify the public-preview requirement and sanitization preferences describe what they protect.
- [ ] Change account visibility to private and later validate its effect on `/u/[username]`.
- [ ] Restore the intended test visibility before public-profile testing.
- [ ] Open `/settings/account`.
- [ ] Confirm export and account-deletion controls are disabled or labeled unavailable/coming soon.
- [ ] Inspect Network while interacting with the placeholders and confirm no export, deletion, Cognito removal, or record mutation request occurs.
- [ ] Sign out and attempt to revisit the settings routes.

### Expected results

- [ ] Saved privacy settings persist after refresh and a new sign-in session.
- [ ] Account lifecycle controls accurately describe plans without claiming that export or deletion currently runs.
- [ ] No destructive operation is available from the account page.
- [ ] Signed-out users cannot read private settings.

### Privacy and safety checks

- [ ] Settings pages do not expose email or profile fields on public routes.
- [ ] Privacy copy states that private records and photos remain private and sanitized snapshot publishing is optional.
- [ ] Changing settings does not silently publish a private record or image.

## 5. Dashboard and onboarding checklist

### Account type

User A after setup, User B, and Visitor.

### Steps

- [ ] Open `/dashboard` as a newly configured User A.
- [ ] Confirm saved-account counts and onboarding progress reflect User A rather than demo or User B data.
- [ ] Confirm the checklist includes profile setup, privacy review, Equipment Passport, Projectile / Ammo, Optic / Sight, Range Session, private photo, Hunting Readiness, optional public snapshot, and Discover.
- [ ] Follow each incomplete action link and confirm it opens the correct route.
- [ ] Create test records during later sections and return to Dashboard after each one.
- [ ] Confirm derived items update when the first relevant saved record exists.
- [ ] Upload a qualifying private photo and confirm the photo milestone updates.
- [ ] Publish a sanitized snapshot and confirm the optional publishing milestone updates.
- [ ] Open Discover and confirm it remains a link-only step rather than claiming tracked completion.
- [ ] When the checklist is mostly complete, confirm it can collapse and be expanded again.
- [ ] Open `/profile` and confirm the checklist appears there if intended by the current UI.
- [ ] Sign out and revisit `/` and `/dashboard`.

### Expected results

- [ ] Progress is derived from existing profile/setting/record/image/snapshot data without a separate onboarding record.
- [ ] Counts update after data refresh and do not require duplicate completion buttons.
- [ ] Publishing is labeled optional and the overall tone is helpful rather than blocking.
- [ ] Signed-out visitors never see an account checklist or User B’s progress.

### Privacy and safety checks

- [ ] Checklist rows reveal only completion state and safe counts, not private record names, notes, image keys, or locations.
- [ ] Checklist copy states that records are private by default, public sharing uses sanitized snapshots, publishing is optional, and private photos are not public.

## 6. Equipment Passport CRUD

### Account type

User B, a second standard account, and Visitor.

### Steps

- [ ] Open `/passports` and note the saved/demo labeling.
- [ ] Create a synthetic Equipment Passport at `/passports/new` with representative optional fields, private notes, public notes, and tags.
- [ ] Confirm required-field validation and correct validation recovery.
- [ ] Save, open `/passports/[passportId]`, and refresh.
- [ ] Edit at `/passports/[passportId]/edit`, change several safe fields, save, and refresh.
- [ ] Confirm the username/private profile workflow is not mixed into the passport editor.
- [ ] Open Public Preview but do not publish until the public-sharing section.
- [ ] Sign in as the second account and attempt to discover or directly open the first account’s private passport ID.
- [ ] Delete a disposable test passport using the supported UI, confirm the prompt if present, and verify it no longer appears.
- [ ] Sign out and confirm only clearly labeled demo/public content remains available.

### Expected results

- [ ] Create, detail, edit, refresh, and delete behavior is consistent.
- [ ] Saved records remain scoped to their owner.
- [ ] Back links and create/edit/detail actions return to expected routes.
- [ ] Demo records are clearly distinguished from backend-saved records.

### Privacy and safety checks

- [ ] Private notes, private photo keys, purchase details, serial-like test values, and owner IDs are absent from signed-out/public responses.
- [ ] A second account cannot read or mutate the first account’s private passport.
- [ ] Creating a passport does not publish it; public sharing requires Public Preview and a separate action.

## 7. Projectiles / Ammo CRUD

### Account type

User B, a second standard account, and Visitor.

### Steps

- [ ] Open `/projectiles` and create a synthetic record using `/projectiles/new`.
- [ ] Exercise required fields, optional fields, and validation errors.
- [ ] Save, open the detail page, and refresh.
- [ ] Edit several values and confirm persistence.
- [ ] Use the record later when creating a linked Range Session.
- [ ] Delete a disposable record and confirm it is removed.
- [ ] Test direct access with the second account and signed-out browser.

### Expected results

- [ ] CRUD behavior and saved/demo labeling match Equipment Passports.
- [ ] The saved projectile/ammo record appears in the signed-in owner’s Range Session selector.
- [ ] Other users cannot read or mutate it.

### Privacy and safety checks

- [ ] Lot numbers, purchase information, inventory details, private notes, and owner IDs are never shown publicly.
- [ ] Public setup summaries contain only explicitly sanitized projectile/ammo summary text.

## 8. Optics / Sights CRUD

### Account type

User B, a second standard account, and Visitor.

### Steps

- [ ] Open `/optics` and create a synthetic record using `/optics/new`.
- [ ] Test required-field validation and optional fields.
- [ ] Save, open the detail page, refresh, edit, and confirm persistence.
- [ ] Use the record later when creating a linked Range Session.
- [ ] Delete a disposable record and verify removal.
- [ ] Test direct access with the second account and signed-out browser.

### Expected results

- [ ] CRUD behavior, navigation, validation, and saved/demo labels are consistent with other record areas.
- [ ] The saved optic/sight appears only in its owner’s applicable selectors.
- [ ] Other users cannot read or mutate it.

### Privacy and safety checks

- [ ] Public output is limited to a sanitized optic/sight summary where explicitly published.
- [ ] No page produces aiming corrections, scope outputs, holds, sight-in instructions, or adjustment recommendations.

## 9. Range Sessions linked-record CRUD

### Account type

User B with saved passport/projectile/optic records, a second standard account, and Visitor.

### Steps

- [ ] Open `/sessions` and create a session at `/sessions/new`.
- [ ] Confirm selectors contain User B’s saved Equipment Passports, Projectile / Ammo records, and Optics / Sights only.
- [ ] Create a session linked to all three record types.
- [ ] Exercise required-field and numeric validation without entering sensitive exact locations.
- [ ] Save, open `/sessions/[sessionId]`, and refresh.
- [ ] Confirm linked-record labels resolve correctly.
- [ ] Edit the session and change one linked record and several session fields.
- [ ] Delete a disposable session and verify removal.
- [ ] Sign in as the second account and attempt direct access to User B’s session ID.
- [ ] Sign out and verify saved session data is not shown as public activity.

### Expected results

- [ ] Linked records save and rehydrate correctly on detail/edit pages.
- [ ] Selectors never mix records from different owners.
- [ ] CRUD and back-navigation behavior are consistent.
- [ ] Demo sessions remain clearly labeled when shown.

### Privacy and safety checks

- [ ] Weather notes, free-text notes, target photo references, exact locations, and private owner IDs remain private.
- [ ] No session view calculates or recommends aim, holds, corrections, or equipment adjustments.

## 10. Maintenance CRUD

### Account type

User B with a saved Equipment Passport, a second standard account, and Visitor.

### Steps

- [ ] Open `/maintenance` and create an entry at `/maintenance/new` linked to User B’s passport.
- [ ] Test required-field validation and representative optional fields.
- [ ] Save, open the detail page, and refresh.
- [ ] Edit the maintenance entry and confirm persistence.
- [ ] Confirm the linked passport label remains correct.
- [ ] Delete a disposable entry and verify removal.
- [ ] Attempt direct access as the second account and while signed out.

### Expected results

- [ ] Maintenance create, detail, edit, refresh, and delete flows work consistently.
- [ ] Equipment selectors and records remain owner-scoped.
- [ ] Signed-out/demo states are clearly labeled and do not expose saved maintenance activity.

### Privacy and safety checks

- [ ] Maintenance notes, parts information, private notes, counts, and linked private IDs are never copied into public profiles or snapshots.
- [ ] Public Passport pages do not reveal that maintenance records exist.

## 11. Hunting Readiness CRUD

### Account type

User B with a saved Equipment Passport, a second standard account, and Visitor.

### Steps

- [ ] Open `/readiness` and create a checklist at `/readiness/new` linked to User B’s passport.
- [ ] Save with a mixture of complete and incomplete items.
- [ ] Open the detail page, refresh, and verify item state.
- [ ] Edit labels/notes and completion states supported by the UI.
- [ ] Confirm the Dashboard onboarding milestone updates after the first saved checklist.
- [ ] Delete a disposable checklist and verify removal.
- [ ] Attempt direct access as the second account and while signed out.

### Expected results

- [ ] Checklist state and linked equipment persist correctly.
- [ ] CRUD, empty states, and saved/demo labeling match other private record areas.
- [ ] Readiness records remain owner-scoped.

### Privacy and safety checks

- [ ] Readiness items, tags/licenses, trip preparation, notes, and linked private IDs never appear on public pages.
- [ ] Readiness copy remains organizational and does not provide aiming or equipment-adjustment instructions.

## 12. Private image uploads, registration, and trusted source verification

### Account type

User B, a second standard account, Visitor, and optionally Backend inspector.

### Steps

- [ ] Confirm the Phase 2B backend is deployed before starting this section.
- [ ] Open a saved Equipment Passport and upload a synthetic JPG, PNG, or WEBP image under 8 MB.
- [ ] Confirm progress, private-success copy, and the private source registration notice.
- [ ] Confirm the private-only panel shows an unverified state and **Verify private image** action without displaying a storage key or identity value.
- [ ] Request verification and confirm the status moves through verifying to verified.
- [ ] Refresh and confirm the private equipment image still displays on the owner-only page.
- [ ] Replace the equipment image and confirm the new image displays.
- [ ] Open a saved Range Session and repeat the upload, verification, and replacement flow for a private target photo.
- [ ] Attempt an unsupported file type and a file larger than 8 MB; confirm both are rejected before association.
- [ ] Confirm demo/sample records do not offer a working private source registration path.
- [ ] If authorized backend inspection is available, inspect User B’s `PrivateImageAsset` rows.
- [ ] Confirm equipment rows use `equipment_cover` and the Equipment Passport ID; target rows use `range_session_target` and the Range Session ID.
- [ ] Confirm the stored filename is generated/sanitized rather than the original local filename.
- [ ] Confirm content type and byte size match the uploaded test file.
- [ ] Confirm a successful verification stores `bindingStatus=verified`, clears any prior bounded failure code, and sets `verifiedAt`.
- [ ] If a pre-Phase-2B candidate is available, confirm verification fails closed with safe re-upload guidance because its identity bridge fields are missing.
- [ ] In an isolated sandbox, delete or move a disposable test object after registration and confirm verification returns a safe failed state without exposing its key.
- [ ] In an isolated sandbox or automated fixture, exercise mismatched size/type/path cases and confirm bounded failed states. Do not corrupt production records.
- [ ] Confirm replacement uploads create immutable private candidate history rather than modifying a verified/audit record.
- [ ] As the second account, attempt to list/read User B’s candidate data through an authenticated client if a safe QA harness exists.
- [ ] If a safe integration harness exists, attempt to verify User B’s candidate id as the second account and confirm it cannot be marked verified.
- [ ] As Visitor/API-key, confirm `PrivateImageAsset` cannot be read.
- [ ] As Visitor or an unauthenticated Identity Pool session, confirm the verification mutation is unavailable or returns unauthorized.
- [ ] Sign out and attempt to reload the prior signed private image URL after expiration or from a separate signed-out session.
- [ ] Follow [Phase 2C Processor Manual Testing](PHASE_2C_PROCESSOR_TESTING.md) with a disposable public-account fixture and verified JPEG or PNG `equipment_cover`; run `npm run test:public-image-processor` with a short-lived matching ID token, the two opaque IDs, optional safe alt text, and the exact confirmation phrase.
- [ ] Confirm the script fails before making a request when the token, either ID, or explicit confirmation is missing; when the token is expired/wrong-pool, an ID is demo/sample-shaped, or `amplify_outputs.json` is not a trusted configured AppSync endpoint; and when alt text is empty-after-normalization or over 200 characters.
- [ ] Confirm a successful invocation returns only an opaque public asset id and `ready` status; inspect the owner-only ledger/snapshot and confirm they reference a backend-generated JPEG key under the processor-only cover namespace.
- [ ] Confirm the derivative decodes, is no larger than 1600 pixels on its long edge or 2 MB, and contains no EXIF/GPS, ICC/application metadata, Photoshop/application metadata, JPEG comments, original filename, private key, or owner identifier.
- [ ] Exercise private-account, wrong-owner, unverified, target-photo, WebP, missing-object, source-mismatch, malformed, animated PNG, oversized-byte, and oversized-pixel fixtures; confirm bounded failure codes and no snapshot projection/object creation. Use isolated synthetic fixtures only.
- [ ] Exercise two controlled concurrent requests against the same prior projection. Confirm only the valid state transition wins, stale failure bookkeeping does not overwrite a newer attempt, and an unsuccessful newly written object is rolled back.
- [ ] Confirm the normal app has no control or network request that invokes `processPublicPassportImage`.

### Expected results

- [ ] Existing private upload and display behavior still works.
- [ ] Successful uploads associate with the correct saved owner record and create an owner-only candidate.
- [ ] Same-owner verification succeeds only after candidate owner, protected user-pool `sub`, trusted Identity Pool identity, saved source, exact path, S3 object, MIME type, and byte size agree.
- [ ] Missing, mismatched, legacy, demo/sample, wrong-owner, wrong-folder, invalid-type, and oversized inputs fail closed with bounded messages.
- [ ] A registration failure, if deliberately simulated in a sandbox, leaves the saved image private and shows that registration is pending; it does not publish anything.
- [ ] Other owners, moderators acting only through their group role, API-key clients, and visitors cannot read private registry rows.
- [ ] Verification does not download image bytes to the UI, copy the object, create a public workflow record, or populate a public snapshot image field.
- [ ] A valid direct Phase 2C backend test may create a derivative and guarded projection, but the object remains processor-only and no app/public page can resolve or render it.

### Privacy and safety checks

- [ ] UI copy distinguishes verified private source binding from public eligibility and never claims that verification publishes or sanitizes the image.
- [ ] Private keys, signed URLs, original filenames, Identity Pool IDs, and image contents are not displayed on public pages or copied into public records.
- [ ] The processor-only derivative prefix, copy, and metadata-free re-encode exist only behind the Phase 2C backend action. No client selection control, public delivery/read authorization, public URL, or rendering exists.
- [ ] Target photos are never automatically selected or published.

## 13. Public Passport publishing and unpublishing

### Account type

User B and Visitor.

### Steps

- [ ] Open a saved passport at `/passports/[passportId]/public-preview`.
- [ ] Confirm the preview distinguishes included public-safe fields from excluded private fields.
- [ ] Confirm an existing private setup photo is described as private and not included.
- [ ] Publish the sanitized snapshot.
- [ ] Open the resulting Discover detail route signed in and signed out.
- [ ] Edit safe source fields, return to Public Preview, update the snapshot, and confirm the public page changes only after the explicit update.
- [ ] Inspect the normal Public Preview request and confirm it omits all image projection fields. They remain empty unless the optional direct Phase 2C integration fixture has deliberately populated the backend-managed fields.
- [ ] Unpublish the snapshot and confirm it disappears from Discover, its prior public detail route becomes unavailable, and the private Equipment Passport remains intact.
- [ ] Republish only if needed for later checklist sections.

### Expected results

- [ ] Publishing creates a sanitized text/setup snapshot, not a live read of the private passport.
- [ ] Updating and unpublishing behave consistently after refresh and in a signed-out session.
- [ ] Unpublishing does not delete or modify the private source record or private image.
- [ ] No public image controls or rendering appear.

### Privacy and safety checks

- [ ] Public snapshots exclude private notes, private image keys/URLs, target photos, image metadata, lot numbers, purchase details, exact locations, maintenance/readiness data, and private profile fields.
- [ ] Normal Public Preview publishing never treats `PrivateImageAsset` candidates as eligible images or invokes the processor.
- [ ] Public setup content remains documentation-only and provides no aiming or adjustment guidance.

## 14. Public profiles

### Account type

User B with a public profile and published snapshot, User A/private-profile fixture, and Visitor.

### Steps

- [ ] Open `/u/[username]` for User B while signed in and signed out.
- [ ] Confirm normalized username lookup works regardless of mixed-case URL input if supported.
- [ ] Confirm `@username`, safe display name, safe public bio, public status, setup count, and published snapshots display as intended.
- [ ] Follow a published setup from the public profile and return.
- [ ] Open a nonexistent username and confirm a safe not-found state.
- [ ] Set the test profile to private using owner settings, refresh `/u/[username]` signed out, and confirm the private-account state.
- [ ] Restore visibility if later tests require the public profile.
- [ ] Confirm `/profile` remains the signed-in private hub and is not confused with `/u/[username]`.

### Expected results

- [ ] Public lookup uses the sanitized public snapshot rather than broad `UserProfile` reads.
- [ ] Public/private account states and no-public-setup empty states are clear.
- [ ] Published setup count matches visible sanitized snapshots.
- [ ] Raw Cognito owner IDs are replaced with `UnifiedRange user` when safe identity resolution is unavailable.

### Privacy and safety checks

- [ ] Public profiles do not show email, first name, last name, city/state, private settings, private records, activity, image keys, or private photos.
- [ ] Private-account display does not leak display name, bio, setup titles, counts, or internal owner identity beyond the intended safe state.

## 15. Discover search and filters

### Account type

Visitor and User B.

### Steps

- [ ] Open `/discover` with multiple published test snapshots available.
- [ ] Search by a supported public title/manufacturer/model/username term.
- [ ] Exercise each available filter individually and in combination.
- [ ] Clear filters and confirm the complete public result set returns.
- [ ] Enter a term with no matches and verify the empty state.
- [ ] Open a result, use Back, and confirm the list remains usable.
- [ ] Repeat signed out and signed in.
- [ ] Unpublish one test snapshot, reload Discover, and confirm it is gone.

### Expected results

- [ ] Search/filter results are deterministic, clearable, and limited to published sanitized snapshots.
- [ ] Cards link safely to public setup and public owner pages when a username is available.
- [ ] Missing identity resolution uses `UnifiedRange user`, never a raw Cognito identifier.
- [ ] Empty, loading, and error states remain usable.

### Privacy and safety checks

- [ ] Search does not query or reveal private `UserProfile`, private records, private notes, image keys, target photos, exact locations, or unpublished passports.
- [ ] Discover contains no public images until the complete public-image backend and consent release ships.

## 16. Reactions, comments, and reports

### Account type

User B, a second standard account, and Visitor.

### Steps

- [ ] Open a published public passport as Visitor and confirm reactions/comments display according to current public-read rules.
- [ ] Attempt each write action signed out and confirm a sign-in prompt appears.
- [ ] Sign in as User B and add/remove or change a reaction; refresh and confirm the count/state.
- [ ] Add a synthetic, non-sensitive comment and refresh.
- [ ] Confirm the comment author links to `/u/[username]` when a safe public username is available.
- [ ] Test an author without a resolvable public identity and confirm `UnifiedRange user` appears.
- [ ] Delete User B’s disposable comment if supported and confirm another user cannot delete it.
- [ ] Submit a test report with each needed representative target/reason combination without entering private data in details.
- [ ] Refresh and confirm the report submission state prevents accidental duplicate submission if that is current behavior.
- [ ] Use the report in the moderation section.

### Expected results

- [ ] Signed-in social actions persist and remain scoped to their author/reporter.
- [ ] Signed-out users can read only the intended public data and cannot write.
- [ ] Reaction counts recover gracefully if the backend is temporarily unavailable.
- [ ] Comment identity uses safe public snapshots or a generic fallback.

### Privacy and safety checks

- [ ] Comments and report forms warn or naturally avoid private information; test content contains none.
- [ ] Public comments do not reveal email, legal name, location, Cognito ID, or private activity.
- [ ] Reports are not publicly readable and do not expose reporter identity on public content pages.

## 17. Admin/moderator moderation and report status updates

### Account type

Visitor, normal User B, Moderator, and Admin.

### Steps

- [ ] As Visitor, confirm Moderation navigation is absent and open `/moderation` and `/moderation/reports` directly.
- [ ] Repeat as normal User B.
- [ ] Sign in as Moderator and confirm Moderation navigation and pending badge appear.
- [ ] Open `/moderation` and `/moderation/reports`.
- [ ] Confirm the test report shows target type/id, reason, details, timestamps, and current status as intended.
- [ ] Confirm reporter identity prefers `@username`, then safe display name where available, with a shortened fallback if no profile can be resolved.
- [ ] Confirm the full internal reporter ID remains only in the muted technical detail line.
- [ ] Change a report through `open`, `reviewed`, `dismissed`, and `action_needed`, refreshing after each change.
- [ ] Confirm missing/open reports count as pending and reviewed/dismissed/action-needed reports do not incorrectly inflate the open badge.
- [ ] Sign in as Admin and repeat one status update.
- [ ] Attempt a status update as normal User B through the UI and, if an approved QA client is available, directly through the data operation.
- [ ] Confirm metadata other than `Report.status` is read-only for moderator/admin workflows.
- [ ] Confirm no delete, hide, suspend, account action, public-image action, or reported-content mutation control exists.

### Expected results

- [ ] Moderation routes and navigation are available only to `admin`/`moderator` group members.
- [ ] Supported statuses persist after refresh and update only the report workflow.
- [ ] Pending count uses missing/open status only.
- [ ] Normal users cannot read the moderation queue or update report status.
- [ ] Status changes never change the reported public content.

### Privacy and safety checks

- [ ] Moderation cards do not show reporter email, first/last name, city/state, private profile fields, private records, private S3 keys, private images, or target photos.
- [ ] Reporter internal IDs are never used as public identity.
- [ ] Moderator group membership does not grant access to another owner’s `PrivateImageAsset` registry or private originals.

## 18. Mobile and responsive sweep

### Account type

Visitor, User B, and Moderator.

### Steps

- [ ] Test at approximately 320 px, 375 px, 768 px, and a desktop width.
- [ ] Sweep `/`, `/auth/sign-in`, `/dashboard`, `/profile`, `/settings`, and `/settings/privacy`.
- [ ] Sweep list/new/detail/edit routes for passports, projectiles, optics, sessions, maintenance, and readiness.
- [ ] Sweep Public Preview, Discover list/detail, public profiles, moderation list, and username-repair states.
- [ ] Open and close mobile navigation; confirm focus and scrolling remain usable.
- [ ] Test long usernames, display names, report reasons/details, notes, manufacturers/models, tags, and empty/error messages.
- [ ] Test all forms with the on-screen keyboard where a physical device is available.
- [ ] Test private image file selection and upload progress on mobile.
- [ ] Rotate a device or emulator between portrait and landscape.

### Expected results

- [ ] No unintended horizontal scrolling, clipped buttons, overlapping navigation, or inaccessible actions appear.
- [ ] Cards, tables/details, status selectors, forms, notices, and long text wrap cleanly.
- [ ] Primary and secondary actions remain distinguishable and touch targets remain usable.
- [ ] Loading, error, success, empty, privacy, and demo labels remain readable.

### Privacy and safety checks

- [ ] Responsive layouts do not reveal normally hidden technical/private lines due to overflow or misplaced content.
- [ ] Mobile screenshots/previews do not expose private image keys or internal IDs outside the owner/moderator technical context.

## 19. Public/private boundary checks

### Account type

Visitor, User B, a second standard account, Moderator, and optionally Backend inspector.

### Steps

- [ ] Create distinctive synthetic marker values in User B’s private notes and private-only fields so accidental leakage can be recognized.
- [ ] Check `/`, Discover cards/details, `/u/[username]`, public comments, and signed-out page source for those markers.
- [ ] Inspect public/API-key GraphQL responses for `PublicPassportSnapshot`, `PublicUserProfileSnapshot`, comments, and reactions.
- [ ] Confirm no public response contains a private storage key or signed URL. If the optional Phase 2C integration fixture populated public projection fields, confirm they contain only the opaque backend asset id, processor-generated derivative key, and safe alt text; otherwise they remain empty.
- [ ] Confirm public profile responses contain only normalized username, safe display name/bio, visibility, and intended timestamps/identity metadata.
- [ ] As the second standard account, attempt direct IDs for User B’s profile hub, private records, target photos, and private image registry.
- [ ] As Moderator, confirm moderation access does not broaden reads of owner-private records or images.
- [ ] Review Public Preview’s included/excluded lists against the actual persisted public snapshot.
- [ ] Sign out, clear site data if practical, and repeat public routes in a new incognito session.

### Expected results

- [ ] Owner-scoped records are unreadable to other owners, moderators without explicit private access, API-key clients, and visitors.
- [ ] Public pages and responses use sanitized snapshots only.
- [ ] Safe identity fallbacks never expose raw Cognito IDs publicly.
- [ ] Private images remain private; public pages make no request to private S3 paths.

### Privacy and safety checks

- [ ] Public surfaces contain no email, first/last name, city/state, private notes, private settings, private activity, S3 keys, signed private URLs, original filenames, Identity Pool IDs, target photos, lot numbers, purchase details, exact locations, maintenance/readiness records, or private documents.
- [ ] Moderation contains report metadata only and does not reveal private source records or private images.
- [ ] No public surface adds calculators, scope outputs, holds, corrections, sight-in instructions, or directions for adjusting or aiming equipment.

## 20. Console and error checks

### Account type

Visitor, User B, Conflict account if available, and Moderator.

### Steps

- [ ] Keep Console and Network recording enabled while completing all prior sections.
- [ ] Reload each major route and check for uncaught exceptions, hydration errors, repeated authorization loops, failed chunks, and missing assets.
- [ ] Watch for repeated GraphQL requests, accidental infinite polling, or duplicate creates after a single action.
- [ ] Trigger representative validation errors, invalid credentials, missing records, private-image type/size rejection, unavailable public snapshot, and unauthorized moderation access.
- [ ] Confirm each failure produces a clear user-facing state and the page remains usable.
- [ ] Confirm sign-out produces no unhandled auth errors and clears private data after refresh.
- [ ] Review GraphQL variables/responses and storage requests for fields that should not cross the current route boundary.
- [ ] Review console messages and any accessible backend logs for secrets or private-data leakage.
- [ ] Confirm no frontend request attempts a public S3 write, public image copy/processing action, or image projection update. The owner-only Phase 2B verification mutation is expected; Phase 2C is exercised only through an explicit backend integration harness.

### Expected results

- [ ] No uncaught runtime, React, Next.js, Amplify, GraphQL, or Storage error remains during successful paths.
- [ ] Expected rejected operations fail once, explain the problem safely, and do not partially publish data.
- [ ] Loading states resolve and buttons recover from success or failure without requiring a hard refresh.
- [ ] No duplicate records, reactions, comments, reports, or image candidates are created by one normal submission.

### Privacy and safety checks

- [ ] Console, network, and backend logs contain no passwords, confirmation codes, Cognito tokens, signed URLs, private image bytes, original filenames, private keys, or sensitive profile/record content.
- [ ] Processor logs contain only fixed event names, bounded failure codes, and safe output type/size—not workflow IDs, owner IDs, record IDs, S3 keys, filenames, URLs, alt text, tokens, or image bytes.
- [ ] Bug reports use bounded error codes/request IDs and sanitized synthetic descriptions rather than copying private payloads.

## Completion and release decision

- [ ] Record every failed, blocked, or skipped check with an owner and follow-up issue.
- [ ] Re-run the affected section after a fix or backend redeploy.
- [ ] Re-run Sections 12, 13, 14, 17, and 19 after any data authorization, storage, public snapshot, or moderation change.
- [ ] Re-run Sections 1, 18, and 20 after any framework, navigation, layout, or deployment change.
- [ ] Do not approve a hosted release if another owner or signed-out/API-key client can access private records, private images, `PrivateImageAsset`, or private keys.
- [ ] Do not approve public image publishing based on the Phase 2C backend foundation. Explicit safety/selection consent UI, public delivery/read authorization, rendering, removal/unpublish lifecycle, superseded/orphan cleanup, image reporting/moderation, accessibility, and hosted adversarial tests are still required.
