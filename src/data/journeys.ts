/**
 * Learning journeys on the learner side: themed groups of trainings. Learners pick any
 * journey and any training in it — there is no required order between journeys.
 */
export type Journey = { id: string; title: string; description: string; audience: string; trainingIds: string[] }

export const journeys: Journey[] = [
  {
    id: 'getting-started',
    title: 'Getting started with M-PESA',
    description: 'The essentials of the M-PESA app and services, for anyone new to the role.',
    audience: 'All staff',
    trainingIds: ['test-training-3', 'mpesa-training-test', 'mpesa-app-features'],
  },
  {
    id: 'agent-merchant-growth',
    title: 'Agent & merchant growth',
    description: 'Grow transaction volume, manage float and support merchants and partner businesses.',
    audience: 'Agent relations & sales',
    trainingIds: ['account-optimization', 'merchant-payments', 'b2c-south-radio'],
  },
  {
    id: 'compliance-protection',
    title: 'Compliance & customer protection',
    description: 'Identity verification, fraud awareness and keeping customers safe.',
    audience: 'Customer-facing roles',
    trainingIds: ['fayda-integration', 'fraud-awareness'],
  },
]
