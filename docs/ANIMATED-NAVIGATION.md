# Selection-linked navigation light

A suspended PayCore emblem and broad warm light follow the real selected item in
PayCore's existing edge panel. Setup tabs retain a compact selection light. It does not reproduce the reel's lantern artwork or
claim to use the creator's implementation. Existing themes and navigation targets
remain unchanged.

Selection comes from the authoritative workspace/setup `aria-current` state. The
indicator uses local layout coordinates, ResizeObserver and scoped mutation
observation; it does not poll or perform network requests. The edge panel reserves a rail beside the labels and displays the existing brand
emblem in a lit pendant. CSS moves it for 460ms; a cancellable 680ms swing settles
the pendant. Setup tabs retain the compact 320ms light. Motion
automatically retargets from the current position during rapid changes. The
first measured position is placed immediately, avoiding an initial sweep.

Pointer selection in the edge panel leaves 740ms for the light to settle before
the existing panel closes. The underlying navigation happens immediately. Rapid
selections cancel the previous close timer; closing/unmounting also clears it.
Keyboard activation and reduced-motion selection close immediately to preserve
keyboard focus behavior and avoid unnecessary waiting. Reduced motion removes the
indicator transition and pendant swing; forced colors hide the decorative light and outline the
current control. Existing selected-state styling remains a static fallback.

The light is aria-hidden, cannot receive focus and cannot intercept input. No new
sound, dependency, financial action, server permission, storage key or backend
configuration is introduced. Existing panel sound controls are retained. The closing sound is requested from
the original pointer gesture; the delayed visual close does not request audio.

Validate real setup/full-workspace transitions, repeated selections, keyboard
activation, reduced motion, resizing and the mobile edge panel with synthetic data.
Browser animation checks do not establish full WCAG conformance or physical Safari
coverage. Roll back this frontend change without changing records, migrations,
provider consent, deployment secrets or financial snapshots.
