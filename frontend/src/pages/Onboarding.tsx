import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Sparkles, Zap, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Onboarding Page - Adaptive experience level selection
 * Determines whether to show wizard (beginners) or quick form (experienced)
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const setUserExperience = useStore((state) => state.setUserExperience);
  const user = useStore((state) => state.user);

  const handleExperienceLevel = (level: 'beginner' | 'experienced') => {
    setUserExperience(level);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Welcome header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl mb-6 shadow-2xl"
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4"
          >
            Welcome{user?.name ? `, ${user.name}` : ''}! 👋
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-xl text-slate-600 dark:text-slate-400 mb-2"
          >
            Let's personalize your Takoss experience
          </motion.p>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-slate-500 dark:text-slate-500"
          >
            How would you describe your experience with AI code generation?
          </motion.p>
        </div>

        {/* Experience level cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Beginner card */}
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            whileHover={{ scale: 1.02, y: -5 }}
            onClick={() => handleExperienceLevel('beginner')}
            className="card cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-indigo-500"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl group-hover:scale-110 transition-transform">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2 group-hover:text-indigo-600 transition-colors">
                  I'm New to This
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Perfect for beginners and first-time users
                </p>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                Step-by-step guided wizard
              </li>
              <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                Helpful tips and explanations
              </li>
              <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                Example projects to try
              </li>
            </ul>

            <div className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline">
              Get started with guided experience →
            </div>
          </motion.div>

          {/* Experienced card */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            whileHover={{ scale: 1.02, y: -5 }}
            onClick={() => handleExperienceLevel('experienced')}
            className="card cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-purple-500"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2 group-hover:text-purple-600 transition-colors">
                  I Know What I'm Doing
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  For experienced developers who want speed
                </p>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                Single-page quick form
              </li>
              <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                Advanced configuration options
              </li>
              <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                API key management
              </li>
            </ul>

            <div className="text-sm text-purple-600 dark:text-purple-400 font-semibold group-hover:underline">
              Jump right in with quick form →
            </div>
          </motion.div>
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-center text-sm text-slate-500 mt-8"
        >
          Don't worry, you can always change this later in settings
        </motion.p>
      </div>
    </div>
  );
}
