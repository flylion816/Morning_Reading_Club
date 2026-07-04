# Change: Support multiple imprint activity types

## Why
One gathering imprint can belong to several activity types, such as cooking and tea. The publish form currently only stores one type, which forces users to choose a single label.

## What Changes
- Allow imprint create and edit flows to submit multiple activity type keys.
- Persist the selected keys in `activityTypes` while keeping `activityType` as the first selected key for compatibility.
- Make list filtering match either historical single-type imprints or new multi-type imprints.
- Render multiple type chips on miniprogram detail and admin management views.

## Impact
- Affected specs: `imprints`
- Affected code: `backend/src/models/Imprint.js`, `backend/src/controllers/imprint.controller.js`, `miniprogram/pages/zaichang/*`, `admin/src/views/ImprintsManagementView.vue`
