/**
 * A round photo, or initials on a colour picked from the name so the same person
 * always gets the same colour. Plain <img>: avatars come from Google or our own
 * bucket, both public URLs, and next/image would need every host listed.
 */
const PALETTE = [
  'bg-rose-200 text-rose-900',
  'bg-amber-200 text-amber-900',
  'bg-emerald-200 text-emerald-900',
  'bg-sky-200 text-sky-900',
  'bg-violet-200 text-violet-900',
  'bg-teal-200 text-teal-900',
]

const SIZES = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-2xl',
} as const

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export function Avatar({
  name,
  url,
  size = 'md',
  className = '',
}: {
  name: string
  url?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-2 ring-white ${SIZES[size]} ${className}`

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} className={`${base} object-cover`} referrerPolicy="no-referrer" />
    )
  }

  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return (
    <span aria-label={name} role="img" className={`${base} ${PALETTE[hash % PALETTE.length]}`}>
      {initialsOf(name)}
    </span>
  )
}
