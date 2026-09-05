import { useQuery } from '@tanstack/react-query'
import { fetchJson } from './publicApi'

export type SitePageSlug =
  | 'home'
  | 'mens'
  | 'women'
  | 'youth'
  | 'fixtures'
  | 'results'
  | 'teams'
  | 'seasons'
  | 'news'
  | 'gallery'
  | 'merchandise'
  | 'merchandise-product'
  | 'order-tracking'
  | 'live'
  | 'compare-teams'
  | 'about-us'
  | 'contact-us'
  | 'search'
  | 'my-npl'
  | 'team-profile'
  | 'player-profile'
  | 'match-centre'
  | 'league-season'
  | 'site-footer'
  | 'not-found'
  | 'privacy'
  | 'terms'
  | 'support'
  | 'account-deletion'
  | 'competition'
  | 'safeguarding'
  | 'scorecard-corrections'
  | 'supporters'

export type SitePageSection = {
  id: string
  heading: string
  body_html: string
}

export type SitePageContent = {
  slug: SitePageSlug
  title: string
  subtitle: string
  effective_date: string
  intro_html: string
  sections: SitePageSection[]
  updated_at: string
}

export function useSitePageContent(slug: SitePageSlug) {
  return useQuery({
    queryKey: ['public-site-page', slug],
    queryFn: () =>
      fetchJson<SitePageContent>(`/public/site-pages/${encodeURIComponent(slug)}`),
    retry: 1,
    staleTime: 1000 * 60 * 5,
  })
}

export function managedSection(
  page: SitePageContent | null | undefined,
  id: string,
  fallbackHeading: string,
  fallbackBodyHtml = '',
): SitePageSection {
  const section = page?.sections.find((item) => item.id === id)
  return {
    id,
    heading: section?.heading.trim() || fallbackHeading,
    body_html: section?.body_html.trim() || fallbackBodyHtml,
  }
}
