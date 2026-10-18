import { useAdmin } from '../admin/store'
import { Layout } from '../components/Layout'

/** Learner-style shell with requester navigation; "Reset demo data" resets the shared demo store. */
export function RequesterLayout() {
  const { reset } = useAdmin()
  return (
    <Layout
      variant="requester"
      reset={{
        label: 'Reset demo data',
        title: 'Reset demo data?',
        message: 'Requests, drafts and admin changes go back to the original demo data.',
        done: 'Demo data restored',
        run: reset,
      }}
    />
  )
}
