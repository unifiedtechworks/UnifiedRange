# S3 Image Storage Plan

## Buckets Or Prefixes

Current private MVP paths:

```txt
private/equipment/{identityId}/{equipmentPassportId}/
private/targets/{identityId}/{rangeSessionId}/
```

Amplify Gen 2 Storage requires the owner token to be the path part immediately before the ending wildcard in the access rule. The backend rules therefore use `private/equipment/{entity_id}/*` and `private/targets/{entity_id}/*`.

Future public/sanitized paths may be added later:

```txt
public/passports/{publicPassportId}/
public/profile/{publicProfileId}/
```

Phase 1 and Phase 2A add no public Storage rule or prefix access. Public paths remain design placeholders until trusted source finalization, a processor Lambda, metadata-removal verification, and a public delivery policy are implemented together. Normal clients must never receive public-prefix write access.

## Private User Images

Private setup images and target photos are readable and writable only by the signed-in owner through Amplify Storage owner-based access. Private images should not be served directly as public assets.

The current MVP stores:

- `EquipmentPassport.privateCoverPhotoKey`
- `TargetPhoto.storageKey`

Phase 2A also registers successful uploads as owner-only `PrivateImageAsset` candidates. The candidate records store the private key, source relationship, generated safe filename, browser-observed content type, and byte size. They have no public/API-key access. Their backend-guarded verification fields remain unset, so the candidate records alone do not authorize S3 reads or public processing.

The app validates the expected key shape and matches its Identity Pool segment and saved source record in the normal upload flow. A future backend must repeat these checks using trusted resolver/IAM identity and `HeadObject`; it must not trust the browser-provided key or metadata.

## Public Sanitized Images

Public images should be copied into a public-safe location only after the user confirms sharing and a Lambda workflow strips metadata. Public image access is not enabled in the current private upload slice.

The current Public Passport publishing flow writes sanitized text/setup data only and does not expose private S3 keys or public images.

## Metadata Stripping

Public images should have metadata stripped before publication, including EXIF GPS data, device metadata, timestamps where appropriate, and other personal metadata.

## Future Workflow

1. User uploads a private image and S3 stores the private original.
2. The client links the image to its saved owner-scoped record and creates an unverified owner-only source candidate.
3. A trusted backend finalizer binds the AppSync owner, source owner, IAM/Identity Pool identity, key path, and actual object, then marks the candidate verified.
4. User previews the Public Passport and explicitly selects a backend-verified eligible source. **Publish without images** remains the default.
5. A Lambda decodes and re-encodes a sanitized derivative into a separate public namespace.
6. The public snapshot references only the approved sanitized derivative.

Steps 3-6 are not implemented. There is no public prefix, public read, public write, public URL, image copy, metadata-stripping Lambda, selection UI, or public image rendering today.
