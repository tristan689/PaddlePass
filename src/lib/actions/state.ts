/**
 * The shape every form-driven Server Action returns through `useActionState`.
 *
 * Plain module on purpose -- no `'use server'` -- so both the actions and the
 * Client Components that render their results can import it without pulling a
 * server bundle into the browser.
 */
export interface ActionState {
  /** Set when the action failed; a sentence for the person, never a stack trace. */
  error?: string
  /** Set when the action succeeded and has something to say about it. */
  message?: string
  /** Convenience flag for "clear the form" behaviour. */
  ok?: boolean
}

export const INITIAL_ACTION_STATE: ActionState = {}
