import { useEffect } from 'react'
import nplLogoUrl from '../assets/logo-optimized.png'

export type SeoBreadcrumb = {
  name: string
  path?: string
}

type JsonLdValue = Record<string, unknown>

type SeoHeadProps = {
  title: string
  description: string
  canonicalPath?: string
  image?: string | null
  type?: 'website' | 'article' | 'product'
  noIndex?: boolean
  breadcrumbs?: SeoBreadcrumb[]
  structuredData?: JsonLdValue | JsonLdValue[]
}

const SITE_NAME = 'NPL Zimbabwe'
const DEFAULT_DESCRIPTION =
  'Official NPL Zimbabwe fixtures, live scores, results, standings, teams, players and news.'

function absoluteUrl(value: string): string {
  try {
    return new URL(value, window.location.origin).toString()
  } catch {
    return window.location.origin
  }
}

function upsertMeta(selector: string, attributes: Record<string, string>): void {
  let node = document.head.querySelector<HTMLMetaElement>(selector)
  if (!node) {
    node = document.createElement('meta')
    document.head.append(node)
  }
  Object.entries(attributes).forEach(([name, value]) => node?.setAttribute(name, value))
}

function upsertCanonical(href: string): void {
  let node = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!node) {
    node = document.createElement('link')
    node.rel = 'canonical'
    document.head.append(node)
  }
  node.href = href
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function SeoHead({
  title,
  description,
  canonicalPath = window.location.pathname,
  image,
  type = 'website',
  noIndex = false,
  breadcrumbs = [],
  structuredData = [],
}: SeoHeadProps) {
  useEffect(() => {
    const resolvedTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
    const resolvedDescription = description.trim() || DEFAULT_DESCRIPTION
    const canonical = absoluteUrl(canonicalPath)
    const shareImage = absoluteUrl(image || nplLogoUrl)
    const appEnvironment = import.meta.env.VITE_APP_ENV?.trim().toLowerCase()
    const preventIndexing =
      noIndex ||
      (appEnvironment
        ? !['production', 'prod'].includes(appEnvironment)
        : false)

    document.title = resolvedTitle
    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: resolvedDescription,
    })
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: preventIndexing
        ? 'noindex,follow'
        : 'index,follow,max-image-preview:large',
    })
    upsertCanonical(canonical)

    const socialMeta: Array<[string, string]> = [
      ['og:title', resolvedTitle],
      ['og:description', resolvedDescription],
      ['og:url', canonical],
      ['og:type', type],
      ['og:site_name', SITE_NAME],
      ['og:image', shareImage],
      ['og:image:secure_url', shareImage],
      ['twitter:card', 'summary_large_image'],
      ['twitter:title', resolvedTitle],
      ['twitter:description', resolvedDescription],
      ['twitter:image', shareImage],
    ]
    socialMeta.forEach(([property, content]) => {
      const isTwitter = property.startsWith('twitter:')
      upsertMeta(
        `meta[${isTwitter ? 'name' : 'property'}="${property}"]`,
        isTwitter ? { name: property, content } : { property, content },
      )
    })

    document.head
      .querySelectorAll('script[data-npl-client-jsonld]')
      .forEach((node) => node.remove())

    const jsonLd: JsonLdValue[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: resolvedTitle,
        description: resolvedDescription,
        url: canonical,
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: window.location.origin,
        },
      },
    ]

    if (breadcrumbs.length > 0) {
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          ...(item.path ? { item: absoluteUrl(item.path) } : {}),
        })),
      })
    }

    jsonLd.push(...(Array.isArray(structuredData) ? structuredData : [structuredData]))
    jsonLd.forEach((value) => {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.nplClientJsonld = 'true'
      script.textContent = safeJson(value)
      document.head.append(script)
    })
  }, [breadcrumbs, canonicalPath, description, image, noIndex, structuredData, title, type])

  return null
}

export const DEFAULT_SEO_DESCRIPTION = DEFAULT_DESCRIPTION
