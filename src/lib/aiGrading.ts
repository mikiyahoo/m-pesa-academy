/**
 * AI Scoring & Feedback Engine for Descriptive / Free-text Assessment Questions.
 * Uses keyword matching, concept coverage, and semantic phrase alignment to
 * automatically score open-ended answers and generate instant feedback.
 */

import type { Assessment, AssessmentSubmission } from '../admin/types'

const COMMON_STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours'
])

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Extracts significant concept keywords and short phrases from a model answer. */
export function extractKeywords(text: string): string[] {
  const words = normalizeText(text).split(' ')
  const unique = new Set<string>()

  for (const w of words) {
    if (w.length >= 3 && !COMMON_STOPWORDS.has(w)) {
      unique.add(w)
    }
  }

  // Also include 2-word key combinations if relevant
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i]
    const w2 = words[i + 1]
    if (w1.length >= 3 && w2.length >= 3 && !COMMON_STOPWORDS.has(w1) && !COMMON_STOPWORDS.has(w2)) {
      unique.add(`${w1} ${w2}`)
    }
  }

  return Array.from(unique)
}

export type DescriptiveScoreResult = {
  score: number           // 0 to 100 percentage
  matchedKeywords: string[]
  missingKeywords: string[]
  feedback: string
  confidence: number      // 0 to 100%
}

/**
 * Evaluates a learner's free-text response against the model answer.
 */
export function scoreDescriptiveAnswer(learnerAnswer: string, modelAnswer: string): DescriptiveScoreResult {
  const trimmed = learnerAnswer.trim()
  if (!trimmed) {
    return {
      score: 0,
      matchedKeywords: [],
      missingKeywords: extractKeywords(modelAnswer).slice(0, 5),
      feedback: 'No answer provided.',
      confidence: 100,
    }
  }

  const modelKeywords = extractKeywords(modelAnswer)
  if (!modelKeywords.length) {
    // If no model answer keywords, evaluate based on completeness and length
    const wordsCount = trimmed.split(/\s+/).length
    const score = Math.min(100, Math.max(50, wordsCount * 5))
    return {
      score,
      matchedKeywords: [],
      missingKeywords: [],
      feedback: score >= 80 ? 'Well structured response.' : 'Response provided, but could be more detailed.',
      confidence: 65,
    }
  }

  const normalizedLearner = normalizeText(learnerAnswer)
  const learnerWords = new Set(normalizedLearner.split(' '))

  const matched: string[] = []
  const missing: string[] = []

  for (const kw of modelKeywords) {
    if (kw.includes(' ')) {
      // Bigram check
      if (normalizedLearner.includes(kw)) matched.push(kw)
    } else {
      // Unigram check (with simple prefix/stem matching)
      const found = Array.from(learnerWords).some(lw => lw === kw || (kw.length > 4 && (lw.startsWith(kw.slice(0, 4)) || kw.startsWith(lw.slice(0, 4)))))
      if (found) matched.push(kw)
      else missing.push(kw)
    }
  }

  // Calculation
  const totalSingleKeywords = modelKeywords.filter(k => !k.includes(' ')).length || 1
  const matchedSingle = matched.filter(k => !k.includes(' ')).length
  const keywordMatchRatio = matchedSingle / totalSingleKeywords

  // Length check (bonus for reasonable elaboration)
  const modelWordCount = modelAnswer.split(/\s+/).length
  const learnerWordCount = trimmed.split(/\s+/).length
  const lengthRatio = Math.min(1, learnerWordCount / Math.max(10, modelWordCount * 0.6))

  // Weighted score (75% keyword relevance, 25% depth)
  const calculated = Math.round((keywordMatchRatio * 0.75 + lengthRatio * 0.25) * 100)
  const finalScore = Math.max(0, Math.min(100, calculated))

  // Construct feedback
  const topMatched = matched.filter(k => !k.includes(' ')).slice(0, 4)
  const topMissing = missing.filter(k => !k.includes(' ')).slice(0, 3)

  let feedback = ''
  if (finalScore >= 85) {
    feedback = `Excellent answer! Demonstrates clear understanding. Key concepts identified: ${topMatched.join(', ')}.`
  } else if (finalScore >= 65) {
    feedback = `Good attempt covering ${topMatched.join(', ')}. To achieve full marks, also mention: ${topMissing.join(', ')}.`
  } else if (finalScore >= 40) {
    feedback = `Partial credit. Mentioned ${topMatched.length ? topMatched.join(', ') : 'some relevant context'}, but missed key points: ${topMissing.join(', ')}.`
  } else {
    feedback = `Needs improvement. Did not adequately cover the required concepts: ${topMissing.join(', ')}.`
  }

  const confidence = Math.round(75 + (matched.length / Math.max(1, modelKeywords.length)) * 25)

  return {
    score: finalScore,
    matchedKeywords: topMatched,
    missingKeywords: topMissing,
    feedback,
    confidence,
  }
}

export type AutoGradeSubmissionResult = {
  overallScore: number
  questionScores: Record<string, { score: number; maxScore: number; feedback: string }>
  summaryComment: string
  descriptiveCount: number
}

/**
 * Auto-grades an entire submission:
 * Evaluates MCQs strictly and descriptive questions with AI keywords matching.
 */
export function autoGradeSubmission(
  assessment: Assessment,
  submission: AssessmentSubmission,
): AutoGradeSubmissionResult {
  const questionScores: Record<string, { score: number; maxScore: number; feedback: string }> = {}
  let totalWeightedScore = 0
  let totalWeight = 0
  let descriptiveCount = 0
  const feedbackItems: string[] = []

  for (const q of assessment.questions) {
    const weight = q.weight || 1
    totalWeight += weight
    const answer = submission.answers[q.id]

    if (q.type === 'mcq') {
      const isCorrect = typeof answer === 'number' && typeof q.answer === 'number' && answer === q.answer
      const qScore = isCorrect ? 100 : 0
      questionScores[q.id] = {
        score: qScore,
        maxScore: 100,
        feedback: isCorrect ? 'Correct choice selected.' : `Incorrect. Expected: ${q.options?.[Number(q.answer)] ?? ''}`,
      }
      totalWeightedScore += qScore * weight
    } else if (q.type === 'descriptive') {
      descriptiveCount++
      const textAnswer = typeof answer === 'string' ? answer : ''
      const modelAnswer = typeof q.answer === 'string' ? q.answer : ''
      const evalResult = scoreDescriptiveAnswer(textAnswer, modelAnswer)

      questionScores[q.id] = {
        score: evalResult.score,
        maxScore: 100,
        feedback: evalResult.feedback,
      }
      totalWeightedScore += evalResult.score * weight
      feedbackItems.push(`Q${assessment.questions.indexOf(q) + 1}: ${evalResult.feedback}`)
    } else {
      // upload / other
      questionScores[q.id] = { score: 100, maxScore: 100, feedback: 'File submitted.' }
      totalWeightedScore += 100 * weight
    }
  }

  const overallScore = totalWeight ? Math.round(totalWeightedScore / totalWeight) : 100
  const passMark = assessment.passMark || 70
  const passed = overallScore >= passMark

  const summaryComment = [
    `AI Auto-Graded: ${overallScore}% (${passed ? 'Passed' : 'Needs Retake'}).`,
    feedbackItems.length ? feedbackItems.join(' | ') : 'All objective criteria evaluated successfully.',
  ].join(' ')

  return {
    overallScore,
    questionScores,
    summaryComment,
    descriptiveCount,
  }
}
