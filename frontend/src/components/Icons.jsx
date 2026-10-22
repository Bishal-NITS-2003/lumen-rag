import React from 'react';

const icon = (path, viewBox = '0 0 24 24') => ({ size = 16, color = 'currentColor', style, strokeWidth = 1.8 } = {}) => (
  <svg width={size} height={size} viewBox={viewBox} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
    {path}
  </svg>
);

export const IconLumen = ({ size = 28, style } = {}) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={style} aria-hidden>
    <rect width="32" height="32" rx="9" fill="url(#lg)" />
    <path d="M16 7v4M16 21v4M7 16h4M21 16h4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="16" r="4.5" fill="#fff" fillOpacity="0.18" stroke="#fff" strokeWidth="1.6" />
    <circle cx="16" cy="16" r="2" fill="#fff" />
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4f46e5" />
        <stop offset="1" stopColor="#7c3aed" />
      </linearGradient>
    </defs>
  </svg>
);

export const IconPlus         = icon(<><path d="M12 5v14M5 12h14" /></>);
export const IconTrash        = icon(<><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></>);
export const IconSearch       = icon(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" /></>);
export const IconSend         = icon(<><path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z" /></>);
export const IconSun          = icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></>);
export const IconMoon         = icon(<><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></>);
export const IconYoutube      = icon(<><rect x="2" y="5" width="20" height="14" rx="3" /><path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none" /></>);
export const IconGlobe        = icon(<><circle cx="12" cy="12" r="9" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10Z" /></>);
export const IconCheck        = icon(<><path d="M20 6 9 17l-5-5" /></>);
export const IconChevronRight = icon(<><path d="m9 18 6-6-6-6" /></>);
export const IconLink         = icon(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>);
export const IconDatabase     = icon(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M21 5v14c0 1.66-4 3-9 3s-9-1.34-9-3V5" /></>);
export const IconZap          = icon(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>);
export const IconBook         = icon(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" /></>);
export const IconCpu          = icon(<><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" /></>);
export const IconPlayCircle   = icon(<><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></>);
export const IconFileText     = icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8L14 2ZM14 2v6h6M16 13H8M16 17H8M10 9H8" /></>);
export const IconMessageSquare= icon(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" /></>);
export const IconLoader       = icon(<><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></>);
export const IconSparkles     = icon(<><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" /></>);
export const IconUpload       = icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></>);
export const IconRadio        = icon(<><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></>);
export const IconHelpCircle   = icon(<><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></>);
export const IconX            = icon(<><path d="M18 6 6 18M6 6l12 12" /></>);
export const IconEdit         = icon(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>);
export const IconExternalLink = icon(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" /></>);
export const IconArrowLeft    = icon(<><path d="m12 19-7-7 7-7M19 12H5" /></>);
export const IconCopy         = icon(<><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>);
export const IconLayers       = icon(<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>);

export default {};
