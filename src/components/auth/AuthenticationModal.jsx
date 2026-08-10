import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { Mail, Lock, LogIn, Info } from 'lucide-react';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { GoogleIcon, MicrosoftIcon } from '@/components/common/BrandIcons';
import { useAuth } from '@/hooks/useAuth';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

/**
 * Sign-in form content. Rendered inside AuthShell's right-hand panel — no
 * outer card chrome of its own, so there's only one glass panel on screen.
 *
 * Calls onSignedIn() after a successful login; the caller routes on to the
 * existing role/city selection flow.
 */
export default function AuthenticationModal({ onSignedIn, onCreateAccount }) {
  const { login } = useAuth();
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
      onSignedIn();
    } catch (err) {
      setServerError(err.message || 'Unable to sign in.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className="font-display text-2xl font-bold text-white">Welcome Back</h2>
      <p className="mt-1 text-sm text-white/70">Sign in to continue</p>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs text-white/80">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Demo -- <span className="font-mono">demo@metroflow.app</span> / <span className="font-mono">MetroFlow@123</span>
        </span>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label="Email / Gmail"
          type="email"
          icon={Mail}
          placeholder="you@metroflow.app"
          error={errors.email?.message}
          className="bg-white/90"
          labelClassName="text-white/85"
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          icon={Lock}
          placeholder="********"
          error={errors.password?.message}
          className="bg-white/90"
          labelClassName="text-white/85"
          {...register('password')}
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" className="h-4 w-4 rounded border-white/40 text-brand-600 focus-ring" {...register('rememberMe')} />
            Remember me
          </label>
          <button
            type="button"
            className="text-sm font-medium text-white hover:text-brand-200"
            onClick={() => toast.info('Password reset instructions would be emailed here.')}
          >
            Forgot Password?
          </button>
        </div>

        {serverError && <p className="rounded-lg bg-danger/20 px-3 py-2 text-sm font-medium text-white">{serverError}</p>}

        <Button type="submit" fullWidth icon={LogIn} isLoading={isSubmitting} size="lg">
          Sign In
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/20" />
        <span className="text-xs font-medium uppercase tracking-wide text-white/50">Or</span>
        <div className="h-px flex-1 bg-white/20" />
      </div>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => toast.info('Google sign-in would open here.')}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/25 bg-white/90 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white focus-ring"
        >
          <GoogleIcon /> Continue with Google
        </button>
        <button
          type="button"
          onClick={() => toast.info('Microsoft sign-in would open here.')}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/25 bg-white/90 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white focus-ring"
        >
          <MicrosoftIcon /> Continue with Microsoft
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-white/70">
        Don't have an account?{' '}
        <button type="button" onClick={onCreateAccount} className="font-semibold text-white hover:text-brand-200">
          Create New Account
        </button>
      </p>
    </motion.div>
  );
}
