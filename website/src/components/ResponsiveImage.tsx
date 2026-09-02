import type { ImgHTMLAttributes } from 'react'
import { imageCdnSrcSet, imageCdnUrl } from '../lib/imageCdn'

type ResponsiveImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string
  widths?: readonly number[]
  quality?: number
  fallbackWidth?: number
  priority?: boolean
}

export function ResponsiveImage({
  src,
  widths,
  quality = 78,
  fallbackWidth = 1280,
  priority = false,
  loading,
  decoding = 'async',
  ...imageProps
}: ResponsiveImageProps) {
  const avifSrcSet = imageCdnSrcSet(src, 'avif', widths, quality)
  const webpSrcSet = imageCdnSrcSet(src, 'webp', widths, quality)
  const fallbackSrc = imageCdnUrl(src, fallbackWidth, undefined, quality)

  return (
    <picture className="responsive-picture">
      {avifSrcSet ? <source type="image/avif" srcSet={avifSrcSet} sizes={imageProps.sizes} /> : null}
      {webpSrcSet ? <source type="image/webp" srcSet={webpSrcSet} sizes={imageProps.sizes} /> : null}
      <img
        {...imageProps}
        src={fallbackSrc}
        loading={priority ? 'eager' : (loading ?? 'lazy')}
        decoding={decoding}
        fetchPriority={priority ? 'high' : imageProps.fetchPriority}
      />
    </picture>
  )
}
