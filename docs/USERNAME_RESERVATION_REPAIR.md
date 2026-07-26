# Username Reservation Repair

## Purpose

Use this runbook when a signed-in account has an existing `UserProfile.username` but the matching `UsernameReservation.ownerId` does not match any identity alias in the current Cognito session. UnifiedRange must not overwrite or delete a reservation automatically because that could enable username takeover.

## Identity Values

New UnifiedRange records use Amplify Auth's `getCurrentUser().username` as the canonical owner key. During validation, the app also recognizes these values from the same authenticated session as legacy aliases:

- `getCurrentUser().userId`
- the Cognito `sub` attribute/claim
- the `cognito:username` token claim

The signed-in `/profile` warning shows only the normalized app username and shortened current/reservation owner identifiers. It never shows email, legal name, location, or private activity.

## Inspect the Conflict

1. Confirm the Amplify frontend outputs, AppSync API, DynamoDB tables, and Cognito user pool all belong to the same intended environment.
2. In the target Cognito user pool, locate the affected signed-in user through an authorized administrator workflow. Record its Cognito username and `sub`; do not copy email or other profile data into tickets or source control.
3. In the target environment's `UserProfile` table or AppSync query console, locate the owner-scoped profile and record its `ownerId` and normalized `username`.
4. Look up the `UsernameReservation` whose record ID is that normalized username. Record its `ownerId`.
5. Compare the reservation owner against the profile owner, Cognito username, `sub`, and `cognito:username` for the same user.
6. Check for another `UserProfile` or Cognito user legitimately associated with the reservation before changing anything.

## Decide the Case

### False-positive / legacy alias

Treat the reservation as belonging to the same account only when its `ownerId` exactly matches a verified identity alias from that same Cognito user. The application now accepts this safely without rewriting the reservation. In development, an administrator may migrate the reservation to the canonical owner key only through a reviewed backend/admin operation that preserves uniqueness and verifies the owner before and after the change.

### Missing reservation

If no reservation exists and the profile's username is valid, the signed-in app creates the reservation with the current canonical owner key. Before manual creation, verify no other environment record or active account owns the username.

### Real conflict

If the reservation owner belongs to another Cognito user or cannot be proven to be an alias of the affected user, do not delete, overwrite, or transfer it. Keep public profile synchronization paused. Resolve ownership through an administrator-reviewed product/support decision, retaining an audit record and communicating with the affected users without disclosing either account's private data.

When the current profile contains a legacy/test username that is legitimately reserved by another account, the owner-facing `/profile/username-repair` flow is the preferred repair:

1. The original reservation owner keeps the existing username and reservation unchanged.
2. The conflicted account opens `/profile`, reviews the safe conflict notice, and chooses **Choose a different username**.
3. The repair page revalidates that the old username is still a real conflict.
4. The account selects an available normalized username and creates its own reservation.
5. Only that signed-in account's `UserProfile.username` is updated.
6. Any stale public profile snapshot is removed only when its owner ID matches the signed-in account; another account's snapshot is never changed.
7. Public profile synchronization resumes under the new, validated username.

The repair page is unavailable when the old reservation is missing or already belongs to the signed-in user's verified identity aliases. Outside this explicit conflict state, usernames remain immutable and `/profile/edit` keeps the username read-only.

## Development Repair Safety

- Confirm the exact AWS account, region, Amplify environment, user pool, AppSync API, and table before changing a dev record.
- Back up the specific reservation/profile records or capture a safe change record before mutation.
- Prefer an authenticated admin/backend repair path over a browser client or direct table edit.
- Change only the intended normalized username record.
- Reopen `/profile` and verify the warning clears, then verify `/u/[username]` is created or updated only when account visibility allows it.
- For a legitimate legacy/test conflict, prefer the owner-facing repair page over manually editing profile or reservation records.
- Sign out and confirm no private profile fields appear publicly.

Never delete reservations casually in production. A reservation can be the only guard preventing another account from claiming an established immutable username.
