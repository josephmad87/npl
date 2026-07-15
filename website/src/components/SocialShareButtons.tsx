type SocialShareButtonsProps = {
  title: string
  text?: string | null
  url?: string
}

function currentShareUrl(providedUrl?: string): string {
  if (providedUrl) return providedUrl

  if (typeof window === 'undefined') {
    return ''
  }

  return window.location.href
}

function openShareWindow(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer,width=720,height=620')
}

export function SocialShareButtons({
  title,
  text,
  url,
}: Readonly<SocialShareButtonsProps>) {
  const shareUrl = currentShareUrl(url)
  const shareText = [title, text].filter(Boolean).join('\n')
  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(shareText)

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: text ?? title,
          url: shareUrl,
        })
        return
      } catch {
        // User cancelled or device blocked native share. Do nothing.
      }
    }

    openShareWindow(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert('Link copied')
    } catch {
      prompt('Copy this link', shareUrl)
    }
  }

  return (
    <div className="social-share" aria-label="Share this page">
      <span className="social-share__label">Share</span>

      <button
        type="button"
        className="social-share__button social-share__button--primary"
        onClick={() => void nativeShare()}
      >
        Share
      </button>

      <button
        type="button"
        className="social-share__button"
        onClick={() =>
          openShareWindow(
            `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
          )
        }
      >
        WhatsApp
      </button>

      <button
        type="button"
        className="social-share__button"
        onClick={() =>
          openShareWindow(
            `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
          )
        }
      >
        X
      </button>

      <button
        type="button"
        className="social-share__button"
        onClick={() =>
          openShareWindow(
            `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          )
        }
      >
        Facebook
      </button>

      <button
        type="button"
        className="social-share__button"
        onClick={() => void copyLink()}
      >
        Copy link
      </button>
    </div>
  )
}
