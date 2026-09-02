# Stage 4 accessibility verification

This is the release evidence and manual test script for the NPL public website and operations console. It covers WCAG 2.2 AA semantics, keyboard access, assistive technology, zoom and responsive reflow. Automated checks are necessary but do not replace the real-device checks below.

## Implemented interface contract

- Both applications import the shared `@npl/ui` tokens and accessibility runtime.
- Skip links and route-focus management move keyboard and screen-reader users to the new page's main content.
- Page changes are announced through a polite live region.
- Tab sets expose `tablist`, `tab`, `aria-selected`, `aria-controls` and labelled `tabpanel` relationships. Arrow keys, Home and End move and activate tabs.
- Modal dialogs expose an accessible name, receive initial focus, trap focus, isolate background content, close with Escape when dismissal is allowed, and restore focus to the opener.
- Async errors use alert semantics; non-error progress uses polite status semantics.
- Overflowing tables become named, focusable horizontal-scroll regions. Header cells receive row or column scope.
- Controls use a 44 CSS-pixel default minimum target and a high-contrast visible focus ring.
- Shared semantic colours meet a 4.5:1 minimum contrast ratio for normal text in their documented foreground/background pairings.
- Reduced-motion preferences suppress non-essential animation and smooth scrolling.
- The scoring workspace drops sticky positioning and stacks dense panels, quick actions and dialog summaries at narrow reflow widths.

## Automated release checks

Run from the repository root:

```bash
npm --prefix ui test
npm --prefix website run lint
npm --prefix website run build
npm --prefix admin run lint
npm --prefix admin run build
```

CI runs the shared accessibility contract tests. Before release, run an automated browser audit against staging for the homepage, a match scorecard, admin login and an authenticated scoring workspace. Critical or serious findings are blockers; Lighthouse Accessibility must be at least 95.

## Keyboard-only test

Test the public header, one complete tab set, a horizontally scrollable table, merchandise quick order, admin navigation, scorer innings/panel tabs, Extras, Wicket, End of over and Finalise dialogs.

1. Start with the pointer unavailable and press Tab. Confirm the skip link is the first useful control and focus is always visible.
2. Activate the skip link and confirm focus lands on main content without obscuration.
3. Traverse all controls in reading order. Confirm there are no unreachable controls, unexpected focus jumps or keyboard traps.
4. In each tab list, use Left/Right, Up/Down, Home and End. Confirm one tab is in the tab order and its panel changes and is announced.
5. Open each dismissible dialog. Confirm focus starts inside it, Tab and Shift+Tab wrap, background controls cannot receive focus, Escape closes it and focus returns to the opener.
6. Confirm mandatory scoring dialogs do not silently dismiss and provide a clear completion action.
7. Focus an overflowing table region and use horizontal scroll keys or Shift+mouse-wheel. Confirm data is not clipped.
8. Trigger validation and network errors. Confirm visible error text appears beside the workflow and receives assertive announcement.

Status: code-level keyboard contracts and local browser focus checks complete. Authenticated scoring scenarios must also be repeated against the anonymised staging dataset before release.

## VoiceOver test — macOS Safari

1. Enable VoiceOver, open the rotor and confirm one main landmark, expected navigation landmarks and a logical heading outline.
2. Navigate by links, form controls, headings and tables. Confirm names describe the destination or action without duplicated decorative-image text.
3. Exercise public and scorer tab sets. Confirm selected state, tab position and associated panel are announced.
4. Open merchandise and scoring dialogs. Confirm the dialog name, initial field, validation errors and status changes are announced; background content must be unavailable.
5. On scorecards and standings, navigate by rows and columns and confirm header associations.
6. Record a staging delivery and confirm queued, saved and conflict states are distinguishable without colour alone.

Status: manual device verification required before production release. Browser semantics have been prepared, but a real VoiceOver session cannot be represented by a DOM-only audit.

## TalkBack test — Android Chrome

1. Use swipe navigation and Explore by Touch on the public header, live scorecard and merchandise flow.
2. Confirm controls have concise names, selected/expanded states are announced and touch targets do not overlap.
3. Open and close the mobile menu and dialogs; focus must enter the overlay, remain inside and return to the opener.
4. Test a wide scorecard table with two-finger horizontal scrolling and confirm surrounding page scroll remains usable.
5. In an authenticated staging scorer session, record a normal ball, an extra and a wicket, then complete an over using TalkBack only.

Status: manual Android-device verification required before production release.

## Zoom and reflow matrix

Browser zoom is equivalent to reducing the available CSS viewport. Test with text scaling at its default value unless a row says otherwise.

| Coverage | Viewport / setting | Pass condition |
| --- | --- | --- |
| Desktop baseline | 1280 CSS px | No page-level horizontal overflow; navigation, content and dialogs are complete. |
| 200% zoom equivalent | 640 CSS px | Content reflows; controls remain available and focused content is not obscured. |
| 400% zoom equivalent | 320 CSS px | No page-level two-dimensional scrolling except named data-table regions; text is readable without clipping. |
| Tablet scorer | 1024 × 768 landscape | Scoring actions and ball-by-ball history remain available without overlap. |
| Mobile reflow | 320 × 800 | Mobile navigation, cards, dialogs and action groups fit; scoring controls stack predictably. |
| Text spacing | WCAG 1.4.12 overrides | No loss of content at 1.5 line height, 2× paragraph spacing, 0.12em letter spacing and 0.16em word spacing. |

Local responsive browser checks cover 1280, 640 and 320 CSS-pixel widths. Repeat the matrix on staging with representative API data and an authenticated scorer session.

## Content and operational requirements

- Editors must provide meaningful alternative text for informative images; decorative imagery must use empty alternative text.
- Every published video with meaningful speech or sound needs accurate captions, and prerecorded audio/video should have a transcript or equivalent where required.
- Link and button text must describe its action without relying on surrounding visual position.
- Do not approve a release with unresolved critical/serious automated findings, keyboard blockers, or failed VoiceOver/TalkBack scoring tasks.
