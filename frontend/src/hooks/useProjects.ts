import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useStore } from '../lib/store';

/**
 * useProjects Hook - Project management utilities
 */
export function useProjects() {
  const queryClient = useQueryClient();
  const {
    setProjects,
    addProject,
    removeProject,
    setGenerating,
    addProgress,
    clearProgress,
  } = useStore();

  // Fetch all projects
  const {
    data: projects,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const data = await apiClient.listProjects();
      setProjects(data);
      return data;
    },
  });

  // Generate new project with streaming
  const generateMutation = useMutation({
    mutationFn: async (request: {
      projectName: string;
      description: string;
      requirements: string;
    }) => {
      // Clear previous progress and start generation
      clearProgress();
      setGenerating(true);

      try {
        const result = await apiClient.generateApplicationStreaming(request, (event) => {
          // Map streaming events to progress items
          let status: 'pending' | 'running' | 'completed' | 'error' = 'pending';

          switch (event.type) {
            case 'phase_start':
              status = 'running';
              break;
            case 'phase_complete':
              status = 'completed';
              break;
            case 'error':
              status = 'error';
              break;
            case 'complete':
              status = 'completed';
              break;
            default:
              status = 'running';
          }

          addProgress({
            phase: event.phase,
            status,
            message: event.message,
            progress: event.progress,
          });
        });

        setGenerating(false);
        return result;
      } catch (error) {
        setGenerating(false);
        throw error;
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        const newProject = {
          projectId: result.projectId,
          projectName: variables.projectName,
          description: variables.description,
          generatedAt: new Date().toISOString(),
        };
        addProject(newProject);
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    },
    onError: () => {
      setGenerating(false);
    },
  });

  // Delete project
  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => apiClient.deleteProject(projectId),
    onSuccess: (_, projectId) => {
      removeProject(projectId);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Download project
  const downloadProject = (projectId: string) => {
    const url = apiClient.getProjectDownloadUrl(projectId);
    window.open(url, '_blank');
  };

  return {
    projects: projects || [],
    isLoading,
    error,
    refetch,
    generateProject: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
    deleteProject: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    downloadProject,
  };
}
