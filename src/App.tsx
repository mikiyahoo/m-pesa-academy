import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminLayout } from './admin/AdminLayout'
import { AdminAssignments } from './admin/pages/Assignments'
import { AdminCategories } from './admin/pages/Categories'
import { AdminCertificates } from './admin/pages/Certificates'
import { AdminTemporaryAccess } from './admin/pages/TemporaryAccess'
import { AdminJourneyDetail, AdminJourneys, AdminMaterials } from './admin/pages/Content'
import { AdminDashboard } from './admin/pages/Dashboard'
import { AdminAssessments, AdminFeedbackForms, AdminFeedbackResponses, AdminSubmissions } from './admin/pages/Evaluation'
import { AdminGroups, AdminUserView, AdminUsers } from './admin/pages/People'
import { AdminReports } from './admin/pages/Reports'
import { AdminRequests } from './admin/pages/Requests'
import { AdminAuditLogs } from './admin/pages/AuditLogs'
import { AdminCertificateTemplates, AdminTrainingTypes } from './admin/pages/Settings'
import { AdminTrainingDetail } from './admin/pages/TrainingDetail'
import { AdminTrainings } from './admin/pages/Trainings'
import { TrainerDashboard } from './admin/pages/TrainerDashboard'
import { AdminLeaderboard } from './admin/pages/Leaderboard'
import { AdminStoreProvider } from './admin/store'
import { Layout } from './components/Layout'
import { AcceptInvite } from './pages/auth/AcceptInvite'
import { Login } from './pages/auth/Login'
import { TemporaryGate } from './pages/auth/TemporaryGate'
import { Otp } from './pages/auth/Otp'
import { CertificateView, Certificates } from './pages/Certificates'
import { CoursePlayer } from './pages/learn/CoursePlayer'
import { Report } from './pages/Report'
import { Help } from './pages/Help'
import { Profile } from './pages/Profile'
import { Learning } from './pages/Learning'
import { TrainingDetail } from './pages/TrainingDetail'
import { Trainings } from './pages/Trainings'
import { VerifyCertificate } from './pages/VerifyCertificate'
import { RequestDetail } from './requester/RequestDetail'
import { RequestForm } from './requester/RequestForm'
import { RequesterDashboard } from './requester/RequesterDashboard'
import { RequesterLayout } from './requester/RequesterLayout'
import { RequesterReports } from './requester/RequesterReports'
import { useAuth } from './store/Auth'
import { OfflineNetworkBanner } from './components/OfflineCourseToggle'
import { registerServiceWorker } from './lib/offlineManager'

registerServiceWorker()

export default function App() {
  const { stage, role, personId } = useAuth()
  const { pathname } = useLocation()

  // The certificate QR code opens a public verification page, signed in or not.
  const verify = pathname.match(/^\/verify\/([^/]+)/)?.[1]
  if (verify) return <VerifyCertificate id={decodeURIComponent(verify)} />

  // Invite links work before sign-in (TE-1.2).
  const invite = pathname.match(/^\/accept\/([^/]+)/)?.[1]
  if (stage === 'signedOut' && invite) return <AcceptInvite token={decodeURIComponent(invite)} />
  if (stage === 'signedOut') return <Login />
  if (stage === 'otp') return <Otp />

  if (role === 'admin') {
    return (
      <AdminStoreProvider>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="trainings" element={<AdminTrainings />} />
            <Route path="trainings/:id" element={<AdminTrainingDetail />} />
            <Route path="requests" element={<AdminRequests />} />
            <Route path="calendar" element={<Navigate to="/admin/trainings?view=calendar" replace />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="journeys" element={<AdminJourneys />} />
            <Route path="journeys/:id" element={<AdminJourneyDetail />} />
            <Route path="materials" element={<AdminMaterials />} />
            <Route path="assignments" element={<AdminAssignments />} />
            <Route path="feedback" element={<Navigate to="/admin/feedback/forms" replace />} />
            <Route path="feedback/forms" element={<AdminFeedbackForms />} />
            <Route path="feedback/responses" element={<AdminFeedbackResponses />} />
            <Route path="assessments" element={<Navigate to="/admin/assessments/pre" replace />} />
            <Route path="assessments/:kind" element={<AdminAssessments />} />
            <Route path="submissions" element={<AdminSubmissions />} />
            <Route path="certificates" element={<AdminCertificates />} />
            <Route path="certificate-templates" element={<AdminCertificateTemplates />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserView />} />
            <Route path="temporary-access" element={<AdminTemporaryAccess />} />
            <Route path="groups" element={<AdminGroups />} />
            <Route path="training-types" element={<AdminTrainingTypes />} />
            <Route path="training-types/categories" element={<AdminTrainingTypes byCategory />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="leaderboard" element={<AdminLeaderboard />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminStoreProvider>
    )
  }

  // Trainers use the admin screens, scoped to the sessions they conduct (D04, S10).
  if (role === 'trainer') {
    return (
      <AdminStoreProvider>
        <Routes>
          <Route path="/admin" element={<AdminLayout variant="trainer" trainerId={personId ?? 's3'} />}>
            <Route index element={<TrainerDashboard />} />
            <Route path="trainings" element={<AdminTrainings />} />
            <Route path="trainings/:id" element={<AdminTrainingDetail />} />
            <Route path="calendar" element={<Navigate to="/admin/trainings?view=calendar" replace />} />
            <Route path="materials" element={<AdminMaterials />} />
            <Route path="submissions" element={<AdminSubmissions />} />
            <Route path="certificates" element={<AdminCertificates />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminStoreProvider>
    )
  }

  // Requesters share the admin store, so their submissions show up in the admin queue.
  // Learner pages, shared by trainees and requesters (who are trainees too).
  const traineePages = (
    <>
      <Route path="/trainings" element={<Trainings />} />
      <Route path="/trainings/:id" element={<TrainingDetail />} />
      <Route path="/certificates" element={<Certificates />} />
      <Route path="/certificates/:id" element={<CertificateView />} />
      <Route path="/calendar" element={<Navigate to="/learning?view=calendar" replace />} />
      <Route path="/report" element={<Report />} />
      <Route path="/learning" element={<Learning />} />
      <Route path="/journeys" element={<Navigate to="/learning?tab=Paths" replace />} />
      <Route path="/help" element={<Help />} />
      <Route path="/profile" element={<Profile />} />
    </>
  )

  if (role === 'requester') {
    return (
      <AdminStoreProvider>
        <Routes>
          {/* Requesters are trainees too: the learner portal plus their requests. */}
          <Route path="/trainings/:id/learn/:itemId?" element={<CoursePlayer />} />
          <Route element={<RequesterLayout />}>
            {traineePages}
            <Route path="/requests" element={<RequesterDashboard />} />
            <Route path="/requests/new" element={<RequestForm />} />
            <Route path="/requests/reports" element={<RequesterReports />} />
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route path="/requests/:id/edit" element={<RequestForm />} />
            <Route path="*" element={<Navigate to="/trainings" replace />} />
          </Route>
        </Routes>
      </AdminStoreProvider>
    )
  }

  return (
    <TemporaryGate>
      <OfflineNetworkBanner />
      <Routes>
        {/* The course player has its own full-screen shell. */}
        <Route path="/trainings/:id/learn/:itemId?" element={<CoursePlayer />} />
        <Route element={<Layout />}>
          {traineePages}
          <Route path="*" element={<Navigate to="/trainings" replace />} />
        </Route>
      </Routes>
    </TemporaryGate>
  )
}
