# WDWShiftX Design System

**Last Updated:** January 19, 2026  
**Status:** Final (v1.0)

---

## Typography

| Element | Value | Notes |
|---------|-------|-------|
| Primary Font | [Lato](https://fonts.google.com/specimen/Lato) | Body text, UI elements |
| Accent Font | [Philosopher](https://fonts.google.com/specimen/Philosopher) | Headings, emphasis |

**Import in `app/layout.tsx`:**
```tsx
import { Lato, Philosopher } from 'next/font/google';
```

---

## Color Palette

### Core Colors

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Primary** | `#BD80FF` | `269, 50%, 100%` | CTAs, links, interactive elements |
| **Primary Light** | `#F2E6FF` | — | Hover states, subtle backgrounds |
| **Secondary** | `#DEBFFF` | — | Secondary actions, borders |
| **Accent** | `#FFEA80` | `50, 50%, 100%` | Highlights, badges, alerts |
| **Text** | `#2F2040` | — | Body text, headings |

### Semantic Colors

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Success** | `#9BE673` | `99, 50%, 90%` | Shift giveaways, success states |
| **Info** | `#80D4FF` | `200, 50%, 100%` | Trade badges, informational alerts |
| **Warning** | `#EE808A` | `355, 50%, 100%` | OT Approved badges, warnings |

---

## Accessibility

- **Contrast Ratio:** Minimum 7:1 (WCAG 2.1 AA+)
- **Touch Targets:** Minimum 44x44px
- **Focus States:** Visible keyboard focus indicators required

---

## Implementation

See `tailwind.config.ts` for Tailwind CSS integration.
