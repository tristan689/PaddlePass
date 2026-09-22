'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionState } from '@/lib/actions/state'
import { createClient } from '@/lib/supabase/server'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const AVATAR_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const profile = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'Enter the name other players should see.')
    .max(60, 'Please use a shorter name (60 characters max).'),
  show_on_calendar: z.boolean(),
})

/**
 * Name, photo and calendar visibility. The photo goes to the `avatars` bucket
 * under the member's own folder -- the storage policy refuses any other path --
 * and its public URL is stored on the profile. Runs as the member, so RLS keeps
 * it to their own row.
 */
export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) return { error: 'Please sign in again.' }

  const parsed = profile.safeParse({
    display_name: formData.get('display_name'),
    show_on_calendar: formData.get('show_on_calendar') === 'on',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check your details.' }

  let avatarUrl: string | undefined
  const file = formData.get('avatar')
  if (file instanceof File && file.size > 0) {
    const ext = AVATAR_TYPES[file.type]
    if (!ext) return { error: 'Please choose a JPG, PNG or WebP photo.' }
    if (file.size > MAX_AVATAR_BYTES) return { error: 'Please choose a photo under 2 MB.' }

    // A fresh name each time, so browsers and the CDN never show a stale photo.
    const path = `${userId}/avatar-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (uploadError) {
      console.error('avatar upload failed', uploadError)
      return { error: 'Could not upload the photo. Please try another one.' }
    }
    avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }

  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    display_name: parsed.data.display_name,
    show_on_calendar: parsed.data.show_on_calendar,
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.error('updateProfile failed', error)
    return { error: 'Could not save your profile. Please try again.' }
  }

  refresh()
  return { ok: true, message: 'Saved.' }
}
