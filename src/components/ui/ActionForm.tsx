'use client'

import { useActionState, useEffect, useRef } from 'react'
import { INITIAL_ACTION_STATE, type ActionState } from '@/lib/actions/state'

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>

/**
 * A <form> wired to a Server Action, with its error and success messages rendered
 * in place.
 *
 * Every admin mutation goes through one of these, which gives the whole admin the
 * same behaviour for free: the button disables while in flight, a failure shows a
 * sentence next to the thing that failed, and a success optionally clears the
 * fields. Nothing here knows what the action does.
 */
export function ActionForm({
  action,
  children,
  className = '',
  resetOnSuccess = false,
  id,
}: {
  action: FormAction
  children: React.ReactNode
  className?: string
  /** Clear the inputs after a successful submit -- for "add another" forms. */
  resetOnSuccess?: boolean
  id?: string
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset()
  }, [state, resetOnSuccess])

  return (
    <form ref={formRef} id={id} action={formAction} className={className}>
      {children}
      {state.error && (
        <p
          role="alert"
          className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
      {state.message && !state.error && (
        <p
          role="status"
          className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {state.message}
        </p>
      )}
    </form>
  )
}
