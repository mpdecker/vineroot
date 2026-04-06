# Vineroot Frontend - Technical Guide

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev server proxies API calls to `http://localhost:4000/api/v1` and WebSocket to the same server.

## Architecture Overview

### Data Flow

```
API Response → React Query → Component State → UI Render
                    ↓
            Zustand Store (auth, ui, workspace)
                    ↓
            Component Props/Context
```

### State Management Strategy

**React Query (Server State)**
- Caches API responses
- Handles refetching and invalidation
- 30s stale time for most queries
- Auto-retry on failure

**Zustand Stores (Client State)**
- Auth: User, tokens, login state
- Workspace: Current workspace, list of workspaces
- UI: Sidebar collapse, active task, search visibility

**Component State (Local)**
- Form values, modals, temporary UI state
- Kept in component to minimize prop drilling

### Component Patterns

**Page Component**
- Fetches data with hooks
- Renders layout + content
- Handles loading/error states

**Container Component**
- Composes smaller components
- Manages local state
- Passes callbacks to children

**Presentational Component**
- Pure render functions
- No data fetching
- Fully controlled by props

## Key Features

### Authentication Flow

1. User enters credentials on LoginPage
2. `useLogin()` hook calls `/auth/login`
3. API returns tokens + user
4. Store tokens in auth.store + localStorage
5. Redirect to `/home`
6. On 401, auto-refresh token or redirect to login

### Task Management

Tasks support:
- Multiple statuses (BACKLOG, READY, IN_PROGRESS, DONE, etc.)
- Priorities (NONE, LOW, MEDIUM, HIGH, URGENT)
- Assignments (multiple users per task)
- Due dates with overdue highlighting
- Subtasks (parent-child relationship)
- Comments and activity logs

### Real-time Updates

Socket.io listens for:
- task:created, task:updated, task:deleted, task:moved
- comment:created, comment:updated
- notification:created

Connect on workspace selection:
```typescript
connectSocket(workspaceId);
// Emits 'join:workspace' to server
```

### Error Handling

**API Errors**
- Caught in mutation onError handlers
- Display toast/alert to user
- Log to console in dev

**Network Errors**
- Axios interceptor on 401
- Auto-retry with exponential backoff
- Fallback to redirect if no refresh token

**Component Errors**
- No error boundary yet (add if needed)
- Each hook returns `error` state

## Code Examples

### Fetching Data

```typescript
import { useProject } from '@/hooks/useProjects';

export function MyComponent() {
  const { data: project, isLoading, error } = useProject(projectId);

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  return <ProjectView project={project} />;
}
```

### Updating Data

```typescript
import { useUpdateTask } from '@/hooks/useTasks';

export function TaskEditor({ task }) {
  const { mutate: updateTask, isPending } = useUpdateTask();

  const handleSave = (title) => {
    updateTask(
      { taskId: task.id, title },
      {
        onSuccess: () => {
          // Refetch or update cache
          queryClient.invalidateQueries(['tasks', task.id]);
        },
        onError: (error) => {
          alert(error.message);
        }
      }
    );
  };

  return <form onSubmit={handleSave}>...</form>;
}
```

### Using Store

```typescript
import { useAuthStore } from '@/stores/auth.store';

export function Profile() {
  const { user, logout } = useAuthStore();
  
  return (
    <div>
      <p>{user?.displayName}</p>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}
```

## Styling Guidelines

### Tailwind Classes

- Use utility classes directly on elements
- Group related utilities logically
- Avoid `@apply` except for repeated patterns

### Color System

**Brand Colors**
```css
bg-brand-50 /* Lightest */
bg-brand-500 /* Primary */
bg-brand-700 /* Darkest */
```

**Status Colors**
- DONE: `text-green-600 bg-green-100`
- BLOCKED: `text-red-600 bg-red-100`
- IN_PROGRESS: `text-purple-600 bg-purple-100`

**Priority Colors**
- NONE: `text-gray-600 bg-gray-100`
- LOW: `text-blue-600 bg-blue-100`
- MEDIUM: `text-yellow-600 bg-yellow-100`
- HIGH: `text-orange-600 bg-orange-100`
- URGENT: `text-red-600 bg-red-100`

## API Contract

All requests:
- Base URL: `/api/v1` (proxied in dev)
- Auth: `Authorization: Bearer {token}` header
- Content-Type: `application/json`

Response format:
```json
{
  "data": { /* payload */ },
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Errors:
```json
{
  "statusCode": 400,
  "message": "Invalid request",
  "error": "ValidationError"
}
```

## Performance Optimizations

1. **Code Splitting**: React Router lazy loads pages
2. **Query Caching**: React Query caches responses
3. **Re-render Prevention**: Zustand selectors, React.memo for lists
4. **Image Optimization**: Use Avatar component for user images
5. **Bundling**: Vite tree-shakes unused code

## Testing Strategy (Future)

Recommended setup:
- Vitest for unit tests
- React Testing Library for component tests
- MSW for API mocking
- Playwright for E2E

Example test:
```typescript
import { render, screen } from '@testing-library/react';
import { TaskRow } from '@/components/task/TaskRow';

test('renders task title', () => {
  const task = { id: '1', title: 'Test Task', ... };
  render(<TaskRow task={task} onSelect={() => {}} onStatusChange={() => {}} />);
  expect(screen.getByText('Test Task')).toBeInTheDocument();
});
```

## Debugging Tips

1. **React DevTools**: Inspect component tree, props, hooks
2. **Network Tab**: Check API requests, response payload
3. **Redux DevTools**: Not needed (using Zustand)
4. **Console Logs**: `console.log(task)` on mutations
5. **Vite HMR**: Hot module reload during development

## Common Tasks

### Adding a New API Endpoint

1. Add hook in `src/hooks/useXxx.ts`
2. Use `useQuery` or `useMutation`
3. Call `api.get/post/patch/delete` from lib/api
4. Handle loading, error, success states in component

### Adding a New Page

1. Create file in `src/pages/...`
2. Add route in `src/App.tsx`
3. Import any hooks needed
4. Use auth guard if protected
5. Add navigation link in sidebar

### Styling a Component

1. Use Tailwind utilities only
2. Group by responsive breakpoints
3. Use clsx for conditional classes
4. Extract repeated patterns to shared components

### Handling Errors

1. Try/catch in async functions
2. Mutation onError callback for API calls
3. Show user-friendly message
4. Log to console for debugging
5. Add error boundary for component failures

## Environment Variables

Create `.env.local` if needed:
```
VITE_API_URL=http://localhost:4000
VITE_WS_URL=http://localhost:4000
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari 14+

Features used:
- ES2020 (const/let, arrow functions, async/await)
- CSS Grid & Flexbox
- LocalStorage (for auth tokens)
- WebSockets (Socket.io)
