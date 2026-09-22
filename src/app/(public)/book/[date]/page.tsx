import { notFound, redirect } from 'next/navigation'
import { isManilaDate } from '@/lib/domain/time'

/**
 * The day picker now lives on the calendar page as its Day view. Links to the
 * old address keep working.
 */
export default async function BookDayRedirect({ params }: PageProps<'/book/[date]'>) {
  const { date } = await params
  if (!isManilaDate(date)) notFound()
  redirect(`/?view=day&d=${date}`)
}
