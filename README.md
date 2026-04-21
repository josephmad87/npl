# Software Requirements Specification (SRS)

## Zimbabwe Cricket National Premier League (NPL) Digital Platform

## 1. Introduction

### 1.1 Purpose

This document defines the software requirements for the Zimbabwe Cricket National Premier League (NPL) digital platform. The platform will provide a public-facing website, an internal admin dashboard, and a backend API/CMS used to manage and publish league content and competition data.

The platform will support the management and presentation of:

- Teams across Men, Women, and Youth divisions
- Players and player statistics
- Leagues, fixtures, matches, and results
- News articles
- Media gallery containing videos and images

This SRS is intended for founders, product managers, designers, software engineers, QA engineers, DevOps engineers, and future implementation agents.

### 1.2 Product Scope

The Zimbabwe Cricket NPL digital platform will serve as the official digital system for publishing league information and managing competition operations.

The solution consists of three main applications:

1. **Public Website** – for fans, media, players, and stakeholders to view league information
2. **Admin Dashboard** – for internal staff to manage content and competition data
3. **Backend API/CMS** – built with FastAPI to provide content management, business logic, data access, and integrations

The platform aims to:

- Provide an official source of truth for NPL content and match data
- Improve communication and visibility of league activities
- Centralize management of teams, players, fixtures, results, and media
- Support future expansion such as live scoring integrations, sponsorship modules, ticketing, and player performance analytics

### 1.3 Definitions, Acronyms, and Abbreviations

- **NPL**: National Premier League
- **CMS**: Content Management System
- **API**: Application Programming Interface
- **Admin App**: Internal dashboard for operational management
- **Public Website**: Public-facing platform consumed by fans and external users
- **Fixture**: Scheduled match
- **Result**: Official outcome of a match
- **TanStack**: Frontend toolkit used for routing, data fetching, and state/table patterns
- **Vite**: Frontend build tool
- **FastAPI**: Python web framework for the backend API
- **RBAC**: Role-Based Access Control

### 1.4 References

This specification is based on standard modern web application design practices for sports league platforms and assumes a modular, API-first architecture.

### 1.5 Overview

The remainder of this document defines the platform architecture, user roles, features, data requirements, quality attributes, integration assumptions, constraints, and acceptance criteria.

---

## 2. Overall Description

### 2.1 Product Perspective

The NPL platform is a new system composed of:

- A **FastAPI backend** acting as the CMS and system of record
- A **public website** built with React, Vite, and TanStack
- An **admin dashboard** built with React, Vite, and TanStack

The API will expose secure endpoints for the admin application and public read endpoints for the website. The backend will manage authentication, authorization, content workflows, media management, and competition data.

### 2.2 Product Functions

The platform will provide the following high-level capabilities:

- Manage teams by division/category
- Manage player profiles and statistics
- Manage leagues, seasons, fixtures, matches, and results
- Publish and manage news content
- Upload and organize image and video galleries
- Present standings, schedules, and match information to the public
- Provide role-based administration for editors, league managers, and super admins

### 2.3 User Classes and Characteristics

#### 2.3.1 Public Users

Users who visit the website to consume information.
Capabilities:

- View teams, players, fixtures, results, news, and gallery
- Search and filter content
- Access league tables and match details

#### 2.3.2 Content Editors

Internal users responsible for news and media content.
Capabilities:

- Create, edit, publish, and archive news articles
- Upload and manage gallery items
- Manage tags, categories, and featured content

#### 2.3.3 Competition Managers

Internal users responsible for league operations.
Capabilities:

- Manage teams, players, leagues, fixtures, matches, and results
- Update player stats and match outcomes
- Manage standings-related source data

#### 2.3.4 Super Administrators

System-level users with full platform control.
Capabilities:

- Full access to all modules
- Manage users and permissions
- Configure platform settings
- Audit system activity

### 2.4 Operating Environment

#### Backend

- Python 3.12+
- FastAPI
- PostgreSQL
- Object/file storage for images and video metadata
- Redis (optional) for caching and background jobs

#### Frontend

- React
- Vite
- TanStack Router
- TanStack Query
- TanStack Table
- TypeScript

#### Deployment

- Linux-based cloud VPS or container environment
- Reverse proxy such as Nginx or Caddy
- Docker-based deployment preferred

### 2.5 Design and Implementation Constraints

- Backend framework must be **FastAPI**
- Public website and admin dashboard must use **React + Vite + TanStack**
- System must support structured content workflows and RBAC
- Platform must be responsive and mobile-friendly
- API must be designed for future extension such as mobile apps and third-party integrations

### 2.6 User Documentation

The system should eventually provide:

- Admin onboarding guide
- Content editor guide
- Competition operations guide
- API documentation via OpenAPI/Swagger

### 2.7 Assumptions and Dependencies

- Official league data will be entered by authorized personnel unless a live scoring integration is added later
- Media files may be stored externally while the CMS stores metadata and references
- Initial version supports English only unless multilingual requirements are introduced later

---

## 3. System Architecture

### 3.1 High-Level Architecture

The platform will follow an API-first architecture:

1. **FastAPI Backend / CMS**
  - Authentication and authorization
  - CRUD for all core entities
  - Media metadata management
  - Public and admin API endpoints
  - Validation and business logic
2. **Admin Dashboard**
  - Secure internal application
  - Uses authenticated API endpoints
  - Supports content and league operations management
3. **Public Website**
  - Public consumption interface
  - Uses public API endpoints
  - SEO-friendly pages for discoverability

### 3.2 Suggested Architectural Style

- Modular monolith for initial release
- Clear domain modules:
  - Auth & Users
  - Teams
  - Players
  - Leagues
  - Matches & Results
  - News
  - Gallery
  - Media
  - Audit Logs
  - Settings

### 3.3 Environments

- Local development
- Staging
- Production

---

## 4. Functional Requirements

## 4.1 Authentication and Authorization

### 4.1.1 Admin Authentication

The system shall allow admin users to sign in securely.

#### Requirements

- Admin users shall log in using email and password
- Passwords shall be securely hashed
- Session handling shall use secure token-based authentication
- Access tokens and refresh tokens should be supported
- Failed login attempts should be logged

### 4.1.2 Role-Based Access Control

The system shall restrict features based on user roles.

#### Roles

- Super Admin
- Competition Manager
- Content Editor
- Read-only Admin (optional)

#### Requirements

- The system shall authorize access per module and action
- The system shall prevent unauthorized create, edit, delete, publish, and settings actions
- The system shall support future fine-grained permissions

---

## 4.2 Teams Module

### 4.2.1 Team Management

The system shall allow admins to manage teams.

#### Team Fields

- Team ID
- Name
- Slug
- Category/Division (Men, Women, Youth)
- Short name
- Logo
- Cover image
- Description
- Home ground
- Coach
- Captain
- Year founded
- Status (active/inactive)
- Social links (optional)

#### Functional Requirements

- Admins shall create teams
- Admins shall update team details
- Admins shall archive or deactivate teams
- Admins shall upload team logo and cover image
- Teams shall be categorized by Men, Women, or Youth
- Teams shall be searchable and filterable in admin
- Public users shall view team lists and team detail pages

### 4.2.2 Team Public Display

- The website shall display all active teams
- The website shall allow filtering by category/division
- Each team page shall show summary information, players, fixtures, results, and related media where applicable

---

## 4.3 Players Module

### 4.3.1 Player Management

The system shall allow admins to manage player profiles.

#### Player Fields

- Player ID
- Full name
- Slug
- Profile photo
- Team
- Category/Division
- Date of birth
- Nationality
- Role (Batsman, Bowler, All-rounder, Wicketkeeper, etc.)
- Batting style
- Bowling style
- Jersey number
- Bio
- Debut information (optional)
- Status (active/inactive/injured/unavailable)

#### Functional Requirements

- Admins shall create player records
- Admins shall assign players to teams
- Admins shall update player details and status
- Admins shall upload profile photos
- Admins shall archive inactive players
- Public users shall browse player profiles
- Public users shall search players by name, team, role, or category

### 4.3.2 Player Statistics

The system shall store and display player statistics.

#### Example Stats Fields

- Matches played
- Runs scored
- Batting average
- Strike rate
- Highest score
- Wickets taken
- Bowling average
- Economy rate
- Best bowling figures
- Catches
- Stumpings
- Player of the match awards

#### Functional Requirements

- Admins shall update player stats manually or via match-result workflows
- The system should support stats aggregation from match records in future versions
- The website shall display player stats on player profile pages
- The website shall support leaderboards such as top run scorers and top wicket takers

---

## 4.4 Leagues and Seasons Module

### 4.4.1 League Management

The system shall support the creation and management of leagues and seasons.

#### League Fields

- League ID
- Name
- Slug
- Description
- Category/Division
- Season name or year
- Start date
- End date
- Logo/banner
- Status (upcoming, active, completed, archived)

#### Functional Requirements

- Admins shall create leagues/seasons
- Admins shall edit league metadata
- Admins shall associate teams with leagues
- Admins shall define status per league
- The website shall display league overview pages

### 4.4.2 Standings / Table Support

The system shall support league standings.

#### Example Table Fields

- Team
- Matches played
- Wins
- Losses
- Ties/No result
- Points
- Net run rate
- Position

#### Functional Requirements

- The system shall allow standings to be computed from results or managed manually depending on implementation mode
- The website shall display standings for active and completed leagues
- Standings shall be filterable by category/division and season

---

## 4.5 Fixtures, Matches, and Results Module

### 4.5.1 Fixture Management

The system shall allow admins to manage fixtures.

#### Fixture/Match Fields

- Match ID
- League/Season
- Category/Division
- Home team / Team A
- Away team / Team B
- Match title
- Venue
- Date
- Start time
- Toss information (optional)
- Umpires (optional)
- Match status (scheduled, live, completed, postponed, abandoned, cancelled)
- Match description/notes
- Cover image/banner (optional)

#### Functional Requirements

- Admins shall create fixtures
- Admins shall edit fixture details
- Admins shall reschedule fixtures
- Admins shall change match status
- Admins shall assign match venue and date/time
- The website shall display fixture lists and match details
- The website shall support filtering by team, league, season, date, and category

### 4.5.2 Result Management

The system shall allow admins to record match results.

#### Result Fields

- Winning team
- Margin/result text
- Score summary
- Innings breakdown
- Top performers
- Player of the match
- Result status
- Match report (optional)

#### Functional Requirements

- Admins shall enter official results for completed matches
- Admins shall update result details after verification
- The system shall preserve an audit trail for result changes
- The website shall display completed match results
- The system should support match reports linked to completed matches

### 4.5.3 Match Detail Pages

The public website shall provide detailed match pages containing:

- Fixture information
- Teams
- Venue and schedule
- Status
- Result summary
- Linked match report if available
- Related photos/videos if available

---

## 4.6 News Module

### 4.6.1 Article Management

The system shall allow content editors and admins to manage news articles.

#### Article Fields

- Article ID
- Title
- Slug
- Summary/excerpt
- Body content (rich text)
- Featured image
- Author
- Publish status (draft, scheduled, published, archived)
- Category
- Tags
- SEO title
- SEO description
- Published date
- Related entities (team, player, league, match)

#### Functional Requirements

- Editors shall create draft articles
- Editors shall edit article content
- Editors shall schedule or publish articles
- Editors shall archive articles
- Editors shall upload/select featured images
- Editors shall assign categories and tags
- The website shall show article listing pages and article detail pages
- The website shall support featured news sections and latest news widgets

### 4.6.2 Editorial Workflow

- Draft articles shall not be visible publicly
- Published articles shall be visible on the website
- Scheduled publishing should be supported if background jobs are enabled
- The system should support preview mode for unpublished articles

---

## 4.7 Gallery Module

### 4.7.1 Gallery Item Management

The system shall allow admins to manage media gallery entries.

#### Gallery Fields

- Media ID
- Title
- Slug (optional)
- Description/caption
- Media type (image/video)
- File URL or embed URL
- Thumbnail
- Uploaded by
- Created date
- Publish status
- Tags
- Related entities (team, player, league, match, article)

#### Functional Requirements

- Admins shall upload image metadata and references
- Admins shall upload video metadata or embed links
- Admins shall organize gallery items by type and tags
- Admins shall publish/unpublish gallery items
- The website shall provide gallery listing and detail views
- The website shall support filtering by media type, tag, league, team, or season where applicable

### 4.7.2 Media Presentation

- Images shall be viewable in responsive galleries
- Videos shall support embedded playback if hosted externally
- Gallery pages shall load optimized thumbnails where available

---

## 4.8 Search and Discovery

### 4.8.1 Public Search

The website shall support search across major public entities.

#### Search Scope

- Teams
- Players
- Leagues
- Fixtures
- Results
- News articles
- Gallery items

#### Functional Requirements

- Public users shall search via keyword
- Search results shall be grouped or filterable by content type
- Search should support pagination

### 4.8.2 Admin Search and Filters

The admin dashboard shall provide fast search and filter controls for all major modules.

---

## 4.9 User and Admin Management

### 4.9.1 Admin Users

The system shall manage internal users.

#### Requirements

- Super admins shall create admin users
- Super admins shall assign roles
- Super admins shall deactivate users
- The system shall log user creation, role changes, and deactivation actions

---

## 4.10 Audit Logs

The system shall store audit logs for critical admin actions.

#### Audit Events

- Login attempts
- Entity creation
- Entity updates
- Entity deletion/archive
- Publishing/unpublishing actions
- Permission changes
- Result modifications

#### Requirements

- Audit entries shall include actor, action, entity type, entity ID, timestamp, and summary of changes where practical
- Super admins shall be able to view audit logs in admin

---

## 4.11 Public Website Pages

The website shall include at minimum:

- Home page
- News listing and article pages
- Teams listing and team detail pages
- Players listing and player detail pages
- Leagues listing and league detail pages
- Fixtures page
- Results page
- Match detail page
- Gallery listing page
- About/Contact pages (optional but recommended)

### 4.11.1 Home Page

The home page should support:

- Hero/banner
- Featured news
- Upcoming fixtures
- Latest results
- League standings snapshot
- Featured gallery items
- Sponsor/partner sections (future-ready)

---

## 5. External Interface Requirements

## 5.1 User Interfaces

### 5.1.1 Public Website

- Responsive design for desktop, tablet, and mobile
- SEO-friendly routing and metadata
- Clear navigation by content type
- Fast-loading pages and optimized media delivery

### 5.1.2 Admin Dashboard

- Secure login
- Sidebar or top navigation for modules
- Tables with sorting, filtering, and pagination
- Rich forms for content editing
- Media selection/upload workflows
- Draft/publish indicators and validation messages

## 5.2 Software Interfaces

- PostgreSQL database
- Object storage or CDN for media
- Email service for admin auth workflows or notifications (optional)
- Future integration points:
  - Live scoring system
  - Social media feeds
  - Sponsorship ad management
  - CRM/newsletter tools

## 5.3 Communications Interfaces

- HTTPS for all environments except local development
- RESTful JSON API initially
- OpenAPI documentation exposed for internal development

---

## 6. API Requirements

## 6.1 API Design Principles

- RESTful resource-oriented endpoints
- Versioned API, e.g. `/api/v1`
- Clear separation of public and admin endpoints where appropriate
- Input validation via Pydantic models
- Consistent error response structure
- Pagination for collection endpoints
- Filtering, sorting, and search for list endpoints

## 6.2 Core API Resource Areas

- Auth
- Users
- Teams
- Players
- Player Stats
- Leagues
- Seasons
- Fixtures/Matches
- Results
- Standings
- News Articles
- Gallery
- Media
- Audit Logs
- Settings

## 6.3 Example Endpoint Groups

### Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### Teams

- `GET /api/v1/public/teams`
- `GET /api/v1/public/teams/{slug}`
- `POST /api/v1/admin/teams`
- `PATCH /api/v1/admin/teams/{id}`
- `DELETE /api/v1/admin/teams/{id}`

### Players

- `GET /api/v1/public/players`
- `GET /api/v1/public/players/{slug}`
- `POST /api/v1/admin/players`
- `PATCH /api/v1/admin/players/{id}`

### Leagues and seasons

- `GET /api/v1/public/leagues`
- `GET /api/v1/public/leagues/{slug}` (includes non-archived season summaries)
- `GET /api/v1/public/leagues/{league_slug}/seasons`
- `GET /api/v1/public/leagues/{league_slug}/seasons/{season_slug}` (includes `team_ids`)
- `POST /api/v1/admin/leagues`
- `PATCH /api/v1/admin/leagues/{id}`
- `GET /api/v1/admin/seasons` (optional `league_id` query)
- `GET /api/v1/admin/leagues/{id}/seasons`
- `POST /api/v1/admin/leagues/{id}/seasons`
- `PATCH /api/v1/admin/seasons/{id}`

### Fixtures and Results

- `GET /api/v1/public/fixtures` (optional `season_id` or `league_id` filter)
- `GET /api/v1/public/results` (optional `season_id` or `league_id` filter)
- `GET /api/v1/public/matches/{id}`
- `POST /api/v1/admin/matches`
- `PATCH /api/v1/admin/matches/{id}`
- `POST /api/v1/admin/matches/{id}/result`

### News

- `GET /api/v1/public/news`
- `GET /api/v1/public/news/{slug}`
- `POST /api/v1/admin/news`
- `PATCH /api/v1/admin/news/{id}`
- `POST /api/v1/admin/news/{id}/publish`

### Gallery

- `GET /api/v1/public/gallery`
- `POST /api/v1/admin/gallery`
- `PATCH /api/v1/admin/gallery/{id}`

## 6.4 API Response Characteristics

- Collections shall return paginated results
- Responses shall include metadata where necessary
- Errors shall include machine-readable code and human-readable message

---

## 7. Data Requirements

## 7.1 Core Entities

Primary entities include:

- User
- Role
- Team
- Player
- PlayerStat
- League
- Season
- SeasonTeam
- Match
- MatchResult
- Standing
- Article
- GalleryItem
- MediaAsset
- AuditLog
- Tag
- Category

## 7.2 Entity Relationships

- A team belongs to one category/division and may appear on many season rosters over time
- A player belongs to one team at a time in the initial version
- A league is a long-lived competition; it has many seasons; each season has its own team roster (`season_teams`)
- A match belongs to one season (and therefore one league) and references two teams
- A match may have one official result
- An article may relate to multiple entities
- A gallery item may relate to multiple entities

## 7.3 Data Integrity Rules

- Slugs shall be unique within entity type
- Published content must satisfy required validation before going live
- Players must be linked to a valid team unless intentionally marked free agent/unassigned in future versions
- Results cannot be finalized without a completed match status

---

## 8. Non-Functional Requirements

## 8.1 Performance

- Public pages should load quickly under standard mobile and desktop conditions
- Collection endpoints should support pagination to prevent heavy payloads
- Frequently accessed public data should be cacheable

## 8.2 Security

- Admin routes shall require authentication
- Sensitive actions shall require authorization checks
- Passwords shall never be stored in plain text
- The API shall validate and sanitize input
- File upload paths and metadata must be handled securely
- Rate limiting should be considered for authentication and public API abuse protection

## 8.3 Reliability and Availability

- The system should be designed for high uptime during league operations
- Backups shall be scheduled for the database
- Media references should degrade gracefully if unavailable

## 8.4 Scalability

- Initial architecture may be a modular monolith
- The system shall be structured to allow future extraction of services if traffic or complexity grows
- CDN/media optimization should be possible without architectural rewrites

## 8.5 Maintainability

- Codebase shall be modular and well-documented
- Shared types/contracts should be maintained between frontend and backend where practical
- API documentation shall be generated and kept current

## 8.6 Usability

- Admin workflows should minimize operational friction
- Forms should provide validation and helpful error messaging
- Public website should be intuitive for general sports audiences

## 8.7 Accessibility

- Frontend applications should target accessible semantic markup
- Basic keyboard navigation and readable color contrast should be supported

## 8.8 SEO

- The public website shall support metadata per page
- News and public content pages shall use crawlable URLs
- Structured data support is recommended for future enhancement

---

## 9. Suggested Frontend Requirements

## 9.1 Public Website Frontend

### Recommended Structure

- React + TypeScript + Vite
- TanStack Router for routing
- TanStack Query for data fetching and caching
- Component-based page architecture

### Website Features

- Home page with dynamic sections
- Listings with filters and pagination
- Detail pages for each major entity
- SEO metadata handling
- Responsive media rendering

## 9.2 Admin Dashboard Frontend

### Recommended Structure

- React + TypeScript + Vite
- TanStack Router
- TanStack Query
- TanStack Table for management tables
- Form library of choice for complex data entry

### Admin Features

- Secure auth flows
- CRUD interfaces for all entities
- List/detail/create/edit pages
- Publish workflows
- Media manager integration
- Audit log views

---

## 10. Suggested Backend Requirements

## 10.1 FastAPI Backend

### Suggested Components

- API routers by domain module
- Service layer for business logic
- Repository/data access layer
- Pydantic schemas for validation
- ORM layer such as SQLAlchemy or SQLModel
- Alembic for migrations
- Background jobs for scheduled publication and maintenance tasks if needed

### Suggested Internal Modules

- `auth`
- `users`
- `teams`
- `players`
- `leagues`
- `matches`
- `results`
- `news`
- `gallery`
- `media`
- `audit`
- `settings`

---

## 11. Reporting and Analytics Requirements

Initial reporting needs may include:

- Number of published articles
- Number of active teams and players
- Upcoming fixtures count
- Completed matches count
- Gallery item counts
- Admin activity overview

Future reporting may include:

- Most viewed articles
- Player statistical rankings
- Team performance summaries
- Traffic and engagement analytics

---

## 12. Error Handling Requirements

- The API shall return structured validation errors
- The admin UI shall show actionable error states
- Public website failures shall degrade gracefully and avoid blank pages where possible
- Logs shall capture backend exceptions with sufficient detail for troubleshooting

---

## 13. Logging and Monitoring Requirements

- Backend application logs
- Request/response monitoring for production
- Error tracking integration recommended
- Audit logging for admin activities
- Health check endpoints recommended

---

## 14. Backup and Recovery Requirements

- Database backups shall be scheduled regularly
- Media storage strategy shall support persistence and restoration
- Recovery procedures should be documented before production launch

---

## 15. Future Scope Considerations

The architecture should remain extensible for:

- Live scoring integrations
- Match ball-by-ball commentary
- Ticketing
- Sponsorship and advertising inventory
- Email/newsletter campaigns
- Mobile apps
- Fan accounts and personalization
- Fantasy league features
- Multi-language support
- Push notifications
- Streaming integrations

---

## 16. Acceptance Criteria Summary

The first production-ready release shall be considered acceptable when:

- Admin users can authenticate securely
- Teams, players, leagues, fixtures, results, news, and gallery items can be managed in admin
- Public website displays published content correctly
- Filtering and search work for major public modules
- Permissions are enforced for admin actions
- API documentation is available
- Core entities are persisted reliably in the database
- The platform is responsive and usable across modern devices

---

## 17. Recommended MVP Scope

To reach an efficient first release, the MVP should include:

- Admin authentication and RBAC
- Team management
- Player management with core stats
- League and season management
- Fixtures and results management
- News publishing
- Gallery management
- Public website for browsing all published data
- Basic admin reporting and audit logs

Out of scope for MVP unless explicitly added:

- Live scoring engine
- Fan user accounts
- Payments/ticketing
- Streaming platform integration
- Advanced analytics dashboards

---

## 18. Final Recommendation

Build the NPL platform as an **API-first modular monolith** using **FastAPI + PostgreSQL** for the CMS/backend, with two separate frontend applications built in **React + Vite + TanStack**:

1. **Public Website** optimized for discoverability, responsiveness, and sports content browsing
2. **Admin Dashboard** optimized for efficient operational workflows and structured content management

This approach gives the league a strong operational backbone, a clean public presence, and a future-proof foundation for advanced sports-tech capabilities later.

---

## 19. Suggested Next Documents

After this SRS, the following documents should be created:

1. Product Requirements Document (PRD)
2. System Architecture Document
3. Database Schema Specification
4. API Endpoint Specification
5. Admin UX Flow Document
6. Website Information Architecture
7. RBAC and Permission Matrix
8. Deployment and DevOps Specification
9. QA Test Plan
10. Cursor prompt pack for backend, website, and admin app generation

