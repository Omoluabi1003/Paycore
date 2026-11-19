# Selection-linked navigation light

A decorative warm indicator follows the real selected item in PayCore's existing
edge panel and setup tabs. It does not reproduce the reel's lantern artwork or
claim to use the creator's implementation. Existing themes and navigation targets
remain unchanged.

Selection comes from the authoritative workspace/setup `aria-current` state. The
indicator uses local layout coordinates, ResizeObserver and scoped mutation
observation; it does not poll or perform network requests. CSS moves it for 320ms
and automatically retargets from the current position during rapid changes. The
first measured position is placed immediately, avoiding an initial sweep.

Pointer selection in the edge panel leaves 380ms for the light to settle before
the existing panel closes. The underlying navigation happens immediately. Rapid
selections cancel the previous close timer; closing/unmounting also clears it.
Keyboard activation and reduced-motion selection close immediately to preserve
keyboard focus behavior and avoid unnecessary waiting. Reduced motion removes the
indicator transition; forced colors hide the decorative light and outline the
current control. Existing selected-state styling remains a static fallback.

The light is aria-hidden, cannot receive focus and cannot intercept input. No new
sound, dependency, financial action, server permission, storage key or backend
configuration is introduced. Existing panel sound controls are retained.

Validate real setup/full-workspace transitions, repeated selections, keyboard
activation, reduced motion, resizing and the mobile edge panel with synthetic data.
Browser animation checks do not establish full WCAG conformance or physical Safari
coverage. Roll back this frontend change without changing records, migrations,
provider consent, deployment secrets or financial snapshots.
