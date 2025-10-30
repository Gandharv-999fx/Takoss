import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { apiClient } from '../lib/api';
import { ArrowLeft, Sparkles, Wand2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * New Project Page - Adaptive form based on user experience level
 */
export default function NewProject() {
  const navigate = useNavigate();
  const { userExperience, setGenerating, setCurrentProjectId, addProgress, clearProgress, addProject } = useStore();

  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Wizard state for beginners
  const [step, setStep] = useState(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    clearProgress();

    try {
      setGenerating(true);

      // Add initial progress
      addProgress({
        phase: 'Starting',
        status: 'running',
        message: 'Initializing AI generation...',
      });

      const result = await apiClient.generateApplication({
        projectName,
        description,
        requirements,
      });

      setCurrentProjectId(result.projectId);

      if (result.success) {
        addProgress({
          phase: 'Complete',
          status: 'completed',
          message: 'Project generated successfully!',
        });

        addProject({
          projectId: result.projectId,
          projectName,
          description,
          generatedAt: new Date().toISOString(),
        });

        // Navigate to project details
        navigate(`/projects/${result.projectId}`);
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to generate project');
      addProgress({
        phase: 'Error',
        status: 'error',
        message: err.response?.data?.error || 'Generation failed',
      });
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  // Beginner wizard form
  if (userExperience === 'beginner') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-12">
          {/* Header */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 mb-8 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          {/* Wizard card */}
          <div className="card">
            {/* Progress indicator */}
            <div className="flex items-center justify-between mb-8">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition ${
                      step >= s
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`flex-1 h-1 mx-2 transition ${
                        step > s ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              {/* Step 1: Project Name */}
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-2xl font-bold mb-2">What's your project called?</h2>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Choose a memorable name for your application
                  </p>

                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., My Blog Platform"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-lg"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!projectName}
                    className="btn-primary mt-6"
                  >
                    Next Step
                  </button>
                </motion.div>
              )}

              {/* Step 2: Description */}
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-2xl font-bold mb-2">Describe your project</h2>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    A brief overview of what your application does
                  </p>

                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., A modern blog platform with user authentication and comments"
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    required
                  />

                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={() => setStep(1)} className="btn-secondary">
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!description}
                      className="btn-primary"
                    >
                      Next Step
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Requirements */}
              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-2xl font-bold mb-2">What features do you need?</h2>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    List the main features and requirements for your application
                  </p>

                  <textarea
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder="e.g.,
- User registration and login
- Create, edit, delete blog posts
- Comment system
- Search functionality
- Responsive design"
                    rows={8}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition font-mono text-sm"
                    required
                  />

                  {error && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={() => setStep(2)} className="btn-secondary">
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !requirements}
                      className="btn-primary flex items-center gap-2 flex-1"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-5 h-5" />
                          Generate Project
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Experienced user quick form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 mb-8 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        {/* Quick form card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Generate New Project</h1>
              <p className="text-slate-600 dark:text-slate-400">Quick project creation</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Project Name *</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Awesome Application"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief overview of your application"
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Requirements *</label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Detailed requirements and features..."
                rows={10}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition font-mono text-sm"
                required
              />
              <p className="text-xs text-slate-500 mt-2">
                Tip: Be specific about features, tech stack preferences, and any special requirements
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Project...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Generate Project
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
