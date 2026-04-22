import { Link } from '@tanstack/react-router'
import nplLogoUrl from './assets/logo.jpeg'

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-shell">
        <div className="utility-row">
          <div className="utility-controls">
            <input type="search" placeholder="Search" aria-label="Search" />
          </div>
        </div>
        <nav className="main-nav nav-row" aria-label="Main">
          <Link to="/" className="site-brand site-brand--inline" aria-label="NPL home">
            <img src={nplLogoUrl} alt="NPL logo" />
          </Link>
          <Link to="/">Home</Link>

          <div className="menu-item">
            <button type="button">Mens</button>
            <div className="dropdown">
              <a href="#">Fixtures</a>
              <a href="#">Results</a>
              <div className="dropdown-group">
                <span>Seasons</span>
                <a href="#">Current Season</a>
                <a href="#">2025</a>
                <a href="#">2024</a>
              </div>
              <div className="dropdown-group">
                <span>Teams</span>
                <a href="#">Eagles</a>
                <a href="#">Rhinos</a>
                <a href="#">Lions</a>
                <a href="#">Panthers</a>
              </div>
            </div>
          </div>

          <div className="menu-item">
            <button type="button">Ladies</button>
            <div className="dropdown">
              <a href="#">Fixtures</a>
              <a href="#">Results</a>
              <div className="dropdown-group">
                <span>Teams</span>
                <a href="#">Queens</a>
                <a href="#">Warriors</a>
                <a href="#">Falcons</a>
              </div>
            </div>
          </div>

          <div className="menu-item">
            <button type="button">Youth</button>
            <div className="dropdown">
              <a href="#">Fixtures</a>
              <a href="#">Results</a>
              <div className="dropdown-group">
                <span>Teams</span>
                <a href="#">U19 Eagles</a>
                <a href="#">U19 Rhinos</a>
                <a href="#">U19 Lions</a>
              </div>
            </div>
          </div>

          <Link to="/">News</Link>
          <a href="#">Center</a>
          <div className="menu-item">
            <button type="button">Gallery</button>
            <div className="dropdown">
              <a href="#">Images</a>
              <a href="#">Video</a>
            </div>
          </div>
          <a href="#">About Us</a>
        </nav>
      </div>
    </header>
  )
}
