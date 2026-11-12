## 1. Poster layout

- [x] 1.1 Add ordered image metadata and proportional layout calculations to the long-poster snapshot.
- [x] 1.2 Include image heights in poster height calculation and keep images between body text and hash-tag lines.
- [x] 1.3 Draw each prepared image sequentially at its calculated position and release the current image reference.

## 2. Memory and fallback handling

- [x] 2.1 Prepare image dimensions and bounded local sources without retaining all decoded image objects.
- [x] 2.2 Use image-aware DPR/export settings and preserve the existing lower-scale export retry.
- [x] 2.3 Skip unavailable images and keep full poster generation and text fallback usable.

## 3. Regression coverage

- [x] 3.1 Verify image order, position, proportional dimensions, and the no-image poster path.
- [x] 3.2 Verify long-poster fallback keeps images while truncating only oversized text.
- [x] 3.3 Verify export retry and image-source preparation do not regress existing poster sharing behavior.
- [x] 3.4 Run the focused course-detail Jest tests and validate the OpenSpec change in strict mode.
