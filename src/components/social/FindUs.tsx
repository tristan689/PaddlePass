import { BRAND_LINKS } from '@/lib/domain/links'
import { PinIcon } from './SocialLinks'

/**
 * Where the court is, with a map. The embed is Google's keyless one, loaded
 * lazily so it never delays the calendar above it.
 */
export function FindUs({ className = '' }: { className?: string }) {
  return (
    <section
      aria-labelledby="find-us-heading"
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 id="find-us-heading" className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <PinIcon />
            Find us
          </h2>
          <p className="text-xs text-slate-500">Undefeated Fitness Center</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            href={BRAND_LINKS.directions}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-slate-900 px-3.5 py-2 font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Get directions
          </a>
          <a
            href={BRAND_LINKS.maps}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Open in Google Maps
          </a>
          <a
            href={BRAND_LINKS.google}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Google profile
          </a>
        </div>
      </div>
      <iframe
        title="Map: Undefeated Fitness Center"
        src={BRAND_LINKS.mapEmbed}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="block h-56 w-full border-0 sm:h-72"
      />
    </section>
  )
}
