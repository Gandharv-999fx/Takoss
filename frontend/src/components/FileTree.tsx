import { useState } from 'react';
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react';

interface FileTreeNode {
  [key: string]: FileTreeNode | null;
}

interface FileTreeProps {
  files: string[];
  selectedFile: string | null;
  onFileSelect: (filePath: string) => void;
}

/**
 * FileTree Component - Hierarchical file browser
 */
export default function FileTree({ files, selectedFile, onFileSelect }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));

  // Build tree structure from flat file list
  const buildFileTree = (filePaths: string[]): FileTreeNode => {
    const tree: FileTreeNode = {};

    filePaths.forEach((filePath) => {
      const parts = filePath.split('/');
      let current = tree;

      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? null : {};
        }
        if (current[part] !== null) {
          current = current[part] as FileTreeNode;
        }
      });
    });

    return tree;
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

  // Render tree recursively
  const renderTree = (tree: FileTreeNode, prefix = ''): React.ReactElement[] => {
    return Object.keys(tree).map((name) => {
      const path = prefix ? `${prefix}/${name}` : name;
      const isFolder = tree[name] !== null;
      const isExpanded = expandedFolders.has(path);
      const isSelected = selectedFile === path;

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
              <Folder
                className={`w-4 h-4 ${
                  isExpanded ? 'text-indigo-500' : 'text-slate-400'
                }`}
              />
              <span className="text-sm font-medium">{name}</span>
            </button>
            {isExpanded && (
              <div className="ml-6 border-l border-slate-200 dark:border-slate-700 pl-2">
                {renderTree(tree[name] as FileTreeNode, path)}
              </div>
            )}
          </div>
        );
      } else {
        return (
          <button
            key={path}
            onClick={() => onFileSelect(path)}
            className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition text-left ${
              isSelected
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                : ''
            }`}
          >
            <div className="w-4" /> {/* Spacer for alignment */}
            <File className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span className="text-sm truncate">{name}</span>
          </button>
        );
      }
    });
  };

  const tree = buildFileTree(files);

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">
        Files ({files.length})
      </h2>
      <div className="space-y-1">{renderTree(tree)}</div>
    </div>
  );
}
