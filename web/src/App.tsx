import { Link, Outlet, Route, Routes } from 'react-router-dom';
import Nav from './components/Nav';
import ProtectedRoute from './components/ProtectedRoute';
import AppointmentDetailPage from './pages/AppointmentDetailPage';
import AppointmentsPage from './pages/AppointmentsPage';
import BookingWizard from './pages/booking/BookingWizard';
import ReviewPage from './pages/booking/ReviewPage';
import DashboardPage from './pages/DashboardPage';
import DependentsPage from './pages/DependentsPage';
import InsuranceOnboardingPage from './pages/InsuranceOnboardingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ClosuresPage from './pages/staff/ClosuresPage';
import ReviewQueuePage from './pages/staff/ReviewQueuePage';
import SchedulePage from './pages/staff/SchedulePage';
import StaffBookingPage from './pages/staff/StaffBookingPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import WaitlistClaimPage from './pages/WaitlistClaimPage';

function Layout() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Nav />
      <main id="main" className="container" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}

function NotFound() {
  return (
    <div className="narrow card">
      <h1>Page not found</h1>
      <Link to="/">Go to the start page</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/waitlist/claim/:token" element={<WaitlistClaimPage />} />

        <Route element={<ProtectedRoute roles={['PATIENT']} />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/onboarding/insurance" element={<InsuranceOnboardingPage />} />
          <Route path="/book" element={<BookingWizard />} />
          <Route path="/book/review/:appointmentId" element={<ReviewPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
          <Route path="/dependents" element={<DependentsPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['STAFF', 'PRACTITIONER']} />}>
          <Route path="/staff/schedule" element={<SchedulePage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['STAFF']} />}>
          <Route path="/staff/review" element={<ReviewQueuePage />} />
          <Route path="/staff/closures" element={<ClosuresPage />} />
          <Route path="/staff/book" element={<StaffBookingPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
