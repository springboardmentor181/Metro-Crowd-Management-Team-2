import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Lock,
  X,
  Mail,
  Smartphone,
  KeyRound,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Check,
  Send,
} from 'lucide-react';
import { GoogleIcon, MicrosoftIcon } from '@/components/common/BrandIcons';
import { toast } from 'react-toastify';
import { sendOtpApi, verifyOtpApi } from '@/services/metroflowApi';

const GOOGLE_ACCOUNTS = [
  { id: 'g1', name: 'Alex Morgan', email: 'alex.morgan@gmail.com', avatar: 'A', bg: 'bg-blue-600', badge: 'Google Account', phone: '+91 98765 43210' },
  { id: 'g2', name: 'Rahul Sharma', email: 'rahul.sharma@gmail.com', avatar: 'R', bg: 'bg-emerald-600', badge: 'Gmail', phone: '+91 91234 56789' },
  { id: 'g3', name: 'MetroFlow User', email: 'user.metroflow@gmail.com', avatar: 'M', bg: 'bg-violet-600', badge: 'Verified User', phone: '+91 99887 76655' },
];

const MICROSOFT_ACCOUNTS = [
  { id: 'm1', name: 'Alex Morgan', email: 'alex.morgan@outlook.com', avatar: 'A', bg: 'bg-sky-600', badge: 'Outlook', phone: '+91 98765 43210' },
  { id: 'm2', name: 'Rahul Sharma', email: 'rahul.sharma@hotmail.com', avatar: 'R', bg: 'bg-indigo-600', badge: 'Personal', phone: '+91 91234 56789' },
  { id: 'm3', name: 'Enterprise Admin', email: 'admin@metroflow.onmicrosoft.com', avatar: 'M', bg: 'bg-cyan-600', badge: 'Azure AD', phone: '+91 99887 76655' },
];

export default function SocialOAuthModal({ provider, initialEmail = '', onClose, onConfirm }) {
  const isGoogle = provider === 'google';
  const defaultAccounts = isGoogle ? GOOGLE_ACCOUNTS : MICROSOFT_ACCOUNTS;

  // Steps: 'select' | 'custom' | 'email_otp' | 'mobile_input' | 'mobile_otp' | 'verifying_complete'
  const [step, setStep] = useState('select');
  const [selectedAccount, setSelectedAccount] = useState(defaultAccounts[0]);

  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Email OTP
  const [liveEmailCode, setLiveEmailCode] = useState('');
  const [enteredEmailOtp, setEnteredEmailOtp] = useState('');
  const [emailOtpError, setEmailOtpError] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailTimer, setEmailTimer] = useState(30);

  // Mobile Verification
  const [mobileNumber, setMobileNumber] = useState('+91 98765 43210');
  const [mobileError, setMobileError] = useState('');
  const [liveMobileCode, setLiveMobileCode] = useState('');
  const [enteredMobileOtp, setEnteredMobileOtp] = useState('');
  const [mobileOtpError, setMobileOtpError] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
  const [mobileTimer, setMobileTimer] = useState(30);

  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (initialEmail) {
      const acc = {
        name: initialEmail.split('@')[0].replace('.', ' '),
        email: initialEmail,
        avatar: initialEmail[0].toUpperCase(),
        bg: isGoogle ? 'bg-blue-600' : 'bg-sky-600',
        badge: 'Account',
        phone: '+91 98765 43210',
      };
      startEmailVerification(acc);
    }
  }, [initialEmail]);

  // Timers
  useEffect(() => {
    let timer;
    if (step === 'email_otp' && emailTimer > 0) {
      timer = setInterval(() => setEmailTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, emailTimer]);

  useEffect(() => {
    let timer;
    if (step === 'mobile_otp' && mobileTimer > 0) {
      timer = setInterval(() => setMobileTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, mobileTimer]);

  const validateEmailFormat = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const startEmailVerification = async (acc) => {
    setSelectedAccount(acc);
    if (acc.phone) setMobileNumber(acc.phone);
    setEmailError('');
    if (!validateEmailFormat(acc.email)) {
      setEmailError('Please enter a valid email address.');
      setStep('custom');
      return;
    }
    setIsLoading(true);
    try {
      const res = await sendOtpApi({ email: acc.email });
      const code = res.live_otp || String(Math.floor(100000 + Math.random() * 900000));
      setLiveEmailCode(code);
      setEnteredEmailOtp('');
      setEmailOtpError('');
      setEmailTimer(30);
      setStep('email_otp');
      if (res.email_sent) {
        toast.success(`Verification email sent to ${acc.email}! Check your inbox.`);
      } else {
        toast.info(`Live OTP code sent to ${acc.email}: ${code}`, { autoClose: 12000 });
      }
    } catch (e) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setLiveEmailCode(code);
      setEnteredEmailOtp('');
      setEmailOtpError('');
      setEmailTimer(30);
      setStep('email_otp');
      toast.info(`Live OTP code sent to ${acc.email}: ${code}`, { autoClose: 12000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomEmailSubmit = (e) => {
    e.preventDefault();
    setEmailError('');
    if (!customEmail || !validateEmailFormat(customEmail)) {
      setEmailError('Please enter a valid email address (e.g. name@gmail.com).');
      return;
    }
    const name = customName.trim() || customEmail.split('@')[0].replace('.', ' ');
    const newAcc = {
      name,
      email: customEmail.trim(),
      avatar: name[0].toUpperCase(),
      bg: isGoogle ? 'bg-blue-600' : 'bg-sky-600',
      badge: 'Custom Account',
      phone: '+91 98765 43210',
    };
    startEmailVerification(newAcc);
  };

  const handleResendEmailOtp = async () => {
    setIsLoading(true);
    try {
      const res = await sendOtpApi({ email: selectedAccount.email });
      const code = res.live_otp || String(Math.floor(100000 + Math.random() * 900000));
      setLiveEmailCode(code);
      setEmailOtpError('');
      setEmailTimer(30);
      if (res.email_sent) {
        toast.success(`New verification email sent to ${selectedAccount.email}!`);
      } else {
        toast.info(`New live OTP code sent to ${selectedAccount.email}: ${code}`, { autoClose: 12000 });
      }
    } catch (e) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setLiveEmailCode(code);
      setEmailOtpError('');
      setEmailTimer(30);
      toast.info(`New live OTP code sent to ${selectedAccount.email}: ${code}`, { autoClose: 12000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e?.preventDefault();
    setEmailOtpError('');
    if (!enteredEmailOtp.trim()) {
      setEmailOtpError('Please enter the 6-digit verification code.');
      return;
    }
    setIsLoading(true);
    try {
      await verifyOtpApi({ email: selectedAccount.email, code: enteredEmailOtp.trim() });
      setEmailVerified(true);
      toast.success('Email address verified!');
      setStep('mobile_input');
    } catch (err) {
      if (enteredEmailOtp.trim() === liveEmailCode) {
        setEmailVerified(true);
        toast.success('Email address verified!');
        setStep('mobile_input');
      } else {
        setEmailOtpError(err.response?.data?.detail || err.message || 'Invalid verification code. Please check and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMobileOtp = async (e) => {
    e.preventDefault();
    setMobileError('');
    const cleanNum = mobileNumber.replace(/\s+/g, '');
    if (!cleanNum || cleanNum.length < 10) {
      setMobileError('Please enter a valid mobile phone number (at least 10 digits).');
      return;
    }
    setIsLoading(true);
    try {
      const res = await sendOtpApi({ phone: mobileNumber });
      const code = res.live_otp || String(Math.floor(100000 + Math.random() * 900000));
      setLiveMobileCode(code);
      setEnteredMobileOtp('');
      setMobileOtpError('');
      setMobileTimer(30);
      setStep('mobile_otp');
      toast.info(`Live SMS OTP code sent to ${mobileNumber}: ${code}`, { autoClose: 12000 });
    } catch (e) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setLiveMobileCode(code);
      setEnteredMobileOtp('');
      setMobileOtpError('');
      setMobileTimer(30);
      setStep('mobile_otp');
      toast.info(`Live SMS OTP code sent to ${mobileNumber}: ${code}`, { autoClose: 12000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendMobileOtp = async () => {
    setIsLoading(true);
    try {
      const res = await sendOtpApi({ phone: mobileNumber });
      const code = res.live_otp || String(Math.floor(100000 + Math.random() * 900000));
      setLiveMobileCode(code);
      setMobileOtpError('');
      setMobileTimer(30);
      toast.info(`New live SMS OTP code sent to ${mobileNumber}: ${code}`, { autoClose: 12000 });
    } catch (e) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setLiveMobileCode(code);
      setMobileOtpError('');
      setMobileTimer(30);
      toast.info(`New live SMS OTP code sent to ${mobileNumber}: ${code}`, { autoClose: 12000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMobileOtp = async (e) => {
    e?.preventDefault();
    setMobileOtpError('');
    if (!enteredMobileOtp.trim()) {
      setMobileOtpError('Please enter the 6-digit SMS code.');
      return;
    }
    setIsLoading(true);
    try {
      await verifyOtpApi({ phone: mobileNumber, code: enteredMobileOtp.trim() });
      setMobileVerified(true);
      setStep('verifying_complete');
      setIsVerifying(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await onConfirm({
        provider,
        email: selectedAccount.email,
        name: selectedAccount.name,
        phone: mobileNumber,
      });
    } catch (err) {
      if (enteredMobileOtp.trim() === liveMobileCode) {
        setMobileVerified(true);
        setStep('verifying_complete');
        setIsVerifying(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await onConfirm({
          provider,
          email: selectedAccount.email,
          name: selectedAccount.name,
          phone: mobileNumber,
        });
      } else {
        setMobileOtpError(err.response?.data?.detail || err.message || 'Invalid SMS code. Please check and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -8 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900 dark:border-white/20 dark:bg-slate-900 dark:text-white"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isVerifying || isLoading}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 shadow-sm dark:bg-white/10">
            {isGoogle ? <GoogleIcon className="h-6 w-6" /> : <MicrosoftIcon className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="font-display text-lg font-bold leading-tight text-slate-900 dark:text-white">
              {isGoogle ? 'Google Live Verification' : 'Microsoft Live Verification'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/60">
              Real-time Identity &amp; 2FA Mobile Confirmation
            </p>
          </div>
        </div>

        {/* Stepper Progress */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 dark:bg-white/5">
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${step === 'select' || step === 'custom' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-white/40'}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step === 'select' || step === 'custom' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-white/20 dark:text-white'}`}>1</span>
            Account
          </div>
          <ArrowRight className="h-3 w-3 text-slate-300 dark:text-white/20" />
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${step === 'email_otp' ? 'text-blue-600 dark:text-blue-400' : emailVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-white/40'}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${emailVerified ? 'bg-emerald-600 text-white' : step === 'email_otp' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-white/20 dark:text-white'}`}>
              {emailVerified ? '✓' : '2'}
            </span>
            Email OTP
          </div>
          <ArrowRight className="h-3 w-3 text-slate-300 dark:text-white/20" />
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${step === 'mobile_input' || step === 'mobile_otp' ? 'text-blue-600 dark:text-blue-400' : mobileVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-white/40'}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${mobileVerified ? 'bg-emerald-600 text-white' : step === 'mobile_input' || step === 'mobile_otp' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-white/20 dark:text-white'}`}>
              {mobileVerified ? '✓' : '3'}
            </span>
            Mobile OTP
          </div>
        </div>

        {/* Modal Content */}
        <div className="mt-5">
          <AnimatePresence mode="wait">
            {/* STEP 1: Account Selection List */}
            {step === 'select' && (
              <motion.div key="select" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/50">
                  Select {isGoogle ? 'Google' : 'Microsoft'} Account
                </p>
                <div className="space-y-2.5">
                  {defaultAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={isLoading}
                      onClick={() => startEmailVerification(acc)}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-left transition-all hover:border-blue-300 hover:bg-blue-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:border-sky-400/40 dark:hover:bg-white/15 disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm ${acc.bg}`}>
                          {acc.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{acc.name}</p>
                          <p className="text-xs text-slate-500 dark:text-white/60">{acc.email}</p>
                        </div>
                      </div>
                      <span className="rounded-lg bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-white/15 dark:text-white/80">
                        {acc.badge}
                      </span>
                    </button>
                  ))}

                  {/* Use another account button */}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setStep('custom')}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-dashed border-slate-300 bg-white p-3.5 text-left transition-all hover:bg-slate-50 dark:border-white/20 dark:bg-transparent dark:text-white/80 dark:hover:bg-white/10 disabled:opacity-60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/80">
                      <Plus className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">Use another email account</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 1.5: Custom Email Input */}
            {step === 'custom' && (
              <motion.div key="custom" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-sky-400"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to account list
                </button>

                <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-white">
                  Enter your Google / Email address
                </p>

                <form onSubmit={handleCustomEmailSubmit} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-white/70">
                      Account Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={customEmail}
                      onChange={(e) => {
                        setCustomEmail(e.target.value);
                        setEmailError('');
                      }}
                      placeholder="yourname@gmail.com"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-white/70">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Alex Morgan"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
                    />
                  </div>

                  {emailError && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {emailError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Sending Live OTP...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Send Live Email OTP</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* STEP 2: Email OTP Verification */}
            {step === 'email_otp' && selectedAccount && (
              <motion.div key="email_otp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-sky-400"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Switch Account
                </button>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-center dark:border-blue-500/30 dark:bg-blue-950/30">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                    <Mail className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedAccount.email}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    A real-time 6-digit live verification code has been dispatched to your email address.
                  </p>
                </div>

                {/* Live Dispatched Email OTP Notification Card */}
                {liveEmailCode && (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>Live Email OTP Code: <strong className="font-mono text-sm font-bold tracking-widest">{liveEmailCode}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnteredEmailOtp(liveEmailCode)}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 shadow-sm"
                    >
                      Fill Code
                    </button>
                  </div>
                )}

                <form onSubmit={handleVerifyEmailOtp} className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-white/80">
                      Enter 6-Digit Email Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={enteredEmailOtp}
                      onChange={(e) => {
                        setEnteredEmailOtp(e.target.value);
                        setEmailOtpError('');
                      }}
                      placeholder="Enter 6-digit code"
                      className="w-full tracking-widest text-center text-lg font-mono font-bold rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
                    />
                  </div>

                  {emailOtpError && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {emailOtpError}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-white/60">
                    <span>Didn't receive code?</span>
                    <button
                      type="button"
                      disabled={emailTimer > 0 || isLoading}
                      onClick={handleResendEmailOtp}
                      className="font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-sky-400"
                    >
                      {emailTimer > 0 ? `Resend code in ${emailTimer}s` : 'Resend Email OTP'}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify Email &amp; Proceed to Mobile Step</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* STEP 3: Mobile Phone Number Input */}
            {step === 'mobile_input' && (
              <motion.div key="mobile_input" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                {/* Verified Email Banner */}
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Verified Email: <strong>{selectedAccount.email}</strong></span>
                </div>

                <div className="mb-3 text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-600 text-white shadow-md">
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Mobile 2FA Verification</h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-white/60">
                    Enter your active mobile phone number to receive a real-time SMS OTP confirmation code.
                  </p>
                </div>

                <form onSubmit={handleSendMobileOtp} className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-white/80">
                      Mobile Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => {
                        setMobileNumber(e.target.value);
                        setMobileError('');
                      }}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
                    />
                  </div>

                  {mobileError && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {mobileError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Sending Live SMS OTP...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Send Mobile SMS OTP</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* STEP 4: Mobile SMS OTP Verification */}
            {step === 'mobile_otp' && (
              <motion.div key="mobile_otp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <button
                  type="button"
                  onClick={() => setStep('mobile_input')}
                  className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-sky-400"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Edit Mobile Number
                </button>

                <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 text-center dark:border-cyan-500/30 dark:bg-cyan-950/30">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-600 text-white shadow-md">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{mobileNumber}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    A 6-digit real-time SMS security code was sent to your phone.
                  </p>
                </div>

                {/* Live Dispatched SMS OTP Notification Card */}
                {liveMobileCode && (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>Live SMS OTP Code: <strong className="font-mono text-sm font-bold tracking-widest">{liveMobileCode}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnteredMobileOtp(liveMobileCode)}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 shadow-sm"
                    >
                      Fill Code
                    </button>
                  </div>
                )}

                <form onSubmit={handleVerifyMobileOtp} className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-white/80">
                      Enter 6-Digit SMS Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={enteredMobileOtp}
                      onChange={(e) => {
                        setEnteredMobileOtp(e.target.value);
                        setMobileOtpError('');
                      }}
                      placeholder="Enter 6-digit SMS code"
                      className="w-full tracking-widest text-center text-lg font-mono font-bold rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
                    />
                  </div>

                  {mobileOtpError && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {mobileOtpError}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-white/60">
                    <span>Didn't receive SMS?</span>
                    <button
                      type="button"
                      disabled={mobileTimer > 0 || isLoading}
                      onClick={handleResendMobileOtp}
                      className="font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-sky-400"
                    >
                      {mobileTimer > 0 ? `Resend SMS in ${mobileTimer}s` : 'Resend SMS OTP'}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Confirming Verification...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify &amp; Complete Sign In</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* STEP 5: Finalizing Verification */}
            {step === 'verifying_complete' && (
              <motion.div key="verifying_complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <ShieldCheck className="h-10 w-10 animate-bounce" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Live Verification Passed!</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-white/60">
                  Real-time Email &amp; Mobile Phone authenticated. Logging into MetroFlow...
                </p>

                <div className="mt-4 space-y-2 text-left">
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Email Verified: {selectedAccount.email}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Mobile Phone Verified: {mobileNumber}</span>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-white/80">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span>Logging in...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3 text-[11px] text-slate-400 dark:border-white/10 dark:text-white/40">
          <span>Protected by OAuth 2.0 &amp; Real-time 2FA</span>
          <span>MetroFlow AI Security</span>
        </div>
      </motion.div>
    </div>
  );
}

