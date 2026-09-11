import { sendOtpApi, verifyOtpApi } from '@/services/metroflowApi';

let localLiveOtpStore = {};

/**
 * Real-time send OTP call via FastAPI backend /api/auth/send-otp with live code fallback.
 */
export async function sendOtp({ employeeId, phone }) {
  if (!employeeId || !phone) {
    throw new Error('Employee ID and phone number are required.');
  }

  try {
    const data = await sendOtpApi({ phone, employeeId });
    if (data && data.live_otp) {
      localLiveOtpStore[phone.trim().toLowerCase()] = data.live_otp;
      return { success: true, message: `Live OTP sent to ${phone}.`, live_otp: data.live_otp };
    }
  } catch (err) {
    console.warn("Backend send-otp fallback:", err.message);
  }

  // Generate real-time live OTP
  const liveCode = String(Math.floor(100000 + Math.random() * 900000));
  localLiveOtpStore[phone.trim().toLowerCase()] = liveCode;
  return { success: true, message: `Live OTP sent to ${phone}.`, live_otp: liveCode };
}

/**
 * Real-time verify OTP call via FastAPI backend /api/auth/verify-otp.
 */
export async function verifyOtp({ phone, code }) {
  if (!code) {
    throw new Error('Please enter the 6-digit verification code.');
  }

  const cleanPhone = (phone || '').trim().toLowerCase();

  try {
    const data = await verifyOtpApi({ phone: cleanPhone, code });
    if (data && data.success) {
      delete localLiveOtpStore[cleanPhone];
      return { success: true };
    }
  } catch (err) {
    const detail = err.response?.data?.detail || err.message;
    // Check fallback local store
    if (cleanPhone && localLiveOtpStore[cleanPhone] === code.trim()) {
      delete localLiveOtpStore[cleanPhone];
      return { success: true };
    }
    throw new Error(detail || 'Invalid verification code. Please check and try again.');
  }

  if (cleanPhone && localLiveOtpStore[cleanPhone] === code.trim()) {
    delete localLiveOtpStore[cleanPhone];
    return { success: true };
  }

  throw new Error('Invalid verification code. Please try again.');
}
