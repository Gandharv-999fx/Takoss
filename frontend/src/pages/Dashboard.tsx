import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useStore } from '../lib/store';
import {
  Plus,
  Folder,
  Download,
  Trash2,
  Clock,
  LogOut,
  Moon,
  Sun,
  Settings,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Dashboard Page - Main landing page with project list
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout, projects, setProjects, removeProject, theme, toggleTheme } = useStore();

  // Fetch projects
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.listProjects(),
  });

  useEffect(() => {
    if (data) {
      setProjects(data);
    }
  }, [data, setProjects]);

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await apiClient.deleteProject(projectId);
      removeProject(projectId);
      refetch();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleDownload = (projectId: string) => {
    const url = apiClient.getProjectDownloadUrl(projectId);
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen">
      {/* Header / Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center transform rotate-3">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Takoss</h1>
                <p className="text-xs text-slate-500">AI Application Builder</p>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                <Settings className="w-5 h-5" />
              </button>

              <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />

              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-medium">{user?.name || user?.email}</p>
                  <p className="text-xs text-slate-500">Developer</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Your Projects</h2>
            <p className="text-slate-600 dark:text-slate-400">
              {projects.length === 0
                ? 'No projects yet. Create your first AI-generated application!'
                : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} generated`}
            </p>
          </div>

          <Link to="/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New Project
          </Link>
        </div>

        {/* Projects grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-3xl mb-6">
              <Folder className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No projects yet</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Start building your first AI-powered application
            </p>
            <Link to="/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Your First Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project: any, index: number) => (
              <motion.div
                key={project.projectId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card group hover:shadow-2xl transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Folder className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg group-hover:text-indigo-600 transition-colors">
                        {project.projectName}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(project.generatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                  {project.description}
                </p>

                <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
                  <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
                    {project.files?.length || 0} files
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/projects/${project.projectId}`)}
                    className="flex-1 btn-primary text-sm py-2"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDownload(project.projectId)}
                    className="p-2 btn-secondary hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.projectId)}
                    className="p-2 btn-secondary hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
