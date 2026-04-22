import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { extractList, fetchJson, resolveMediaUrl } from './lib/publicApi'

type PageConfig = {
  title: string
  subtitle: string
  endpoint: string
  highlightParam?: string
}

function listFromPayload(payload: unknown): Array<Record<string, unknown>> {
  return extractList<Record<string, unknown>>(payload)
}

function itemTitle(item: Record<string, unknown>): string {
  return (
    (item.title as string | undefined) ??
    (item.name as string | undefined) ??
    (item.full_name as string | undefined) ??
    (item.slug as string | undefined) ??
    'Untitled'
  )
}

function itemMeta(item: Record<string, unknown>): string {
  const bits = [
    item.category as string | undefined,
    item.status as string | undefined,
    item.match_date as string | undefined,
  ].filter(Boolean)
  return bits.join(' • ')
}

function itemThumb(item: Record<string, unknown>): string | null {
  return resolveMediaUrl(
    (item.featured_image_url as string | undefined) ??
      (item.thumbnail_url as string | undefined) ??
      (item.file_url as string | undefined) ??
      (item.cover_image_url as string | undefined) ??
      null,
  )
}

function PublicListPage({ title, subtitle, endpoint, highlightParam }: PageConfig) {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['menu-page', endpoint],
    queryFn: async () => listFromPayload(await fetchJson<unknown>(endpoint)),
    retry: 1,
  })
  const highlightedSlug =
    highlightParam && typeof globalThis !== 'undefined'
      ? new URLSearchParams(globalThis.location.search).get(highlightParam)
      : null

  return (
    <main className="container">
      <section className="menu-page">
        <header className="menu-page-header">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>

        {isLoading ? <p>Loading...</p> : null}
        {isError ? <p>Could not load content.</p> : null}

        {!isLoading && !isError ? (
          <div className="menu-list">
            {data.map((item, idx) => {
              const titleText = itemTitle(item)
              const slug = item.slug as string | undefined
              const thumb = itemThumb(item)
              const meta = itemMeta(item)
              const isActive = highlightedSlug && slug ? highlightedSlug === slug : false
              return (
                <article key={`${slug ?? titleText}-${idx}`} className={`menu-list-item${isActive ? ' is-active' : ''}`}>
                  {thumb ? <img src={thumb} alt={titleText} /> : <div className="menu-list-thumb-placeholder" />}
                  <div>
                    {slug && endpoint.includes('/public/news') ? (
                      <Link to="/news/$slug" params={{ slug }} className="menu-list-link">
                        {titleText}
                      </Link>
                    ) : (
                      <h2>{titleText}</h2>
                    )}
                    {meta ? <p>{meta}</p> : null}
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>
    </main>
  )
}

export const MensPage = () => (
  <PublicListPage title="Mens" subtitle="Active mens teams." endpoint="/public/teams?category=men&page_size=20" />
)
export const MensFixturesPage = () => (
  <PublicListPage title="Mens Fixtures" subtitle="Upcoming mens fixtures." endpoint="/public/fixtures?category=men&page_size=20" />
)
export const MensResultsPage = () => (
  <PublicListPage title="Mens Results" subtitle="Latest mens results." endpoint="/public/results?category=men&page_size=20" />
)
export const MensSeasonsPage = () => (
  <PublicListPage
    title="Mens Seasons"
    subtitle="League seasons."
    endpoint="/public/leagues?page_size=20"
    highlightParam="leagueSlug"
  />
)
export const MensTeamsPage = () => (
  <PublicListPage
    title="Mens Teams"
    subtitle="Mens team listings."
    endpoint="/public/teams?category=men&page_size=30"
    highlightParam="teamSlug"
  />
)

export const LadiesPage = () => (
  <PublicListPage title="Ladies" subtitle="Active ladies teams." endpoint="/public/teams?category=ladies&page_size=20" />
)
export const LadiesFixturesPage = () => (
  <PublicListPage title="Ladies Fixtures" subtitle="Upcoming ladies fixtures." endpoint="/public/fixtures?category=ladies&page_size=20" />
)
export const LadiesResultsPage = () => (
  <PublicListPage title="Ladies Results" subtitle="Latest ladies results." endpoint="/public/results?category=ladies&page_size=20" />
)
export const LadiesTeamsPage = () => (
  <PublicListPage
    title="Ladies Teams"
    subtitle="Ladies team listings."
    endpoint="/public/teams?category=ladies&page_size=30"
    highlightParam="teamSlug"
  />
)

export const YouthPage = () => (
  <PublicListPage title="Youth" subtitle="Active youth teams." endpoint="/public/teams?category=youth&page_size=20" />
)
export const YouthFixturesPage = () => (
  <PublicListPage title="Youth Fixtures" subtitle="Upcoming youth fixtures." endpoint="/public/fixtures?category=youth&page_size=20" />
)
export const YouthResultsPage = () => (
  <PublicListPage title="Youth Results" subtitle="Latest youth results." endpoint="/public/results?category=youth&page_size=20" />
)
export const YouthTeamsPage = () => (
  <PublicListPage
    title="Youth Teams"
    subtitle="Youth team listings."
    endpoint="/public/teams?category=youth&page_size=30"
    highlightParam="teamSlug"
  />
)

export const NewsPage = () => (
  <PublicListPage title="News" subtitle="Latest published news." endpoint="/public/news?page_size=20" />
)
export const CenterPage = () => (
  <PublicListPage title="Center" subtitle="Player center." endpoint="/public/players?page_size=20" />
)
export const GalleryPage = () => (
  <PublicListPage title="Gallery" subtitle="All published media." endpoint="/public/gallery?page_size=20" />
)
export const GalleryImagesPage = () => (
  <PublicListPage title="Gallery Images" subtitle="Published image gallery." endpoint="/public/gallery?media_type=image&page_size=20" />
)
export const GalleryVideoPage = () => (
  <PublicListPage title="Gallery Video" subtitle="Published video gallery." endpoint="/public/gallery?media_type=video&page_size=20" />
)
export const AboutUsPage = () => (
  <PublicListPage title="About Us" subtitle="League overview and context." endpoint="/public/leagues?page_size=20" />
)
