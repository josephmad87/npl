from app.schemas.site_page_content import SitePageBody, SitePageSlug


DEFAULT_SITE_PAGES: dict[SitePageSlug, dict[str, object]] = {
    "privacy": {
        "title": "Privacy Policy",
        "subtitle": (
            "How NPL Zimbabwe collects, uses, protects, and shares information "
            "across its website, mobile apps, and authorised scoring services."
        ),
        "effective_date": "23 July 2026",
        "intro_html": (
            "<p>NPL Zimbabwe respects your privacy. This policy explains the "
            "information handled when you browse npl.co.zw, use NPL - Zimbabwe "
            "mobile applications, create a fan account, follow teams or players, "
            "receive notifications, or use authorised scoring and administration "
            "tools.</p>"
        ),
        "sections": [
            {
                "id": "information-we-collect",
                "heading": "1. Information we collect",
                "body_html": (
                    "<p>We may collect account details such as your name, email "
                    "address, password credentials, followed teams, favourite "
                    "players, notification choices, support messages, and device "
                    "information needed to deliver the service.</p>"
                    "<p>For authorised scorers and administrators, we also process "
                    "role, assignment, scorecard, audit, and security information.</p>"
                ),
            },
            {
                "id": "how-we-use-information",
                "heading": "2. How we use information",
                "body_html": (
                    "<ul><li>operate accounts, live scores, fixtures, results, and "
                    "statistics;</li><li>send opted-in match reminders, live updates, "
                    "and result notifications;</li><li>provide support and protect "
                    "account and competition integrity;</li><li>improve service "
                    "performance and reliability; and</li><li>meet legal and "
                    "regulatory obligations.</li></ul>"
                ),
            },
            {
                "id": "notifications",
                "heading": "3. Notifications and preferences",
                "body_html": (
                    "<p>If you enable notifications, we may use a device push token "
                    "and your team or player preferences to schedule alerts. You can "
                    "change optional preferences in the app or device settings.</p>"
                ),
            },
            {
                "id": "sharing",
                "heading": "4. When information is shared",
                "body_html": (
                    "<p>We may share limited information with hosting, analytics, "
                    "notification, security, and support providers acting for NPL. "
                    "We may also disclose information where required by law or needed "
                    "to protect users, competition integrity, or legal rights. We do "
                    "not sell personal information.</p>"
                ),
            },
            {
                "id": "retention-and-security",
                "heading": "5. Retention and security",
                "body_html": (
                    "<p>Information is retained only as long as reasonably necessary "
                    "for the purposes described, official competition records, "
                    "security, dispute resolution, and legal compliance. We use "
                    "reasonable organisational and technical safeguards, but no "
                    "online service can guarantee absolute security.</p>"
                ),
            },
            {
                "id": "your-rights",
                "heading": "6. Your choices and rights",
                "body_html": (
                    "<p>You may request access, correction, deletion, or another "
                    "privacy action where applicable. You can request fan-account "
                    'deletion from the <a href="/account-deletion">account-deletion '
                    "page</a>. We may verify your identity before completing a "
                    "request.</p>"
                ),
            },
            {
                "id": "children",
                "heading": "7. Children",
                "body_html": (
                    "<p>NPL services are not intended to collect personal information "
                    "from a child contrary to applicable law. Contact NPL if you "
                    "believe a child supplied information without appropriate "
                    "authorisation.</p>"
                ),
            },
            {
                "id": "policy-changes",
                "heading": "8. Changes to this policy",
                "body_html": (
                    "<p>We may update this policy when our services, providers, or "
                    "legal obligations change. The effective date identifies the "
                    "current version.</p>"
                ),
            },
            {
                "id": "contact-us",
                "heading": "9. Contact us",
                "body_html": (
                    '<p>Use the <a href="/support">support page</a> or '
                    '<a href="/contact-us">contact form</a> for privacy requests, '
                    "questions, or complaints.</p>"
                ),
            },
        ],
    },
    "terms": {
        "title": "Terms of Use",
        "subtitle": ("The rules that apply when using NPL Zimbabwe websites, apps, and digital services."),
        "effective_date": "23 July 2026",
        "intro_html": (
            "<p>These terms govern access to npl.co.zw, NPL - Zimbabwe mobile "
            "applications, live scoring, fan accounts, and authorised scoring and "
            "administration tools. By using a service, you agree to these terms.</p>"
        ),
        "sections": [
            {
                "id": "acceptance",
                "heading": "1. Acceptance and eligibility",
                "body_html": (
                    "<p>You must use NPL services lawfully and have the authority to "
                    "accept these terms. Additional rules may apply to competitions, "
                    "credentials, purchases, or promotions.</p>"
                ),
            },
            {
                "id": "accounts",
                "heading": "2. Accounts and authorised access",
                "body_html": (
                    "<ul><li>Provide accurate information and keep it current.</li>"
                    "<li>Keep passwords, devices, and verification codes secure.</li>"
                    "<li>Do not share scorer or administrator accounts.</li>"
                    "<li>Notify NPL promptly if you suspect unauthorised access.</li>"
                    "<li>Use only matches, records, and functions assigned to your "
                    "role.</li></ul><p>We may restrict an account where reasonably "
                    "necessary to protect users, the service, or competition "
                    "integrity.</p>"
                ),
            },
            {
                "id": "scores-and-content",
                "heading": "3. Scores, schedules, and content",
                "body_html": (
                    "<p>Live scores and statistics may change because of scorer "
                    "corrections, official decisions, weather, revised conditions, "
                    "or technical delays. A live score is provisional until the "
                    "result is formally finalised.</p>"
                ),
            },
            {
                "id": "acceptable-use",
                "heading": "4. Acceptable use",
                "body_html": (
                    "<p>You must not bypass security, access another account without "
                    "permission, submit false scores, manipulate records, upload "
                    "malicious code, scrape the service abusively, harass others, or "
                    "use NPL services unlawfully.</p>"
                ),
            },
            {
                "id": "intellectual-property",
                "heading": "5. Intellectual property and permissions",
                "body_html": (
                    "<p>NPL services, branding, designs, databases, written content, "
                    "and software are owned by or licensed to NPL. Team, player, "
                    "sponsor, broadcast, and third-party material remains the property "
                    "of its respective owner.</p>"
                ),
            },
            {
                "id": "merchandise",
                "heading": "6. Merchandise enquiries",
                "body_html": (
                    "<p>A merchandise form is an order enquiry, not necessarily a "
                    "completed sale. Availability, sizing, delivery, price, payment, "
                    "and collection must be confirmed by NPL.</p>"
                ),
            },
            {
                "id": "third-party-services",
                "heading": "7. Third-party services",
                "body_html": (
                    "<p>NPL services may link to services we do not control. Their "
                    "terms and privacy policies apply when you use them.</p>"
                ),
            },
            {
                "id": "availability",
                "heading": "8. Availability, disclaimers, and liability",
                "body_html": (
                    "<p>Services are provided on an “as available” basis. To the "
                    "extent permitted by law, NPL is not liable for indirect, "
                    "incidental, or consequential loss arising solely from use of, "
                    "or inability to use, a digital service.</p>"
                ),
            },
            {
                "id": "terms-changes",
                "heading": "9. Changes to these terms",
                "body_html": (
                    "<p>We may update these terms as the platform or applicable "
                    "requirements change. The effective date identifies the current "
                    "version.</p>"
                ),
            },
            {
                "id": "contact-us",
                "heading": "10. Contact us",
                "body_html": (
                    '<p>Use the <a href="/support">support page</a> or '
                    '<a href="/contact-us">contact form</a> for questions about '
                    "these terms.</p>"
                ),
            },
        ],
    },
    "support": {
        "title": "Support",
        "subtitle": ("Help with NPL Zimbabwe scores, accounts, notifications, scoring, and website services."),
        "effective_date": "",
        "intro_html": (
            "<p>Use the guidance below for common issues. If you still need "
            "assistance, send the NPL team a message and include the page, match, "
            "or account involved.</p>"
        ),
        "sections": [
            {
                "id": "scores-and-fixtures",
                "heading": "Scores and fixtures",
                "body_html": (
                    "<p>Report incorrect match information with the match, innings, "
                    "over or player, the information shown, and the correction you "
                    'believe is needed.</p><p><a href="/contact-us">Report a score '
                    "issue</a></p>"
                ),
            },
            {
                "id": "fan-accounts",
                "heading": "Fan accounts",
                "body_html": (
                    "<p>For sign-in help, check the email used to register and look "
                    "in spam or junk folders for verification messages. Never share "
                    "a password or verification code with support.</p>"
                ),
            },
            {
                "id": "notifications",
                "heading": "Notifications",
                "body_html": (
                    "<p>Follow a team and enable notifications in both the NPL app "
                    "and device settings. Fixture changes can move or cancel "
                    "scheduled reminders.</p>"
                ),
            },
            {
                "id": "live-scoring",
                "heading": "Live-scoring assistance",
                "body_html": (
                    "<p>Include the match name and ID, scorer email, last successfully "
                    "recorded ball, and any error message. Do not send passwords or "
                    "authentication codes.</p>"
                ),
            },
            {
                "id": "admin-access",
                "heading": "Administrator access",
                "body_html": (
                    "<p>Role changes, locked scorecards, and edit-access requests must "
                    "be approved through authorised NPL administrators.</p>"
                ),
            },
            {
                "id": "privacy-choices",
                "heading": "Privacy and account choices",
                "body_html": (
                    '<p>Read the <a href="/privacy">privacy policy</a> or use the '
                    '<a href="/account-deletion">account-deletion page</a> to '
                    "submit a request.</p>"
                ),
            },
            {
                "id": "information-to-include",
                "heading": "Information to include",
                "body_html": (
                    "<ul><li>your name and account email;</li><li>the match, team, "
                    "player, page, or feature affected;</li><li>the approximate date "
                    "and time;</li><li>the device and browser or app version; and</li>"
                    "<li>a screenshot that does not reveal private credentials.</li>"
                    "</ul>"
                ),
            },
        ],
    },
    "account-deletion": {
        "title": "Account Deletion",
        "subtitle": ("Request deletion of an NPL - Zimbabwe fan account and associated personal information."),
        "effective_date": "",
        "intro_html": (
            "<p>You can ask NPL Zimbabwe to delete your fan account. This page "
            "provides an external request method for website and mobile-app users.</p>"
        ),
        "sections": [
            {
                "id": "delete-in-app",
                "heading": "Delete an account in the app",
                "body_html": (
                    "<ol><li>Sign in to NPL - Zimbabwe.</li><li>Open your profile and "
                    "choose Privacy and account.</li><li>Select Delete account and "
                    "review the information shown.</li><li>Confirm the request using "
                    "the account verification step.</li></ol><p>If you cannot sign "
                    "in or the in-app option does not work, submit the form on this "
                    "page.</p>"
                ),
            },
            {
                "id": "what-is-deleted",
                "heading": "What will be deleted",
                "body_html": (
                    "<p>After verification, deletion covers the fan account, profile "
                    "details, supported and followed teams, favourite players, stored "
                    "push tokens, and optional notification preferences.</p>"
                ),
            },
            {
                "id": "retained-information",
                "heading": "Information we may retain",
                "body_html": (
                    "<p>Limited information may be retained for legal compliance, "
                    "fraud and security prevention, dispute resolution, or official "
                    "competition records. Scorer and administrator actions may remain "
                    "in audit and scorecard records.</p>"
                ),
            },
            {
                "id": "verification-and-timing",
                "heading": "Verification and timing",
                "body_html": (
                    "<p>We may contact the account email to confirm identity. We aim "
                    "to complete a verified request within 30 days unless legal or "
                    "operational requirements reasonably require more time.</p>"
                ),
            },
            {
                "id": "before-submitting",
                "heading": "Before submitting",
                "body_html": (
                    "<p>Account deletion is permanent. If you only want to stop "
                    "match alerts, turn off notifications in the app or your device "
                    "settings instead.</p>"
                ),
            },
        ],
    },
    "competition": {
        "title": "Competition Information",
        "subtitle": (
            "A practical guide to NPL Zimbabwe competitions, fixtures, standings, results, and official decisions."
        ),
        "effective_date": "",
        "intro_html": (
            "<p>Use this page as a starting point for NPL Zimbabwe competition "
            "information. Published competition regulations, notices, and official "
            "decisions remain authoritative if they differ from a website summary.</p>"
        ),
        "sections": [
            {
                "id": "competitions-and-seasons",
                "heading": "Competitions and seasons",
                "body_html": (
                    "<p>Competition hubs bring together enrolled teams, fixtures, "
                    "results, standings, and season information. Visit the "
                    '<a href="/mens">men\'s</a>, <a href="/women">women\'s</a>, '
                    'or <a href="/youth">youth</a> hub to explore the current '
                    "competitions.</p>"
                ),
            },
            {
                "id": "fixtures-and-results",
                "heading": "Fixtures and results",
                "body_html": (
                    "<p>Fixture dates, venues, and start times can change. Check the "
                    '<a href="/fixtures">fixtures page</a> before travelling. '
                    "Completed and officially updated matches appear on the "
                    '<a href="/results">results page</a>.</p>'
                ),
            },
            {
                "id": "standings-and-net-run-rate",
                "heading": "Standings and net run rate",
                "body_html": (
                    "<p>Standings are generated from recorded match results and any "
                    "approved competition adjustments. Points, positions, and net run "
                    "rate can change after a scorecard correction or official "
                    "decision. Matches excluded from net run rate by an official "
                    "decision are not included in that calculation.</p>"
                ),
            },
            {
                "id": "playoffs-and-qualification",
                "heading": "Playoffs and qualification",
                "body_html": (
                    "<p>Placeholder playoff fixtures show qualification positions "
                    "until a team is mathematically confirmed. Teams and club marks "
                    "are populated as qualification and preceding playoff results "
                    "become official.</p>"
                ),
            },
            {
                "id": "official-decisions",
                "heading": "Official decisions",
                "body_html": (
                    "<p>Disciplinary findings, abandoned-match determinations, points "
                    "adjustments, eligibility rulings, and other official decisions "
                    "may alter the result or standings. The published decision and "
                    "competition regulations govern the final outcome.</p>"
                ),
            },
            {
                "id": "questions-and-corrections",
                "heading": "Questions and corrections",
                "body_html": (
                    '<p>Read the <a href="/scorecard-corrections">scorecard '
                    "correction process</a> before reporting a score issue. For other "
                    'competition questions, use the <a href="/support">support '
                    "page</a>.</p>"
                ),
            },
        ],
    },
    "safeguarding": {
        "title": "Safeguarding",
        "subtitle": ("How players, officials, volunteers, families, and supporters can raise a safeguarding concern."),
        "effective_date": "",
        "intro_html": (
            "<p>NPL Zimbabwe wants cricket to be safe, respectful, and inclusive. "
            "Safeguarding concerns should be taken seriously and shared through an "
            "appropriate confidential channel.</p>"
        ),
        "sections": [
            {
                "id": "urgent-danger",
                "heading": "If someone is in immediate danger",
                "body_html": (
                    "<p>Contact the emergency services or the appropriate local "
                    "authority first. Do not wait for a website response where urgent "
                    "action is needed. After immediate safety has been addressed, "
                    "notify an authorised NPL or club safeguarding contact.</p>"
                ),
            },
            {
                "id": "what-to-report",
                "heading": "What to report",
                "body_html": (
                    "<p>A concern may involve a child or adult at risk, harassment, "
                    "abuse, bullying, discrimination, unsafe conduct, inappropriate "
                    "communication, retaliation, or a failure to follow safeguarding "
                    "requirements.</p>"
                ),
            },
            {
                "id": "how-to-report",
                "heading": "How to report a concern",
                "body_html": (
                    '<p>Use the <a href="/contact-us">contact form</a> and clearly '
                    "label the message “SAFEGUARDING”. Include only the information "
                    "needed to identify the concern, when and where it happened, who "
                    "may be at risk, and a safe way to contact you. Do not upload or "
                    "circulate sensitive evidence publicly.</p>"
                ),
            },
            {
                "id": "what-happens-next",
                "heading": "What happens next",
                "body_html": (
                    "<p>An authorised person will assess the report, consider immediate "
                    "safety, preserve appropriate confidentiality, and refer the matter "
                    "to the relevant authority or competition process where required. "
                    "Information is shared only where there is a legitimate need.</p>"
                ),
            },
            {
                "id": "privacy-and-records",
                "heading": "Privacy and records",
                "body_html": (
                    "<p>Safeguarding records may be retained where needed to protect "
                    "people, meet legal or regulatory duties, or manage a complaint. "
                    'Read the <a href="/privacy">privacy policy</a> for general '
                    "information about personal data.</p>"
                ),
            },
            {
                "id": "conduct-at-cricket",
                "heading": "Safe conduct at cricket",
                "body_html": (
                    "<p>Follow venue rules, respect personal boundaries, use "
                    "appropriate communication, obtain the required consent for images "
                    "or recordings, and challenge unsafe or discriminatory behaviour "
                    "through the proper channel.</p>"
                ),
            },
        ],
    },
    "scorecard-corrections": {
        "title": "Scorecard Corrections",
        "subtitle": ("How live scores, completed scorecards, player statistics, and standings are corrected."),
        "effective_date": "",
        "intro_html": (
            "<p>Live scores are provisional. Corrections are controlled and audited "
            "so that the public scorecard and official competition records remain "
            "consistent.</p>"
        ),
        "sections": [
            {
                "id": "during-the-match",
                "heading": "Corrections during a match",
                "body_html": (
                    "<p>The assigned scorer can correct a delivery while the scoring "
                    "session is active. The correction should preserve the delivery "
                    "sequence and reconcile the innings total, batter figures, bowler "
                    "figures, extras, wickets, and commentary.</p>"
                ),
            },
            {
                "id": "after-finalisation",
                "heading": "After finalisation",
                "body_html": (
                    "<p>A completed scorecard remains editable by an authorised scorer "
                    "for up to 120 minutes after finalisation. When that period ends, "
                    "the scorecard is locked and a super administrator must approve "
                    "any further correction.</p>"
                ),
            },
            {
                "id": "request-a-correction",
                "heading": "Request a correction",
                "body_html": (
                    '<p>Use the <a href="/contact-us">contact form</a> and label the '
                    "message “SCORECARD CORRECTION”. Include the match, innings, over "
                    "and ball, player, current entry, requested correction, reason, "
                    "and any reliable supporting record.</p>"
                ),
            },
            {
                "id": "approval-and-audit",
                "heading": "Approval and audit trail",
                "body_html": (
                    "<p>Approved post-lock corrections record who requested, approved, "
                    "and applied the change. A request can be declined where the "
                    "evidence is insufficient or the requested change conflicts with "
                    "an official decision.</p>"
                ),
            },
            {
                "id": "downstream-updates",
                "heading": "Statistics and standings updates",
                "body_html": (
                    "<p>After an approved correction, NPL may recalculate player and "
                    "team statistics, match summaries, standings, and net run rate. "
                    "Team totals are not changed when only an individual attribution "
                    "is being corrected.</p>"
                ),
            },
            {
                "id": "official-decisions",
                "heading": "Official competition decisions",
                "body_html": (
                    "<p>An official determination can supersede a scorecard result or "
                    'standings treatment. See <a href="/competition">competition '
                    "information</a> for how these decisions are reflected.</p>"
                ),
            },
        ],
    },
    "supporters": {
        "title": "Supporter Information",
        "subtitle": ("Follow NPL Zimbabwe teams, players, fixtures, results, and match-day updates."),
        "effective_date": "",
        "intro_html": (
            "<p>This guide helps supporters find official competition information, "
            "manage fan preferences, and enjoy NPL cricket responsibly.</p>"
        ),
        "sections": [
            {
                "id": "follow-the-competition",
                "heading": "Follow the competition",
                "body_html": (
                    '<p>Use the <a href="/fixtures">fixtures</a>, '
                    '<a href="/live">live scores</a>, '
                    '<a href="/results">results</a>, and '
                    '<a href="/news">news</a> pages to follow the season. Team '
                    "and player pages bring related information together.</p>"
                ),
            },
            {
                "id": "accounts-and-favourites",
                "heading": "Fan accounts and favourites",
                "body_html": (
                    "<p>Registered supporters can select supported or followed teams "
                    "and favourite players where that feature is available. Keep your "
                    "account email current and never share a password or verification "
                    "code.</p>"
                ),
            },
            {
                "id": "match-reminders",
                "heading": "Match reminders and results",
                "body_html": (
                    "<p>When notifications are enabled, reminders may be sent around "
                    "24 hours and one hour before a followed team's scheduled start, "
                    "with result updates after the match. Late fixture changes, device "
                    "settings, or connectivity can affect delivery, so always check "
                    "the latest fixture.</p>"
                ),
            },
            {
                "id": "match-day-conduct",
                "heading": "Match-day conduct",
                "body_html": (
                    "<p>Respect players, officials, volunteers, other supporters, and "
                    "venue rules. Do not enter restricted areas or publish abusive, "
                    "discriminatory, or unsafe content. Read the "
                    '<a href="/safeguarding">safeguarding page</a> if you need to '
                    "raise a concern.</p>"
                ),
            },
            {
                "id": "merchandise",
                "heading": "Merchandise",
                "body_html": (
                    "<p>Browse available supporter products in the "
                    '<a href="/merchandise">merchandise shop</a>. A quick order is '
                    "an enquiry until availability, price, size, payment, and "
                    "collection or delivery are confirmed.</p>"
                ),
            },
            {
                "id": "support-and-privacy",
                "heading": "Support and privacy",
                "body_html": (
                    '<p>Visit <a href="/support">support</a> for help, read the '
                    '<a href="/privacy">privacy policy</a>, or use the '
                    '<a href="/account-deletion">account-deletion page</a> for an '
                    "account request.</p>"
                ),
            },
        ],
    },
}


def default_site_page_body(slug: SitePageSlug) -> SitePageBody:
    return SitePageBody.model_validate(DEFAULT_SITE_PAGES[slug])
