# S3 Image Storage Plan

## Buckets Or Prefixes

Planned paths:

```txt
private/users/{userId}/passports/{passportId}/
private/users/{userId}/range-sessions/{sessionId}/target-photos/
private/users/{userId}/profile/
public/passports/{publicPassportId}/
public/profile/{publicProfileId}/
```

## Private User Images

Private setup images and target photos should be readable only by the owner through Cognito/AppSync-mediated access. Private images should not be served directly as public assets.

## Public Sanitized Images

Public images should be copied into a public-safe location only after the user confirms sharing and a Lambda workflow strips metadata.

## Metadata Stripping

Public images should have metadata stripped before publication, including EXIF GPS data, device metadata, timestamps where appropriate, and other personal metadata.

## Future Workflow

1. User uploads private image.
2. S3 stores original private image.
3. User previews Public Passport.
4. Lambda creates sanitized derivative.
5. Public snapshot references only the sanitized derivative.
