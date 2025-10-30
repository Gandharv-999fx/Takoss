import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useStore } from '../lib/store';

/**
 * useProjects Hook - Project management utilities
 */
export function useProjects() {
  const queryClient = useQueryClient();
  const { setProjects, addProject, removeProject } = useStore();

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

  // Generate new project
  const generateMutation = useMutation({
    mutationFn: (request: {
      projectName: string;
      description: string;
      requirements: string;
    }) => apiClient.generateApplication(request),
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
