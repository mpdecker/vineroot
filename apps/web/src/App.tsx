import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import HomePage from './pages/home/HomePage';
import MyTasksPage from './pages/my-tasks/MyTasksPage';
import ProjectPage from './pages/project/ProjectPage';
import PortfolioPage from './pages/portfolio/PortfolioPage';
import PortfoliosListPage from './pages/portfolios/PortfoliosListPage';
import ProgramsListPage from './pages/programs/ProgramsListPage';
import ProgramDetailPage from './pages/programs/ProgramDetailPage';
import GoalsPage from './pages/goals/GoalsPage';
import ReportingPage from './pages/reporting/ReportingPage';
import AutomationsPage from './pages/automations/AutomationsPage';
import IntegrationsPage from './pages/integrations/IntegrationsPage';
import WorkspacesPage from './pages/workspaces/WorkspacesPage';
import ProjectsListPage from './pages/projects/ProjectsListPage';
import DashboardsListPage from './pages/dashboards/DashboardsListPage';
import DashboardDetailPage from './pages/dashboards/DashboardDetailPage';
import PmProjectsPage from './pages/pm/PmProjectsPage';
import PmProjectDashboardPage from './pages/pm/PmProjectDashboardPage';
import PmTaskBoardPage from './pages/pm/PmTaskBoardPage';
import ProjectIntakeFormPage from './pages/project/ProjectIntakeFormPage';
import PublicIntakeFormPage from './pages/public/PublicIntakeFormPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import SettingsLayout from './pages/settings/SettingsLayout';
import ProfilePage from './pages/settings/ProfilePage';
import WorkspaceSettingsPage from './pages/settings/WorkspaceSettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** MS Project parity: friendly URLs for the Gantt-style schedule tab (canonical path remains `timeline`). */
function RedirectProjectScheduleAlias({ to }: { to: string }) {
  const { projectId } = useParams<{ projectId: string }>();
  return <Navigate to={`/projects/${projectId}/${to}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/i/:token" element={<PublicIntakeFormPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
        <Route path="inbox" element={<Navigate to="/notifications" replace />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="workspaces" element={<WorkspacesPage />} />
        <Route path="projects" element={<ProjectsListPage />} />
        <Route path="dashboards" element={<DashboardsListPage />} />
        <Route path="dashboards/:dashboardId" element={<DashboardDetailPage />} />
        <Route path="portfolios/:portfolioId" element={<PortfolioPage />} />
        <Route path="portfolios" element={<PortfoliosListPage />} />
        <Route path="programs/:programId" element={<ProgramDetailPage />} />
        <Route path="programs" element={<ProgramsListPage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="projects/:projectId/list" element={<ProjectPage />} />
        <Route path="projects/:projectId/board" element={<ProjectPage />} />
        <Route path="projects/:projectId/backlog" element={<ProjectPage />} />
        <Route path="projects/:projectId/sprint-board" element={<ProjectPage />} />
        <Route path="projects/:projectId/roadmap" element={<ProjectPage />} />
        <Route path="projects/:projectId/epics" element={<ProjectPage />} />
        <Route path="projects/:projectId/timeline" element={<ProjectPage />} />
        <Route
          path="projects/:projectId/schedule"
          element={<RedirectProjectScheduleAlias to="timeline" />}
        />
        <Route
          path="projects/:projectId/gantt"
          element={<RedirectProjectScheduleAlias to="timeline" />}
        />
        <Route path="projects/:projectId/calendar" element={<ProjectPage />} />
        <Route path="projects/:projectId/activity" element={<ProjectPage />} />
        <Route path="projects/:projectId/burndown" element={<ProjectPage />} />
        <Route path="projects/:projectId/flow" element={<ProjectPage />} />
        <Route path="projects/:projectId/workload" element={<ProjectPage />} />
        <Route path="projects/:projectId/network" element={<ProjectPage />} />
        <Route path="projects/:projectId/timephased" element={<ProjectPage />} />
        <Route path="projects/:projectId/form" element={<ProjectIntakeFormPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="reporting" element={<ReportingPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="workspace" element={<WorkspaceSettingsPage />} />
        </Route>
        <Route path="pm" element={<PmProjectsPage />} />
        <Route path="pm/projects/:projectId" element={<PmProjectDashboardPage />} />
        <Route path="pm/projects/:projectId/board" element={<PmTaskBoardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
