# MVP Scope

## MVP Goal

Build a working web app that lets users create private equipment passports, log range sessions, upload target photos, track maintenance, create hunting readiness checklists, and optionally publish sanitized public setup profiles for discovery.

## MVP Modules

### 1. Accounts and Profiles

- Sign up
- Log in
- User profile
- Display name
- Privacy defaults
- Public profile page later

### 2. Equipment Passports

Start with rifle-focused fields, but structure the model so pistols and archery can be added later.

A passport should include:

- Equipment type: rifle, pistol, bow, crossbow, other
- Nickname
- Manufacturer
- Model
- Caliber or draw/arrow category
- Use case tags
- Optic/sight
- Accessories
- Preferred ammo/projectile
- Round count or shot count
- Maintenance notes
- Private notes
- Public notes
- Photos

### 3. Ammo / Projectile Profiles

For firearm MVP:

- Manufacturer
- Product line
- Caliber
- Bullet weight
- Bullet type
- Lot number
- Rounds purchased
- Rounds remaining
- Notes

Future archery fields:

- Arrow shaft
- Spine
- Point/broadhead
- Fletching
- Total arrow weight
- Notes

### 4. Optic / Sight Profiles

- Manufacturer
- Model
- Type
- Reticle/pin configuration
- Sight unit if applicable
- Notes

No aiming corrections should be calculated.

### 5. Range Sessions

- Date
- Equipment used
- Ammo/projectile used
- Distance
- Shooting discipline
- Position
- Support/rest type
- Weather notes
- Group size or score
- Cold-bore / first-shot marker
- Clean/fouled marker
- Notes
- Target photos
- Confidence rating

### 6. Target Photos

- Upload target photo
- Attach to range session
- Add notes
- Manually enter group size or score

MVP does not need computer vision.

### 7. Maintenance Log

- Date
- Equipment passport
- Round/shot count
- Cleaning or maintenance type
- Parts changed
- Notes

### 8. Hunting Readiness

Checklist template:

- License/tag confirmed
- Equipment confirmed at range
- First-shot/cold-bore practice logged
- Field-position practice logged
- Ammo/projectile verified
- Optic/sight checked
- Gear inspected
- Pack list complete
- Emergency contact plan
- Offline maps prepared
- Weather checked

### 9. Public Setup Discovery

Users may publish sanitized public versions of equipment passports.

Discovery filters:

- Equipment type
- Caliber/category
- Manufacturer
- Model
- Optic/sight
- Ammo/projectile
- Use case
- Hunting/target
- Budget tag
- Beginner-friendly tag

### 10. Comments and Reactions

Initial reactions:

- Helpful setup
- Similar to mine
- Good hunting build
- Budget-friendly
- Lightweight
- Well documented
- Beginner-friendly

Comments should support reporting/moderation.

## Explicit Non-Goals

Do not build:

- Ballistics solver
- Scope adjustment calculator
- Holdover calculator
- Wind correction calculator
- Zeroing wizard
- Reloading recipe recommendations
- Firearm/ammo marketplace
- Tactical engagement features
- Exact location-sharing feed
