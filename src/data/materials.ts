import type { Slide } from '../types'

/**
 * Sample lesson videos shipped under /public/trainings. Video modules are assigned
 * one of these round-robin so every training can be played end-to-end in the demo.
 */
export const SAMPLE_VIDEOS = [
  '/trainings/Module%20(1).mp4',
  '/trainings/Module%20(2).mp4',
  '/trainings/Module%20(3).mp4',
  '/trainings/Module%20(4).mp4',
  '/trainings/Module%20(5).mp4',
]

/** Source presentation under /public/trainings, offered for download next to the in-app slides. */
export const SAMPLE_DECK_FILE = '/trainings/Sample Training.pptx'

/**
 * Pages taken from "Sample Training.pptx" (merchant, distribution and agency-banking
 * product journeys) so the in-app presentation viewer shows the real sample deck.
 */
export const SAMPLE_DECK: Slide[] = [
  {
    title: 'Unified Product as Primary Operator and Finance Operator',
    bullets: [
      'M-PESA merchant, distribution and agency-banking product suite',
      'Primary operator and finance operator responsibilities',
      'Sample Training.pptx · M-PESA Learning & Development',
    ],
  },
  {
    title: 'Unified HO',
    bullets: [
      'Request Payment — self service, generate QR, request to pay',
      'Accept from M-PESA wallet via link and international card via link',
      'Self service — withdraw to bank, add money',
      'Distribute float · collect balance · roll up',
      'Withdraw to my bank or to another bank',
    ],
  },
  {
    title: 'Unified own store (payment merchant)',
    bullets: [
      'Request payment · sell airtime · sell package',
      'Assisted payment — EEU, water, school payment',
      'Self service — withdraw to my bank, add money',
      'EVD — sell float to print account',
    ],
  },
  {
    title: 'Unified independent store',
    bullets: [
      'Request payment, sell airtime and sell package',
      'Assisted payment — EEU, water, school payment',
      'Self service — withdraw to my bank, add money',
      'Transfer float to print account (EVD)',
      'QR, working reward, commission and print account',
    ],
  },
  {
    title: 'Large & Medium Merchant — Primary and Finance Operator',
    bullets: [
      'Request payment (self service)',
      'Withdraw to bank · add money',
      'Distribute float · collect balance',
      'Accept by QR or payment link (wallet and international card)',
    ],
  },
  {
    title: 'Micro Merchant — Primary and Finance Operator',
    bullets: [
      'Request payment · sell airtime · sell package',
      'Self service — withdraw to bank, add money',
      'Transfer float to print account (EVD)',
      'Working reward · Mekoya commission · print account',
    ],
  },
  {
    title: 'Distribution Product with Primary Operator',
    bullets: [
      'Distribution HO and shop manager roles',
      'Sell float to EVD and DSA',
      'Sell float to print / working accounts',
      'Check store balance',
    ],
  },
  {
    title: 'Agency banking classification',
    bullets: [
      'Unified independent and unified own store',
      'Assisted payment — school, water, EEU',
      'Self service — withdraw to my bank, add money',
      'Match the merchant type to the right product before enabling services',
    ],
  },
  {
    title: 'Summary & next steps',
    bullets: [
      'Confirm the operator role: primary, finance or assistant',
      'Walk the customer through the self-service journeys',
      'Download the deck to keep for reference',
      'Mark the module complete to unlock the next one',
    ],
  },
]
