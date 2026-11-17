<!-- impeccable:design-schema 1 -->

# Aura SMM — Design System & Engineering Guidelines

This document synthesizes **Impeccable**, **Emil Kowalski's Design Engineering**, and **Taste Skill 2.5 (Anti-Slop)** into enforceable rules for Aura SMM.

---

## 1. Color System & Palettes

| Token | Hex | Role | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas** | `#F8F9FD` | Page Background | Subtle cool-gray canvas that softens glare |
| **Card Surface** | `#FFFFFF` | Primary Elev. | White cards with crisp 1px borders |
| **Border Default** | `#DEE0ED` | Structural Divider | 1px border on cards, inputs, and tab bars |
| **Text Primary** | `#252943` | Deep Navy Heading | High-contrast readability, never pure black |
| **Text Muted** | `#252943`/60 | Subtext & Labels | Captions, secondary timestamps, hints |
| **Primary Accent** | `#3A4EFB` | Electric Cobalt | CTAs, active states, focus rings, links |
| **Primary Hover** | `#2C3FE0` | Deep Cobalt | Darkened state on hover/active |
| **Brand Contrast** | `#E3FF3B` | Electric Lime | Admin badges, high-priority highlights |
| **Emerald (Success)** | `#10B981` | Safe / Active | Anti-bot status, verified transactions |
| **Rose (Likes)** | `#F43F5E` | Heart Engagement | Likes metrics, active like wave counters |
| **Amber (Saves/Warn)**| `#F59E0B` | Bookmark / Alert | Saves counters, provider low-balance alerts |
| **Purple (Shares)** | `#8B5CF6` | Reposts Metric | Shares and viral distribution counters |

---

## 2. Typography & Optical Alignment

1. **System Font Stack**:
   - `var(--font-inter, system-ui), system-ui, -apple-system, sans-serif`
   - Letter-spacing: `-0.011em` for tighter, confident readability.
2. **Tabular Numerics**:
   - Every metric, countdown, price, balance, and batch quantity strictly uses `font-mono tracking-tight` (`font-variant-numeric: tabular-nums lining-nums`). Numbers never jitter or shift column widths when incrementing.
3. **Hierarchy**:
   - Page Titles: `text-xl font-extrabold text-[#252943]`
   - Section Headers: `text-sm font-bold text-[#252943]`
   - Metric Values: `text-base sm:text-2xl font-black font-mono`
   - Badges & Chips: `text-[10px] sm:text-xs font-black uppercase tracking-wider`

---

## 3. Emil Kowalski Interaction Rules (`emil-design-eng`)

1. **Explicit Property Transitions**:
   - Never use `transition: all`. Always specify:
     ```css
     transition: transform 0.14s var(--ease-out), background-color 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
     ```
2. **Tactile Feedback (`press-scale`)**:
   - Every button, card, and clickable element scales down on press (`active:scale-[0.98]` or `active:scale-[0.97]`).
   - The interface must confirm it heard the user's touch/click immediately.
3. **No Jarring Animations on High-Frequency Actions**:
   - Keyboard typing, instant search filtering, and dropdown selects react immediately with 0ms transition.
   - Modals and drawers enter with `scale(0.96) -> scale(1)` and `opacity: 0 -> 1` using `var(--ease-out)`. Never scale from `0`.

---

## 4. Taste Skill Anti-Slop House Rules (`design-taste-frontend`)

1. **Equal Content Edges**:
   - Uniform left and right paddings (`px-4 sm:px-6 lg:px-8`) on all screens. No content overflowing or cutting off.
2. **Card Hover Lift (`card-hover`)**:
   - Interactive preset and strategy cards subtly lift 2px (`hover:-translate-y-0.5`) with ambient shadow expansion:
     ```css
     .card-hover:hover {
       transform: translateY(-2px);
       box-shadow: 0 8px 20px -6px rgba(37, 41, 67, 0.08), 0 2px 6px -1px rgba(37, 41, 67, 0.04);
     }
     ```
3. **Real Icons & Meaningful Badges**:
   - Real Lucide icons with dedicated semantic colors (`Eye` in blue, `Heart` in rose, `Bookmark` in amber, `Share2` in purple).
   - Real badges with exact values, never vague claims like "Best Quality" or "100% Super Fast".

---

## 5. Component Patterns

### Buttons
- **Primary CTA**:
  `bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white font-bold rounded-2xl shadow-md shadow-[#3A4EFB]/20 press-scale`
- **Secondary / Action**:
  `bg-[#F8F9FD] hover:bg-[#EEF1FB] border border-[#DEE0ED] text-[#3A4EFB] font-bold rounded-xl press-scale`
- **Destructive**:
  `bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded-xl press-scale`

### Cards
- **Container**: `bg-white rounded-3xl border border-[#DEE0ED] p-5 sm:p-6 shadow-subtle`
- **Active State**: `border-[#3A4EFB] ring-2 ring-[#3A4EFB]/25 bg-white -translate-y-0.5 shadow-md`

### Inputs
- `bg-white sm:bg-[#F8F9FD] border border-[#DEE0ED] focus:bg-white focus:border-[#3A4EFB] focus:outline-none rounded-xl text-xs sm:text-sm font-medium transition-all`
