import { DEFAULT_RULES, demoMeeting, simulateAttendance } from './teams/attendance'
import type { AdminData, AdminTraining, Person } from './types'

// Small deterministic PRNG so seed data is stable across reloads.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}
const rand = rng(58)
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]

const names = [
  'Awet Gebrehiwet', 'Atsede Gebre', 'Lelisa Asmare', 'Fasil Wale', 'Mati Yohanis', 'Temesgen Mezgebe', 'Hana Tesfaye',
  'Abel Kebede', 'Selam Haile', 'Dawit Mengistu', 'Meron Alemu', 'Yonas Girma', 'Bethlehem Tadesse', 'Kidus Bekele',
  'Rahel Desta', 'Natnael Worku', 'Saron Ayele', 'Biniam Tekle', 'Eden Solomon', 'Henok Abebe', 'Liya Fikru',
  'Robel Assefa', 'Tsion Mulugeta', 'Samuel Getachew', 'Mahlet Wondimu', 'Eyob Negash', 'Feven Hailu', 'Nahom Sisay',
  'Ruth Gebremedhin', 'Mikias Tilahun', 'Hiwot Lemma', 'Amanuel Berhe',
]
const departments = ['Call Center', 'Retail', 'Enterprise', 'Agent Network', 'Compliance', 'Marketing']

const slug = (name: string) => name.toLowerCase().replace(' ', '.')

const participants: Person[] = names.map((name, i) => ({
  id: `u${i + 1}`,
  name,
  email: `${slug(name)}@partner.safaricom.et`,
  phone: `07${String(10000000 + Math.floor(rand() * 89999999))}`,
  role: 'Participant',
  status: i % 11 === 10 ? 'Inactive' : 'Active',
  department: i < 21 ? 'Call Center' : pick(departments),
  groupIds: i < 21 ? ['g1'] : [pick(['g2', 'g3', 'g4'])],
  createdAt: `2026-0${1 + (i % 8)}-${String(3 + (i % 25)).padStart(2, '0')}`,
}))

const staff: Person[] = [
  { id: 's1', name: 'Fasil Wolde', email: 'fasil.wolde@safaricom.et', phone: '0711223344', role: 'Admin', status: 'Active', department: 'Learning & Development', groupIds: [], createdAt: '2025-11-02' },
  { id: 's2', name: 'Mariamawit Fekadeselase', email: 'mariamawit.f@safaricom.et', phone: '0711000002', role: 'Trainer', status: 'Active', department: 'Learning & Development', groupIds: [], createdAt: '2025-12-10' },
  { id: 's3', name: 'Dereje Desta', email: 'dereje.desta@safaricom.et', phone: '0711000003', role: 'Trainer', status: 'Active', department: 'Learning & Development', groupIds: [], createdAt: '2026-01-15' },
  { id: 's4', name: 'Bereket Belay', email: 'bereket.belay@safaricom.et', phone: '0711000004', role: 'Trainer', status: 'Active', department: 'Enterprise', groupIds: [], createdAt: '2026-02-20' },
]

const ids = (from: number, to: number) => participants.slice(from, to).map((p) => p.id)

function progressFor(participantIds: string[], moduleIds: string[], level: number) {
  const out: AdminTraining['progress'] = {}
  participantIds.forEach((pid) => {
    out[pid] = {}
    moduleIds.forEach((mid) => {
      const v = level >= 100 ? 100 : level <= 0 ? 0 : Math.max(0, Math.min(100, Math.round(level + (rand() - 0.5) * 60)))
      out[pid][mid] = v
    })
  })
  return out
}

export const seedAdminData = (): AdminData => {
  const materials: AdminData['materials'] = [
    { id: 'mat1', title: 'M-PESA Consumer Registration', type: 'DOCUMENT', minutes: 5, description: 'Step-by-step guide to registering a new consumer, including KYC requirements and Fayda verification.', updatedAt: '2026-09-12' },
    { id: 'mat2', title: 'Enterprise Onboarding Playbook', type: 'DOCUMENT', minutes: 12, description: 'How enterprise customers are onboarded to B2C, C2B and bulk payment services.', updatedAt: '2026-09-02' },
    { id: 'mat3', title: 'Consumer Products & Services Overview', type: 'PRESENTATION', minutes: 20, description: 'Send money, Lipa na M-PESA, airtime, savings and loans — features, tariffs and limits.', updatedAt: '2026-08-28' },
    { id: 'mat4', title: 'Handling Difficult Calls', type: 'VIDEO', minutes: 18, description: 'Role-play video demonstrating de-escalation techniques for call center agents.', updatedAt: '2026-08-15' },
    { id: 'mat5', title: 'PIN Reset & Account Unlock Procedure', type: 'DOCUMENT', minutes: 8, description: 'Secure procedure for verifying customers and resetting their M-PESA PIN.', updatedAt: '2026-07-30' },
    { id: 'mat6', title: 'Fraud Red Flags Checklist', type: 'DOCUMENT', minutes: 6, description: 'Common fraud patterns (SIM swap, phishing, fake reversals) and how to escalate.', updatedAt: '2026-07-21' },
    { id: 'mat7', title: 'Agent Float Management', type: 'VIDEO', minutes: 15, description: 'Keeping float healthy, rebalancing and working with super-agents.', updatedAt: '2026-07-04' },
    { id: 'mat8', title: 'M-PESA App Walkthrough', type: 'LINK', minutes: 10, description: 'Interactive walkthrough of the M-PESA super app and its mini-apps.', updatedAt: '2026-06-18' },
  ]

  const journeys: AdminData['journeys'] = [
    {
      id: 'j1',
      name: 'M-PESA Call Center Training',
      description: 'Core onboarding journey for call center agents supporting consumer and enterprise customers.',
      modules: [
        { id: 'j1m1', title: 'M-PESA Consumer Service', materialIds: ['mat1'] },
        { id: 'j1m2', title: 'M-PESA Enterprise Service', materialIds: ['mat2'] },
        { id: 'j1m3', title: 'M-PESA Consumer Products and Services', materialIds: ['mat3'] },
      ],
    },
    {
      id: 'j2',
      name: 'Customer Care Excellence',
      description: 'Soft skills and secure procedures for frontline staff.',
      modules: [
        { id: 'j2m1', title: 'Handling Difficult Calls', materialIds: ['mat4'] },
        { id: 'j2m2', title: 'Secure Account Procedures', materialIds: ['mat5', 'mat6'] },
      ],
    },
    {
      id: 'j3',
      name: 'Agent Network Essentials',
      description: 'Everything new agents need to operate an M-PESA outlet.',
      modules: [
        { id: 'j3m1', title: 'Registering Customers', materialIds: ['mat1'] },
        { id: 'j3m2', title: 'Float Management', materialIds: ['mat7'] },
        { id: 'j3m3', title: 'Fraud Prevention', materialIds: ['mat6'] },
        { id: 'j3m4', title: 'The M-PESA App', materialIds: ['mat8'] },
      ],
    },
  ]

  const modulesOf = (jid: string) => journeys.find((j) => j.id === jid)!.modules.map((m) => m.id)

  const trainings: AdminTraining[] = [
    {
      id: 't58', name: 'M-PESA Call Center Training-Batch 58', journeyId: 'j1', typeId: 'tt1', trainerId: 's2',
      date: '2026-10-08', startTime: '09:00', endTime: '17:00', location: 'ISON Office', recurring: false, status: 'SCHEDULED',
      participantIds: ids(0, 21), feedbackFormId: 'ff1', progress: progressFor(ids(0, 21), modulesOf('j1'), 100),
    },
    {
      id: 't57', name: 'M-PESA Call Center Training-Batch 57', journeyId: 'j1', typeId: 'tt1', trainerId: 's2',
      date: '2026-09-24', startTime: '09:00', endTime: '17:00', location: 'ISON Office', recurring: false, status: 'COMPLETED',
      participantIds: ids(4, 22), preAssessmentId: 'a1', postAssessmentId: 'a2', feedbackFormId: 'ff1', progress: progressFor(ids(4, 22), modulesOf('j1'), 100),
    },
    {
      id: 't59', name: 'M-PESA Call Center Training-Batch 59', journeyId: 'j1', typeId: 'tt1', trainerId: 's3',
      date: '2026-10-22', startTime: '09:00', endTime: '17:00', location: 'ISON Office', recurring: false, status: 'SCHEDULED',
      participantIds: ids(10, 28), preAssessmentId: 'a1', postAssessmentId: 'a2', feedbackFormId: 'ff1', progress: progressFor(ids(10, 28), modulesOf('j1'), 0),
    },
    {
      id: 't60', name: 'Customer Care Excellence-Cohort 12', journeyId: 'j2', typeId: 'tt2', trainerId: 's3',
      date: '2026-10-06', startTime: '13:00', endTime: '17:00', location: 'Safaricom HQ — Room 4B', recurring: true, status: 'ONGOING',
      participantIds: ids(18, 32), postAssessmentId: 'a3', feedbackFormId: 'ff2', progress: progressFor(ids(18, 32), modulesOf('j2'), 55),
    },
    {
      id: 't61', name: 'Agent Network Essentials-Hawassa', journeyId: 'j3', typeId: 'tt3', trainerId: 's4',
      date: '2026-11-03', startTime: '10:00', endTime: '16:00', location: 'Hawassa Regional Office', recurring: false, status: 'SCHEDULED',
      participantIds: ids(21, 32), feedbackFormId: 'ff2', progress: progressFor(ids(21, 32), modulesOf('j3'), 0),
    },
    {
      id: 't62', name: 'Agent Network Essentials-Adama', journeyId: 'j3', typeId: 'tt3', trainerId: 's4',
      date: '2026-08-19', startTime: '10:00', endTime: '16:00', location: 'Adama Branch', recurring: false, status: 'COMPLETED',
      participantIds: ids(12, 26), postAssessmentId: 'a3', feedbackFormId: 'ff2', progress: progressFor(ids(12, 26), modulesOf('j3'), 100),
    },
    {
      id: 't63', name: 'Customer Care Excellence-Cohort 11', journeyId: 'j2', typeId: 'tt2', trainerId: 's2',
      date: '2026-09-09', startTime: '13:00', endTime: '17:00', location: 'ONLINE', recurring: true, status: 'CANCELLED',
      participantIds: ids(0, 8), progress: progressFor(ids(0, 8), modulesOf('j2'), 0),
    },
  ]

  // Teams-delivered sessions get a meeting; past ones already have attendance synced.
  const people = [...staff, ...participants]
  trainings.forEach((t) => {
    if (['t57', 't58', 't59', 't60', 't63'].includes(t.id)) t.teamsMeeting = demoMeeting(t.id)
    if (t.id === 't57' || t.id === 't60') {
      t.attendance = { syncedAt: `${t.date}T${t.endTime}:30`, source: 'simulated', records: simulateAttendance(t, people, new Date(`${t.date}T23:59:00`).getTime()) }
    }
  })

  const assessments: AdminData['assessments'] = [
    {
      id: 'a1', title: 'Call Center Readiness — Pre-Assessment', kind: 'PRE', passMark: 0,
      questions: [
        { id: 'a1q1', question: 'Which document is required to register an M-PESA customer?', options: ['Utility bill', 'Valid government ID', 'Bank card'], answer: 1 },
        { id: 'a1q2', question: 'What should a customer never share?', options: ['Phone number', 'M-PESA PIN', 'Name'], answer: 1 },
      ],
    },
    {
      id: 'a2', title: 'Call Center Certification — Post-Assessment', kind: 'POST', passMark: 70,
      questions: [
        { id: 'a2q1', question: 'B2C stands for…', options: ['Bank to Customer', 'Business to Customer', 'Buy to Collect'], answer: 1 },
        { id: 'a2q2', question: 'A caller asks for a PIN to "fix" an account. This is…', options: ['Normal', 'Social engineering', 'A promotion'], answer: 1 },
        { id: 'a2q3', question: 'Fayda is Ethiopia’s…', options: ['National ID program', 'Mobile network', 'Tax authority'], answer: 0 },
      ],
    },
    {
      id: 'a3', title: 'Customer Care & Agent Essentials — Final Quiz', kind: 'POST', passMark: 75,
      questions: [
        { id: 'a3q1', question: 'Float refers to…', options: ['Agent e-money and cash', 'A complaint', 'A tariff'], answer: 0 },
        { id: 'a3q2', question: 'Suspected fraud should be…', options: ['Ignored', 'Reported immediately', 'Shared online'], answer: 1 },
      ],
    },
  ]

  const feedbackForms: AdminData['feedbackForms'] = [
    { id: 'ff1', title: 'Training Feedback', questions: ['Overall, how satisfied were you with the training?', 'How relevant was the content to your role?', 'How effective was the trainer?'] },
    { id: 'ff2', title: 'Short Session Feedback', questions: ['How useful was this session?', 'Would you recommend it to a colleague?'] },
  ]

  const comments = [
    'Very practical, the role-plays helped a lot.',
    'Great trainer, clear explanations.',
    'Would like more time on enterprise services.',
    'The registration walkthrough was excellent.',
    'Room was a bit crowded but content was good.',
    'Please share the slides after the session.',
    '',
  ]
  const feedbackResponses: AdminData['feedbackResponses'] = []
  trainings
    .filter((t) => t.feedbackFormId && t.status !== 'CANCELLED' && t.status !== 'SCHEDULED')
    .concat(trainings[0])
    .forEach((t) => {
      const form = feedbackForms.find((f) => f.id === t.feedbackFormId)!
      t.participantIds.slice(0, Math.ceil(t.participantIds.length * 0.7)).forEach((pid, i) => {
        feedbackResponses.push({
          id: `fr-${t.id}-${pid}`,
          formId: form.id,
          trainingId: t.id,
          participantId: pid,
          ratings: form.questions.map(() => 3 + Math.round(rand() * 2)),
          comment: comments[i % comments.length],
          submittedAt: t.date,
        })
      })
    })

  const requests: AdminData['requests'] = [
    { id: 'r1', requesterId: 'u22', topic: 'Fraud awareness refresher for retail staff', journeyId: 'j2', participants: 15, preferredDate: '2026-10-28', reason: 'Recent rise in SIM swap fraud attempts reported at our shops.', status: 'PENDING', createdAt: '2026-10-05' },
    { id: 'r2', requesterId: 'u25', topic: 'Agent onboarding — Bahir Dar', journeyId: 'j3', participants: 24, preferredDate: '2026-11-12', reason: 'New agents recruited in the Amhara region need onboarding.', status: 'PENDING', createdAt: '2026-10-03' },
    { id: 'r3', requesterId: 'u27', topic: 'Enterprise B2C portal training', journeyId: 'j1', participants: 8, preferredDate: '2026-10-15', reason: 'Two new enterprise clients going live this month.', status: 'APPROVED', createdAt: '2026-09-26' },
    { id: 'r4', requesterId: 'u30', topic: 'Marketing team — product overview', participants: 6, preferredDate: '2026-09-30', reason: 'Campaign planning for Q4 launch.', status: 'REJECTED', createdAt: '2026-09-18' },
  ]

  const templates: AdminData['templates'] = [
    { id: 'ct1', name: 'M-PESA Classic', accent: 'green', title: 'Certificate of Completion', isDefault: true },
    { id: 'ct2', name: 'Safaricom Red', accent: 'red', title: 'Certificate of Achievement', isDefault: false },
    { id: 'ct3', name: 'Executive Dark', accent: 'dark', title: 'Certificate of Excellence', isDefault: false },
  ]

  const trainingTypes: AdminData['trainingTypes'] = [
    { id: 'tt1', name: 'Call Center Onboarding', category: 'Partner', level: 'Beginner', description: 'Initial certification for outsourced call center agents.' },
    { id: 'tt2', name: 'Customer Care Upskilling', category: 'Internal', level: 'Intermediate', description: 'Soft-skills and procedures refresher for frontline staff.' },
    { id: 'tt3', name: 'Agent Onboarding', category: 'Partner', level: 'Beginner', description: 'Onboarding for new M-PESA agents and merchants.' },
    { id: 'tt4', name: 'Enterprise Client Enablement', category: 'Customer', level: 'Advanced', description: 'Portal and API training for enterprise customers.' },
  ]

  const auditLogs: AdminData['auditLogs'] = [
    ['Fasil Wolde', 'Created training', 'M-PESA Call Center Training-Batch 58', '2026-10-01T09:14:00'],
    ['Fasil Wolde', 'Invited 21 participants', 'M-PESA Call Center Training-Batch 58', '2026-10-01T09:20:00'],
    ['Mariamawit Fekadeselase', 'Uploaded material', 'M-PESA Consumer Registration', '2026-09-12T15:02:00'],
    ['Fasil Wolde', 'Approved training request', 'Enterprise B2C portal training', '2026-09-27T11:40:00'],
    ['Fasil Wolde', 'Rejected training request', 'Marketing team — product overview', '2026-09-19T10:05:00'],
    ['Dereje Desta', 'Completed training', 'M-PESA Call Center Training-Batch 57', '2026-09-24T17:10:00'],
    ['Fasil Wolde', 'Cancelled training', 'Customer Care Excellence-Cohort 11', '2026-09-08T08:30:00'],
    ['Fasil Wolde', 'Created group', 'Call Center — ISON', '2026-08-30T13:22:00'],
  ].map(([actor, action, target, at], i) => ({ id: `al${i + 1}`, actor, action, target, at }))

  return {
    materials,
    journeys,
    people,
    groups: [
      { id: 'g1', name: 'Call Center — ISON', description: 'Outsourced call center agents at ISON.' },
      { id: 'g2', name: 'Retail Shops', description: 'Safaricom retail shop staff.' },
      { id: 'g3', name: 'Agent Network', description: 'Field agents and super-agents.' },
      { id: 'g4', name: 'Enterprise Sales', description: 'Enterprise account managers.' },
    ],
    trainings,
    requests,
    assessments,
    feedbackForms,
    feedbackResponses,
    templates,
    trainingTypes,
    auditLogs,
    attendanceRules: DEFAULT_RULES,
  }
}
