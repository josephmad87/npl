import type { ReactNode } from 'react'

import { SectionHintTip } from '@/components/SectionHintTip'

type PageHeaderProps = {
  title: string
  description?: string
  /** When true, `description` is only shown in a help tooltip beside the title. */
  descriptionAsTooltip?: boolean
  actions?: ReactNode
  /** Optional logo beside the title (team / league badge). */
  media?: ReactNode
  /** Shown inline after the title (e.g. help tooltip). */
  titleAccessory?: ReactNode
}

export function PageHeader({
  title,
  description,
  descriptionAsTooltip,
  actions,
  media,
  titleAccessory,
}: PageHeaderProps) {
  const descriptionTip =
    descriptionAsTooltip && description ? (
      <SectionHintTip ariaHelp={description}>
        <span className="section-hint-tip__text">{description}</span>
      </SectionHintTip>
    ) : null

  const titleAccessoryBlock =
    descriptionTip || titleAccessory ? (
      <span className="page-header__title-accessory">
        {descriptionTip}
        {titleAccessory}
      </span>
    ) : null

  return (
    <header className="page-header">
      <div className="page-header__top">
        <div className="page-header__intro">
          {media}
          <div className="page-header__titles">
            <div className="page-header__title-row">
              <h1>{title}</h1>
              {titleAccessoryBlock}
            </div>
            {description && !descriptionAsTooltip ? (
              <p>{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
    </header>
  )
}
