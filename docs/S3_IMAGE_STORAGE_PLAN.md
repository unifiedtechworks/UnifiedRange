# S3 Image Storage Plan

## Buckets Or Prefixes

Current private MVP paths:

```txt
private/{identityId}/equipment/{equipmentPassportId}/
private/{identityId}/targets/{rangeSessionId}/
```

Future public/sanitized paths may be added later:

```txt
public/passports/{publicPassportId}/
public/profile/{publicProfileId}/
```

## Private User Images

Private setup images and target photos are readable and writable only by the signed-in owner through Amplify Storage owner-based access. Private images should not be served directly as public assets.

The current MVP stores:

- `EquipmentPassport.privateCoverPhotoKey`
- `TargetPhoto.storageKey`

## Public Sanitized Images

Public images should be copied into a public-safe location only after the user confirms sharing and a Lambda workflow strips metadata. Public image access is not enabled in the current private upload slice.

## Metadata Stripping

Public images should have metadata stripped before publication, including EXIF GPS data, device metadata, timestamps where appropriate, and other personal metadata.

## Future Workflow

1. User uploads private image.
2. S3 stores original private image.
3. User previews Public Passport.
4. Lambda creates sanitized derivative.
5. Public snapshot references only the sanitized derivative.
