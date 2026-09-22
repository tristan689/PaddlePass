import Link from 'next/link'

export type CalendarView = 'day' | 'week' | 'month'

/** `?view=` from the URL, defaulting to the view that suits a phone. */
export function pickView(raw: unknown): CalendarView {
  return raw === 'day' || raw === 'month' ? raw : 'week'
}

/**
 * Day / Week / Month segmented control. Plain links, so the view is in the URL:
 * shareable, back-button friendly, and rendered with no client JavaScript.
 */
export function ViewSwitcher({
  view,
  anchor,
  month,
  className = '',
}: {
  view: CalendarView
  /** The date the Day and Week views centre on. */
  anchor: string
  /** `YYYY-MM` the Month view shows. */
  month: string
  className?: string
}) {
  const items: Array<{ key: CalendarView; label: string; href: string }> = [
    { key: 'day', label: 'Day', href: `/?view=day&d=${anchor}` },
    { key: 'week', label: 'Week', href: `/?view=week&d=${anchor}` },
    { key: 'month', label: 'Month', href: `/?view=month&m=${month}` },
  ]

  return (
    <nav
      aria-label="Calendar view"
      className={`inline-flex rounded-full bg-slate-200/70 p-1 ${className}`}
    >
      {items.map((item) => {
        const active = item.key === view
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              active
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
