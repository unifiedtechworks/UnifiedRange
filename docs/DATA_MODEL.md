# Initial Data Model

This file describes the initial conceptual data model. Codex should turn this into TypeScript types first, then database tables later.

## UserProfile

- id
- displayName
- username
- avatarUrl
- bio
- privacyDefault
- createdAt
- updatedAt

## EquipmentPassport

Use a broad model so UnifiedRange can support rifles first, then pistols and archery later.

- id
- ownerId
- equipmentType: rifle | pistol | bow | crossbow | other
- nickname
- manufacturer
- model
- category
- caliber
- barrelLength
- twistRate
- drawWeight
- drawLength
- bowType
- opticOrSightId
- accessories
- preferredProjectileId
- useCaseTags
- roundOrShotCount
- privateNotes
- publicNotes
- coverPhotoUrl
- isPublic
- createdAt
- updatedAt

## ProjectileProfile

For firearms, this means ammo. For archery, this means arrows/bolts.

- id
- ownerId
- projectileType: ammo | arrow | bolt | pellet | other
- manufacturer
- productLine
- caliber
- bulletWeight
- bulletType
- lotNumber
- roundsPurchased
- roundsRemaining
- arrowShaft
- arrowSpine
- pointOrBroadhead
- fletching
- totalWeight
- privateNotes
- publicNotes
- createdAt
- updatedAt

## OpticSightProfile

- id
- ownerId
- sightType: scope | red_dot | iron_sight | bow_sight | other
- manufacturer
- model
- reticleOrPinSetup
- magnification
- adjustmentUnit
- clickValue
- privateNotes
- publicNotes
- createdAt
- updatedAt

## RangeSession

- id
- ownerId
- equipmentPassportId
- projectileProfileId
- date
- distance
- distanceUnit
- discipline
- position
- supportType
- weatherNotes
- windNotesFreeText
- groupSize
- score
- isColdBore
- isCleanBarrel
- isSuppressed
- confidenceRating
- sessionNotes
- isPublicSummary
- createdAt
- updatedAt

## TargetPhoto

- id
- ownerId
- rangeSessionId
- imageUrl
- caption
- manuallyEnteredGroupSize
- manuallyEnteredScore
- isPublic
- createdAt
- updatedAt

## MaintenanceLogEntry

- id
- ownerId
- equipmentPassportId
- date
- roundOrShotCount
- maintenanceType
- partsChanged
- notes
- createdAt
- updatedAt

## HuntingChecklist

- id
- ownerId
- equipmentPassportId
- huntName
- season
- species
- checklistItems
- notes
- createdAt
- updatedAt

## PublicPassportSnapshot

A sanitized public representation of an EquipmentPassport.

- id
- equipmentPassportId
- ownerId
- title
- equipmentType
- manufacturer
- model
- category
- caliber
- opticOrSightSummary
- projectileSummary
- useCaseTags
- publicNotes
- coverPhotoUrl
- publicStats
- createdAt
- updatedAt

## Comment

- id
- authorId
- targetType
- targetId
- body
- status
- createdAt
- updatedAt

## Reaction

- id
- userId
- targetType
- targetId
- reactionType
- createdAt

## Report

- id
- reporterId
- targetType
- targetId
- reason
- details
- status
- createdAt
- updatedAt
