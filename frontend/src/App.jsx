import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ClinicalShell } from "./components/clinical/ClinicalShell.jsx";

import { ProtectedRoute } from "./components/ProtectedRoute";

import { DashboardPage } from "./pages/DashboardPage";

import { LoginPage } from "./pages/LoginPage";

import { PlaceholderPage } from "./pages/PlaceholderPage";

import { DepartmentAnalyticsPage } from "./pages/DepartmentAnalyticsPage";

import { AlertsPage } from "./pages/AlertsPage";

import { CompletedQueuePage } from "./pages/CompletedQueuePage";

import { LiveQueuePage } from "./pages/LiveQueuePage";

import { PatientRecordsPage } from "./pages/PatientRecordsPage";

import { TokenCreationPage } from "./pages/TokenCreationPage";

import { TokenDetailPage } from "./pages/TokenDetailPage";



import { APP_NAME } from "./constants/brand.js";

const AppLayout = ({ children, title = APP_NAME }) => (

  <ClinicalShell pageTitle={title}>{children}</ClinicalShell>

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

              <AppLayout title="Create Token">

                <TokenCreationPage />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/create-token"

          element={

            <ProtectedRoute>

              <AppLayout title="Create Token">

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

          path="/tokens/*"

          element={

            <ProtectedRoute>

              <AppLayout title="Patient visit">

                <TokenDetailPage />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/dashboard"

          element={

            <ProtectedRoute>

              <AppLayout title="Overview">

                <DashboardPage />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/alerts"

          element={

            <ProtectedRoute>

              <AppLayout title="Alerts">

                <AlertsPage />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/intelligence"

          element={<Navigate to="/infographic" replace />}

        />

        <Route

          path="/patient-queue"

          element={

            <ProtectedRoute>

              <AppLayout title="Overview">

                <DashboardPage />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/overview"

          element={

            <ProtectedRoute>

              <AppLayout title="Overview">

                <DashboardPage />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/live-queue"

          element={

            <ProtectedRoute>

              <AppLayout title="Live Queue">

                <LiveQueuePage />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/completed-queue"

          element={

            <ProtectedRoute>

              <AppLayout title="Completed">

                <CompletedQueuePage />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/department-analytics"

          element={<Navigate to="/infographic" replace />}

        />

        <Route

          path="/infographic"

          element={

            <ProtectedRoute>

              <AppLayout title="Infographic">

                <DepartmentAnalyticsPage />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/schedules"

          element={

            <ProtectedRoute>

              <AppLayout title="Schedules">

                <PlaceholderPage title="Schedules" />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/patient-records"

          element={

            <ProtectedRoute>

              <AppLayout title="Patient Records">

                <PatientRecordsPage />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/staff-directory"

          element={

            <ProtectedRoute>

              <AppLayout title="Staff Directory">

                <PlaceholderPage title="Staff Directory" />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/reports"

          element={

            <ProtectedRoute>

              <AppLayout title="Reports">

                <PlaceholderPage title="Reports" />

              </AppLayout>

            </ProtectedRoute>

          }

        />

        <Route

          path="/help-center"

          element={

            <ProtectedRoute>

              <AppLayout title="Help Center">

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

