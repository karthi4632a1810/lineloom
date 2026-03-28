import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { TokenCreationPage } from "./pages/TokenCreationPage";
import { TokenDetailPage } from "./pages/TokenDetailPage";

const AppLayout = ({ children }) => (
  <>
    <Navbar />
    <main className="app-main">{children}</main>
  </>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/token-create"
          element={
            <ProtectedRoute>
              <AppLayout>
                <TokenCreationPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-token"
          element={
            <ProtectedRoute>
              <AppLayout>
                <TokenCreationPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient-detail"
          element={<Navigate to="/tokens/T-SEED-001" replace />}
        />
        <Route
          path="/tokens/:tokenId"
          element={
            <ProtectedRoute>
              <AppLayout>
                <TokenDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient-queue"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/overview"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/live-queue"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/department-analytics"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PlaceholderPage title="Department Analytics" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedules"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PlaceholderPage title="Schedules" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient-records"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PlaceholderPage title="Patient Records" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff-directory"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PlaceholderPage title="Staff Directory" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PlaceholderPage title="Reports" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/help-center"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PlaceholderPage title="Help Center" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            localStorage.getItem("auth_token") ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
