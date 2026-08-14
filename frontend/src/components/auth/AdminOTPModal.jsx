import { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { BadgeCheck, Briefcase, Phone, ShieldCheck, Info } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import * as otpService from '@/services/otpService';
import { DEMO_OTP_CODE } from '@/constants';

const EMPLOYEE_ROLES = ['Station Manager', 'Control Room Operator', 'Operations Staff', 'Security Officer', 'Maintenance Engineer'];

/**
 * Two-step employee verification popup: Employee Role + Employee ID +
 * registered phone number → Send OTP, then Enter OTP → Verify. This is
 * the ONLY authentication popup in the admin flow — city and station are
 * chosen on their own full pages (AdminSelectCity / AdminSelectStation)
 * before this ever opens.
 *
 * Calls onVerified(undefined, employeeId, employeeRole) only after a
 * successful OTP check — the first argument is kept for backward
 * compatibility with callers that don't need it.
 */
export default function AdminOTPModal({
  isOpen,
  onClose,
  onVerified,
  title = 'Employee Verification',
  subtitle = 'Confirm your assignment to continue',
}) {
  const [step, setStep] = useState('request'); // 'request' | 'verify'
  const [employeeRole, setEmployeeRole] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const otpInputRef = useRef(null);

  const resetAndClose = () => {
    setStep('request');
    setEmployeeRole('');
    setEmployeeId('');
    setPhone('');
    setOtp('');
    setError('');
    onClose();
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!employeeRole || !employeeId.trim() || !phone.trim()) {
      setError('Please select your role and enter both Employee ID and registered phone number.');
      return;
    }
    setIsSending(true);
    try {
      await otpService.sendOtp({ employeeId, phone });
      toast.success(`OTP sent to ${phone}. (Demo code: ${DEMO_OTP_CODE})`);
      setStep('verify');
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Unable to send OTP.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);
    try {
      await otpService.verifyOtp({ code: otp });
      toast.success('Identity verified.');
      onVerified(undefined, employeeId, employeeRole);
      resetAndClose();
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const stepIndex = { request: 1, verify: 2 }[step];

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title={title} subtitle={subtitle} size="sm">
      <div className="mb-5 flex items-center gap-2">
        {[1, 2].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                n <= stepIndex ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {n}
            </div>
            {n < 2 && <div className={`h-0.5 flex-1 rounded ${n < stepIndex ? 'bg-brand-600' : 'bg-slate-100'}`} />}
          </div>
        ))}
      </div>

      {step === 'request' && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <Input label="Employee ID" icon={BadgeCheck} placeholder="EMP-00123" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Employee Role</label>
            <div className="relative">
              <Briefcase className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={employeeRole}
                onChange={(e) => setEmployeeRole(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2.5 pl-10 text-sm text-slate-800 focus-ring"
              >
                <option value="">Select employee role…</option>
                {EMPLOYEE_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <Input label="Registered Phone Number" icon={Phone} placeholder="+91 90000 00000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" fullWidth isLoading={isSending}>
            Send OTP
          </Button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-xs text-brand-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Demo mode — no SMS is actually sent. Use code <span className="font-mono font-semibold">{DEMO_OTP_CODE}</span>.
            </span>
          </div>
          <Input
            ref={otpInputRef}
            label="Enter OTP"
            icon={ShieldCheck}
            placeholder="123456"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          />
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep('request')} fullWidth>
              Back
            </Button>
            <Button type="submit" fullWidth isLoading={isVerifying}>
              Verify OTP
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
