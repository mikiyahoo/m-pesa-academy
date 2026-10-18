const PREFS_KEY = 'mpesa-learning:notification-prefs'

/** What the learner wants in their notification bell; remembered per browser. */
export type NotificationPrefs = { reminders: boolean; certificates: boolean; feedback: boolean }

export const DEFAULT_PREFS: NotificationPrefs = { reminders: true, certificates: true, feedback: true }

export function loadNotificationPrefs(): NotificationPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_PREFS
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Preferences are a convenience in the prototype.
  }
}
