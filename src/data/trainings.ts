import { SAMPLE_DECK, SAMPLE_DECK_FILE, SAMPLE_VIDEOS } from './materials'
import type { Module, QuizQuestion, Training, TrainingProgress, User } from '../types'

export const currentUser: User = {
  name: 'Fasil Wolde Gebrewold',
  email: 'fasil.wolde@mpesa.et',
  phone: '0712345678',
  role: 'Agent Relations Officer',
}

export const adminUser: User = {
  name: 'Fasil Wolde',
  email: 'fasil.wolde@safaricom.et',
  phone: '0711223344',
  role: 'Training Administrator',
}

/** Trainer (matches person s3 in the admin seed); signs in to the trainer portal (D04). */
export const trainerUser: User = {
  name: 'Dereje Desta',
  email: 'dereje.desta@safaricom.et',
  phone: '0711000003',
  role: 'Trainer · Learning & Development',
}

/** Team representative who can request training (matches person s5 in the admin seed). */
export const requesterUser: User = {
  name: 'Kalkidan Mekonnen',
  email: 'kalkidan.mekonnen@safaricom.et',
  phone: '0711334455',
  role: 'Requester · Call Center Operations',
}

/** Groups the demo learner belongs to; used for per-group download rules (D4, C06). */
export const LEARNER_GROUP_IDS = ['g1']

export const canDownload = (m: Module) => m.kind === 'document' && !!m.deck && (!m.downloadGroupIds || m.downloadGroupIds.some((g) => LEARNER_GROUP_IDS.includes(g)))

/** Demo-only credential for the fake login flow; there is no backend. Both accounts share it. */
export const DEMO_PASSWORD = 'Mpesa@2026'

// Every third module is a video streamed from /public/trainings; the rest are presentations
// that open in the slide viewer with a minimum reading time before they can be completed.
const mod = (prefix: string, titles: [string, number][]): Module[] => {
  let video = 0
  return titles.map(([title, minutes], i) => {
    const kind: Module['kind'] = i % 3 === 1 ? 'video' : 'document'
    const id = `${prefix}-m${i + 1}`
    return kind === 'video'
      ? { id, title, minutes, kind, video: SAMPLE_VIDEOS[video++ % SAMPLE_VIDEOS.length] }
      : { id, title, minutes, kind, deck: SAMPLE_DECK_FILE, slides: SAMPLE_DECK }
  })
}

const q = (prefix: string, items: [string, string[], number][]): QuizQuestion[] =>
  items.map(([question, options, answer], i) => ({ id: `${prefix}-q${i + 1}`, question, options, answer }))

/** Placeholder join link; the UI recognises "DEMO" links and doesn't open them. */
export const TEAMS_DEMO = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_DEMO%40thread.v2/0'

export const trainings: Training[] = [
  {
    id: 'test-training-3',
    cover: '/covers/test-training-3.jpg',
    title: 'Test training 3dited',
    trainer: 'Dereje Desta',
    date: '2026-06-18',
    startTime: '00:40',
    endTime: '03:00',
    venue: 'ONLINE',
    teamsJoinUrl: TEAMS_DEMO,
    recording: '/trainings/Module (1).mp4',
    category: 'Onboarding',
    banner: 'red',
    description:
      'An introductory session covering the M-PESA ecosystem, the customer journey and the core services every team member should know before working with customers and agents.',
    modules: mod('t3', [
      ['Welcome to M-PESA', 15],
      ['Customer registration & KYC basics', 30],
      ['Send money, withdraw & buy airtime', 35],
      ['Handling common customer queries', 25],
    ]),
    quiz: q('t3', [
      ['Which document is required to register a new M-PESA customer?', ['A utility bill', 'A valid government-issued ID', 'A bank statement', 'A SIM card receipt'], 1],
      ['What should a customer never share with anyone?', ['Their phone number', 'Their M-PESA PIN', 'Their name', 'Their till number'], 1],
      ['Where can a customer withdraw cash?', ['Any M-PESA agent', 'Only at a bank', 'Only at a Safaricom shop', 'Online'], 0],
    ]),
    quizSettings: { timeLimitMinutes: 10, maxAttempts: 3, shuffle: false },
  },
  {
    id: 'mpesa-training-test',
    isPublic: true,
    cover: '/covers/mpesa-training-test.jpg',
    title: 'M-PESA TRAINING TEST',
    trainer: 'Mariamawit Fekadeselase',
    date: '2026-06-22',
    startTime: '12:00',
    endTime: '17:00',
    venue: 'ONLINE',
    teamsJoinUrl: TEAMS_DEMO,
    category: 'Product',
    banner: 'red',
    description:
      'A deep dive into M-PESA products, tariffs and transaction limits, with hands-on scenarios for frontline staff.',
    modules: mod('tt', [
      ['M-PESA product portfolio', 30],
      ['Tariffs & transaction limits', 40],
      ['Lipa na M-PESA overview', 30],
    ]),
    quiz: q('tt', [
      ['What is "Lipa na M-PESA" used for?', ['Paying merchants', 'Opening a bank account', 'Buying a SIM', 'Resetting a PIN'], 0],
      ['Transaction limits exist mainly to…', ['Slow down customers', 'Comply with regulation and reduce risk', 'Increase fees', 'Limit agents'], 1],
      ['Who sets the M-PESA tariff?', ['Each agent', 'The customer', 'M-PESA (published tariff)', 'The bank'], 2],
    ]),
    quizSettings: { timeLimitMinutes: 15, maxAttempts: 2, shuffle: true },
  },
  {
    id: 'fayda-integration',
    cover: '/covers/fayda-integration.jpg',
    title: 'M-PESA INTGRATION WITH FAYDA (NID) Via Web',
    trainer: 'Mariamawit Fekadeselase',
    date: '2026-06-30',
    startTime: '10:00',
    endTime: '23:00',
    venue: 'ONLINE',
    teamsJoinUrl: TEAMS_DEMO,
    recording: '/trainings/Module (2).mp4',
    category: 'Compliance',
    banner: 'fayda',
    bannerTitle: 'National ID (Fayda)\nFor M-PESA',
    description:
      'Learn how M-PESA integrates with Fayda, the Ethiopian National ID, to verify customers digitally through the web portal — speeding up registration and strengthening KYC.',
    modules: mod('fy', [
      ['What is Fayda?', 20],
      ['Web portal walkthrough', 40],
      ['Verifying a customer with their FIN', 35],
      ['Troubleshooting failed verifications', 25],
    ]),
    quiz: q('fy', [
      ['Fayda is Ethiopia’s…', ['Mobile network', 'National ID program', 'Central bank', 'Tax authority'], 1],
      ['Fayda verification mainly improves…', ['Airtime sales', 'Customer KYC', 'Network speed', 'Agent commissions'], 1],
      ['If verification fails, the first step is to…', ['Register anyway', 'Re-check the FIN and customer details', 'Close the account', 'Call the police'], 1],
    ]),
    quizSettings: { timeLimitMinutes: 10, maxAttempts: 3, shuffle: true },
  },
  {
    id: 'b2c-south-radio',
    cover: '/covers/b2c-south-radio.jpg',
    title: 'M-PESA B2C Service for South Radio and Television Agency',
    trainer: 'Bereket Belay',
    date: '2026-07-08',
    startTime: '14:00',
    endTime: '17:00',
    venue: 'ONLINE',
    teamsJoinUrl: TEAMS_DEMO,
    recording: '/trainings/Module (3).mp4',
    category: 'Business',
    banner: 'green',
    bannerTitle: 'M-PESA Bulk\nService',
    description:
      'A tailored session for the South Radio and Television Agency on paying staff, suppliers and partners in bulk using the M-PESA B2C service.',
    modules: mod('b2c', [
      ['Introduction to B2C & bulk payments', 25],
      ['Setting up the organisation portal', 35],
      ['Uploading a bulk payment file', 30],
      ['Reconciliation & reporting', 30],
    ]),
    quiz: q('b2c', [
      ['B2C stands for…', ['Bank to Customer', 'Business to Customer', 'Buy to Collect', 'Broker to Client'], 1],
      ['Bulk payments are uploaded via…', ['USSD', 'The organisation portal', 'SMS', 'An agent'], 1],
      ['Reconciliation helps to…', ['Match payments with records', 'Reset PINs', 'Buy airtime', 'Register customers'], 0],
    ]),
    quizSettings: { timeLimitMinutes: 20, maxAttempts: 2, shuffle: true },
  },
  {
    id: 'account-optimization',
    cover: '/covers/account-optimization.jpg',
    title: 'M-PESA Account Optimization for Agents and Merchants',
    trainer: 'Dereje Desta',
    date: '2026-10-08',
    startTime: '09:00',
    endTime: '18:00',
    venue: 'Addis Ababa HQ — Hall B',
    teamsJoinUrl: TEAMS_DEMO,
    recording: '/trainings/Module (4).mp4',
    category: 'Agents',
    banner: 'optimization',
    bannerTitle: 'M-PESA ACCOUNT\nOPTIMIZATION',
    description:
      'Practical techniques for agents and merchants to keep their float healthy, increase transaction volumes and resolve account issues quickly.',
    modules: mod('ao', [
      ['Float management', 30],
      ['Growing transaction volume', 30],
      ['Account limits & upgrades', 25],
      ['Dispute resolution', 25],
    ]),
    quiz: q('ao', [
      ['Float refers to…', ['An agent’s available e-money and cash', 'A customer complaint', 'A type of SIM', 'A tariff band'], 0],
      ['A good way to grow volume is to…', ['Close early', 'Keep sufficient float at peak hours', 'Refuse small transactions', 'Charge extra'], 1],
      ['Disputes should be…', ['Ignored', 'Logged and escalated through official channels', 'Settled in cash', 'Posted online'], 1],
    ]),
    quizSettings: { timeLimitMinutes: 15, maxAttempts: 3, shuffle: false },
  },
  {
    id: 'merchant-payments',
    cover: '/covers/merchant-payments.jpg',
    title: 'Lipa na M-PESA: Merchant Payments in the Market',
    trainer: 'Bereket Belay',
    date: '2026-10-21',
    startTime: '10:00',
    endTime: '13:00',
    venue: 'Hawassa Regional Office',
    category: 'Merchants',
    banner: 'merchant',
    bannerTitle: 'Pay with\nM-PESA',
    description:
      'Equip market merchants to accept QR and till payments, understand settlement, and promote cashless payments to their customers.',
    modules: mod('mp', [
      ['Till numbers & QR codes', 25],
      ['Accepting a payment step by step', 30],
      ['Settlement & withdrawals', 25],
    ]),
    quiz: q('mp', [
      ['Customers can pay a merchant by…', ['Scanning a QR code or entering a till number', 'Sending a letter', 'Calling the merchant', 'Visiting a bank'], 0],
      ['A merchant confirms payment by…', ['Trusting the customer', 'Checking the M-PESA confirmation SMS', 'Waiting a week', 'Asking a neighbour'], 1],
      ['Settlement moves funds…', ['To the merchant’s account', 'To the customer', 'To an agent', 'Nowhere'], 0],
    ]),
    quizSettings: { timeLimitMinutes: 10, maxAttempts: 2, shuffle: true },
  },
  {
    id: 'fraud-awareness',
    isPublic: true,
    cover: '/covers/fraud-awareness.jpg',
    title: 'Fraud Awareness & Customer Protection',
    trainer: 'Mariamawit Fekadeselase',
    date: '2026-11-04',
    startTime: '14:00',
    endTime: '16:30',
    venue: 'ONLINE',
    teamsJoinUrl: TEAMS_DEMO,
    category: 'Compliance',
    banner: 'dark',
    bannerTitle: 'Stay Safe\nwith M-PESA',
    description:
      'Recognise common fraud patterns — SIM swap, phishing and fake reversals — and learn how to protect customers and report incidents.',
    modules: mod('fa', [
      ['Common fraud schemes', 30],
      ['Social engineering red flags', 25],
      ['Reporting & escalation', 20],
    ]),
    quiz: q('fa', [
      ['A caller asks for a customer’s PIN to “fix” their account. This is…', ['Normal', 'A social engineering attempt', 'A promotion', 'A system update'], 1],
      ['A sudden SIM swap request should be…', ['Approved instantly', 'Verified carefully with ID', 'Ignored', 'Done by phone'], 1],
      ['Suspected fraud should be…', ['Reported immediately', 'Kept secret', 'Shared on social media', 'Handled with cash'], 0],
    ]),
    quizSettings: { timeLimitMinutes: 12, maxAttempts: 3, shuffle: true },
  },
  {
    id: 'mpesa-app-features',
    isPublic: true,
    cover: '/covers/mpesa-app-features.jpg',
    title: 'Getting the Most from the M-PESA Super App',
    trainer: 'Dereje Desta',
    date: '2026-11-19',
    startTime: '09:30',
    endTime: '12:00',
    venue: 'ONLINE',
    teamsJoinUrl: TEAMS_DEMO,
    category: 'Product',
    banner: 'red',
    description:
      'A tour of the M-PESA app: mini-apps, statements, savings and how to guide customers through self-service features.',
    modules: mod('sa', [
      ['App onboarding & login', 20],
      ['Mini-apps & bill payments', 30],
      ['Statements & self-service', 25],
    ]),
    quiz: q('sa', [
      ['Customers can download statements from…', ['The M-PESA app', 'A radio station', 'A fax machine', 'Nowhere'], 0],
      ['Mini-apps let customers…', ['Use partner services inside M-PESA', 'Change networks', 'Print money', 'Skip KYC'], 0],
      ['App login is secured by…', ['The customer’s PIN or biometrics', 'Their name', 'Their birthday', 'Nothing'], 0],
    ]),
    quizSettings: { timeLimitMinutes: 8, maxAttempts: 2, shuffle: false },
  },
]

// Fayda decks are downloadable for Enterprise Sales only; other learners read them in the portal (D4).
trainings
  .find((t) => t.id === 'fayda-integration')
  ?.modules.forEach((m) => {
    if (m.kind === 'document') m.downloadGroupIds = ['g4']
  })

/** Seed progress so the dashboard starts with realistic history. */
export const seedProgress: Record<string, TrainingProgress> = {
  'test-training-3': {
    completedModules: trainings[0].modules.map((m) => m.id),
    quizScore: 100,
    attended: true,
    checkInAt: '2026-06-18T00:44:00',
    checkInMethod: 'teams',
    feedback: { likert: [5, 4, 5, 5], recommend: true, comment: 'Clear and well paced.', anonymous: false, submittedAt: '2026-06-18T03:05:00' },
    completedAt: '2026-06-18',
  },
  // Modules done but the quiz isn't passed yet.
  'fayda-integration': {
    completedModules: trainings[2].modules.map((m) => m.id),
    quizScore: 67,
    attended: true,
    checkInAt: '2026-06-30T10:22:00',
    checkInMethod: 'teams',
  },
  'b2c-south-radio': {
    completedModules: trainings[3].modules.map((m) => m.id),
    quizScore: 100,
    attended: true,
    checkInAt: '2026-07-08T14:03:00',
    checkInMethod: 'teams',
    feedback: { likert: [4, 5, 4, 4], recommend: true, comment: '', anonymous: true, submittedAt: '2026-07-08T17:10:00' },
    completedAt: '2026-07-08',
  },
  'account-optimization': {
    completedModules: [trainings[4].modules[0].id],
  },
}

export const PASS_MARK = 70

/** Check-ins after this many minutes count as Late (URS 2.7 example; admins can change it). */
export const LATE_WINDOW_MINUTES = 15

/** Minimum reading time before a document can be marked complete; shortened for the demo. */
export const DOCUMENT_MIN_SECONDS = 10

/** Feedback statements: trainer, content, logistics, overall (URS 2.6), answered on a 5-point Likert scale (TA-4.3). */
export const FEEDBACK_STATEMENTS = [
  'The trainer explained topics clearly and answered questions well.',
  'The content was relevant and useful for my role.',
  'Timing, venue or online tools worked well.',
  'Overall, the training met my expectations.',
]
export const LIKERT = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']
