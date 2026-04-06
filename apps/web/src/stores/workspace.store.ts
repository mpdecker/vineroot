import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Workspace } from '../types';

interface WorkspaceState {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  setCurrentWorkspace(ws: Workspace): void;
  setWorkspaces(list: Workspace[]): void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspace: null,
      workspaces: [],
      setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),
      setWorkspaces: (list) => set({ workspaces: list }),
    }),
    { name: 'vineroot-workspace', partialize: (s) => ({ currentWorkspace: s.currentWorkspace }) }
  )
);
