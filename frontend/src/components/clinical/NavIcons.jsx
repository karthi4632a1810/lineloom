/** Inline SVG icons for navigation (visual only). */
const iconProps = { viewBox: "0 0 24 24", "aria-hidden": true };

export const NavIcons = {
  overview: (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  queue: (
    <svg {...iconProps}>
      <path d="M4 6h16M4 12h16M4 18h10" />
      <circle cx="18" cy="18" r="3" />
    </svg>
  ),
  completed: (
    <svg {...iconProps}>
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  create: (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  records: (
    <svg {...iconProps}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  analytics: (
    <svg {...iconProps}>
      <path d="M4 19V5M10 19V9M16 19v-6M20 19V3" />
    </svg>
  ),
  infographic: (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 14l3-4 3 3 4-6" />
      <circle cx="7" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  menu: (
    <svg {...iconProps}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  search: (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  ),
  bell: (
    <svg {...iconProps}>
      <path d="M18 16V11a6 6 0 10-12 0v5l-2 2h16l-2-2z" />
      <path d="M10 20a2 2 0 004 0" />
    </svg>
  ),
  moon: (
    <svg {...iconProps}>
      <path d="M21 14.5A8.5 8.5 0 1110.5 4 7 7 0 0021 14.5z" />
    </svg>
  ),
  sun: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  chevron: (
    <svg {...iconProps}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  logout: (
    <svg {...iconProps}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
};
