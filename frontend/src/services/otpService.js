import { DEMO_OTP_CODE } from '@/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

function delay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendOtp({ employeeId, phone }) {
  if (!employeeId || !phone) {
    throw new Error('Employee ID and phone number are required.');
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, employeeId }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('FastAPI backend send-otp fallback:', err);
  }

  await delay();
  return { success: true, message: `OTP sent to ${phone}.` };
}

export async function verifyOtp({ code, phone }) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, phone }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('FastAPI backend verify-otp fallback:', err);
  }

  await delay(400);
  if (code !== DEMO_OTP_CODE) {
    throw new Error('Invalid OTP. Please try again.');
  }
  return { success: true };
}
