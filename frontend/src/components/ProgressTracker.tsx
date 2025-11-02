import { CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../lib/store';

/**
 * ProgressTracker Component - Real-time generation progress display
 */
export default function ProgressTracker() {
  const { isGenerating, generationProgress } = useStore();

  if (!isGenerating && generationProgress.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 right-6 w-96 max-h-96 overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Generation Progress</h3>
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-indigo-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              In Progress
            </div>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="px-6 py-4 max-h-80 overflow-y-auto space-y-4">
        <AnimatePresence>
          {generationProgress.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-3"
            >
              {/* Status Icon */}
              <div className="mt-1">
                {step.status === 'completed' && (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                )}
                {step.status === 'running' && (
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                )}
                {step.status === 'pending' && (
                  <Clock className="w-5 h-5 text-slate-400" />
                )}
                {step.status === 'error' && (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
              </div>

              {/* Step Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">{step.phase}</h4>
                  {step.progress && (
                    <span className="text-xs text-slate-500">{step.progress}%</span>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {step.message}
                </p>

                {/* Progress Bar */}
                {step.progress !== undefined && step.status === 'running' && (
                  <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                    <motion.div
                      className="bg-indigo-600 h-1.5 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${step.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {!isGenerating && generationProgress.length > 0 && (
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              {generationProgress.filter((s) => s.status === 'completed').length} /{' '}
              {generationProgress.length} completed
            </span>
            <button
              onClick={() => useStore.getState().clearProgress()}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
