# Future Username Sign-In Plan

UnifiedRange currently signs users in with email and password through Amazon Cognito. The immutable `UserProfile.username` is an app-level identity; it is not currently a Cognito sign-in alias.

A future username sign-in flow should use a trusted server-side lookup that accepts a normalized username and begins authentication without returning the account's email address to the browser. The lookup must use generic success and failure responses, rate limiting, abuse monitoring, and protections against username-to-email enumeration. Cognito should remain the credential verifier, and the app must not store passwords or create a client-readable username-to-email directory.

The existing `UsernameReservation` model is suitable for uniqueness and friendly identity display, but its records must not be extended with email or other private profile fields. A production sign-in design should use a narrowly scoped backend function or Cognito custom authentication flow, with secrets and email resolution confined to trusted server-side execution.

Username sign-in is intentionally not implemented in the hosted-dev MVP. Email/password remains the only supported login until the server-side lookup, enumeration resistance, recovery behavior, and operational controls are designed and reviewed.
