# ASTRYX-inspired component pilot

Source of inspiration: https://github.com/meta/astryx

## Scope
This is a **native compatibility pilot** using ASTRYX's documented component and accessibility principles, not an installation of the @astryxdesign/core runtime package.

- Project: Paycore
- Live pilot surface: Local workspace onboarding
- Implementation: app/preview-access.tsx and app/immersive-entry.css

## Contract
Correct form labeling and autocomplete, clear focus, 44px touch targets, validation indicators and high-contrast fields. Local-only disclosure and financial flows unchanged.

## Release review
1. Run the existing build and type-check workflow.
2. Check desktop and iPhone layouts, keyboard-only navigation and visible focus.
3. Confirm that screen-reader control labels and high-contrast states remain useful.
4. Re-test the existing critical user journey.
5. Merge only with explicit owner approval.

## Future direct ASTRYX package adoption
React 19 is present, but npm dependency and lockfile updates must be performed together, and an isolated provider + component migration should be validated before making ASTRYX global. Do not add whole-app reset.css or a neutral theme that overrides the product's visual identity without screenshot-based regression approval.
