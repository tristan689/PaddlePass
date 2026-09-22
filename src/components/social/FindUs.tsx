import { BRAND_LINKS } from '@/lib/domain/links'
import { PinIcon } from './SocialLinks'

/**
 * Where the court is: a heading and a small map, nothing else. Links to
 * directions and the Google listing live in the header and footer, so this stays
 * quiet under the calendar. The embed is Google's keyless one, loaded lazily so it
 * never delays the calendar above it.
 */
export function FindUs({ className = '' }: { className?: string }) {
  return (
    <section
      aria-labelledby="find-us-heading"
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}
    >
      <h2
        id="find-us-heading"
        className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-slate-900"
      >
        <PinIcon />
        Find us
        <span className="font-normal text-slate-500">· Undefeated Fitness Center</span>
      </h2>
      <iframe
        title="Map: Undefeated Fitness Center"
        src={BRAND_LINKS.mapEmbed}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="block h-32 w-full border-0 sm:h-40"
      />
    </section>
  )
}
