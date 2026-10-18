/** Step-by-step user guides, readable inside the portal from Help & Support. */
export type Guide = {
  id: string
  title: string
  summary: string
  minutes: number
  updated: string // YYYY-MM-DD
  sections: { heading: string; steps: string[] }[]
}

export const guides: Guide[] = [
  {
    id: 'getting-started',
    title: 'Getting started with M-PESA Academy',
    summary: 'Sign in, find your trainings and work through your first course.',
    minutes: 4,
    updated: '2026-10-01',
    sections: [
      {
        heading: 'Sign in',
        steps: ['Enter your work email or phone number and your password.', 'Type the 6-digit code sent to your phone. If it expires, choose “Resend code”.'],
      },
      {
        heading: 'Find your trainings',
        steps: [
          'Home shows your latest trainings, progress and upcoming sessions.',
          'Open Trainings to see everything, filter by status or category, or save favourites with the heart.',
          'Your journeys and milestones are on your Profile — take the trainings in any order. On Trainings, switch to the calendar view to see sessions by month.',
        ],
      },
      {
        heading: 'Work through a course',
        steps: [
          'Open a training and choose Start learning.',
          'Lessons open in order: finish a video or reading and the next one unlocks.',
          'Your progress is saved automatically, so you can stop and continue later.',
        ],
      },
    ],
  },
  {
    id: 'attendance',
    title: 'Joining sessions and checking in',
    summary: 'How attendance is recorded for Teams and in-person sessions.',
    minutes: 3,
    updated: '2026-09-24',
    sections: [
      {
        heading: 'Microsoft Teams sessions',
        steps: ['Open the training when the session is live and choose Join on Teams.', 'Attendance is recorded automatically from Teams — no separate check-in is needed.'],
      },
      {
        heading: 'In-person sessions',
        steps: [
          'Your trainer shows a QR code at the venue.',
          'Scan it with your phone camera and confirm — that is your only check-in.',
          'Arriving after the late window marks you as Late; your trainer can correct mistakes.',
        ],
      },
    ],
  },
  {
    id: 'assessments-certificates',
    title: 'Assessments and certificates',
    summary: 'Taking the final assessment, earning your certificate and sharing it.',
    minutes: 4,
    updated: '2026-09-30',
    sections: [
      {
        heading: 'Take the assessment',
        steps: [
          'The assessment opens after the lessons. Check the attempts, time limit and pass mark first.',
          'Answer every question; the timer submits automatically when it runs out.',
          'Your best score counts.',
        ],
      },
      {
        heading: 'Earn your certificate',
        steps: ['Attend the session, pass the assessment and share your feedback.', 'The certificate is issued automatically and appears under Certificates.'],
      },
      {
        heading: 'Download, print and verify',
        steps: [
          'Open a certificate, pick a design and choose Download PDF or Print.',
          'Anyone can scan the QR code on the certificate to confirm it is genuine.',
        ],
      },
    ],
  },
]
