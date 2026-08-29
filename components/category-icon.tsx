import type { ReactNode } from "react";

import {
  categoryGlyph,
  type CategoryGlyphName,
} from "@/lib/categories";

const ICON_PATHS: Record<CategoryGlyphName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
  bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" />,
  phone: <><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10 5h4M11 18.5h2" /></>,
  cart: <><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
  utensils: <><path d="M7 3v7M4 3v4a3 3 0 0 0 6 0V3M7 10v11" /><path d="M17 3v18M17 3c-2 2-3 4.2-3 7h3" /></>,
  train: <><rect x="5" y="3" width="14" height="15" rx="3" /><path d="M8 7h8M7 12h10M8 21l2-3M16 21l-2-3" /><circle cx="9" cy="15" r="1" /><circle cx="15" cy="15" r="1" /></>,
  car: <><path d="m5 16-1 2v2M19 16l1 2v2M4 14l2-6a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l2 6" /><path d="M3 14h18v4H3zM7 17h.01M17 17h.01" /></>,
  plane: <><path d="M22 2 9.8 14.2" /><path d="m22 2-7.5 19-4.7-6.8L3 9.5 22 2Z" /><path d="M9.8 14.2 9 21l3.6-3.8" /></>,
  health: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /><path d="M7 12h3l1-3 2 6 1-3h3" /></>,
  sparkle: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" /><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14ZM19 13l.7 1.8 1.8.7-1.8.7L19 18l-.7-1.8-1.8-.7 1.8-.7L19 13Z" /></>,
  book: <><path d="M4 4.5A3.5 3.5 0 0 1 7.5 4H12v16H7.5A3.5 3.5 0 0 0 4 20.5v-16Z" /><path d="M20 4.5A3.5 3.5 0 0 0 16.5 4H12v16h4.5a3.5 3.5 0 0 1 3.5.5v-16Z" /></>,
  bag: <><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
  play: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m10 9 5 3-5 3V9Z" /></>,
  repeat: <><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="m7 22-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
  family: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3 20a6 6 0 0 1 12 0M14 16a5 5 0 0 1 7 4" /></>,
  paw: <><circle cx="7" cy="7" r="2" /><circle cx="17" cy="7" r="2" /><circle cx="4.5" cy="12" r="1.7" /><circle cx="19.5" cy="12" r="1.7" /><path d="M8.2 13.2C9.4 11.7 10.5 11 12 11s2.6.7 3.8 2.2c2.2 2.8.3 6.3-3.1 5.2a2.3 2.3 0 0 0-1.4 0c-3.4 1.1-5.3-2.4-3.1-5.2Z" /></>,
  gift: <><path d="M3 10h18v4H3zM5 14h14v7H5zM12 10v11" /><path d="M12 10H7.5a2.5 2.5 0 1 1 2.2-3.7L12 10Zm0 0h4.5a2.5 2.5 0 1 0-2.2-3.7L12 10Z" /></>,
  shield: <><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  receipt: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" /><path d="M9 7h6M9 11h6M9 15h4" /></>,
  bank: <><path d="m3 9 9-6 9 6H3ZM5 20h14M7 9v8M12 9v8M17 9v8M3 17h18" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V4h6v3M3 12h18M10 12v2h4v-2" /></>,
  laptop: <><rect x="5" y="4" width="14" height="11" rx="1.5" /><path d="m2 19 3-4h14l3 4H2ZM10 18h4" /></>,
  chart: <><path d="M4 20V5M4 20h16" /><path d="m7 15 4-4 3 2 5-6M16 7h3v3" /></>,
  refund: <><path d="m9 7-5 5 5 5" /><path d="M4 12h10a6 6 0 0 1 6 6v1" /></>,
  "plus-circle": <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  income: <><path d="M12 3v13M7 11l5 5 5-5" /><path d="M5 20h14" /></>,
};

export function CategoryIcon({ category }: { category: string }) {
  const glyph = categoryGlyph(category);
  return (
    <svg
      className="category-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[glyph]}
    </svg>
  );
}
