# Design System Specification

## 1. Overview & Creative North Star
**Creative North Star: The Clinical Curator**

Medical data is traditionally dense, stressful, and chaotic. This design system seeks to transform the healthcare dashboard from a "spreadsheet" into a "curated editorial experience." We move away from the rigid, line-heavy aesthetic of legacy medical software in favor of **Tonal Layering** and **Aerated Data Layouts**.

The experience is anchored by a sense of calm authority. We achieve this through "Soft Minimalism"—using breathing room (negative space) as a structural element rather than borders. By utilizing intentional asymmetry in header placements and overlapping "floating" containers, we create a UI that feels high-end, responsive, and profoundly organized.

---

## 2. Colors: Tonal Depth & Meaning
We utilize a sophisticated palette that prioritizes readability and status-based scanning without visual fatigue.

### The "No-Line" Rule
**Designers are prohibited from using 1px solid borders for sectioning.** Boundaries must be defined through background color shifts. For example, a card (`surface_container_lowest`) sits on a workspace background (`surface`) to define its edge. Lines create visual noise; tonal shifts create focus.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each layer represents a step deeper into the information hierarchy:
*   **Base Layer:** `surface` (#f7f9fb) – The canvas.
*   **Secondary Sections:** `surface_container_low` (#f2f4f6) – Grouping secondary filters or sidebars.
*   **Actionable Cards:** `surface_container_lowest` (#ffffff) – The highest priority containers for data tables and patient records.
*   **Interactive Elements:** `surface_container_high` (#e6e8ea) – Hover states and pressed surfaces.

### The "Glass & Gradient" Rule
To prevent a "flat" enterprise look, use **Glassmorphism** for persistent navigation bars or floating action panels. Use a background blur (12px–20px) with `surface` at 80% opacity. 
*   **Signature Textures:** For primary CTAs and header accents, utilize a subtle linear gradient from `primary` (#003d9b) to `primary_container` (#0052cc) at a 135-degree angle. This provides a "jewel-toned" depth that feels premium.

---

## 3. Typography: The Editorial Scale
We use a dual-font strategy to balance character with clinical precision.

*   **Display & Headlines (Manrope):** Used for "Wayfinding." These should be bold and authoritative. Large `display-lg` (3.5rem) settings should be used for key metrics (e.g., total waiting patients) to create clear visual entry points.
*   **Body & Labels (Inter):** Used for "Information." Inter’s high x-height ensures that patient IDs and timestamps remain legible even at `body-sm` (0.75rem).
*   **Hierarchy Tip:** Always use `on_surface_variant` (#434654) for secondary labels (e.g., "Time in Queue") and `on_surface` (#191c1e) for the actual data (e.g., "12 min") to create an immediate "Scan-and-Read" rhythm.

---

## 4. Elevation & Depth
In this system, elevation is a feeling, not a drop-shadow.

### The Layering Principle
Depth is achieved by stacking. Place a `surface_container_lowest` card on a `surface_container_low` background. The subtle 2% shift in brightness provides enough contrast for the eye to perceive a "lift" without the clutter of a shadow.

### Ambient Shadows
When an element must float (e.g., a modal or a floating menu), use **Ambient Light Shadows**:
*   **Shadow:** `0 12px 32px rgba(25, 28, 30, 0.06)`
*   The color is a tinted version of `on_surface`, making it feel like a natural shadow cast on a medical-grade surface.

### The "Ghost Border" Fallback
If a border is required for accessibility (e.g., an input field), use the **Ghost Border**: `outline_variant` (#c3c6d6) at 20% opacity. It should be felt, not seen.

---

## 5. Components: Refined Utility

### Buttons & CTAs
*   **Primary:** Rounded `lg` (1rem). Gradient fill (`primary` to `primary_container`). White text.
*   **Secondary:** `surface_container_high` background with `on_primary_fixed_variant` text. No border.
*   **States:** On hover, increase the elevation through a slightly more pronounced ambient shadow, never a darker color.

### Data Tables (The Clinical Grid)
*   **No Dividers:** Forbid horizontal lines. Separate rows using `3.5` (1.2rem) vertical spacing.
*   **Alternating Tones:** Use a subtle shift to `surface_container_low` for every second row if data density is extremely high.
*   **Ample Whitespace:** Headers should use `label-md` in all-caps with 0.05em tracking for a professional, "ledger" feel.

### Status Badges
Status is critical in a medical context. Use high-contrast "Pills":
*   **Completed:** `tertiary_container` (#006844) background with `on_tertiary_container` (#7de7b2) text.
*   **Waiting:** `error_container` (#ffdad6) background with `on_error_container` (#93000a) text.
*   **Consulting:** `secondary_container` (#d0e1fb) background with `on_secondary_container` (#54647a) text.

### Patient "Quick-View" Cards
A custom component for this system. Use a `xl` (1.5rem) corner radius. Use `display-sm` for the patient name and `body-md` for the vitals. Anchor the card with a `primary` color bar (4px width) on the left side to denote the "Active" status.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use `24` (8.5rem) spacing for outer page margins to create a "Gallery" feel.
*   **Do** use `8px` (DEFAULT) roundedness for most components, but experiment with `full` (9999px) for status badges and chips.
*   **Do** rely on typography weight (SemiBold vs. Regular) to create hierarchy before reaching for a new color.

### Don't:
*   **Don't** use pure black (#000000). Use `on_surface` (#191c1e) for all "black" text.
*   **Don't** use 1px dividers to separate the header from the body. Use a background color transition from `surface_dim` to `surface`.
*   **Don't** crowd the data. If a table feels "busy," increase the vertical spacing (`3` to `4`) rather than shrinking the font.