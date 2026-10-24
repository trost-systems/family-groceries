import type { ComponentType } from 'react'
import type { Localized } from './shared/types'

export interface PrototypeMeta {
  /** sort key on the index page, e.g. "A" */
  letter: string
  title: Localized
  /** one-line rationale shown on the index */
  rationale: Localized
  /** review round the variant answers; round 1 directions leave it out */
  round?: 1 | 2 | 3
}

interface PrototypeModule {
  meta: PrototypeMeta
  default: ComponentType
}

const modules = import.meta.glob<PrototypeModule>('./prototypes/*/index.tsx', { eager: true })

export const prototypes = Object.entries(modules)
  .map(([path, mod]) => ({ name: path.split('/')[2], meta: mod.meta, round: mod.meta.round ?? 1, Component: mod.default }))
  .sort((a, b) => a.meta.letter.localeCompare(b.meta.letter))
