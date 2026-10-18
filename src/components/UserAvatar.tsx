import { useState } from 'react'
import { cn, initials } from '../lib/utils'

const AVATAR_COUNT = 6

/** Demo profile photo for a person: the same name always maps to the same picture in /public/avatars. */
export function avatarFor(name: string) {
  let hash = 0
  for (const ch of name.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return `/avatars/avatar-${(hash % AVATAR_COUNT) + 1}.png`
}

/** Round profile photo; falls back to initials if the image can't load. Size it with `className` (e.g. size-9). */
export function UserAvatar({ name, className }: { name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed)
    return <span className={cn('grid shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700', className)}>{initials(name)}</span>
  return <img src={avatarFor(name)} alt="" onError={() => setFailed(true)} className={cn('shrink-0 rounded-full bg-zinc-100 object-cover', className)} />
}
