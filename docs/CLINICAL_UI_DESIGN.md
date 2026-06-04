# Clinical Curator — UI/UX Redesign

## 1. Layout structure (12-column)

```
┌─────────────────────────────────────────────────────────────────┐
│ Sidebar (248px) │ Top bar: page title · search · role             │
├─────────────────┼───────────────────────────────────────────────┤
│ Nav             │ Patient summary header (12 cols)                │
│ · Overview      │ KPI strip: Wait · Consult · Treatment · TAT     │
│ · Live queue    ├──────────────────────────────┬──────────────────┤
│ · …             │ Main (8 cols)                │ Rail (4 cols)    │
│                 │ · Workflow cards             │ · Billing (HIS)  │
│                 │ · Activity logs + search     │ · Journey        │
│ User + logout   │                              │ · Urgent actions │
└─────────────────┴──────────────────────────────┴──────────────────┘
```

**Primary content (8):** operational workflow + searchable logs.  
**Secondary rail (4):** billing prominence, journey, quick actions.

## 2. Component hierarchy

```
App
└── ClinicalShell
    └── TokenDetailPage (logic, API, modals)
        └── ClinicalTokenDetailLayout (presentation)
            ├── Patient header
            ├── KpiRow (4 metrics)
            ├── WorkflowGrid (pharmacy, lab, treatment)
            ├── ActivityLog (filterable data grids)
            ├── BillingPanel
            ├── JourneyTimeline
            └── UrgentActions
```

## 3. Design system (CSS variables)

| Token | Value |
|--------|--------|
| Primary | `#2563EB` |
| Success | `#16A34A` |
| Warning | `#F59E0B` |
| Danger | `#DC2626` |
| Background | `#F8FAFC` |
| Card | `#FFFFFF` |
| Radius | `16px` |
| Font | Inter 400–700 |

Implemented in `frontend/src/styles/clinical-curator.css`.

## 4. Tailwind mapping (optional migration)

If adding Tailwind later:

```html
<div class="grid grid-cols-12 gap-4 max-w-[1600px]">
  <header class="col-span-12 rounded-2xl border bg-white shadow-sm p-6">…</header>
  <div class="col-span-8 space-y-4">…</div>
  <aside class="col-span-4 space-y-4">…</aside>
</div>
```

## 5. UX improvements

| Problem | Solution |
|---------|----------|
| Empty whitespace | 12-col grid, tighter gaps (16px), denser KPI row |
| Weak hierarchy | Large patient header + accent KPI top bars |
| Disconnected workflow | Color-coded cards + progress bars + status chips |
| Journey hard to scan | Vertical timeline with dots, cards, durations |
| Billing buried | Right rail, left border accent, Posted/Pending badge |
| Generic sidebar | Fixed ClinicalShell with active state + user footer |
| Tables dated | Sticky-header grids + client-side log search |

## 6. Preserved functionality

All existing actions and data paths unchanged:

- Start / End consult, Complete visit, Revert
- Treatment Start / End
- HIS pharmacy, lab, billing sync (backend)
- Modals (consult, end consult, complete, revert)
- Live timers via `nowMs`
- Background HIS poll (silent reload)
- Patient journey from tracking

## 7. Files

- `frontend/src/styles/clinical-curator.css` — design system
- `frontend/src/components/clinical/ClinicalShell.jsx` — shell + nav
- `frontend/src/components/clinical/ClinicalTokenDetailLayout.jsx` — token UI
- `frontend/src/pages/TokenDetailPage.jsx` — wiring + modals
