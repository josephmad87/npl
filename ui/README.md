# NPL interface foundation

`@npl/ui` is the shared interface contract for the public website and operations console.

- `tokens.css` defines the brand and neutral scales, semantic text/surface colours, 4px spacing scale, typography, radii, elevation, motion, focus, target sizes, and reusable surface/button/field/table primitives.
- `accessibility.js` installs route-independent keyboard behaviour for tabs and modal dialogs, restores dialog focus, and makes only overflowing data tables keyboard-scrollable with an accessible region name.
- `accessibility.test.mjs` protects the focus, contrast, reduced-motion, tab, and application-integration contracts.

New UI should consume semantic tokens rather than adding raw colours or arbitrary spacing. Controls must retain the shared focus ring and minimum target size. Tab buttons require `role="tab"`, `aria-selected`, and `aria-controls`; their active content requires a labelled `tabpanel`. Modal dialogs require `aria-modal="true"` and either `aria-labelledby` or `aria-label`.
