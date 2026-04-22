import { resolveMediaUrl } from '../lib/publicApi'

type GalleryItem = {
  id: number
  title: string
  media_type: string
  file_url: string
  thumbnail_url?: string | null
}

export function GalleryCard({
  item,
  onOpen,
}: {
  item: GalleryItem
  onOpen?: (item: GalleryItem) => void
}) {
  const image = resolveMediaUrl(item.thumbnail_url ?? item.file_url)
  return (
    <button type="button" className="ui-gallery-card" onClick={() => onOpen?.(item)}>
      {image ? <img src={image} alt={item.title} /> : <div className="ui-gallery-card-placeholder" />}
      <div>
        <p>{item.media_type}</p>
        <h3>{item.title}</h3>
      </div>
    </button>
  )
}
