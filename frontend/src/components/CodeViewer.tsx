import { useState } from 'react';
import { Copy, Check, Download, File } from 'lucide-react';

interface CodeViewerProps {
  fileName: string;
  content: string;
  language?: string;
}

/**
 * CodeViewer Component - Display code with syntax highlighting and copy functionality
 */
export default function CodeViewer({ fileName, content, language }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get file extension for basic syntax detection
  const getFileExtension = () => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext || 'txt';
  };

  const ext = language || getFileExtension();

  return (
    <div className="flex flex-col h-full">
      {/* File header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <File className="w-5 h-5 text-indigo-600" />
          <div>
            <span className="font-mono text-sm font-medium">{fileName}</span>
            <span className="ml-2 text-xs text-slate-500">{ext}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition text-sm"
          >
            {copied ? (
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
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition text-sm"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-900">
        <pre className="bg-white dark:bg-slate-800 rounded-xl p-6 overflow-x-auto">
          <code className="text-sm font-mono leading-relaxed">{content}</code>
        </pre>
      </div>

      {/* Stats footer */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-6 py-3 text-xs text-slate-500 flex items-center gap-4">
        <span>{content.split('\n').length} lines</span>
        <span>{content.length} characters</span>
        <span>{Math.ceil(content.length / 1024)} KB</span>
      </div>
    </div>
  );
}
