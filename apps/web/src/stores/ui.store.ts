import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  activeTaskId: string | null;
  searchOpen: boolean;
  commandPaletteOpen: boolean;
  toggleSidebar(): void;
  openTask(id: string): void;
  closeTask(): void;
  openSearch(): void;
  closeSearch(): void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activeTaskId: null,
  searchOpen: false,
  commandPaletteOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openTask: (id) => set({ activeTaskId: id }),
  closeTask: () => set({ activeTaskId: null }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));
