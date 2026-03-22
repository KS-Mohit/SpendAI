# Design System Specification: The Kinetic Luminescence

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Ledger of Light."** 

In the high-stakes world of fintech, users demand two things: absolute precision and effortless intelligence. This system moves away from the "boxy" nature of traditional banking apps. Instead, it adopts a high-end editorial aesthetic inspired by astronomical navigation and precision engineering. 

We utilize a "Linear-app" inspired philosophy: extreme minimalism, high-contrast typography, and depth created through luminosity rather than structure. By breaking the standard grid with intentional white space and "floating" data points, we create an experience that feels less like a database and more like a premium command center.

---

## 2. Colors & Surface Architecture

### The Palette
The color strategy relies on a near-black foundation to allow the neon-adjacent greens to "vibrate" with importance.

*   **Primary (The Pulse):** `#6BFB9A` (Active states, critical paths).
*   **Primary Container (The Glow):** `#4ADE80` (Standard actions).
*   **Secondary (The Mint):** `#62DCAD` (Success, validation, growth).
*   **Surface:** `#131313` (Main canvas).
*   **Surface Container Lowest:** `#0E0E0E` (Deep recessed areas).
*   **Surface Container High:** `#2A2A2A` (Floating cards/modals).

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders to define section boundaries. 
Instead, hierarchy must be established through:
1.  **Tonal Shifts:** Placing a `surface-container-low` (#1C1B1B) section against the main `background` (#131313).
2.  **Negative Space:** Using the `16` (4rem) or `20` (5rem) spacing tokens to create mental groupings.

### The Glass & Gradient Rule
To achieve a "premium" feel, use **Glassmorphism** for utility bars and navigation.
*   **Style:** `surface` color at 60% opacity with a `20px` backdrop-blur. 
*   **Signature Glow:** Use the `primary` color (#6BFB9A) in a box-shadow with 10% opacity and a 40px blur to create a "bloom" effect around high-priority cards, mimicking the light of a high-end OLED display.

---

## 3. Typography: Editorial Precision
We use **Inter** exclusively, but we treat it with editorial intent. The contrast between `display` sizes and `label` sizes is the primary driver of the brand's sophisticated feel.

*   **Display-LG (3.5rem):** Used for "hero" balances or total spend. Letter-spacing: `-0.04em`.
*   **Headline-SM (1.5rem):** Section headers. Tight tracking, semi-bold weight.
*   **Body-MD (0.875rem):** Standard data and descriptions. Use `muted-gray` (#9CA3AF) to prevent visual fatigue.
*   **Label-SM (0.6875rem):** All-caps with `+0.05em` letter-spacing. This is used for micro-data (e.g., TIMESTAMP, CATEGORY).

**Rule:** Never use "Pure White" for body text. Reserve `#FFFFFF` for Headlines and Titles. Use `on-surface-variant` (#BCCABB) for all secondary information.

---

## 4. Elevation & Depth (The Layering Principle)

Depth in this system is not "shadow-heavy"; it is **"light-heavy."**

1.  **Layering Tiers:**
    *   **Level 0 (Base):** `surface-container-lowest` (#0E0E0E) for the global background.
    *   **Level 1 (Sections):** `surface-dim` (#131313) for main content areas.
    *   **Level 2 (Cards):** `surface-container-low` (#1C1B1B) for standard cards.
    *   **Level 3 (Interactive):** `surface-container-high` (#2A2A2A) for hover states and active modals.

2.  **Ambient Shadows:**
    For floating elements (Modals/Popovers), use a shadow: `0px 20px 40px rgba(0, 0, 0, 0.4)`. To add the "Fintech Signature," add a secondary shadow: `0px 0px 15px rgba(74, 222, 128, 0.05)` (The Green Bloom).

3.  **The Ghost Border:**
    If a border is required for accessibility on inputs, use `outline-variant` (#3D4A3E) at 30% opacity. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** Background `primary-container` (#4ADE80), Text `on-primary` (#003919). Radius: `md` (0.375rem).
*   **Ghost:** Transparent background, `outline` color text. On hover, apply a `surface-container-highest` background.

### Cards & Data Lists
*   **Mandate:** No dividers. Use `Spacing 4` (1rem) to separate list items.
*   **Interactive List Items:** On hover, shift the background to `surface-container-high`.
*   **Fintech Special:** Use a vertical 2px "indicator line" of `primary` green only to show the currently selected or active transaction.

### Input Fields
*   **Resting State:** `surface-container-lowest` background with a subtle "Ghost Border."
*   **Focus State:** Border becomes `primary` (#6BFB9A) at 50% opacity, with a `4px` outer glow (bloom) of the same color at 10% opacity.

### Chips (Transaction Tags)
*   Small, `label-sm` typography. Background: `surface-variant` (#353534). Border-radius: `full`.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts. A card on the left does not always need a matching card on the right. Use the "extra" space for large, muted typography.
*   **Do** use the Spacing Scale strictly. Gaps between elements should be consistent (e.g., 2rem between sections, 0.75rem between related inputs).
*   **Do** use "The Bloom." A subtle green glow behind a "Total Balance" makes the data feel valuable.

### Don’t:
*   **Don’t** use 100% opaque borders. They clutter the UI and look "out of the box."
*   **Don’t** use gradients on text. It cheapens the "Editorial" look. Keep text flat and use scale/weight for emphasis.
*   **Don’t** use standard "Drop Shadows" (grey/black). Always tint your shadows with a hint of the background color or the primary green accent to maintain color harmony.