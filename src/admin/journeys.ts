import type { AdminData, AdminTraining, Journey } from './types'

/** A training's journeys in the order chosen when it was scheduled (older trainings have just one). */
export const journeyIdsOf = (t: Pick<AdminTraining, 'journeyId' | 'journeyIds'>): string[] =>
  t.journeyIds?.length ? t.journeyIds : t.journeyId ? [t.journeyId] : []

export const trainingJourneys = (data: Pick<AdminData, 'journeys'>, t: Pick<AdminTraining, 'journeyId' | 'journeyIds'>): Journey[] =>
  journeyIdsOf(t)
    .map((id) => data.journeys.find((j) => j.id === id))
    .filter((j): j is Journey => !!j)

/**
 * All of a training's journeys as one journey: names joined with arrows and modules back to back,
 * so screens built for a single journey show every module in order.
 */
export function combinedJourney(data: Pick<AdminData, 'journeys'>, t: Pick<AdminTraining, 'journeyId' | 'journeyIds'> | undefined): Journey | undefined {
  if (!t) return undefined
  const list = trainingJourneys(data, t)
  if (list.length <= 1) return list[0]
  return { ...list[0], name: list.map((j) => j.name).join(' → '), description: list.map((j) => j.description).filter(Boolean).join(' '), modules: list.flatMap((j) => j.modules) }
}
