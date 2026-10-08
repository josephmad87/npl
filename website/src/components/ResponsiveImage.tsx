import type { ImgHTMLAttributes } from 'react'
import { imageCdnSrcSet, imageCdnUrl, type ResponsiveImageFormat } from '../lib/imageCdn'

const DEFAULT_FORMATS: readonly ResponsiveImageFormat[] = ['avif', 'webp']

type ResponsiveImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string
  widths?: readonly number[]
  quality?: number
  fallbackWidth?: number
  formats?: readonly ResponsiveImageFormat[]
  priority?: boolean
}

export function ResponsiveImage({
  src,
  widths,
  quality = 78,
  fallbackWidth = 1280,
  formats = DEFAULT_FORMATS,
  priority = false,
  loading,
  decoding = 'async',
  ...imageProps
}: ResponsiveImageProps) {
  const avifSrcSet = formats.includes('avif') ? imageCdnSrcSet(src, 'avif', widths, quality) : undefined
  const webpSrcSet = formats.includes('webp') ? imageCdnSrcSet(src, 'webp', widths, quality) : undefined
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
