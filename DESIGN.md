---
version: alpha
name: Content Collector Admin
description: A restrained, information-dense operator interface for safely collecting, reviewing, and promoting Facebook content sources.
colors:
  primary: "#1C5F63"
  primary-hover: "#175D61"
  on-primary: "#FFFFFF"
  accent: "#D34322"
  on-accent: "#FFFFFF"
  background: "#F6F7F3"
  background-top: "#FAFAF7"
  surface: "#FFFFFF"
  foreground: "#1D2125"
  muted: "#EEEBE7"
  muted-foreground: "#5D656F"
  border: "#D7D2CC"
  sidebar: "#222824"
  sidebar-foreground: "#FFFFFF"
  brand: "#F2B84B"
  brand-foreground: "#1D231F"
  info-background: "#E8F4F8"
  info-border: "#9BBDD1"
  info-foreground: "#245A72"
  success-background: "#EDF8EE"
  success-border: "#9DCCAD"
  success-foreground: "#23633A"
  warning-background: "#FFF7DC"
  warning-border: "#DFC36E"
  warning-foreground: "#76591A"
  danger: "#B93535"
  danger-hover: "#9F2D2D"
  danger-background: "#FFF5F5"
  danger-badge-background: "#FFF0F0"
  danger-border: "#E4A0A0"
  danger-foreground: "#8F3030"
  danger-text: "#7F1D1D"
typography:
  page-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 2rem
    letterSpacing: 0em
  app-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.75rem
  section-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.5rem
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5rem
  body-medium:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.25rem
  button:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.25rem
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1rem
    letterSpacing: 0.12em
  eyebrow:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1rem
    letterSpacing: 0.18em
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1rem
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.25rem
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
rounded:
  sm: 4px
  md: 6px
  full: 999px
components:
  app-background:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
  app-header:
    backgroundColor: "{colors.background-top}"
    textColor: "{colors.foreground}"
    height: 68px
    padding: 12px 24px
  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.sidebar-foreground}"
    width: 272px
    padding: 12px
  sidebar-item:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.sidebar-foreground}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: 8px 12px
  sidebar-item-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.sm}"
  brand-mark:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-foreground}"
    rounded: "{rounded.sm}"
    size: 36px
  page-title:
    textColor: "{colors.foreground}"
    typography: "{typography.page-title}"
  app-title:
    textColor: "{colors.foreground}"
    typography: "{typography.app-title}"
  eyebrow:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.eyebrow}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: 16px
  card-muted:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: 12px
  section-title:
    textColor: "{colors.foreground}"
    typography: "{typography.section-title}"
  body:
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
  caption:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.caption}"
  field-label:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
  code-value:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.code}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: 0px 12px
  input-disabled:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: 0px 16px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: 0px 16px
  button-ghost:
    textColor: "{colors.foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: 0px 12px
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: 0px 16px
  button-danger-hover:
    backgroundColor: "{colors.danger-hover}"
    textColor: "{colors.on-primary}"
  button-disabled:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
  link-primary:
    textColor: "{colors.primary}"
    typography: "{typography.body-medium}"
  divider-neutral:
    backgroundColor: "{colors.border}"
    height: 1px
  outline-info:
    backgroundColor: "{colors.info-border}"
    height: 1px
  outline-success:
    backgroundColor: "{colors.success-border}"
    height: 1px
  outline-warning:
    backgroundColor: "{colors.warning-border}"
    height: 1px
  outline-danger:
    backgroundColor: "{colors.danger-border}"
    height: 1px
  status-neutral:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    padding: 0px 8px
  status-info:
    backgroundColor: "{colors.info-background}"
    textColor: "{colors.info-foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    padding: 0px 8px
  status-success:
    backgroundColor: "{colors.success-background}"
    textColor: "{colors.success-foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    padding: 0px 8px
  status-warning:
    backgroundColor: "{colors.warning-background}"
    textColor: "{colors.warning-foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    padding: 0px 8px
  status-danger:
    backgroundColor: "{colors.danger-badge-background}"
    textColor: "{colors.danger-foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    padding: 0px 8px
  alert-info:
    backgroundColor: "{colors.info-background}"
    textColor: "{colors.info-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
  alert-success:
    backgroundColor: "{colors.success-background}"
    textColor: "{colors.success-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
  alert-warning:
    backgroundColor: "{colors.warning-background}"
    textColor: "{colors.warning-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
  alert-danger:
    backgroundColor: "{colors.danger-background}"
    textColor: "{colors.danger-text}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
  accent-marker:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    size: 8px
  drawer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    width: 448px
    padding: 16px
---

## Overview

Content Collector Admin is a practical operations console, not a marketing
site. Its visual character is restrained, trustworthy, compact, and calm. The
interface should help one operator inspect profiles, collection runs, content,
and discovered publishing sources without hiding consequential decisions.

Preserve the established warm-neutral canvas, white work surfaces, dark green
sidebar, teal primary actions, and small amber brand marker. Prefer clear
hierarchy and evidence over decoration. Dense information is welcome when it is
grouped, labelled, and scannable.

## Colors

- **Primary (`#1C5F63`)** is the default action, link, focus, and selected-state
  color. Use `#175D61` on primary-button hover.
- **Accent (`#D34322`)** is a scarce attention marker. It is not the ordinary
  call-to-action color and must not compete with danger red.
- **Background (`#F6F7F3`)** and **background top (`#FAFAF7`)** create the warm,
  low-glare application canvas. Main working surfaces remain white.
- **Foreground (`#1D2125`)** is used for primary text. Muted foreground
  (`#5D656F`) is for descriptions, timestamps, field labels, and secondary
  metadata; never use it for critical decisions.
- **Border (`#D7D2CC`)** defines cards, fields, dividers, and secondary controls.
  Borders are visible but quiet.
- **Sidebar (`#222824`)** uses white text. The active item reverses to a white
  surface with dark text. The brand mark is amber (`#F2B84B`) with dark text.
- Semantic states use complete background, border, and foreground sets:
  info `#E8F4F8 / #9BBDD1 / #245A72`, success
  `#EDF8EE / #9DCCAD / #23633A`, warning
  `#FFF7DC / #DFC36E / #76591A`, and danger
  `#FFF5F5 / #E4A0A0 / #7F1D1D`.
- Never encode status through color alone. Pair color with a concise text label,
  icon, or explanation.

## Typography

Use Inter when available, followed by the system sans-serif stack. Use the
monospace stack only for technical IDs, run IDs, and other exact machine values.

- Page titles are 24px/32px, semibold.
- Application titles are 18px/28px, semibold.
- Card and section titles are 16px/24px, semibold.
- Body copy and control labels are 14px. Descriptions use a 24px line height for
  comfortable scanning.
- Metadata labels are 12px, semibold, uppercase, with `0.12em` tracking.
- Page eyebrows are 12px, semibold, uppercase, with `0.18em` tracking.
- Do not use oversized display typography. This is an operations product and
  the content should remain the visual focus.

## Layout & Spacing

Use a 4px base rhythm. The preferred working gaps are 8px, 12px, 16px, 20px,
24px, and 32px.

- At large widths, the application uses a fixed 272px sidebar and a flexible
  content column. Main content is capped at 1280px and centered within its
  column.
- Main page padding is 16px on small screens, 24px on medium screens, and 32px
  on large screens.
- Cards normally use 16px internal padding. Dense nested panels use 12px.
- A page header places title and description on the left and one compact action
  group on the right. Stack these on narrow screens.
- Prefer one clear review column over many tiny columns. Use responsive grids
  for short metadata fields, but preserve reading order when they collapse.
- On narrow screens, the sidebar becomes a top horizontal navigation region.
  Actions wrap, cards remain full width, and no essential control may require
  horizontal scrolling.

## Elevation & Depth

Depth is intentionally shallow. Cards use a one-pixel neutral border and the
existing subtle panel shadow (`0 1px 2px rgb(22 24 29 / 0.08)`). Nested panels
usually use a muted background and border without another shadow.

Use stronger elevation only for modal drawers. Drawers have a dark translucent
backdrop, a white panel, a left border, and a strong shadow. Avoid decorative
gradients inside cards; the only application gradient is the very subtle page
canvas.

## Shapes

Corners are compact rather than soft. Standard cards, buttons, fields, badges,
technical values, and navigation items use a 4px radius. A 6px radius is
reserved for slightly larger overlays or grouped containers. Use a fully round
shape only for tiny indicators or genuinely circular icon controls.

Interactive controls are normally 40px high; compact actions may be 36px high.
Maintain at least a 40px practical click target when controls are isolated.

## Components

### Navigation and page shell

The sidebar contains the amber `FG` mark, product name, short product context,
and primary navigation. Keep navigation labels short. Selected navigation is a
high-contrast white item; hover states on dark navigation remain subtle.

The sticky application header shows a small uppercase context label and an
18px title. Page content begins with an optional eyebrow, a 24px page title, a
one- or two-line description, and optional actions.

### Cards and information groups

Cards are white with a neutral border, 4px corners, and the subtle panel shadow.
Use a bordered header when the card contains a list or form. Use definition-list
patterns for labelled metadata. Technical identifiers are secondary and appear
in a muted monospace treatment; they must not become the visual title when a
human-readable identity exists.

### Buttons and links

- Primary buttons are teal with white text and represent the preferred safe
  next action.
- Secondary buttons are white with a neutral border.
- Ghost buttons are for low-priority or reversible actions.
- Danger buttons are solid red and reserved for destructive or blocking
  operations.
- Disabled controls remain visible with reduced emphasis and must be paired
  with a nearby explanation when the reason is not obvious.
- External review destinations use a clear teal text link or secondary button,
  an external-link icon, and descriptive wording such as **Open on Facebook**.
  Do not make a raw URL the only affordance.

All controls need a visible two-pixel teal focus ring. Keyboard focus order must
follow the visual reading order.

### Fields

Inputs, selects, and text areas use white backgrounds, neutral borders, 4px
corners, and 40px control height. On focus, the border becomes teal and gains a
soft teal ring. Disabled fields use the muted background. Put validation text
below the relevant field and add a summary only when several fields fail.

### Status and feedback

Badges are 24px high, use 12px medium text, and always include a border from the
matching semantic palette. Use neutral, info, success, warning, and danger
consistently. Feedback panels use the same semantic palettes with 12px vertical
and 16px horizontal padding.

Loading states should preserve the approximate final layout with muted skeleton
blocks. Empty states explain what is absent and, where useful, the next action.
Errors state what failed without exposing stack traces, credentials, session
state, or raw platform payloads.

### Drawers

Use a right-side drawer for focused inspection that should not lose the parent
list context. The desktop width is 448px and becomes full width on small screens.
The drawer must trap focus, close on Escape or backdrop interaction, and restore
focus to its trigger.

### Discovered-source review

Treat Discovered Sources as a review queue, not a wall of promotion forms.

- Use the captured Facebook group or page name as the primary card title.
- Provide a prominent **Open on Facebook** destination before approval actions.
- Keep the external publisher ID and internal record ID as secondary technical
  details, preferably behind a copy affordance or expandable details.
- Show source kind, platform, review status, observation count, and first/last
  observed timestamps as compact metadata.
- Approval fails closed when no safe review destination exists. Disable Approve
  and explain exactly what is missing; never ask the operator to trust an opaque
  ID alone.
- Separate Approve, Ignore, and Block visually. Block remains the only danger
  action.
- Keep promotion into a managed Source Group collapsed or absent until the
  source is approved. After approval, reveal promotion as a distinct next step,
  not as part of the identity-review form.

## Do's and Don'ts

### Do

- Design for deliberate operator decisions and fast scanning.
- Keep human-readable identity, safe review destination, and current status near
  each other.
- Preserve explicit loading, empty, unavailable, disabled, success, warning,
  and failure states.
- Use semantic HTML, labelled controls, visible focus, keyboard navigation, and
  WCAG AA contrast.
- Reuse the existing token values and component vocabulary before introducing a
  new visual pattern.
- Keep sensitive and trusted data out of generic UI surfaces.

### Don't

- Do not turn the interface into a spacious consumer dashboard or marketing
  page.
- Do not use giant headings, pill-shaped controls everywhere, glassmorphism,
  decorative charts, or strong shadows.
- Do not use color as the sole status signal.
- Do not promote technical IDs to primary titles when a readable name exists.
- Do not enable approval without a safe review destination.
- Do not expose cookies, local storage, tokens, proxy credentials, fingerprint
  secrets, raw Facebook payloads, private response bodies, or stack traces.
- Do not mix source identity review and managed-source promotion into one
  always-expanded form.
