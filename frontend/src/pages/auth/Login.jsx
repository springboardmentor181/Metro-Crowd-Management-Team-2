import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { Mail, Lock, LogIn, Info, TrainFront } from 'lucide-react';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES, APP_NAME, APP_TAGLINE } from '@/constants';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', rememberMe: true } });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await login(values);
      toast.success('Welcome to MetroFlow!');
      const redirectTo = location.state?.from?.pathname || ROUTES.SELECT_ROLE;
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err.message || 'Unable to sign in.');
    }
  };

  return (
    <div className="flex min-h-screen bg-app-gradient">
      {/* Illustration / brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-hero-gradient p-10 text-white lg:flex">
        <div className="bg-mesh-dots pointer-events-none absolute inset-0 opacity-20" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <TrainFront className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">{APP_NAME}</span>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <MetroIllustration />
        </div>

        <div className="relative">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md font-display text-3xl font-bold leading-tight text-white"
          >
            {APP_TAGLINE}
          </motion.h1>
          <p className="mt-3 max-w-sm text-sm text-brand-200">
            Real-time crowd intelligence, journey planning, and AI-driven operations for every
            metro network — in one platform.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white">
              <TrainFront className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold text-slate-900">{APP_NAME}</span>
          </div>

          <h2 className="font-display text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-1.5 text-sm text-slate-500">Sign in to continue to MetroFlow.</p>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-xs text-brand-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Demo account — <span className="font-mono">demo@metroflow.app</span> /{' '}
              <span className="font-mono">MetroFlow@123</span>
            </span>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input label="Email address" type="email" icon={Mail} placeholder="you@metroflow.app" error={errors.email?.message} {...register('email')} />
            <Input label="Password" type="password" icon={Lock} placeholder="••••••••" error={errors.password?.message} {...register('password')} />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus-ring" {...register('rememberMe')} />
                Remember me
              </label>
              <button type="button" className="text-sm font-medium text-brand-600 hover:text-brand-700" onClick={() => toast.info('Password reset instructions would be emailed here.')}>
                Forgot password?
              </button>
            </div>

            {serverError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{serverError}</p>}

            <Button type="submit" fullWidth icon={LogIn} isLoading={isSubmitting} size="lg">
              Sign in
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

function MetroIllustration() {
  return (
    <motion.svg
      viewBox="0 0 360 260"
      className="w-full max-w-md drop-shadow-2xl"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.1 }}
    >
      <ellipse cx="180" cy="235" rx="140" ry="14" fill="rgba(0,0,0,0.15)" />
      <motion.g animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
        <rect x="40" y="90" width="280" height="110" rx="24" fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
        {[70, 130, 190, 250].map((x) => (
          <rect key={x} x={x} y={112} width="34" height="34" rx="6" fill="#ffffff" fillOpacity="0.9" />
        ))}
        <rect x="40" y="182" width="280" height="10" fill="#ffffff" fillOpacity="0.25" />
        <circle cx="80" cy="210" r="12" fill="#0b1338" stroke="#fff" strokeWidth="3" />
        <circle cx="280" cy="210" r="12" fill="#0b1338" stroke="#fff" strokeWidth="3" />
      </motion.g>
      <line x1="10" y1="230" x2="350" y2="230" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="3" strokeDasharray="10 8" />
      <motion.circle cx="60" cy="60" r="4" fill="#ffbe4d" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
      <motion.circle cx="300" cy="40" r="3" fill="#ffffff" animate={{ opacity: [0.2, 0.9, 0.2] }} transition={{ duration: 2.6, repeat: Infinity }} />
    </motion.svg>
  );
}
