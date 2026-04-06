# Vineroot React Frontend - Build Summary

## Project Structure

Complete React + TypeScript + Tailwind frontend for Vineroot project management app.

### Configuration Files
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Vite build configuration with API proxying
- `tsconfig.json` - TypeScript configuration
- `tsconfig.node.json` - Node-specific TypeScript config
- `tailwind.config.js` - Tailwind CSS theme customization
- `postcss.config.js` - PostCSS processing
- `index.html` - HTML entry point

### Core Files
- `src/main.tsx` - React app entry point with Query Client setup
- `src/App.tsx` - Main router with protected routes
- `src/index.css` - Global Tailwind styles

### Types
- `src/types/index.ts` - Complete TypeScript interfaces aligned with backend schema

### Libraries
- `src/lib/api.ts` - Axios HTTP client with auth interceptors and token refresh
- `src/lib/socket.ts` - Socket.io client setup for real-time events

### State Management (Zustand)
- `src/stores/auth.store.ts` - User authentication state
- `src/stores/workspace.store.ts` - Current workspace context
- `src/stores/ui.store.ts` - UI state (sidebar, active task, search)

### Hooks (React Query)
- `src/hooks/useAuth.ts` - Login, register, me queries
- `src/hooks/useProjects.ts` - Project CRUD operations
- `src/hooks/useTasks.ts` - Task CRUD, assignment, movement
- `src/hooks/useNotifications.ts` - Notifications with real-time updates

### UI Components
All components use Tailwind CSS and lucide-react icons:

- `src/components/ui/Button.tsx` - Primary, secondary, ghost, danger variants
- `src/components/ui/Input.tsx` - Text input with label, error, hint
- `src/components/ui/Modal.tsx` - Framer-motion animated modal
- `src/components/ui/Avatar.tsx` - User avatar with color hash initials
- `src/components/ui/Badge.tsx` - Priority and status badges with colors
- `src/components/ui/Dropdown.tsx` - Click-outside dropdown menu
- `src/components/ui/Tooltip.tsx` - Hover tooltip on any content
- `src/components/ui/index.ts` - Barrel export

### Layout Components
- `src/components/layout/Sidebar.tsx` - Project navigation, collapsible sidebar
- `src/components/layout/TopBar.tsx` - Header with notifications bell
- `src/components/layout/AppShell.tsx` - Main layout wrapper

### Task Components
- `src/components/task/TaskRow.tsx` - List view with status, priority, due date
- `src/components/task/TaskCard.tsx` - Kanban board card with drag support
- `src/components/task/TaskDetail.tsx` - Right-side panel with full task editing

### Project Components
- `src/components/project/ProjectListView.tsx` - Asana-style list with sections
- `src/components/project/ProjectBoardView.tsx` - Kanban board with columns
- `src/components/project/ProjectHeader.tsx` - Project title and view tabs

### Pages
- `src/pages/auth/LoginPage.tsx` - Email/password login with error handling
- `src/pages/auth/RegisterPage.tsx` - Account creation with workspace setup
- `src/pages/home/HomePage.tsx` - Dashboard with recent projects
- `src/pages/my-tasks/MyTasksPage.tsx` - Task grouping: Today, Upcoming, Later
- `src/pages/inbox/InboxPage.tsx` - Notifications with type icons
- `src/pages/project/ProjectPage.tsx` - Project with List/Board views
- `src/pages/portfolio/PortfolioPage.tsx` - Portfolio placeholder
- `src/pages/goals/GoalsPage.tsx` - Goals placeholder
- `src/pages/reporting/ReportingPage.tsx` - Reporting placeholder

## Features Implemented

### Authentication
- Login/Register pages with form validation
- Persistent auth tokens with Zustand
- Automatic token refresh on 401 responses
- Protected routes that redirect to login

### Data Management
- React Query for server state with staleTime and retry logic
- Zustand for client state (auth, workspace, UI)
- Auto-refetching for notifications (30s interval)

### Project Management
- Multiple view types: List (with sections) and Board (Kanban)
- Task CRUD with optimistic updates
- Task assignment and status management
- Section-based organization

### Real-time Capabilities
- Socket.io client configured for workspace events
- Auto-reconnection handling
- Event emission for workspace changes

### UI/UX
- Responsive layout with collapsible sidebar
- Framer-motion animations for modals and dropdowns
- Tailwind CSS for consistent styling
- Lucide-react icons throughout
- Status colors: DONE=green, BLOCKED=red, IN_PROGRESS=purple, etc.
- Priority colors: NONE=gray, LOW=blue, MEDIUM=yellow, HIGH=orange, URGENT=red

### Forms
- Controlled inputs with label, error, and hint support
- Loading states on async operations
- Form validation

## API Integration

All endpoints in `/api/v1` namespace:

### Auth
- POST `/auth/login`
- POST `/auth/register`
- POST `/auth/refresh`
- GET `/auth/me`

### Projects
- GET `/workspaces/{id}/projects`
- GET `/projects/{id}`
- POST `/workspaces/{id}/projects`
- PATCH `/projects/{id}`

### Tasks
- GET `/tasks` (with filters)
- GET `/tasks/mine`
- GET `/tasks/{id}`
- POST `/projects/{id}/tasks`
- PATCH `/tasks/{id}`
- PATCH `/tasks/{id}/move`
- DELETE `/tasks/{id}`
- POST `/tasks/{id}/assign`
- DELETE `/tasks/{id}/assignees/{userId}`

### Notifications
- GET `/notifications`
- GET `/notifications/unread-count`
- PATCH `/notifications/{id}`
- POST `/notifications/mark-all-read`

## Development

Install dependencies:
```bash
npm install
```

Start dev server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

## Notes

- All components use TypeScript with strict mode
- No hardcoded API URLs (uses relative paths with Vite proxy)
- Error handling with try/catch in mutations
- Loading states on all async operations
- Responsive design supporting mobile to desktop
- Accessibility basics (proper label associations, focus states)
