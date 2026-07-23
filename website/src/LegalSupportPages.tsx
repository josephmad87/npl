import { type FormEvent, type ReactNode, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PageHero } from './components/PageHero'
import { fetchJson, postJson } from './lib/publicApi'

const EFFECTIVE_DATE = '23 July 2026'

type PublicContactDetails = {
  contacts?: {
    emails?: string[]
    phone?: string
  }
  physical_address?: string
}

function usePublicContactDetails() {
  return useQuery({
    queryKey: ['public-about-legal-support'],
    queryFn: () => fetchJson<PublicContactDetails>('/public/about'),
    retry: 1,
    staleTime: 1000 * 60 * 10,
  })
}

function LegalPageShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <>
      <PageHero
        variant="siteLogo"
        title={title}
        subtitle={subtitle}
        fallbackMode="none"
      />
      <main className="container legal-page">{children}</main>
    </>
  )
}

function ContactNpl({
  purpose,
  showAddress = false,
}: {
  purpose: string
  showAddress?: boolean
}) {
  const contactQ = usePublicContactDetails()
  const emails = (contactQ.data?.contacts?.emails ?? [])
    .map((email) => email.trim())
    .filter(Boolean)
  const phone = contactQ.data?.contacts?.phone?.trim() ?? ''
  const address = contactQ.data?.physical_address?.trim() ?? ''

  return (
    <div className="legal-contact">
      <p>
        For {purpose}, use our <Link to="/contact-us">contact form</Link>
        {emails[0] ? (
          <>
            {' '}
            or email <a href={`mailto:${emails[0]}`}>{emails[0]}</a>
          </>
        ) : null}
        .
      </p>
      {phone ? (
        <p>
          Telephone:{' '}
          <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
        </p>
      ) : null}
      {showAddress && address ? <p className="legal-contact__address">{address}</p> : null}
    </div>
  )
}

function PolicyNavigation({ items }: { items: Array<{ href: string; label: string }> }) {
  return (
    <nav className="legal-page__contents" aria-label="On this page">
      <strong>On this page</strong>
      <ol>
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

const privacySections = [
  { href: '#who-we-are', label: 'Who we are' },
  { href: '#information-we-collect', label: 'Information we collect' },
  { href: '#how-we-use-information', label: 'How we use information' },
  { href: '#sharing-information', label: 'How information is shared' },
  { href: '#retention-security', label: 'Retention and security' },
  { href: '#your-choices', label: 'Your rights and choices' },
  { href: '#children', label: 'Children’s privacy' },
  { href: '#contact-privacy', label: 'Contact us' },
]

export function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle="How NPL Zimbabwe collects, uses, protects, and manages personal information."
    >
      <div className="legal-page__meta">
        <span>Effective {EFFECTIVE_DATE}</span>
        <span>Applies to npl.co.zw and NPL - Zimbabwe digital services</span>
      </div>

      <div className="legal-page__layout">
        <article className="legal-document">
          <p className="legal-document__lead">
            NPL Zimbabwe respects your privacy. This policy explains the information
            we may process when you use our website, contact us, order merchandise,
            register for fan services, follow teams or players, receive notifications,
            or use authorised scoring and administration tools.
          </p>

          <section id="who-we-are">
            <h2>1. Who we are</h2>
            <p>
              NPL Zimbabwe operates the National Premier League digital platform,
              including the public website, live scoring services, fan features,
              and authorised scorer and administration services. References to
              “NPL”, “we”, “us”, or “our” mean the operator of those services.
            </p>
            <ContactNpl purpose="privacy questions" showAddress />
          </section>

          <section id="information-we-collect">
            <h2>2. Information we collect</h2>
            <p>Depending on the feature you use, we may process:</p>
            <ul>
              <li>
                <strong>Fan account information:</strong> your name or display name,
                email address, password in securely hashed form, account status, and
                verification or password-reset records.
              </li>
              <li>
                <strong>Preferences:</strong> the team you support, teams you follow,
                favourite players, language, and notification choices.
              </li>
              <li>
                <strong>Notification information:</strong> device push tokens,
                platform type, delivery status, and the matches or results relevant
                to your preferences.
              </li>
              <li>
                <strong>Scorer and administrator information:</strong> staff account
                details, roles, match assignments, security events, and audit records.
              </li>
              <li>
                <strong>Contact information:</strong> your name, email address,
                optional telephone number, and the content of messages sent to us.
              </li>
              <li>
                <strong>Merchandise enquiries:</strong> your name, telephone number,
                optional email, product, size, quantity, and order notes. Do not send
                payment-card details through website forms.
              </li>
              <li>
                <strong>Technical information:</strong> IP address, device and browser
                type, operating system, timestamps, requested pages, diagnostics, and
                security logs generated when our services are used.
              </li>
              <li>
                <strong>Competition information:</strong> player and official names,
                photographs, team affiliations, statistics, scorecards, match events,
                and other records required to operate and report on the competition.
              </li>
            </ul>
          </section>

          <section id="how-we-use-information">
            <h2>3. How we use information</h2>
            <p>We use information to:</p>
            <ul>
              <li>provide fixtures, live scores, results, statistics, and news;</li>
              <li>create, secure, and support fan and staff accounts;</li>
              <li>save team-following and favourite-player preferences;</li>
              <li>
                send opted-in match reminders, including reminders approximately
                24 hours and one hour before a followed team plays;
              </li>
              <li>send final result notifications and service messages;</li>
              <li>manage scoring, match corrections, approvals, and audit trails;</li>
              <li>respond to enquiries and process merchandise requests;</li>
              <li>protect users, prevent misuse, and diagnose technical problems;</li>
              <li>comply with legal and competition obligations; and</li>
              <li>improve the reliability and usefulness of NPL services.</li>
            </ul>
            <p>
              Where applicable, we rely on consent, performance of a service you
              requested, our legitimate interests in operating and securing the
              platform, and compliance with legal obligations.
            </p>
          </section>

          <section id="sharing-information">
            <h2>4. How information is shared</h2>
            <p>
              We do not sell personal information. We may share only what is
              reasonably necessary with:
            </p>
            <ul>
              <li>
                service providers supporting hosting, databases, email, push
                notifications, security, diagnostics, and customer support;
              </li>
              <li>
                authorised NPL personnel, competition officials, clubs, and match
                administrators where required for league operations;
              </li>
              <li>
                professional advisers, regulators, or law-enforcement bodies when
                required by law or to protect legitimate rights; and
              </li>
              <li>
                a successor organisation if the service is reorganised, subject to
                appropriate privacy safeguards.
              </li>
            </ul>
            <p>
              Some providers may process information in another country. Where that
              happens, we take reasonable steps to require appropriate contractual,
              organisational, and security protections.
            </p>
          </section>

          <section id="retention-security">
            <h2>5. Retention and security</h2>
            <p>
              We retain information only for as long as reasonably needed for the
              purpose for which it was collected, to maintain official competition
              records, resolve disputes, enforce agreements, and meet legal
              obligations. Information no longer needed is deleted or anonymised
              according to our retention procedures.
            </p>
            <p>
              We use reasonable protections, including access controls, role-based
              permissions, encryption in transit, secure password hashing, audit
              records, and restricted administrative access. No online service can
              promise absolute security, so users should also protect their passwords
              and devices.
            </p>
          </section>

          <section id="your-choices">
            <h2>6. Your rights and choices</h2>
            <p>Subject to applicable law, you may ask us to:</p>
            <ul>
              <li>provide access to personal information we hold about you;</li>
              <li>correct inaccurate or incomplete information;</li>
              <li>delete your fan account and associated personal information;</li>
              <li>restrict or object to certain processing;</li>
              <li>provide an available copy of information you supplied; or</li>
              <li>withdraw consent for optional processing.</li>
            </ul>
            <p>
              You can change notification preferences in the app and disable push
              notifications in your device settings. To close an account, visit our{' '}
              <Link to="/account-deletion">account-deletion page</Link>.
            </p>
            <p>
              We may verify your identity before completing a request. Official
              scorecards, competition records, safeguarding information, financial
              records, or security logs may be retained where there is a lawful or
              operational reason.
            </p>
          </section>

          <section id="children">
            <h2>7. Children’s privacy</h2>
            <p>
              Public cricket content may be viewed by supporters of all ages. Fan
              registration is not intended for children below the minimum age
              required by applicable law unless a parent or guardian has provided
              any required authorisation. Contact us if you believe a child supplied
              personal information without appropriate permission.
            </p>
          </section>

          <section id="changes">
            <h2>8. Changes to this policy</h2>
            <p>
              We may update this policy when our services, providers, or legal
              obligations change. The effective date identifies the current version.
              Material changes may also be announced through the website, app, or
              account email.
            </p>
          </section>

          <section id="contact-privacy">
            <h2>9. Contact us</h2>
            <ContactNpl purpose="privacy requests, questions, or complaints" showAddress />
          </section>
        </article>

        <PolicyNavigation items={privacySections} />
      </div>
    </LegalPageShell>
  )
}

const termsSections = [
  { href: '#terms-acceptance', label: 'Acceptance' },
  { href: '#terms-accounts', label: 'Accounts and access' },
  { href: '#terms-content', label: 'Scores and content' },
  { href: '#terms-conduct', label: 'Acceptable use' },
  { href: '#terms-rights', label: 'Intellectual property' },
  { href: '#terms-orders', label: 'Merchandise enquiries' },
  { href: '#terms-liability', label: 'Availability and liability' },
  { href: '#terms-contact', label: 'Contact us' },
]

export function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Use"
      subtitle="The rules that apply when using NPL Zimbabwe websites, apps, and digital services."
    >
      <div className="legal-page__meta">
        <span>Effective {EFFECTIVE_DATE}</span>
        <span>NPL Zimbabwe digital services</span>
      </div>

      <div className="legal-page__layout">
        <article className="legal-document">
          <p className="legal-document__lead">
            These terms govern access to npl.co.zw, NPL - Zimbabwe mobile
            applications, live scoring, fan accounts, and authorised scoring and
            administration tools. By using a service, you agree to these terms.
          </p>

          <section id="terms-acceptance">
            <h2>1. Acceptance and eligibility</h2>
            <p>
              You must use NPL services lawfully and have the authority to accept
              these terms. If you use a service for a club, organisation, or another
              person, you confirm that you are authorised to do so. Additional rules
              may apply to competitions, credentials, purchases, or promotions.
            </p>
          </section>

          <section id="terms-accounts">
            <h2>2. Accounts and authorised access</h2>
            <ul>
              <li>Provide accurate information and keep it reasonably current.</li>
              <li>Keep passwords, devices, and verification codes secure.</li>
              <li>Do not share scorer or administrator accounts.</li>
              <li>Notify NPL promptly if you suspect unauthorised access.</li>
              <li>
                Scorers and administrators may use only the matches, records, and
                functions assigned to their role.
              </li>
            </ul>
            <p>
              We may suspend, restrict, or close an account where reasonably necessary
              to protect the service, users, competition integrity, or legal rights.
              You may request deletion of a fan account through the{' '}
              <Link to="/account-deletion">account-deletion page</Link>.
            </p>
          </section>

          <section id="terms-content">
            <h2>3. Scores, schedules, and content</h2>
            <p>
              We work to keep fixtures, live scores, statistics, tables, and editorial
              content accurate. Cricket data can change because of scorer corrections,
              official decisions, disciplinary outcomes, weather, revised playing
              conditions, or technical delays. A live score is provisional until the
              result is formally finalised.
            </p>
            <p>
              NPL may correct published information when reasonably required. Users
              should rely on formal competition notices where a website or app display
              conflicts with an official ruling.
            </p>
          </section>

          <section id="terms-conduct">
            <h2>4. Acceptable use</h2>
            <p>You must not:</p>
            <ul>
              <li>interfere with, overload, probe, or bypass service security;</li>
              <li>access another person’s account without permission;</li>
              <li>submit false scores, impersonate an official, or manipulate records;</li>
              <li>upload malicious code or use automated extraction abusively;</li>
              <li>harass others or submit unlawful, defamatory, or harmful content;</li>
              <li>
                copy, resell, commercially exploit, or redistribute protected NPL
                content without authorisation; or
              </li>
              <li>use the service in a way that violates law or competition rules.</li>
            </ul>
          </section>

          <section id="terms-rights">
            <h2>5. Intellectual property and permissions</h2>
            <p>
              NPL services, branding, page designs, databases, written content, and
              software are owned by or licensed to NPL. Team marks, player images,
              sponsor marks, broadcasts, and third-party material remain the property
              of their respective owners.
            </p>
            <p>
              You may view and share links to public content for personal,
              non-commercial purposes. Broader reproduction, broadcast, data feeds,
              commercial use, or creation of a competing database requires prior
              written permission.
            </p>
          </section>

          <section id="terms-orders">
            <h2>6. Merchandise enquiries</h2>
            <p>
              Submitting a merchandise form is an order enquiry, not necessarily a
              completed sale. Availability, sizing, delivery, price, payment method,
              and collection details must be confirmed by NPL. Do not submit payment
              credentials through a general contact form.
            </p>
          </section>

          <section id="terms-third-parties">
            <h2>7. Third-party services</h2>
            <p>
              NPL services may link to social networks, video platforms, maps, payment
              providers, or other services we do not control. Their terms and privacy
              policies apply when you use them.
            </p>
          </section>

          <section id="terms-liability">
            <h2>8. Availability, disclaimers, and liability</h2>
            <p>
              Services are provided on an “as available” basis. We do not promise
              uninterrupted access or that every error will be corrected immediately.
              To the extent permitted by applicable law, NPL is not liable for
              indirect, incidental, or consequential loss arising solely from use of,
              or inability to use, a digital service.
            </p>
            <p>
              Nothing in these terms excludes rights or liabilities that cannot
              lawfully be excluded. These terms are governed by the laws applicable
              in Zimbabwe, subject to mandatory consumer rights where you live.
            </p>
          </section>

          <section id="terms-changes">
            <h2>9. Changes to these terms</h2>
            <p>
              We may update these terms as the platform or applicable requirements
              change. Continued use after the effective date means you accept the
              revised terms where permitted by law.
            </p>
          </section>

          <section id="terms-contact">
            <h2>10. Contact us</h2>
            <ContactNpl purpose="questions about these terms" showAddress />
          </section>
        </article>

        <PolicyNavigation items={termsSections} />
      </div>
    </LegalPageShell>
  )
}

export function SupportPage() {
  const contactQ = usePublicContactDetails()
  const emails = (contactQ.data?.contacts?.emails ?? [])
    .map((email) => email.trim())
    .filter(Boolean)
  const phone = contactQ.data?.contacts?.phone?.trim() ?? ''

  return (
    <LegalPageShell
      title="Support"
      subtitle="Help with NPL Zimbabwe scores, accounts, notifications, scoring, and website services."
    >
      <section className="support-page__intro">
        <div>
          <p className="support-page__eyebrow">NPL help centre</p>
          <h2>How can we help?</h2>
          <p>
            Use the guidance below for common issues. If you still need assistance,
            send the NPL team a message and include the page, match, or account
            involved.
          </p>
        </div>
        <div className="support-page__contact-card">
          <strong>Contact NPL support</strong>
          <Link className="support-page__primary-link" to="/contact-us">
            Send a support message
          </Link>
          {emails[0] ? <a href={`mailto:${emails[0]}`}>{emails[0]}</a> : null}
          {phone ? (
            <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
          ) : null}
        </div>
      </section>

      <section className="support-page__grid" aria-label="Support topics">
        <article className="support-page__topic">
          <span>Scores and fixtures</span>
          <h2>Report incorrect match information</h2>
          <p>
            Include the match, innings, over or player, the information shown, and the
            correction you believe is needed. Live scores remain provisional until
            the scorer finalises the result.
          </p>
          <Link to="/contact-us">Report a score issue</Link>
        </article>

        <article className="support-page__topic">
          <span>Fan accounts</span>
          <h2>Sign-in and profile help</h2>
          <p>
            Check the email used to register, request a password reset, and look in
            spam or junk folders for verification messages. Never share a password or
            verification code with support.
          </p>
          <Link to="/account-deletion">Delete an account</Link>
        </article>

        <article className="support-page__topic">
          <span>Notifications</span>
          <h2>Match reminders and results</h2>
          <p>
            Follow a team and enable notifications in both the NPL app and your device
            settings. Fixture changes can move or cancel scheduled reminders.
          </p>
          <Link to="/privacy">How notification data is used</Link>
        </article>

        <article className="support-page__topic">
          <span>Scorers</span>
          <h2>Live-scoring assistance</h2>
          <p>
            Include the match name and ID, your scorer email, the last successfully
            recorded ball, and any error message. Do not send your password or
            two-factor authentication code.
          </p>
          <Link to="/contact-us">Contact operations support</Link>
        </article>

        <article className="support-page__topic">
          <span>Administrators</span>
          <h2>Access and permissions</h2>
          <p>
            Role changes, locked scorecards, and edit-access requests must be approved
            through authorised NPL administrators. Supply the affected match or
            record and the reason access is required.
          </p>
          <Link to="/contact-us">Request assistance</Link>
        </article>

        <article className="support-page__topic">
          <span>Privacy</span>
          <h2>Your information and choices</h2>
          <p>
            Read how information is handled, change optional notification preferences,
            or submit a request concerning your personal information.
          </p>
          <div className="support-page__topic-links">
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/account-deletion">Account deletion</Link>
          </div>
        </article>
      </section>

      <section className="support-page__response">
        <h2>Information to include</h2>
        <ul>
          <li>your name and the email associated with your account;</li>
          <li>the match, team, player, page, or feature affected;</li>
          <li>the approximate date and time the issue happened;</li>
          <li>the device and app or browser version, if known; and</li>
          <li>a screenshot that does not reveal private credentials.</li>
        </ul>
        <p>
          Urgent live-scoring issues should be clearly labelled with the match name
          and “LIVE SCORING” at the start of the message.
        </p>
      </section>
    </LegalPageShell>
  )
}

export function AccountDeletionPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [details, setDetails] = useState('')
  const [website, setWebsite] = useState('')
  const [submitState, setSubmitState] = useState<
    'idle' | 'sending' | 'success' | 'error'
  >('idle')
  const isReady =
    fullName.trim() !== '' && email.trim() !== '' && submitState !== 'sending'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isReady) return

    setSubmitState('sending')
    try {
      await postJson('/public/contact', {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: null,
        message: [
          'ACCOUNT DELETION REQUEST',
          `Account email: ${email.trim()}`,
          details.trim()
            ? `Additional information: ${details.trim()}`
            : 'Additional information: none supplied',
        ].join('\n\n'),
        website: website.trim() || null,
      })
      setSubmitState('success')
      setFullName('')
      setEmail('')
      setDetails('')
      setWebsite('')
    } catch {
      setSubmitState('error')
    }
  }

  return (
    <LegalPageShell
      title="Account Deletion"
      subtitle="Request deletion of an NPL - Zimbabwe fan account and associated personal information."
    >
      <div className="account-deletion__layout">
        <article className="legal-document account-deletion__explanation">
          <p className="legal-document__lead">
            You can ask NPL Zimbabwe to delete your fan account. This page provides an
            external request method for website and mobile-app users.
          </p>

          <section>
            <h2>Delete an account in the app</h2>
            <ol>
              <li>Sign in to NPL - Zimbabwe.</li>
              <li>Open your profile and choose Privacy and account.</li>
              <li>Select Delete account and review the information shown.</li>
              <li>Confirm the request using the account verification step.</li>
            </ol>
            <p>
              If you cannot sign in, the app is not yet available, or the in-app
              option does not work, submit the form on this page.
            </p>
          </section>

          <section>
            <h2>What will be deleted</h2>
            <p>
              After verification, deletion covers the fan account, profile details,
              supported and followed teams, favourite players, stored push tokens,
              and optional notification preferences associated with the account.
            </p>
          </section>

          <section>
            <h2>Information we may retain</h2>
            <p>
              Limited information may be retained where reasonably necessary for
              legal compliance, fraud and security prevention, dispute resolution, or
              official competition records. Match actions performed by a scorer or
              administrator may remain in audit and scorecard records.
            </p>
          </section>

          <section>
            <h2>Verification and timing</h2>
            <p>
              We may contact the account email to confirm identity and prevent an
              unauthorised deletion. We aim to complete a verified request within
              30 days unless legal or operational requirements reasonably require
              more time.
            </p>
          </section>

          <section>
            <h2>Before submitting</h2>
            <p>
              Account deletion is permanent. If you only want to stop match alerts,
              turn off notifications in the app or your device settings instead.
            </p>
          </section>
        </article>

        <section className="account-deletion__form-card" aria-labelledby="deletion-form-title">
          <p className="support-page__eyebrow">Privacy request</p>
          <h2 id="deletion-form-title">Request account deletion</h2>
          <p>
            Use the email connected to the account. Do not include a password,
            verification code, or identity-document image.
          </p>

          {submitState === 'success' ? (
            <div className="account-deletion__success" role="status">
              <h3>Request received</h3>
              <p>
                NPL support may contact you at the account email to verify the request
                before deletion.
              </p>
              <button type="button" onClick={() => setSubmitState('idle')}>
                Submit another request
              </button>
            </div>
          ) : (
            <form className="account-deletion__form" onSubmit={(event) => void handleSubmit(event)}>
              <input
                type="text"
                name="website"
                className="contact-page__honeypot"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />

              <label htmlFor="deletion-full-name">Full name</label>
              <input
                id="deletion-full-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />

              <label htmlFor="deletion-email">Account email</label>
              <input
                id="deletion-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <label htmlFor="deletion-details">
                Additional information <span>(optional)</span>
              </label>
              <textarea
                id="deletion-details"
                rows={5}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="For example, tell us if you no longer have access to the account."
              />

              <button type="submit" disabled={!isReady}>
                {submitState === 'sending' ? 'Sending request…' : 'Request deletion'}
              </button>

              {submitState === 'error' ? (
                <p className="account-deletion__error" role="alert">
                  We could not submit the request. Please try again or use the{' '}
                  <Link to="/contact-us">contact page</Link>.
                </p>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </LegalPageShell>
  )
}
