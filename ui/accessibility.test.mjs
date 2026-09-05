import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { nextTabIndex, preferredScrollBehavior } from './accessibility.js'

const uiDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(uiDir, '..')

function source(path) {
  return readFileSync(resolve(rootDir, path), 'utf8')
}

function luminance(hex) {
  const values = hex.match(/[a-f\d]{2}/gi).map((value) => Number.parseInt(value, 16) / 255)
  const [red, green, blue] = values.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background))
  const dark = Math.min(luminance(foreground), luminance(background))
  return (light + 0.05) / (dark + 0.05)
}

test('tab arrow navigation wraps in both directions', () => {
  assert.equal(nextTabIndex(2, 3, 'ArrowRight'), 0)
  assert.equal(nextTabIndex(0, 3, 'ArrowLeft'), 2)
})

test('tab navigation supports vertical arrows and endpoints', () => {
  assert.equal(nextTabIndex(0, 3, 'ArrowDown'), 1)
  assert.equal(nextTabIndex(2, 3, 'ArrowUp'), 1)
  assert.equal(nextTabIndex(1, 3, 'Home'), 0)
  assert.equal(nextTabIndex(1, 3, 'End'), 2)
})

test('server-side scrolling defaults to non-animated behaviour', () => {
  assert.equal(preferredScrollBehavior(), 'auto')
})

test('shared tokens provide WCAG focus, forced-colour, and reduced-motion contracts', () => {
  const tokens = source('ui/tokens.css')
  assert.match(tokens, /:focus-visible/)
  assert.match(tokens, /@media \(forced-colors: active\)/)
  assert.match(tokens, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(tokens, /--npl-control-min: 2\.75rem/)
})

test('core shared colour pairs meet WCAG AA normal-text contrast', () => {
  assert.ok(contrast('#200001', '#fcfbfb') >= 4.5)
  assert.ok(contrast('#564d4d', '#fcfbfb') >= 4.5)
  assert.ok(contrast('#fcfbfb', '#200001') >= 4.5)
  assert.ok(contrast('#d2c8c8', '#200001') >= 4.5)
})

test('both applications install the shared accessibility runtime and token system', () => {
  for (const app of ['website', 'admin']) {
    const main = source(`${app}/src/main.tsx`)
    const css = source(app === 'website' ? 'website/src/index.css' : 'admin/src/styles/globals.css')
    assert.match(main, /installAccessibilityRuntime\(\)/)
    assert.match(css, /@import '@npl\/ui\/tokens\.css'/)
  }
})

test('application styles do not suppress focus indicators', () => {
  const styles = `${source('website/src/App.css')}\n${source('admin/src/styles/globals.css')}`
  assert.doesNotMatch(styles, /outline:\s*none/i)
})

test('ARIA tabs expose selected state rather than toggle-button state', () => {
  const paths = [
    'website/src/MatchDetailPage.tsx',
    'website/src/components/LeagueHeroBar.tsx',
    'website/src/components/LiveScorePanel.tsx',
    'website/src/MenuPages.tsx',
    'website/src/TeamDetailPage.tsx',
    'admin/src/components/MatchResultEditor.tsx',
    'admin/src/routes/_shell/index.tsx',
    'admin/src/routes/_shell/matches/$matchId.tsx',
    'admin/src/routes/_shell/scoring/$matchId.tsx',
    'admin/src/routes/_shell/scoring/index.tsx',
    'admin/src/routes/_shell/teams/$teamId.tsx',
  ]
  const tabButtons = paths.flatMap((path) =>
    (source(path).match(/<button\b[\s\S]*?<\/button>/g) ?? []).filter((button) => /role="tab"/.test(button)),
  )
  assert.ok(tabButtons.length > 0)
  for (const button of tabButtons) {
    assert.match(button, /\bid=/)
    assert.match(button, /aria-selected=/)
    assert.match(button, /aria-controls=/)
    assert.doesNotMatch(button, /aria-pressed=/)
  }
})

test('modal dialogs expose a name and modal semantics', () => {
  const paths = [
    'website/src/SiteHeader.tsx',
    'website/src/components/MediaLightbox.tsx',
    'website/src/components/MerchandiseQuickOrderModal.tsx',
    'admin/src/routes/_shell/scoring/$matchId.tsx',
  ]
  const dialogs = paths.flatMap((path) => source(path).match(/<[^>]+role="dialog"[\s\S]*?>/g) ?? [])
  assert.ok(dialogs.length > 0)
  for (const dialog of dialogs) {
    assert.match(dialog, /aria-modal="true"/)
    assert.match(dialog, /aria-(?:label|labelledby)=/)
  }
})

test('shared runtime announces application error feedback', () => {
  const runtime = source('ui/accessibility.js')
  for (const selector of ['.ui-error-notice', '.form-error', '.login-error', '.settings-form__error']) {
    assert.match(runtime, new RegExp(selector.replace('.', '\\\.')))
  }
  assert.match(runtime, /setAttribute\('role', 'alert'\)/)
})

test('dialog visibility excludes hidden and inert interface branches', () => {
  const runtime = source('ui/accessibility.js')
  assert.match(runtime, /closest\('\[hidden\], \[inert\], \[aria-hidden="true"\]'\)/)
})

test('decorative page hero imagery does not duplicate the visible heading', () => {
  const hero = source('website/src/components/PageHero.tsx')
  const responsiveImages = hero.match(/<ResponsiveImage[\s\S]*?\/>/g) ?? []
  assert.ok(responsiveImages.length >= 2)
  for (const image of responsiveImages) assert.match(image, /alt=""/)
})

test('public data tables expose scoped headers and named keyboard-scroll regions', () => {
  const paths = [
    'website/src/MatchDetailPage.tsx',
    'website/src/MenuPages.tsx',
    'website/src/PlayerDetailPage.tsx',
    'website/src/TeamDetailPage.tsx',
    'website/src/components/InningsScorecardPanels.tsx',
    'website/src/components/LeagueSeasonHub.tsx',
    'website/src/components/LeagueStatsPanel.tsx',
    'website/src/components/LiveScorePanel.tsx',
  ]
  const combined = paths.map(source).join('\n')
  const headerCells = combined.match(/<th(?:\s|>)[\s\S]*?>/g) ?? []
  assert.ok(headerCells.length > 0)
  for (const header of headerCells) assert.match(header, /scope="(?:col|row)"/)
  assert.match(combined, /className="[^"]*npl-table-region[^"]*"/)
  assert.match(combined, /role="region"/)
  assert.match(combined, /tabIndex=\{0\}/)
})

test('data-driven public templates use admin-managed page content', () => {
  const managedPages = [
    'website/src/App.tsx',
    'website/src/LiveScoresPage.tsx',
    'website/src/MatchDetailPage.tsx',
    'website/src/MenuPages.tsx',
    'website/src/MerchandiseOrderTrackingPage.tsx',
    'website/src/MerchandisePage.tsx',
    'website/src/MerchandiseProductPage.tsx',
    'website/src/NotFoundPage.tsx',
    'website/src/PlayerDetailPage.tsx',
    'website/src/SiteFooter.tsx',
    'website/src/SupporterAccountPage.tsx',
    'website/src/TeamDetailPage.tsx',
    'website/src/components/FixturesListing.tsx',
    'website/src/components/LeagueSeasonHub.tsx',
    'website/src/components/LiveScorePanel.tsx',
  ]
  for (const path of managedPages) {
    assert.match(source(path), /useSitePageContent\(/, path)
  }

  const editor = source('admin/src/routes/_shell/site-pages/index.tsx')
  assert.match(editor, /title="Website Content"/)
  assert.match(editor, /content_editor/)
  assert.match(editor, /Change their headings and supporting text here/)
})
