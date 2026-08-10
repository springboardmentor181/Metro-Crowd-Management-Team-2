import { DEMO_OTP_CODE } from '@/constants';

function delay(ms = 900) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock "send OTP" call. In a real backend this would trigger an SMS to the
 * given phone number tied to the employee record. For the demo it always
 * succeeds and the valid code is fixed (see DEMO_OTP_CODE).
 */
export async function sendOtp({ employeeId, phone }) {
  await delay();
  if (!employeeId || !phone) {
    throw new Error('Employee ID and phone number are required.');
  }
  return { success: true, message: `OTP sent to ${phone}.` };
}

export async function verifyOtp({ code }) {
  await delay(600);
  if (code !== DEMO_OTP_CODE) {
    throw new Error('Invalid OTP. Please try again.');
  }
  return { success: true };
}
