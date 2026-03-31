import { NavLink } from 'react-router-dom'

export function AndroidKindleTabBar() {
  return (
    <nav className="android-kindle-tabbar" aria-label="Main navigation">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          isActive ? 'android-kindle-tab android-kindle-tab--active' : 'android-kindle-tab'
        }
      >
        <span className="android-kindle-tab__icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
            <path d="M8 7h8M8 11h5" strokeLinecap="round" />
          </svg>
        </span>
        <span className="android-kindle-tab__label">Library</span>
      </NavLink>
      <NavLink
        to="/photos"
        className={({ isActive }) =>
          isActive ? 'android-kindle-tab android-kindle-tab--active' : 'android-kindle-tab'
        }
      >
        <span className="android-kindle-tab__icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
            <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="android-kindle-tab__label">Photos</span>
      </NavLink>
    </nav>
  )
}
