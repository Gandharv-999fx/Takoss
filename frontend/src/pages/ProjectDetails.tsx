import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import {
  ArrowLeft,
  Download,
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-react';

/**
 * Project Details Page - View generated project with file browser
 */
export default function ProjectDetails() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Fetch project metadata
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiClient.getProject(projectId!),
    enabled: !!projectId,
  });

  // Fetch selected file content
  const { data: fileContent } = useQuery({
    queryKey: ['file', projectId, selectedFile],
    queryFn: () => apiClient.getProjectFile(projectId!, selectedFile!),
    enabled: !!projectId && !!selectedFile,
  });

  const handleDownload = () => {
    const url = apiClient.getProjectDownloadUrl(projectId!);
    window.open(url, '_blank');
  };

  const handleCopyFile = () => {
    if (fileContent) {
      navigator.clipboard.writeText(fileContent);
      setCopiedFile(selectedFile);
      setTimeout(() => setCopiedFile(null), 2000);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Build file tree structure
  const buildFileTree = (files: string[]) => {
    const tree: any = {};

    files.forEach((filePath) => {
      const parts = filePath.split('/');
      let current = tree;

      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? null : {};
        }
        current = current[part];
      });
    });

    return tree;
  };

  // Render file tree recursively
  const renderFileTree = (tree: any, prefix = ''): React.ReactElement[] => {
    return Object.keys(tree).map((name) => {
      const path = prefix ? `${prefix}/${name}` : name;
      const isFolder = tree[name] !== null;
      const isExpanded = expandedFolders.has(path);

      if (isFolder) {
        return (
          <div key={path}>
            <button
              onClick={() => toggleFolder(path)}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition text-left"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
              <Folder className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium">{name}</span>
            </button>
            {isExpanded && (
              <div className="ml-6 border-l border-slate-200 dark:border-slate-700 pl-2">
                {renderFileTree(tree[name], path)}
              </div>
            )}
          </div>
        );
      } else {
        const isSelected = selectedFile === path;
        return (
          <button
            key={path}
            onClick={() => setSelectedFile(path)}
            className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition text-left ${
              isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : ''
            }`}
          >
            <File className="w-4 h-4" />
            <span className="text-sm">{name}</span>
          </button>
        );
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-4">Project not found</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const fileTree = buildFileTree(project.files || []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>

            <div className="flex-1 mx-6">
              <h1 className="text-xl font-bold">{project.projectName}</h1>
              <p className="text-sm text-slate-500">{project.description}</p>
            </div>

            <button onClick={handleDownload} className="btn-primary flex items-center gap-2">
              <Download className="w-5 h-5" />
              Download ZIP
            </button>
          </div>
        </div>
      </header>

      {/* Main content - Split view */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* File browser sidebar */}
        <aside className="w-80 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">
              Files ({project.files?.length || 0})
            </h2>
            <div className="space-y-1">{renderFileTree(fileTree)}</div>
          </div>
        </aside>

        {/* File viewer */}
        <main className="flex-1 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
          {selectedFile ? (
            <div className="h-full flex flex-col">
              {/* File header */}
              <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <File className="w-5 h-5 text-indigo-600" />
                  <span className="font-mono text-sm">{selectedFile}</span>
                </div>
                <button
                  onClick={handleCopyFile}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
                >
                  {copiedFile === selectedFile ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              {/* File content */}
              <div className="flex-1 overflow-auto p-6">
                <pre className="bg-white dark:bg-slate-800 rounded-xl p-6 overflow-x-auto">
                  <code className="text-sm font-mono">{fileContent || 'Loading...'}</code>
                </pre>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <Folder className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  Select a file to view its contents
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
