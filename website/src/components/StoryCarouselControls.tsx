type StorySlide = {
  id: number | string
  title: string
}

type StoryCarouselControlsProps = {
  slides: StorySlide[]
  currentIndex: number
  onSelect: (index: number) => void
}

export function StoryCarouselControls({ slides, currentIndex, onSelect }: StoryCarouselControlsProps) {
  if (slides.length < 2) return null

  return (
    <div className="story-carousel-controls" role="group" aria-label="News carousel controls">
      <div className="story-carousel-controls__arrows">
        <button type="button" className="story-carousel-controls__arrow" aria-label="Previous story" onClick={() => onSelect((currentIndex - 1 + slides.length) % slides.length)}>
          <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M27 16H5m0 0 9-9m-9 9 9 9" /></svg>
        </button>
        <button type="button" className="story-carousel-controls__arrow" aria-label="Next story" onClick={() => onSelect((currentIndex + 1) % slides.length)}>
          <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16h22m0 0-9-9m9 9-9 9" /></svg>
        </button>
      </div>
      <div className="story-carousel-controls__steps">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={`story-carousel-controls__step${index === currentIndex ? ' is-active' : ''}`}
            aria-label={`Show story ${index + 1}: ${slide.title}`}
            aria-current={index === currentIndex ? 'true' : undefined}
            onClick={() => onSelect(index)}
          >
            <span key={`${currentIndex}-${slide.id}`} className="story-carousel-controls__fill" />
          </button>
        ))}
      </div>
    </div>
  )
}
