const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const TAB_KEYS = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'])

export function nextTabIndex(current, total, key) {
  if (total <= 0) return -1
  if (key === 'Home') return 0
  if (key === 'End') return total - 1
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % total
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + total) % total
  return current
}

export function preferredScrollBehavior() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

function visible(element) {
  return (
    element instanceof HTMLElement &&
    !element.hidden &&
    !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
    element.getClientRects().length > 0
  )
}

function focusableWithin(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(visible)
}

function syncTabStops(root = document) {
  root.querySelectorAll('[role="tablist"]').forEach((tablist) => {
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]')).filter(
      (tab) => tab instanceof HTMLElement && !tab.hasAttribute('disabled'),
    )
    if (tabs.length === 0) return
    const selected = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true')
    tabs.forEach((tab, index) => tab.setAttribute('tabindex', index === (selected >= 0 ? selected : 0) ? '0' : '-1'))
  })
}

const TABLE_REGION_SELECTOR = [
  '.table-wrap',
  '.table-scroll',
  '.player-public-table-wrap',
  '.team-page__table-wrap',
  '.match-centre-table-wrap',
  '.league-stats-table-wrap',
  '.compare-teams-table-wrap',
  '.match-centre-player-matchup__table-wrap',
  '.live-score-panel__table-wrap',
  '.league-standings-scroll',
].join(',')

function tableRegionLabel(region, table) {
  const caption = table.querySelector('caption')?.textContent?.trim()
  if (caption) return caption

  const section = region.closest('section, article')
  const heading = section?.querySelector('h2, h3, h4')?.textContent?.trim()
  return heading ? `${heading} table` : 'Scrollable data table'
}

function syncTableRegions(root = document) {
  root.querySelectorAll('thead th:not([scope])').forEach((header) => header.setAttribute('scope', 'col'))
  root.querySelectorAll('tbody th:not([scope])').forEach((header) => header.setAttribute('scope', 'row'))

  root.querySelectorAll(TABLE_REGION_SELECTOR).forEach((region) => {
    if (!(region instanceof HTMLElement)) return
    const table = region.querySelector('table')
    if (!(table instanceof HTMLTableElement)) return

    region.classList.add('npl-table-region')
    const isScrollable = region.scrollWidth > region.clientWidth + 1
    if (isScrollable) {
      if (!region.hasAttribute('tabindex')) {
        region.setAttribute('tabindex', '0')
        region.dataset.generatedTableTabindex = 'true'
      }
      if (!region.hasAttribute('role')) {
        region.setAttribute('role', 'region')
        region.dataset.generatedTableRegion = 'true'
      }
      if (!region.hasAttribute('aria-label') && !region.hasAttribute('aria-labelledby')) {
        region.setAttribute('aria-label', tableRegionLabel(region, table))
        region.dataset.generatedTableLabel = 'true'
      }
      return
    }

    if (region.dataset.generatedTableLabel === 'true') {
      region.removeAttribute('aria-label')
      delete region.dataset.generatedTableLabel
    }
    if (region.dataset.generatedTableRegion === 'true') {
      region.removeAttribute('role')
      delete region.dataset.generatedTableRegion
    }
    if (region.dataset.generatedTableTabindex === 'true') {
      region.removeAttribute('tabindex')
      delete region.dataset.generatedTableTabindex
    }
  })
}

const ERROR_FEEDBACK_SELECTOR = [
  '.ui-error-notice',
  '.form-error',
  '.login-error',
  '.settings-form__error',
  '.media-url-field__error',
  '.match-centre-fan-pom__error',
  '.account-deletion__error',
].join(',')

function syncFeedback(root = document) {
  root.querySelectorAll(ERROR_FEEDBACK_SELECTOR).forEach((message) => {
    if (!message.hasAttribute('role')) message.setAttribute('role', 'alert')
  })
}

export function installAccessibilityRuntime() {
  if (typeof document === 'undefined' || !document.body) return () => {}

  let activeDialog = null
  let dialogOpener = null
  let inertedForDialog = []

  const restoreDialogSiblings = () => {
    inertedForDialog.forEach((element) => element.removeAttribute('inert'))
    inertedForDialog = []
  }

  const isolateDialog = (dialog) => {
    let current = dialog
    while (current?.parentElement && current.parentElement !== document.body) {
      const parent = current.parentElement
      Array.from(parent.children).forEach((sibling) => {
        if (sibling === current || !(sibling instanceof HTMLElement) || sibling.hasAttribute('inert')) return
        sibling.setAttribute('inert', '')
        inertedForDialog.push(sibling)
      })
      current = parent
    }
  }

  const syncDialog = () => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).filter(visible)
    const nextDialog = dialogs.at(-1) ?? null
    if (nextDialog === activeDialog) return

    restoreDialogSiblings()

    if (activeDialog && !nextDialog && dialogOpener instanceof HTMLElement && document.contains(dialogOpener)) {
      dialogOpener.focus({ preventScroll: true })
    }

    activeDialog = nextDialog
    if (!nextDialog) {
      dialogOpener = null
      return
    }

    dialogOpener = document.activeElement
    isolateDialog(nextDialog)
    nextDialog.setAttribute('tabindex', nextDialog.getAttribute('tabindex') ?? '-1')
    const initial = nextDialog.querySelector('[data-dialog-initial-focus], [autofocus]')
    const target = visible(initial) ? initial : focusableWithin(nextDialog)[0] ?? nextDialog
    requestAnimationFrame(() => target.focus({ preventScroll: true }))
  }

  const onKeyDown = (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return

    const tablist = target.closest('[role="tablist"]')
    if (tablist && target.getAttribute('role') === 'tab' && TAB_KEYS.has(event.key)) {
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]')).filter(
        (tab) => tab instanceof HTMLElement && !tab.hasAttribute('disabled'),
      )
      const current = tabs.indexOf(target)
      const next = tabs[nextTabIndex(current, tabs.length, event.key)]
      if (next instanceof HTMLElement) {
        event.preventDefault()
        next.focus()
        next.click()
      }
      return
    }

    if (!activeDialog || !visible(activeDialog)) return

    if (event.key === 'Escape') {
      const close = activeDialog.querySelector(
        '[data-dialog-close], button[aria-label^="Close" i]',
      )
      if (close instanceof HTMLElement) {
        event.preventDefault()
        close.click()
      }
      return
    }

    if (event.key !== 'Tab') return
    const focusable = focusableWithin(activeDialog)
    if (focusable.length === 0) {
      event.preventDefault()
      activeDialog.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  let syncFrame = 0
  const sync = () => {
    if (syncFrame) cancelAnimationFrame(syncFrame)
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0
      syncTabStops()
      syncDialog()
      syncTableRegions()
      syncFeedback()
    })
  }
  const onResize = () => {
    syncTableRegions()
  }
  const observer = new MutationObserver(sync)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'hidden'] })
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize, { passive: true })
  sync()

  return () => {
    observer.disconnect()
    document.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', onResize)
    if (syncFrame) cancelAnimationFrame(syncFrame)
    restoreDialogSiblings()
  }
}
