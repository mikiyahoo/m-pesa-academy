/**
 * Demo content for Academy Lite. Every course is a short series of posts: videos, swipeable slides,
 * one-tap quizzes and tips. Videos, covers and avatars come from the main project's public folder.
 */

export type Review = { name: string; stars: number; text: string; ago: string }
export type Trainer = {
  id: string
  name: string
  handle: string
  avatar: string
  title: string
  /** Demo contact details (not real numbers). */
  phone: string
  telegram: string
  email: string
  bio: string
  languages: string[]
  region: string
  /** Office hours: days (0 = Sunday) and local times. */
  hours: { days: number[]; from: string; to: string }
  replies: string
  rating: number
  reviews: Review[]
  /** Quick questions learners often ask this trainer. */
  faqs: string[]
}

export type Slide = { emoji: string; title: string; body?: string; points?: string[]; bg: string }

export type Item =
  | { id: string; kind: 'video'; src: string; caption: string; tags: string[] }
  | { id: string; kind: 'slides'; slides: Slide[]; caption: string; tags: string[] }
  | { id: string; kind: 'quiz'; question: string; options: string[]; answer: number; explain: string; caption: string; tags: string[] }
  | { id: string; kind: 'tip'; slide: Slide; caption: string; tags: string[] }

export type Course = {
  id: string
  title: string
  blurb: string
  cover: string
  trainerId: string
  category: string
  level: 'Beginner' | 'Intermediate'
  learners: number
  items: Item[]
}

export const ME = { id: 'me', name: 'Fasil Wolde', handle: 'fasil.wolde', avatar: '/avatars/avatar-2.png', role: 'Agent Relations Officer · Addis Ababa', phone: '+251 911 222 333' }

const WEEKDAYS = [1, 2, 3, 4, 5, 6]
export const TRAINERS: Trainer[] = [
  {
    id: 't1', name: 'Dereje Desta', handle: 'dereje.trains', avatar: '/avatars/avatar-1.png', title: 'Lead trainer · Onboarding',
    phone: '+251911000101', telegram: 'dereje_trains', email: 'dereje.desta@example.com',
    bio: '8 years onboarding agents and merchants across Ethiopia. I keep things short, practical and friendly. Ask me anything about getting started with M-PESA.',
    languages: ['Amharic', 'English'], region: 'Addis Ababa', hours: { days: WEEKDAYS, from: '08:30', to: '17:30' }, replies: 'within an hour', rating: 4.9,
    reviews: [
      { name: 'Selam Tadesse', stars: 5, text: 'Explains KYC better than anyone. Called me back the same day!', ago: '1 week' },
      { name: 'Yonas Alemu', stars: 5, text: 'Very patient with our new agents.', ago: '3 weeks' },
    ],
    faqs: ['How do I register a new customer?', 'Which ID documents are accepted?', 'Can you visit our shop for a session?'],
  },
  {
    id: 't2', name: 'Mariamawit Fekadeselase', handle: 'mariamawit.f', avatar: '/avatars/avatar-3.png', title: 'Fraud & risk trainer',
    phone: '+251911000102', telegram: 'mariamawit_f', email: 'mariamawit.f@example.com',
    bio: 'I help agents and merchants spot scams before they cost anything. If something feels wrong at your counter, message me straight away.',
    languages: ['Amharic', 'English', 'Afaan Oromo'], region: 'Addis Ababa', hours: { days: WEEKDAYS, from: '08:00', to: '18:00' }, replies: 'within 30 minutes', rating: 4.8,
    reviews: [
      { name: 'Abel Girma', stars: 5, text: 'Her red flags saved one of our customers last week.', ago: '5 days' },
      { name: 'Meron Kebede', stars: 4, text: 'Great live Q&A sessions, very practical.', ago: '1 month' },
    ],
    faqs: ['I think a customer is being scammed. What now?', 'How do I report a fake reversal?', 'Is this SMS real?'],
  },
  {
    id: 't3', name: 'Bereket Belay', handle: 'bereket.fayda', avatar: '/avatars/avatar-4.png', title: 'Fayda integration trainer',
    phone: '+251911000103', telegram: 'bereket_fayda', email: 'bereket.belay@example.com',
    bio: 'Fayda and digital ID specialist. I can walk you through verification step by step, in person or on a call.',
    languages: ['Amharic', 'English'], region: 'Hawassa', hours: { days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00' }, replies: 'within 2 hours', rating: 4.7,
    reviews: [{ name: 'Liya Mekonnen', stars: 5, text: 'Fayda finally makes sense to me 😄', ago: '2 weeks' }],
    faqs: ['The Fayda code is not arriving. What do I do?', 'Can a customer register without Fayda?'],
  },
  {
    id: 't4', name: 'Selamawit Bekele', handle: 'selam.merchants', avatar: '/avatars/avatar-5.png', title: 'Enterprise & merchants',
    phone: '+251911000104', telegram: 'selam_merchants', email: 'selamawit.bekele@example.com',
    bio: 'I set up merchants with Till and Paybill and help businesses grow with Lipa na M-PESA. Merchants: book a call any time in office hours.',
    languages: ['Amharic', 'English', 'Tigrinya'], region: 'Addis Ababa', hours: { days: WEEKDAYS, from: '08:30', to: '17:30' }, replies: 'within an hour', rating: 4.9,
    reviews: [
      { name: 'Bole Mini Market', stars: 5, text: 'Our till was ready in one visit. Thank you!', ago: '4 days' },
      { name: 'Yonas Alemu', stars: 5, text: 'Clear and quick, recommended for every shop owner.', ago: '2 weeks' },
    ],
    faqs: ['Do I need a Till or a Paybill?', 'How do I see my daily payments?', 'Can you help set up my shop?'],
  },
  {
    id: 't5', name: 'Hana Tesfaye', handle: 'hana.cares', avatar: '/avatars/avatar-6.png', title: 'Customer care coach',
    phone: '+251911000105', telegram: 'hana_cares', email: 'hana.tesfaye@example.com',
    bio: 'Coaching teams to stay calm, kind and quick with every customer. Happy to role-play a tough call with you.',
    languages: ['Amharic', 'English'], region: 'Adama', hours: { days: [1, 2, 3, 4, 5], from: '08:30', to: '17:00' }, replies: 'within a few hours', rating: 4.8,
    reviews: [{ name: 'Selam Tadesse', stars: 5, text: 'The LEARN method changed how I handle complaints.', ago: '1 week' }],
    faqs: ['How do I calm an angry customer?', 'Can we do a role-play session?'],
  },
]

/** Whether the trainer is inside office hours right now (local time). */
export function availability(t: Trainer, now = new Date()) {
  const hm = now.getHours() * 60 + now.getMinutes()
  const toMin = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3))
  const open = t.hours.days.includes(now.getDay()) && hm >= toMin(t.hours.from) && hm < toMin(t.hours.to)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const first = t.hours.days[0]
  const last = t.hours.days[t.hours.days.length - 1]
  return { open, label: `${dayNames[first]}–${dayNames[last]} · ${t.hours.from}–${t.hours.to}` }
}

export const trainerOf = (id: string) => TRAINERS.find((t) => t.id === id)!

const V = (n: number) => `/trainings/Module (${n}).mp4`

// Slide backgrounds (bold gradients so every slide reads well on a phone).
const RED = 'from-[#d03c3b] via-[#b8302f] to-[#6e1717]'
const GREEN = 'from-[#39b54a] via-[#23893a] to-[#0f4d1f]'
const NIGHT = 'from-[#1f2937] via-[#111827] to-[#030712]'
const SUN = 'from-[#f59e0b] via-[#ea580c] to-[#9a3412]'
const SEA = 'from-[#0ea5e9] via-[#2563eb] to-[#1e1b4b]'
const PLUM = 'from-[#a855f7] via-[#7c3aed] to-[#3b0764]'

export const COURSES: Course[] = [
  {
    id: 'basics',
    title: 'M-PESA Basics',
    blurb: 'What M-PESA is, the everyday services and how to register a customer.',
    cover: '/covers/test-training-3.jpg',
    trainerId: 't1',
    category: 'Onboarding',
    level: 'Beginner',
    learners: 1840,
    items: [
      { id: 'b1', kind: 'video', src: V(1), caption: 'Welcome! What M-PESA is and why it matters to every customer you serve 👋', tags: ['MPESA', 'Onboarding'] },
      {
        id: 'b2',
        kind: 'slides',
        caption: 'The 3 services customers use every day. Swipe ➡️',
        tags: ['SendMoney', 'Basics'],
        slides: [
          { emoji: '💸', title: 'Send money', body: 'Enter the number, the amount and the PIN. The receiver gets an SMS straight away.', bg: RED },
          { emoji: '🏧', title: 'Withdraw cash', body: 'At any agent: give the agent number, confirm the amount, enter the PIN.', bg: GREEN },
          { emoji: '📱', title: 'Buy airtime', body: 'For yourself or anyone else, any time. No scratch card needed.', bg: SEA },
        ],
      },
      { id: 'b3', kind: 'quiz', question: 'Where can a customer withdraw cash?', options: ['Any M-PESA agent', 'Only at a bank', 'Only at a Safaricom shop'], answer: 0, explain: 'Agents are everywhere: that is the whole point of M-PESA.', caption: 'Quick check ✅', tags: ['Quiz'] },
      { id: 'b4', kind: 'tip', caption: 'Save this one 🔐', tags: ['Security'], slide: { emoji: '🔐', title: 'Never share your PIN', body: 'Not with agents, not with staff, not with family. Nobody from M-PESA will ever ask for it.', bg: NIGHT } },
      { id: 'b5', kind: 'video', src: V(2), caption: 'Registering a new customer, step by step (KYC) 🪪', tags: ['KYC', 'Registration'] },
      { id: 'b6', kind: 'quiz', question: 'Which document do you need to register a new customer?', options: ['A utility bill', 'A valid ID or Fayda number', 'A bank statement'], answer: 1, explain: 'A government ID or the Fayda number proves who the customer is.', caption: 'One more 💪', tags: ['Quiz', 'KYC'] },
    ],
  },
  {
    id: 'fraud',
    title: 'Spot the Scam',
    blurb: 'The red flags of fake reversals, SIM swaps and OTP tricks, and what to do.',
    cover: '/covers/fraud-awareness.jpg',
    trainerId: 't2',
    category: 'Fraud & security',
    level: 'Beginner',
    learners: 2310,
    items: [
      {
        id: 'f1',
        kind: 'slides',
        caption: '5 red flags of a fake "wrong transfer" 🚩 Swipe all of them',
        tags: ['Fraud', 'RedFlags'],
        slides: [
          { emoji: '📞', title: 'The surprise call', body: '"I sent money to you by mistake, please send it back."', bg: RED },
          { emoji: '⏱️', title: 'Pressure to act fast', body: 'Scammers rush you so you do not have time to check.', bg: SUN },
          { emoji: '✉️', title: 'SMS from a normal number', body: 'Real M-PESA messages come from M-PESA, not a personal number.', bg: PLUM },
          { emoji: '🔢', title: 'They ask for a code', body: 'PIN or one-time code: nobody legitimate will ever ask for it.', bg: NIGHT },
          { emoji: '📉', title: 'Balance did not change', body: 'Check the real balance. No money arrived? Then nothing goes back.', bg: GREEN },
        ],
      },
      { id: 'f2', kind: 'video', src: V(3), caption: 'Real example: how a SIM-swap attempt sounds 🎧 Listen to the end', tags: ['SIMSwap', 'Fraud'] },
      { id: 'f3', kind: 'quiz', question: 'A customer gets an SMS saying they received money "by mistake". First step?', options: ['Send the money back right away', 'Check the real balance and statement', 'Share the SMS in a group'], answer: 1, explain: 'Always check the real balance first. Fake SMS messages look real.', caption: 'What would you do? 🤔', tags: ['Quiz', 'Fraud'] },
      { id: 'f4', kind: 'tip', caption: 'Escalate, do not argue 📣', tags: ['Fraud', 'Escalation'], slide: { emoji: '📣', title: 'Escalate, don’t argue', points: ['Stay calm and polite', 'Log the number and time', 'Report to the fraud desk the same day'], bg: SUN } },
      { id: 'f5', kind: 'quiz', question: 'Someone calls "from M-PESA" and asks for the code you just got. You…', options: ['Read it out quickly', 'Hang up and report it', 'Send it by SMS instead'], answer: 1, explain: 'The code is the key to the account. Real staff never ask for it.', caption: 'Easy one? 😎', tags: ['Quiz', 'OTP'] },
    ],
  },
  {
    id: 'fayda',
    title: 'Fayda ID in 5 Minutes',
    blurb: 'Ethiopia’s digital ID and how it links to M-PESA accounts.',
    cover: '/covers/fayda-integration.jpg',
    trainerId: 't3',
    category: 'Product',
    level: 'Beginner',
    learners: 960,
    items: [
      {
        id: 'y1',
        kind: 'slides',
        caption: 'Fayda explained in 3 slides 🇪🇹',
        tags: ['Fayda', 'DigitalID'],
        slides: [
          { emoji: '🆔', title: 'What is Fayda?', body: 'Ethiopia’s national digital ID: one number that proves who you are.', bg: GREEN },
          { emoji: '🔗', title: 'Why link it to M-PESA', body: 'Faster registration, fewer mistakes and stronger protection against fraud.', bg: SEA },
          { emoji: '✅', title: 'Verify in 3 steps', points: ['Ask for the Fayda number', 'Confirm the one-time code', 'Check the photo and name match'], bg: RED },
        ],
      },
      { id: 'y2', kind: 'video', src: V(4), caption: 'Live demo: verifying a customer with Fayda 🖥️', tags: ['Fayda', 'Demo'] },
      { id: 'y3', kind: 'quiz', question: 'Fayda is Ethiopia’s…', options: ['Tax system', 'National digital ID', 'Mobile money agent network'], answer: 1, explain: 'Fayda is the national digital ID programme.', caption: 'Check yourself 🧠', tags: ['Quiz', 'Fayda'] },
    ],
  },
  {
    id: 'merchant',
    title: 'Lipa na M-PESA',
    blurb: 'Till and Paybill for shops and businesses, set up in minutes.',
    cover: '/covers/merchant-payments.jpg',
    trainerId: 't4',
    category: 'Merchants',
    level: 'Intermediate',
    learners: 1120,
    items: [
      { id: 'm1', kind: 'video', src: V(5), caption: 'Till vs Paybill in 60 seconds 🛒', tags: ['Merchants', 'LipaNaMPESA'] },
      {
        id: 'm2',
        kind: 'slides',
        caption: 'Set up a merchant in 4 steps 🏪',
        tags: ['Merchants', 'Setup'],
        slides: [
          { emoji: '📝', title: '1. Collect the documents', body: 'Business licence, owner ID and a phone number for the till.', bg: PLUM },
          { emoji: '🏷️', title: '2. Pick Till or Paybill', body: 'Till for paying at the counter, Paybill for bills and accounts.', bg: SUN },
          { emoji: '⚙️', title: '3. Register and test', body: 'Make a small test payment together with the owner.', bg: SEA },
          { emoji: '📊', title: '4. Show the statement', body: 'Teach the owner where to see every payment.', bg: GREEN },
        ],
      },
      { id: 'm3', kind: 'quiz', question: 'A shop wants customers to pay at the counter. They need…', options: ['A Till number', 'A Paybill for each customer', 'Only a bank account'], answer: 0, explain: 'A Till number is made for paying at the counter.', caption: 'Merchant pro? 🏆', tags: ['Quiz', 'Merchants'] },
    ],
  },
  {
    id: 'care',
    title: 'Customer Care Excellence',
    blurb: 'Calm, kind and quick: handling every customer like a pro.',
    cover: '/covers/mpesa-app-features.jpg',
    trainerId: 't5',
    category: 'Soft skills',
    level: 'Beginner',
    learners: 1505,
    items: [
      { id: 'c1', kind: 'tip', caption: 'Try it on your next customer 😊', tags: ['CustomerCare'], slide: { emoji: '😊', title: 'The 3-second rule', body: 'Greet every customer within 3 seconds, with a smile and their name if you know it.', bg: SUN } },
      {
        id: 'c2',
        kind: 'slides',
        caption: 'The LEARN method for difficult customers 🧘',
        tags: ['CustomerCare', 'LEARN'],
        slides: [
          { emoji: '👂', title: 'Listen', body: 'Let them finish. Do not interrupt.', bg: SEA },
          { emoji: '🤝', title: 'Empathise', body: '"I understand how frustrating that is."', bg: PLUM },
          { emoji: '🙏', title: 'Apologise', body: 'For the experience, even if it was not your fault.', bg: RED },
          { emoji: '🛠️', title: 'Resolve', body: 'Fix it, or explain exactly what happens next.', bg: GREEN },
          { emoji: '📲', title: 'Notify', body: 'Follow up when it is done.', bg: NIGHT },
        ],
      },
      { id: 'c3', kind: 'video', src: V(2), caption: 'Role play: turning an angry call around 📞', tags: ['CustomerCare', 'RolePlay'] },
      { id: 'c4', kind: 'quiz', question: 'An angry customer starts shouting. What do you do first?', options: ['Explain the policy', 'Transfer the call', 'Listen without interrupting'], answer: 2, explain: 'Listening first calms most people down. Then empathise and resolve.', caption: 'Your move 👇', tags: ['Quiz', 'CustomerCare'] },
    ],
  },
]

export const courseOf = (id: string) => COURSES.find((c) => c.id === id)!
export const findItem = (itemId: string) => {
  for (const c of COURSES) {
    const i = c.items.findIndex((it) => it.id === itemId)
    if (i >= 0) return { course: c, item: c.items[i], index: i }
  }
  return undefined
}

/** A stable pseudo-random number per id, so counts look real and stay the same. */
export const seeded = (id: string, min: number, max: number) => {
  let h = 2166136261
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return min + (Math.abs(h) % (max - min + 1))
}

export const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

/* ---------------------------------- people ---------------------------------- */

export type Person = { id: string; name: string; avatar: string }
export const CLASSMATES: Person[] = [
  { id: 'p1', name: 'Selam Tadesse', avatar: '/avatars/avatar-5.png' },
  { id: 'p2', name: 'Abel Girma', avatar: '/avatars/avatar-1.png' },
  { id: 'p3', name: 'Meron Kebede', avatar: '/avatars/avatar-6.png' },
  { id: 'p4', name: 'Yonas Alemu', avatar: '/avatars/avatar-4.png' },
  { id: 'p5', name: 'Liya Mekonnen', avatar: '/avatars/avatar-3.png' },
]

const COMMENT_POOL = [
  'This is so clear, thank you! 🙏',
  'Can we get this as a PDF?',
  'We had exactly this case at our shop last week 😅',
  'The swipe slides are the best part',
  'Does this apply to agents in the regions too?',
  'Saved for my team 💾',
  'Short and useful. More like this please!',
  'Finally understood the difference 💡',
]
export type Comment = { id: string; name: string; avatar: string; text: string; ago: string; likes: number; trainer?: boolean }
export function seedComments(itemId: string, trainerId: string): Comment[] {
  const n = seeded(itemId + 'c', 3, 6)
  const list: Comment[] = Array.from({ length: n }, (_, i) => {
    const p = CLASSMATES[(seeded(itemId + i, 0, 999) + i) % CLASSMATES.length]
    return { id: `${itemId}-c${i}`, name: p.name, avatar: p.avatar, text: COMMENT_POOL[seeded(itemId + 'x' + i, 0, COMMENT_POOL.length - 1)], ago: `${seeded(itemId + 'h' + i, 1, 23)}h`, likes: seeded(itemId + 'l' + i, 0, 120) }
  })
  const t = trainerOf(trainerId)
  list.splice(1, 0, { id: `${itemId}-ct`, name: t.name, avatar: t.avatar, text: 'Great question! I’ll cover it in the next live session 👍', ago: '2h', likes: seeded(itemId + 't', 20, 300), trainer: true })
  return list
}

/* ----------------------------------- chats ---------------------------------- */

export type Msg = { id: string; from: 'me' | string; text: string; at: number; kind?: 'text' | 'voice' | 'share'; views?: number }
export type Chat = { id: string; name: string; avatar: string; kind: 'trainer' | 'group' | 'channel'; members?: number; trainerId?: string; pinned?: boolean; muted?: boolean }

export const CHATS: Chat[] = [
  { id: 'announce', name: 'M-PESA Academy 📢', avatar: '/favicon.svg', kind: 'channel', members: 12840, pinned: true },
  { id: 'dereje', name: 'Dereje Desta', avatar: '/avatars/avatar-1.png', kind: 'trainer', trainerId: 't1' },
  { id: 'fraud-group', name: 'Spot the Scam · Batch 12', avatar: '/covers/fraud-awareness.jpg', kind: 'group', members: 46 },
  { id: 'mariamawit', name: 'Mariamawit Fekadeselase', avatar: '/avatars/avatar-3.png', kind: 'trainer', trainerId: 't2' },
  { id: 'bole-team', name: 'Bole Shop Team', avatar: '/covers/mpesa-app-features.jpg', kind: 'group', members: 9, muted: true },
  { id: 'hana', name: 'Hana Tesfaye', avatar: '/avatars/avatar-6.png', kind: 'trainer', trainerId: 't5' },
  { id: 'bereket', name: 'Bereket Belay', avatar: '/avatars/avatar-4.png', kind: 'trainer', trainerId: 't3' },
  { id: 'selamawit', name: 'Selamawit Bekele', avatar: '/avatars/avatar-5.png', kind: 'trainer', trainerId: 't4' },
]
export const chatOfTrainer = (trainerId: string) => CHATS.find((c) => c.trainerId === trainerId)!

const min = 60_000
const hr = 60 * min
export function seedMessages(now: number): Record<string, Msg[]> {
  return {
    announce: [
      { id: 'a1', from: 'announce', text: '📌 New course: “Spot the Scam”. 5 short posts, 1 quiz. Open the Home tab and swipe up!', at: now - 26 * hr, views: 9820 },
      { id: 'a2', from: 'announce', text: '🎓 Certificates now land on your Profile the moment you finish a course.', at: now - 5 * hr, views: 7410 },
      { id: 'a3', from: 'announce', text: '🔴 LIVE tomorrow 10:00: Q&A with the fraud desk. Tap LIVE on the Home tab to set a reminder.', at: now - 40 * min, views: 3302 },
    ],
    dereje: [
      { id: 'd1', from: 'dereje', text: 'Hi Fasil 👋 welcome to Academy Lite!', at: now - 3 * hr },
      { id: 'd2', from: 'dereje', text: 'Start with “M-PESA Basics”. It takes about 5 minutes.', at: now - 3 * hr + min },
      { id: 'd3', from: 'me', text: 'Thanks! Started it already 💪', at: now - 2 * hr },
      { id: 'd4', from: 'dereje', text: 'Great. Ask me anything here, any time.', at: now - 2 * hr + 2 * min },
    ],
    'fraud-group': [
      { id: 'g1', from: 'Selam Tadesse', text: 'Did anyone else get the "wrong transfer" call this week?', at: now - 90 * min },
      { id: 'g2', from: 'Abel Girma', text: 'Yes! Used the red flags from the slides, the customer was so relieved', at: now - 80 * min },
      { id: 'g3', from: 'Meron Kebede', text: '🎤 Voice message', at: now - 30 * min, kind: 'voice' },
      { id: 'g4', from: 'Yonas Alemu', text: 'Quiz 3 was tricky 😅', at: now - 12 * min },
    ],
    mariamawit: [{ id: 'm1', from: 'mariamawit', text: 'Your team did great on the fraud quiz 👏 keep it up!', at: now - 26 * hr }],
    'bole-team': [
      { id: 'bt1', from: 'Liya Mekonnen', text: 'Shift swap on Saturday anyone?', at: now - 50 * hr },
      { id: 'bt2', from: 'me', text: 'I can take it', at: now - 49 * hr },
    ],
    hana: [{ id: 'h1', from: 'hana', text: 'Try the 3-second rule today and tell me how it went 😊', at: now - 30 * hr }],
    bereket: [{ id: 'be1', from: 'bereket', text: 'Selam! Any Fayda questions, I’m here 🆔', at: now - 4 * 24 * hr }],
    selamawit: [{ id: 'se1', from: 'selamawit', text: 'Hi! Merchants and shop owners: ask me about Till and Paybill any time 🏪', at: now - 6 * 24 * hr }],
  }
}

/** Short helpful replies trainers send back in the demo, picked by keyword. */
export function trainerReply(text: string): string {
  const t = text.toLowerCase()
  if (/pin|otp|code/.test(t)) return 'Golden rule: never share a PIN or one-time code, and nobody legitimate will ask for one. 🔐'
  if (/fraud|scam|reversal|sim/.test(t)) return 'Check the real balance first, then escalate to the fraud desk. The “Spot the Scam” course has the 5 red flags. 🚩'
  if (/fayda|id/.test(t)) return 'Ask for the Fayda number, confirm the one-time code, and check the photo and name match. ✅'
  if (/certificate|cert/.test(t)) return 'Finish every post in a course and your certificate appears on your Profile straight away 🎓'
  if (/quiz|answer/.test(t)) return 'Quizzes are one tap. A wrong answer shows the right one, so you learn either way 💡'
  if (/thank|thanks|amesegnalehu/.test(t)) return 'Any time! 🙌'
  if (/hi|hello|selam|hey/.test(t)) return 'Selam! 👋 How can I help today?'
  return 'Good question! I’ll get back to you on this, and it’s a nice topic for the next live session 👍'
}

/* --------------------------------- community -------------------------------- */

export type Post = {
  id: string
  author: string
  avatar: string
  /** Posted by the Academy team (shown with a verified tick). */
  official?: boolean
  ago: string
  text: string
  image?: string
  badge?: { emoji: string; title: string }
  reactions: number
  comments: number
  shares: number
}

export const ACADEMY = { name: 'M-PESA Academy', avatar: '/favicon white.svg' }

/** Community posts are written by the Academy team and trainers; learners react, comment and share. */
export const POSTS: Post[] = [
  { id: 'po1', author: ACADEMY.name, avatar: ACADEMY.avatar, official: true, ago: '35 min', text: '🎉 Congratulations to Selam Tadesse for finishing “Spot the Scam” on her coffee break. Who’s next?', badge: { emoji: '🎓', title: 'Certificate earned · Spot the Scam' }, reactions: 128, comments: 14, shares: 3 },
  { id: 'po2', author: 'Dereje Desta', avatar: '/avatars/avatar-1.png', official: true, ago: '2 h', text: 'New video in M-PESA Basics: registering a customer step by step. Watch it before your next shift 👇', image: '/covers/test-training-3.jpg', reactions: 342, comments: 41, shares: 22 },
  { id: 'po3', author: ACADEMY.name, avatar: ACADEMY.avatar, official: true, ago: '5 h', text: 'Story of the week 💪 Abel Girma stopped a customer from sending money back to a scammer. He spotted red flag #4 from “Spot the Scam”. Training works!', reactions: 516, comments: 63, shares: 48 },
  { id: 'po4', author: ACADEMY.name, avatar: ACADEMY.avatar, official: true, ago: 'Yesterday', text: '🔥 Streak challenge: learn something every day this week and earn a bonus 50 XP. Meron Kebede is already on 7 days!', badge: { emoji: '🔥', title: '7-day streak challenge' }, reactions: 204, comments: 27, shares: 5 },
  { id: 'po5', author: 'Mariamawit Fekadeselase', avatar: '/avatars/avatar-3.png', official: true, ago: '2 days', text: 'Reminder: the fraud desk Q&A is live tomorrow at 10:00. Bring your toughest questions 🎙️ Tap LIVE on the Home tab to set a reminder.', image: '/covers/fraud-awareness.jpg', reactions: 187, comments: 19, shares: 31 },
]

export const LIVE = [
  { id: 'l1', title: 'Fraud desk Q&A', host: 't2', when: 'Live now', live: true, viewers: 214 },
  { id: 'l2', title: 'Fayda verification walkthrough', host: 't3', when: 'Tomorrow · 10:00', live: false },
  { id: 'l3', title: 'Merchant onboarding clinic', host: 't4', when: 'Fri · 14:30', live: false },
]
