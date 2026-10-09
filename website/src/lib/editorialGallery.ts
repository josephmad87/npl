import type { GalleryLightboxItem } from '../components/GalleryLightbox'

const galleryPath = '/gallery/2026-t20-blast/'

const photoUrl = (filename: string) =>
  new URL(`${galleryPath}${filename}`, globalThis.location?.origin ?? 'https://npl.co.zw').href

const photos: { filename: string; title: string }[] = [
  { filename: 'fielding-action.jpg', title: 'NPL T20 Blast fielder in action' },
  { filename: 'wicket-celebration-blue-red.jpg', title: 'Teammates celebrate a wicket' },
  { filename: 'takashinga-ground.jpg', title: 'Takashinga Cricket Club ground' },
  { filename: 'wicket-celebration-maroon.jpg', title: 'A wicket celebration at the NPL T20 Blast' },
  { filename: 'batting-action-blue-maroon.jpg', title: 'A batter plays an attacking shot' },
  { filename: 'batting-action-orange.jpg', title: 'A batter in action at the NPL T20 Blast' },
  { filename: 'running-between-wickets.jpg', title: 'Batters run between the wickets' },
  { filename: 't20-blast-team-representatives.jpg', title: 'NPL T20 Blast team representatives' },
  { filename: 'team-walkout.jpg', title: 'Players walk out at the NPL T20 Blast' },
  { filename: 'player-presentation.jpg', title: 'A player receives a presentation award' },
  { filename: 'match-official-and-representatives.jpg', title: 'Match official with team representatives' },
]

export const editorialGalleryPhotos: GalleryLightboxItem[] = photos.map((photo, index) => ({
  id: -1000 - index,
  title: photo.title,
  media_type: 'image',
  file_url: photoUrl(photo.filename),
}))
