export function PageHero({
  title,
  subtitle,
  imageUrl,
}: {
  title: string
  subtitle?: string
  imageUrl?: string | null
}) {
  return (
    <section className="ui-page-hero">
      {imageUrl ? <img src={imageUrl} alt={title} /> : null}
      <div className="ui-page-hero-overlay">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </section>
  )
}
