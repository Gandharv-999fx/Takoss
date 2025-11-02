import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

/**
 * EmptyState Component - Display when no data is available
 */
export default function EmptyState({ icon: Icon, title, description, action, children }: EmptyStateProps) {
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-3xl mb-6">
        <Icon className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary">
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}
