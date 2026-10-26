/**
 * Learning journeys on the learner side: themed groups of trainings. Learners pick any
 * journey and any training in it — there is no required order between journeys.
 */
export type Journey = {
  id: string
  title: string
  description: string
  audience: string
  trainingIds: string[]
  badgeName?: string
  badgeDescription?: string
  prerequisites?: Record<string, string[]>
}

export const journeys: Journey[] = [
  {
    id: 'getting-started',
    title: 'Getting started with M-PESA',
    description: 'The essentials of the M-PESA app and services, for anyone new to the role.',
    audience: 'All staff',
    trainingIds: ['test-training-3', 'mpesa-training-test', 'mpesa-app-features'],
    badgeName: 'M-PESA Certified Foundations',
    badgeDescription: 'Completed all core introductory M-PESA training modules and assessments.',
    prerequisites: {
      'mpesa-training-test': ['test-training-3'],
      'mpesa-app-features': ['mpesa-training-test'],
    },
  },
  {
    id: 'agent-merchant-growth',
    title: 'Agent & merchant growth',
    description: 'Grow transaction volume, manage float and support merchants and partner businesses.',
    audience: 'Agent relations & sales',
    trainingIds: ['account-optimization', 'merchant-payments', 'b2c-south-radio'],
    badgeName: 'Merchant & Growth Champion',
    badgeDescription: 'Mastered agent float management, merchant payment onboarding, and B2C bulk disbursements.',
    prerequisites: {
      'merchant-payments': ['account-optimization'],
      'b2c-south-radio': ['merchant-payments'],
    },
  },
  {
    id: 'compliance-protection',
    title: 'Compliance & customer protection',
    description: 'Identity verification, fraud awareness and keeping customers safe.',
    audience: 'Customer-facing roles',
    trainingIds: ['fraud-awareness', 'fayda-integration'],
    badgeName: 'Risk & Trust Specialist',
    badgeDescription: 'Accredited in customer identity verification, Fayda digital ID, and anti-fraud protocols.',
    prerequisites: {
      'fayda-integration': ['fraud-awareness'],
    },
  },
]
