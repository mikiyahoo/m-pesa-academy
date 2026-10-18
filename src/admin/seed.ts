import { DEFAULT_RULES, demoMeeting, simulateAttendance } from './teams/attendance'
import { localISO } from '../lib/utils'
import { runIssuing, scanAlerts } from './insights'
import type { AdminData, AdminTraining, Checkin, Person } from './types'

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
  // Partner staff are temporary users with an access window (TA-1.4). A few show other states:
  // u4 expires within a week, u8 has already expired, and the Inactive ones read as revoked.
  designation: i < 21 ? 'Call Center Agent' : 'Field Representative',
  organization: i < 21 ? 'ISON Africa' : 'M-PESA Partner Network',
  region: i < 21 ? 'Addis Ababa' : pick(['Sidama', 'Oromia', 'Amhara']),
  accessStart: '2026-08-01',
  accessEnd: i === 3 ? '2026-10-16' : i === 7 ? '2026-10-05' : '2026-12-31',
  invitedAt: '2026-07-28T10:00:00',
  invitedBy: 'Fasil Wolde',
  acceptedAt: '2026-08-01T09:12:00',
  inviteToken: `inv-seed-u${i + 1}`,
}))

// A fresh invite that hasn't been accepted yet; open /accept/demo-invite to sign in as her.
// Her profile is incomplete on purpose so the first-login profile step appears (TE-1.1).
const pendingInvite: Person = {
  id: 'u33',
  name: 'Selam Getachew',
  email: 'selam.getachew@gmail.com',
  phone: '0912345678',
  role: 'Participant',
  status: 'Active',
  department: '',
  groupIds: ['g3'],
  createdAt: '2026-10-10',
  organization: 'Hawassa Agent Network',
  accessStart: '2026-10-10',
  accessEnd: '2026-12-03',
  invitedAt: '2026-10-10T15:40:00',
  invitedBy: 'Bereket Belay',
  inviteToken: 'demo-invite',
}
participants.push(pendingInvite)

const staff: Person[] = [
  { id: 's1', name: 'Fasil Wolde', email: 'fasil.wolde@safaricom.et', phone: '0711223344', role: 'Admin', status: 'Active', department: 'Learning & Development', groupIds: [], createdAt: '2025-11-02' },
  { id: 's2', name: 'Mariamawit Fekadeselase', email: 'mariamawit.f@safaricom.et', phone: '0711000002', role: 'Trainer', status: 'Active', department: 'Learning & Development', groupIds: [], createdAt: '2025-12-10' },
  { id: 's3', name: 'Dereje Desta', email: 'dereje.desta@safaricom.et', phone: '0711000003', role: 'Trainer', status: 'Active', department: 'Learning & Development', groupIds: [], createdAt: '2026-01-15', canApprove: true },
  { id: 's4', name: 'Bereket Belay', email: 'bereket.belay@safaricom.et', phone: '0711000004', role: 'Trainer', status: 'Active', department: 'Enterprise', groupIds: [], createdAt: '2026-02-20' },
  // Team representatives flagged as requesters (TA-1.7).
  { id: 's5', name: 'Kalkidan Mekonnen', email: 'kalkidan.mekonnen@safaricom.et', phone: '0711334455', role: 'Participant', status: 'Active', department: 'Call Center Operations', groupIds: [], createdAt: '2026-03-04', isRequester: true },
  { id: 's6', name: 'Yared Alemayehu', email: 'yared.alemayehu@safaricom.et', phone: '0711000006', role: 'Participant', status: 'Active', department: 'Retail Operations', groupIds: [], createdAt: '2026-03-18', isRequester: true },
  { id: 's7', name: 'Mekdes Tadesse', email: 'mekdes.tadesse@safaricom.et', phone: '0711000007', role: 'Participant', status: 'Active', department: 'Enterprise Sales', groupIds: [], createdAt: '2026-04-02', isRequester: true },
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
    {
      id: 'mat1', title: 'M-PESA Consumer Registration', type: 'DOCUMENT', minutes: 5,
      description: 'Step-by-step guide to registering a new consumer, including KYC requirements and Fayda verification.',
      updatedAt: '2026-09-12', level: 'Beginner', skills: ['KYC', 'Customer registration'], thumbnail: 'red', minViewSeconds: 300,
      downloadableGroupIds: ['g1', 'g2', 'g3', 'g4'], visibleGroupIds: [], taggedTrainerIds: ['s2', 's3'], version: 2,
      history: [
        { at: '2026-09-12T10:00:00', by: 'Mariamawit Fekadeselase', change: 'Replaced file — added the new Fayda flow (version 2)' },
        { at: '2026-08-20T09:00:00', by: 'Mariamawit Fekadeselase', change: 'Created' },
      ],
    },
    {
      id: 'mat2', title: 'Enterprise Onboarding Playbook', type: 'DOCUMENT', minutes: 12,
      description: 'How enterprise customers are onboarded to B2C, C2B and bulk payment services.',
      updatedAt: '2026-09-02', level: 'Intermediate', skills: ['B2C', 'Enterprise onboarding'], thumbnail: 'blue', minViewSeconds: 600,
      downloadableGroupIds: ['g4'], visibleGroupIds: ['g4'], taggedTrainerIds: ['s4'], version: 1,
      history: [{ at: '2026-09-02T11:30:00', by: 'Bereket Belay', change: 'Created' }],
    },
    {
      id: 'mat3', title: 'Consumer Products & Services Overview', type: 'PRESENTATION', minutes: 20,
      description: 'Send money, Lipa na M-PESA, airtime, savings and loans — features, tariffs and limits.',
      updatedAt: '2026-08-28', level: 'Beginner', skills: ['Products', 'Tariffs & limits'], thumbnail: 'green',
      downloadableGroupIds: [], visibleGroupIds: [], taggedTrainerIds: ['s2'], version: 3,
      history: [
        { at: '2026-08-28T14:00:00', by: 'Mariamawit Fekadeselase', change: 'Replaced file — November tariffs (version 3)' },
        { at: '2026-08-10T09:00:00', by: 'Mariamawit Fekadeselase', change: 'Replaced file (version 2)' },
        { at: '2026-07-25T09:00:00', by: 'Mariamawit Fekadeselase', change: 'Created' },
      ],
    },
    {
      id: 'mat4', title: 'Handling Difficult Calls', type: 'VIDEO', minutes: 18,
      description: 'Role-play video demonstrating de-escalation techniques for call center agents.',
      updatedAt: '2026-08-15', level: 'Intermediate', skills: ['De-escalation', 'Call handling'], thumbnail: 'amber',
      url: '/trainings/Module%20(2).mp4', downloadableGroupIds: [], visibleGroupIds: [], taggedTrainerIds: ['s3'], version: 1,
      history: [{ at: '2026-08-15T15:00:00', by: 'Dereje Desta', change: 'Created — streamed, not downloadable (D4)' }],
    },
    {
      id: 'mat5', title: 'PIN Reset & Account Unlock Procedure', type: 'DOCUMENT', minutes: 8,
      description: 'Secure procedure for verifying customers and resetting their M-PESA PIN.',
      updatedAt: '2026-07-30', level: 'Advanced', skills: ['PIN reset', 'Account security'], thumbnail: 'red', minViewSeconds: 240,
      downloadableGroupIds: ['g1'], visibleGroupIds: ['g1'], taggedTrainerIds: ['s2'], version: 1,
      history: [{ at: '2026-07-30T08:00:00', by: 'Mariamawit Fekadeselase', change: 'Created' }],
    },
    {
      id: 'mat6', title: 'Fraud Red Flags Checklist', type: 'DOCUMENT', minutes: 6,
      description: 'Common fraud patterns (SIM swap, phishing, fake reversals) and how to escalate.',
      updatedAt: '2026-07-21', level: 'Beginner', skills: ['Fraud awareness', 'Escalation'], thumbnail: 'zinc', minViewSeconds: 180,
      downloadableGroupIds: [], visibleGroupIds: [], taggedTrainerIds: ['s3'], version: 2,
      history: [
        { at: '2026-07-21T10:00:00', by: 'Dereje Desta', change: 'Replaced file — added fake-reversal pattern (version 2)' },
        { at: '2026-07-01T10:00:00', by: 'Dereje Desta', change: 'Created' },
      ],
    },
    {
      id: 'mat7', title: 'Agent Float Management', type: 'VIDEO', minutes: 15,
      description: 'Keeping float healthy, rebalancing and working with super-agents.',
      updatedAt: '2026-07-04', level: 'Intermediate', skills: ['Float management', 'Agent operations'], thumbnail: 'fayda',
      url: '/trainings/Module%20(3).mp4', downloadableGroupIds: [], visibleGroupIds: ['g3'], taggedTrainerIds: ['s4'], version: 1,
      history: [{ at: '2026-07-04T09:00:00', by: 'Bereket Belay', change: 'Created — visible to the Agent Network group only' }],
    },
    {
      id: 'mat8', title: 'M-PESA App Walkthrough', type: 'LINK', minutes: 10,
      description: 'Interactive walkthrough of the M-PESA super app and its mini-apps.',
      updatedAt: '2026-06-18', level: 'Novice', skills: ['M-PESA app', 'Self-service'], thumbnail: 'blue',
      url: 'https://www.m-pesa.com/app-walkthrough', downloadableGroupIds: [], visibleGroupIds: [], taggedTrainerIds: ['s2'], version: 1,
      history: [{ at: '2026-06-18T12:00:00', by: 'Mariamawit Fekadeselase', change: 'Created' }],
    },
  ]

  const journeys: AdminData['journeys'] = [
    {
      id: 'j1',
      name: 'M-PESA Call Center Training',
      description: 'Core onboarding journey for call center agents supporting consumer and enterprise customers.',
      startDate: '2026-08-01',
      endDate: '2026-12-31',
      modules: [
        { id: 'j1m1', title: 'M-PESA Consumer Service', materialIds: ['mat1'] },
        { id: 'j1m2', title: 'M-PESA Enterprise Service', materialIds: ['mat2'] },
        { id: 'j1m3', title: 'M-PESA Consumer Products and Services', materialIds: ['mat3'], assessmentId: 'a2' },
      ],
    },
    {
      id: 'j2',
      name: 'Customer Care Excellence',
      description: 'Soft skills and secure procedures for frontline staff.',
      startDate: '2026-09-01',
      endDate: '2027-01-31',
      modules: [
        { id: 'j2m1', title: 'Handling Difficult Calls', materialIds: ['mat4'] },
        { id: 'j2m2', title: 'Secure Account Procedures', materialIds: ['mat5', 'mat6'], assessmentId: 'a3' },
      ],
    },
    {
      id: 'j3',
      name: 'Agent Network Essentials',
      description: 'Everything new agents need to operate an M-PESA outlet.',
      startDate: '2026-10-01',
      endDate: '2027-03-31',
      modules: [
        { id: 'j3m1', title: 'Registering Customers', materialIds: ['mat1'] },
        { id: 'j3m2', title: 'Float Management', materialIds: ['mat7'] },
        { id: 'j3m3', title: 'Fraud Prevention', materialIds: ['mat6'] },
        { id: 'j3m4', title: 'The M-PESA App', materialIds: ['mat8'], assessmentId: 'a3' },
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
      participantIds: [...ids(21, 32), 'u33'], feedbackFormId: 'ff2', progress: progressFor([...ids(21, 32), 'u33'], modulesOf('j3'), 0),
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
    if (['t57', 't58', 't59', 't60'].includes(t.id)) t.teamsMeeting = demoMeeting(t.id)
    if (t.id === 't57' || t.id === 't60') {
      t.attendance = { syncedAt: `${t.date}T${t.endTime}:30`, source: 'simulated', records: simulateAttendance(t, people, new Date(`${t.date}T23:59:00`).getTime()) }
      // Seed a few check-ins so the roster isn't empty (most via QR/link, one late).
      const start = new Date(`${t.date}T${t.startTime}:00`).getTime()
      t.checkins = t.participantIds.slice(0, 9).map((pid, i) => {
        const late = i % 4 === 3
        const at = new Date(start + (late ? 22 : 2 + i * 3) * 60000)
        return {
          personId: pid,
          at: localISO(at),
          method: (i % 3 === 0 ? 'link' : i % 3 === 1 ? 'offline' : 'qr') as Checkin['method'],
          status: (late ? 'Late' : 'Present') as Checkin['status'],
          verified: true,
          by: 'Fasil Wolde',
        }
      })
    }
  })

  // Scheduling details (S01): category, level, delivery, description and a creation record.
  const meta: Record<string, Partial<AdminTraining>> = {
    t57: { categoryId: 'c1', subcategoryId: 'c1s1', level: 'Beginner', description: 'Certification batch for new ISON call center agents.' },
    t58: { categoryId: 'c1', subcategoryId: 'c1s1', level: 'Beginner', description: 'Certification batch for new ISON call center agents.' },
    t59: { categoryId: 'c1', subcategoryId: 'c1s1', level: 'Beginner', description: 'Certification batch requested by Call Center Operations.' },
    t60: { categoryId: 'c1', subcategoryId: 'c1s2', level: 'Intermediate', description: 'Weekly soft-skills and secure-procedures cohort for frontline staff.' },
    t61: { categoryId: 'c4', subcategoryId: 'c4s1', level: 'Beginner', description: 'Onboarding for new agents in the Sidama region.' },
    t62: { categoryId: 'c4', subcategoryId: 'c4s1', level: 'Beginner', description: 'Onboarding for new agents in Adama.' },
    t63: { categoryId: 'c1', level: 'Intermediate', description: 'Online cohort — cancelled.' },
  }
  trainings.forEach((t) => {
    Object.assign(t, meta[t.id] ?? {})
    t.delivery = t.location === 'ONLINE' ? 'Online' : 'Physical'
    t.history = [{ at: '2026-08-01T09:00:00', by: 'Fasil Wolde', action: 'Created' }]
    if (t.status === 'CANCELLED') t.history.push({ at: '2026-09-08T08:30:00', by: 'Fasil Wolde', action: 'Cancelled', reason: 'Low confirmed attendance' })
  })

  // Cohort 12 runs weekly on Tuesdays (TA-2.3): one session per date, sharing a series id.
  const t60 = trainings.find((t) => t.id === 't60')!
  t60.seriesId = 'ser-cce12'
  t60.recurrence = { freq: 'weekly', interval: 1, weekdays: [2], until: '2026-10-27' }
  ;['2026-10-13', '2026-10-20', '2026-10-27'].forEach((date, i) => {
    trainings.push({
      ...t60,
      id: `t60-${i + 2}`,
      date,
      status: 'SCHEDULED',
      attendance: undefined,
      teamsMeeting: demoMeeting(`t60-${i + 2}`),
      progress: progressFor(t60.participantIds, modulesOf('j2'), 0),
    })
  })

  // A deliberate clash so conflict detection has something to show: Dereje Desta is already
  // running Batch 59 all day on Oct 22, and four of these trainees are in that batch too.
  trainings.push({
    id: 't64', name: 'Fraud Refresher — Retail Team Leads', journeyId: 'j2', typeId: 'tt2', trainerId: 's3',
    date: '2026-10-22', startTime: '10:00', endTime: '12:00', location: 'Bole Retail Shop — Training Room', recurring: false, status: 'SCHEDULED',
    participantIds: ids(21, 25), feedbackFormId: 'ff2', progress: progressFor(ids(21, 25), modulesOf('j2'), 0),
    categoryId: 'c1', subcategoryId: 'c1s1', level: 'Intermediate', delivery: 'Physical', description: 'Short refresher on SIM-swap and fake-reversal fraud.',
    history: [{ at: '2026-10-09T10:15:00', by: 'Fasil Wolde', action: 'Created' }],
  })

  const categories: AdminData['categories'] = [
    { id: 'c1', name: 'Consumer', description: 'Products and services for individual customers.', subcategories: [
      { id: 'c1s1', name: 'Send money & withdraw', description: '' },
      { id: 'c1s2', name: 'Lipa na M-PESA', description: '' },
      { id: 'c1s3', name: 'Airtime & bundles', description: '' },
    ] },
    { id: 'c2', name: 'Enterprise', description: 'Business payment services.', subcategories: [
      { id: 'c2s1', name: 'B2C / bulk payments', description: '' },
      { id: 'c2s2', name: 'C2B / Paybill', description: '' },
      { id: 'c2s3', name: 'Enterprise portal', description: '' },
    ] },
    { id: 'c3', name: 'Saving & Credit', description: 'Savings and lending products.', subcategories: [
      { id: 'c3s1', name: 'Savings', description: '' },
      { id: 'c3s2', name: 'Micro-loans', description: '' },
    ] },
    { id: 'c4', name: 'Agent / Merchant', description: 'Running an M-PESA outlet or accepting payments.', subcategories: [
      { id: 'c4s1', name: 'Agent onboarding', description: '' },
      { id: 'c4s2', name: 'Float management', description: '' },
      { id: 'c4s3', name: 'Merchant payments', description: '' },
    ] },
    { id: 'c5', name: 'IMT', description: 'International money transfer.', subcategories: [
      { id: 'c5s1', name: 'Inbound remittance', description: '' },
      { id: 'c5s2', name: 'Outbound remittance', description: '' },
    ] },
  ]

  const assessments: AdminData['assessments'] = [
    {
      id: 'a1', title: 'Call Center Readiness — Pre-Assessment', kind: 'PRE', passMark: 0,
      mandatory: false, shuffle: false, lockAfterDeadline: false, grading: 'passfail', topic: 'General induction',
      questions: [
        { id: 'a1q1', type: 'mcq', question: 'Which document is required to register an M-PESA customer?', options: ['Utility bill', 'Valid government ID', 'Bank card'], answer: 1, weight: 1 },
        { id: 'a1q2', type: 'mcq', question: 'What should a customer never share?', options: ['Phone number', 'M-PESA PIN', 'Name'], answer: 1, weight: 1 },
      ],
    },
    {
      id: 'a2', title: 'Call Center Certification — Post-Assessment', kind: 'POST', passMark: 70,
      mandatory: true, deadline: '2026-10-31', timeLimitMinutes: 15, timerScope: 'test', maxAttempts: 2,
      shuffle: true, lockAfterDeadline: true, grading: 'score', topic: 'Call Center Certification',
      questions: [
        { id: 'a2q1', type: 'mcq', question: 'B2C stands for…', options: ['Bank to Customer', 'Business to Customer', 'Buy to Collect'], answer: 1, weight: 1 },
        { id: 'a2q2', type: 'mcq', question: 'A caller asks for a PIN to "fix" an account. This is…', options: ['Normal', 'Social engineering', 'A promotion'], answer: 1, weight: 1 },
        { id: 'a2q3', type: 'mcq', question: 'Fayda is Ethiopia’s…', options: ['National ID program', 'Mobile network', 'Tax authority'], answer: 0, weight: 1 },
        {
          id: 'a2q4', type: 'descriptive',
          question: 'A customer calls saying their transfer failed but their balance was debited. Describe how you would handle the call.',
          answer: 'Verify the customer identity and the transaction reference, explain that failed reversals usually settle within 24 hours, log a reversal ticket if it does not, and never ask for the customer PIN or OTP.',
          weight: 1,
        },
      ],
    },
    {
      id: 'a3', title: 'Customer Care & Agent Essentials — Final Quiz', kind: 'POST', passMark: 75,
      mandatory: true, timeLimitMinutes: 10, timerScope: 'question', maxAttempts: 3,
      shuffle: true, lockAfterDeadline: false, grading: 'score', topic: 'Customer Care',
      questions: [
        { id: 'a3q1', type: 'mcq', question: 'Float refers to…', options: ['Agent e-money and cash', 'A complaint', 'A tariff'], answer: 0, weight: 1 },
        { id: 'a3q2', type: 'mcq', question: 'Suspected fraud should be…', options: ['Ignored', 'Reported immediately', 'Shared online'], answer: 1, weight: 1 },
      ],
    },
  ]

  const questionBank: AdminData['questionBank'] = [
    { id: 'qb1', category: 'Consumer', type: 'mcq', question: 'Which document is required to register an M-PESA consumer?', options: ['National ID or Fayda', 'Utility bill only', 'Bank statement', 'Passport photo only'], answer: 0, weight: 1 },
    { id: 'qb2', category: 'Consumer', type: 'mcq', question: 'What should a customer never share with anyone, including agents?', options: ['Their PIN', 'Their name', 'Their phone number', 'Their Fayda ID'], answer: 0, weight: 1 },
    { id: 'qb3', category: 'Enterprise', type: 'mcq', question: 'B2C payments are used when…', options: ['A business pays many customers (e.g. salaries)', 'A customer pays a merchant', 'Agents buy float', 'Banks settle overnight'], answer: 0, weight: 1 },
    { id: 'qb4', category: 'Compliance', type: 'mcq', question: 'Fayda is Ethiopia’s…', options: ['National digital ID', 'Mobile money agent', 'Tax system', 'Telecom regulator'], answer: 0, weight: 1 },
    { id: 'qb5', category: 'Fraud', type: 'mcq', question: 'A customer reports a fake reversal SMS. The correct action is…', options: ['Verify the transaction and escalate', 'Ask them to pay a fee', 'Ignore it', 'Share the SMS publicly'], answer: 0, weight: 1 },
    {
      id: 'qb6', category: 'Compliance', type: 'descriptive',
      question: 'Describe how you would verify a customer’s identity before resetting their M-PESA PIN.',
      answer: 'Confirm the caller is the account holder using their registered name, national ID/Fayda number and recent transaction details; never accept the PIN or OTP; log the verification and follow the PIN reset procedure.',
      weight: 1,
    },
  ]

  const submissions: AdminData['submissions'] = [
    {
      id: 'sub1', assessmentId: 'a2', trainingId: 't57', personId: 'u5', attempt: 1,
      answers: { a2q1: 1, a2q2: 1, a2q3: 0, a2q4: 'Verify the customer, check the transaction reference, explain the 24-hour reversal window, and raise a ticket if it has not settled.' },
      score: 82, status: 'graded', comment: 'Good call handling. Remember to confirm the customer identity before discussing the transaction.',
      startedAt: '2026-09-20T09:10:00', submittedAt: '2026-09-20T09:22:00',
    },
    {
      id: 'sub2', assessmentId: 'a2', trainingId: 't57', personId: 'u6', attempt: 1,
      answers: { a2q1: 1, a2q2: 2, a2q3: 0, a2q4: 'I would apologize and tell them to wait for the reversal.' },
      status: 'needs-grading',
      startedAt: '2026-09-21T11:00:00', submittedAt: '2026-09-21T11:08:00',
    },
    {
      id: 'sub3', assessmentId: 'a2', trainingId: 't57', personId: 'u7', attempt: 2,
      answers: { a2q1: 0, a2q2: 1, a2q3: 2, a2q4: 'Tell them to check their balance again later.' },
      score: 42, status: 'graded', comment: 'Still missing the verification steps — please redo the PIN reset module and retake.',
      startedAt: '2026-09-22T14:30:00', submittedAt: '2026-09-22T14:41:00',
    },
    {
      id: 'sub4', assessmentId: 'a3', trainingId: 't60', personId: 'u5', attempt: 1,
      answers: { a3q1: 0, a3q2: 1 },
      score: 100, status: 'graded',
      startedAt: '2026-09-23T10:00:00', submittedAt: '2026-09-23T10:07:00',
    },
  ]

  const feedbackForms: AdminData['feedbackForms'] = [
    {
      id: 'ff1', title: 'Training Feedback', trainingTypeIds: ['tt1', 'tt3'],
      questions: ['Overall, how satisfied were you with the training?', 'How relevant was the content to your role?', 'How effective was the trainer?', 'What should we improve?'],
      questionTypes: ['likert', 'likert', 'likert', 'open'],
    },
    {
      id: 'ff2', title: 'Short Session Feedback', trainingTypeIds: ['tt2'],
      questions: ['How useful was this session?', 'Would you recommend it to a colleague?'],
      questionTypes: ['likert', 'yesno'],
    },
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
          ratings: form.questions.map((_, qi) => {
            const type = form.questionTypes?.[qi] ?? 'likert'
            return type === 'yesno' ? (rand() > 0.15 ? 1 : 0) : type === 'open' ? 0 : 3 + Math.round(rand() * 2)
          }),
          texts: form.questionTypes?.includes('open') && i % 3 === 0 ? { [form.questionTypes.indexOf('open')]: ['More role-play time', 'Share slides before the session', 'Shorter breaks'][i % 3 === 0 ? (i / 3) % 3 : 0] } : undefined,
          comment: comments[i % comments.length],
          submittedAt: t.date,
        })
      })
    })

  // Requests in every state, relative to "now" so the draft is always fresh and relative dates read naturally.
  const now = Date.now()
  const iso = (msAgo: number) => localISO(now - msAgo)
  const H = 3_600_000
  const D = 24 * H
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const who = (pids: string[]) => pids.map((pid) => people.find((x) => x.id === pid)!).map((x) => ({ name: x.name, email: x.email }))
  const base = { otherCategory: '', audienceNote: '', description: '', attachments: [] as AdminData['requests'][number]['attachments'] }
  const requests: AdminData['requests'] = [
    {
      ...base, id: 'r1', requesterId: 's6', team: 'Retail Operations', topic: 'Fraud awareness refresher for retail staff', trainingTypeId: 'tt2',
      categories: ['Consumer'], targetGroupIds: ['g2'], delivery: 'Physical', location: 'Bole Retail Shop — Training Room', preferredDate: '2026-10-28', preferredTime: '10:00',
      participants: who(['u22', 'u23', 'u24', 'u25']), objectives: 'Spot SIM-swap and fake-reversal fraud at the counter and escalate it correctly.',
      description: 'Recent rise in SIM swap fraud attempts reported at our shops.', status: 'PENDING', createdAt: iso(7 * D), submittedAt: iso(7 * D),
      history: [{ at: iso(7 * D), by: 'Yared Alemayehu', label: 'Submitted' }],
    },
    {
      ...base, id: 'r2', requesterId: 's7', team: 'Enterprise Sales', topic: 'Enterprise B2C portal training', trainingTypeId: 'tt4',
      categories: ['Enterprise'], targetGroupIds: ['g4'], delivery: 'Online', location: '', preferredDate: '2026-10-20', preferredTime: '14:00',
      participants: who(['u27', 'u28', 'u29']), objectives: 'Prepare account managers to onboard two enterprise clients on the B2C portal.',
      status: 'APPROVED', createdAt: iso(16 * D), submittedAt: iso(16 * D), trainerId: 's4', joinLink: origin + '/join/r2-k3x9p2qa',
      history: [
        { at: iso(16 * D), by: 'Mekdes Tadesse', label: 'Submitted' },
        { at: iso(15 * D), by: 'Fasil Wolde', label: 'Approved', detail: 'Trainer: Bereket Belay' },
      ],
    },
    {
      ...base, id: 'r3', requesterId: 's6', team: 'Retail Operations', topic: 'Retail team — product overview', trainingTypeId: 'tt2',
      categories: ['Consumer', 'Saving & Credit'], targetGroupIds: ['g2'], delivery: 'Physical', location: 'Retail HQ, 3rd floor', preferredDate: '2026-09-30', preferredTime: '09:00',
      participants: who(['u26', 'u30']), objectives: 'Overview of savings and credit products ahead of the Q4 campaign.',
      status: 'REJECTED', createdAt: iso(24 * D), submittedAt: iso(24 * D),
      rejection: { reason: 'Training already scheduled for this team', comment: 'Customer Care Excellence-Cohort 12 covers these products; please nominate staff there.' },
      history: [
        { at: iso(24 * D), by: 'Yared Alemayehu', label: 'Submitted' },
        { at: iso(23 * D), by: 'Fasil Wolde', label: 'Rejected', detail: 'Training already scheduled for this team' },
      ],
    },
    {
      ...base, id: 'r4', requesterId: 's5', team: 'Call Center Operations', topic: 'Call center onboarding — Batch 59', trainingTypeId: 'tt1',
      categories: ['Consumer', 'Enterprise'], targetGroupIds: ['g1'], delivery: 'Physical', location: 'ISON Office', preferredDate: '2026-10-22', preferredTime: '09:00',
      participants: who(['u11', 'u12', 'u13', 'u14', 'u15', 'u16']), objectives: 'Certify new ISON agents on consumer and enterprise M-PESA services.',
      status: 'APPROVED', createdAt: iso(21 * D), submittedAt: iso(21 * D), trainerId: 's3', trainingId: 't59', joinLink: origin + '/join/r4-7hd2m1zc',
      attachments: [{ name: 'batch59-trainees.xlsx', size: 18432, type: 'xlsx' }],
      history: [
        { at: iso(21 * D), by: 'Kalkidan Mekonnen', label: 'Submitted' },
        { at: iso(20 * D), by: 'Fasil Wolde', label: 'Approved', detail: 'Trainer: Dereje Desta' },
        { at: iso(20 * D), by: 'Fasil Wolde', label: 'Scheduled', detail: 'M-PESA Call Center Training-Batch 59' },
      ],
    },
    {
      ...base, id: 'r5', requesterId: 's5', team: 'Call Center Operations', topic: 'Tariff changes refresher', trainingTypeId: 'tt2',
      categories: ['Consumer'], targetGroupIds: ['g1'], delivery: 'Online', location: '', preferredDate: '2026-10-30', preferredTime: '15:00',
      participants: who(['u1', 'u2', 'u3', 'u4', 'u5']), objectives: 'Walk agents through the November tariff changes so they can answer customer questions.',
      status: 'PENDING', createdAt: iso(2 * D), submittedAt: iso(2 * D),
      history: [{ at: iso(2 * D), by: 'Kalkidan Mekonnen', label: 'Submitted' }],
    },
    {
      ...base, id: 'r6', requesterId: 's5', team: 'Call Center Operations', topic: 'Fraud escalation for team leads', trainingTypeId: 'tt2',
      categories: ['Consumer'], targetGroupIds: [], delivery: 'Online', location: '', preferredDate: '', preferredTime: '',
      participants: [], objectives: '', status: 'DRAFT', createdAt: iso(5 * H), draftExpiresAt: localISO(now - 5 * H + D),
      history: [],
    },
  ]

  const templates: AdminData['templates'] = [
    { id: 'ct1', name: 'Pattern Border', accent: 'red', layout: 'border', title: 'Certificate of Completion', isDefault: true },
    { id: 'ct2', name: 'Red Sweep', accent: 'red', layout: 'sweep', title: 'Certificate of Completion', isDefault: false, assignedTypeIds: ['tt2'] },
    { id: 'ct3', name: 'Brighter Future', accent: 'red', layout: 'tiles', title: 'Certificate of Completion', isDefault: false, assignedTypeIds: ['tt4'] },
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

  // Graded post-assessment attempts for finished sessions, so results and certificates have data.
  trainings
    .filter((t) => t.status === 'COMPLETED' && t.postAssessmentId)
    .forEach((t) =>
      t.participantIds.forEach((pid) => {
        if (submissions.some((x) => x.trainingId === t.id && x.personId === pid)) return
        submissions.push({
          id: `sub-${t.id}-${pid}`, assessmentId: t.postAssessmentId!, trainingId: t.id, personId: pid, attempt: 1, answers: {},
          score: 50 + Math.round(rand() * 50), status: 'graded', startedAt: `${t.date}T15:00:00`, submittedAt: `${t.date}T15:12:00`,
        })
      }),
    )

  // Finished in-person sessions without a Teams report used QR check-in (TE-5.1).
  trainings
    .filter((t) => t.status === 'COMPLETED' && !t.attendance && !t.checkins?.length)
    .forEach((t) => {
      t.checkins = t.participantIds
        .filter(() => rand() > 0.12)
        .map((pid) => {
          const late = rand() > 0.85
          const min = late ? 20 + Math.round(rand() * 20) : Math.round(rand() * 10)
          const [h, m] = t.startTime.split(':').map(Number)
          const at = `${t.date}T${String(h + Math.floor((m + min) / 60)).padStart(2, '0')}:${String((m + min) % 60).padStart(2, '0')}:00`
          return { personId: pid, at, method: 'qr', status: late ? 'Late' : 'Present', verified: true, by: 'QR scan' } as Checkin
        })
    })

  // One unhappy response so the low-feedback alert (F04) has something to show.
  const unhappy = trainings.find((t) => t.status === 'COMPLETED' && t.feedbackFormId === 'ff1')
  if (unhappy) {
    const pid = unhappy.participantIds[unhappy.participantIds.length - 1]
    feedbackResponses.push({ id: `fr-${unhappy.id}-${pid}-low`, formId: 'ff1', trainingId: unhappy.id, participantId: pid, ratings: [2, 2, 1, 0], texts: { 3: 'Too fast, and the room was full.' }, comment: 'Hard to follow.', submittedAt: unhappy.date })
  }

  const feedbackBank: AdminData['feedbackBank'] = [
    { id: 'fb1', category: 'Trainer', question: 'The trainer explained topics clearly.', type: 'likert' },
    { id: 'fb2', category: 'Trainer', question: 'The trainer answered questions well.', type: 'likert' },
    { id: 'fb3', category: 'Content', question: 'The content was relevant to my role.', type: 'likert' },
    { id: 'fb4', category: 'Content', question: 'The materials were easy to follow.', type: 'likert' },
    { id: 'fb5', category: 'Logistics', question: 'The venue or online tools worked well.', type: 'likert' },
    { id: 'fb6', category: 'Overall', question: 'Would you recommend this training to a colleague?', type: 'yesno' },
    { id: 'fb7', category: 'Overall', question: 'What should we improve?', type: 'open' },
  ]

  const contentStats: AdminData['contentStats'] = Object.fromEntries(
    materials.map((m) => [m.id, { views: 20 + Math.round(rand() * 180), downloads: m.type === 'VIDEO' ? 0 : Math.round(rand() * 60) }]),
  )

  const data: AdminData = {
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
    questionBank,
    submissions,
    feedbackForms,
    feedbackResponses,
    templates,
    trainingTypes,
    categories,
    auditLogs,
    attendanceRules: DEFAULT_RULES,
    feedbackBank,
    alerts: [],
    alertRules: { feedbackBelow: 2.5, attendanceBelow: 60 },
    contentStats,
  }

  // Certificates were issued automatically for finished sessions, except the latest one,
  // which shows up in the tracker as "not yet triggered" (X06).
  const finished = data.trainings.filter((t) => t.status === 'COMPLETED').sort((a, b) => b.date.localeCompare(a.date))
  finished.slice(1).forEach((t) => {
    const issued = runIssuing(data, t, 'System')
    issued.certificatesRunAt = `${t.date}T${t.endTime}:00`
    issued.certificates = issued.certificates?.map((c) => ({ ...c, issuedAt: `${t.date}T${t.endTime}:00` }))
    data.trainings = data.trainings.map((x) => (x.id === t.id ? issued : x))
  })
  data.alerts = scanAlerts(data)
  return data
}
