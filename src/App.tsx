import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './admin/AdminLayout'
import { AdminJourneyDetail, AdminJourneys, AdminMaterials } from './admin/pages/Content'
import { AdminDashboard } from './admin/pages/Dashboard'
import { AdminAssessments, AdminFeedbackForms, AdminFeedbackResponses } from './admin/pages/Evaluation'
import { AdminGroups, AdminUsers } from './admin/pages/People'
import { AdminReports } from './admin/pages/Reports'
import { AdminRequests } from './admin/pages/Requests'
import { AdminAuditLogs, AdminCertificateTemplates, AdminTrainingTypes } from './admin/pages/Settings'
import { AdminTrainingDetail } from './admin/pages/TrainingDetail'
import { AdminTrainings } from './admin/pages/Trainings'
import { AdminStoreProvider } from './admin/store'
import { Layout } from './components/Layout'
import { Login } from './pages/auth/Login'
import { Otp } from './pages/auth/Otp'
import { CalendarPage } from './pages/CalendarPage'
import { CertificateView, Certificates } from './pages/Certificates'
import { Report } from './pages/Report'
import { TrainingDetail } from './pages/TrainingDetail'
import { Trainings } from './pages/Trainings'
import { useAuth } from './store/Auth'

export default function App() {
  const { stage, role } = useAuth()

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
            <Route path="journeys" element={<AdminJourneys />} />
            <Route path="journeys/:id" element={<AdminJourneyDetail />} />
            <Route path="materials" element={<AdminMaterials />} />
            <Route path="feedback" element={<Navigate to="/admin/feedback/forms" replace />} />
            <Route path="feedback/forms" element={<AdminFeedbackForms />} />
            <Route path="feedback/responses" element={<AdminFeedbackResponses />} />
            <Route path="assessments" element={<Navigate to="/admin/assessments/pre" replace />} />
            <Route path="assessments/:kind" element={<AdminAssessments />} />
            <Route path="certificate-templates" element={<AdminCertificateTemplates />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="groups" element={<AdminGroups />} />
            <Route path="training-types" element={<AdminTrainingTypes />} />
            <Route path="training-types/categories" element={<AdminTrainingTypes byCategory />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminStoreProvider>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/trainings" element={<Trainings />} />
        <Route path="/trainings/:id" element={<TrainingDetail />} />
        <Route path="/certificates" element={<Certificates />} />
        <Route path="/certificates/:id" element={<CertificateView />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/report" element={<Report />} />
        <Route path="*" element={<Navigate to="/trainings" replace />} />
      </Route>
    </Routes>
  )
}
