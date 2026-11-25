// Stroke icon set (24×24, currentColor). Equipment icons follow IEC 60617 symbol shapes.
const s = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const IC = {
  overview: s('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  findings: s('<path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/>'),
  schedule: s('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h3v3"/>'),
  equipment: s('<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>'),
  sld: s('<path d="M3 5h18M3 19h18"/><path d="M8 5v4M8 15v4M16 5v4M16 15v4"/><rect x="6" y="9" width="4" height="6" rx=".8"/><rect x="14" y="9" width="4" height="6" rx=".8"/>'),
  bushing: s('<path d="M12 2v4"/><path d="M8 6h8l-1 3H9z"/><path d="M9 9h6l-1 3h-4zM10 12h4l-.6 3h-2.8z"/><path d="M12 15v7"/>'),
  winding: s('<path d="M5 4c3 0 3 3 0 3s-3 3 0 3 3 3 0 3-3 3 0 3 3 3 0 3"/><path d="M14 4h6M14 20h6M17 4v16"/>'),
  dga: s('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 14h9"/>'),
  ct: s('<circle cx="12" cy="12" r="6"/><path d="M2 12h20"/>'),
  cb_crm: s('<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M12 2v5M12 17v5"/><path d="M10 12h4"/>'),
  cb_timing: s('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'),
  la: s('<path d="M12 2v5"/><rect x="8" y="7" width="8" height="10" rx="1"/><path d="M12 9.5l-1.5 3h3l-1.5 3"/><path d="M12 17v2M8 21h8M10 23h4"/>'),
  norms: s('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h7M9 16h7M9 8h3"/>'),
  standards: s('<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="18" cy="18" r="2.5"/>'),
  data: s('<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13"/><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>'),
  roadmap: s('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  search: s('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  theme: s('<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>'),
  print: s('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>'),
  menu: s('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  doc: s('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/>'),
  arrow: s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  ext: s('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>'),
};
export const LOGO = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="12" r="5.2"/><circle cx="15" cy="12" r="5.2" stroke="#f2a900"/><path d="M1.5 12h2.3M20.2 12h2.3"/></svg>`;
