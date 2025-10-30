import { useNavigate } from 'react-router-dom';
import { Folder, Clock, Download, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProjectCardProps {
  project: {
    projectId: string;
    projectName: string;
    description: string;
    generatedAt: string;
    files?: string[];
  };
  onDownload: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  index?: number;
}

/**
 * ProjectCard Component - Display project in a card layout
 */
export default function ProjectCard({ project, onDownload, onDelete, index = 0 }: ProjectCardProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="card group hover:shadow-2xl transition-all duration-300 cursor-pointer"
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
          onClick={(e) => {
            e.stopPropagation();
            onDownload(project.projectId);
          }}
          className="p-2 btn-secondary hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project.projectId);
          }}
          className="p-2 btn-secondary hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
