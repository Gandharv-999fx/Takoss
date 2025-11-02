import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from './api';

/**
 * Global State Store - Zustand store for app-wide state
 */

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface GenerationProgress {
  phase: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message: string;
  progress?: number;
}

export interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;

  // User experience level (for adaptive UI)
  userExperience: 'beginner' | 'experienced' | null;
  setUserExperience: (level: 'beginner' | 'experienced') => void;

  // Generation state
  isGenerating: boolean;
  currentProjectId: string | null;
  generationProgress: GenerationProgress[];
  setGenerating: (generating: boolean) => void;
  setCurrentProjectId: (projectId: string | null) => void;
  addProgress: (progress: GenerationProgress) => void;
  clearProgress: () => void;

  // Projects list cache
  projects: any[];
  setProjects: (projects: any[]) => void;
  addProject: (project: any) => void;
  removeProject: (projectId: string) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // User state
      user: null,
      isAuthenticated: apiClient.isAuthenticated(),
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),
      logout: () => {
        apiClient.logout();
        set({
          user: null,
          isAuthenticated: false,
          projects: [],
          currentProjectId: null,
          generationProgress: [],
        });
      },

      // User experience level
      userExperience: null,
      setUserExperience: (level) => set({ userExperience: level }),

      // Generation state
      isGenerating: false,
      currentProjectId: null,
      generationProgress: [],
      setGenerating: (generating) => set({ isGenerating: generating }),
      setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),
      addProgress: (progress) =>
        set((state) => ({
          generationProgress: [...state.generationProgress, progress],
        })),
      clearProgress: () => set({ generationProgress: [] }),

      // Projects list
      projects: [],
      setProjects: (projects) => set({ projects }),
      addProject: (project) =>
        set((state) => ({
          projects: [project, ...state.projects],
        })),
      removeProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.projectId !== projectId),
        })),

      // UI state
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      theme: 'light',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
    }),
    {
      name: 'takoss-storage',
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        userExperience: state.userExperience,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
