import { AUTH_STORAGE_KEY } from '@/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const USERS_KEY = 'metroflow_users_v2';

function readUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (raw) return JSON.parse(raw);
  const seeded = [
    {
      id: 'USR-DEMO',
      name: 'Demo User',
      email: 'demo@metroflow.app',
      password: 'MetroFlow@123',
      phone: '+91 90000 00000',
      profileImage: null,
      dateJoined: new Date('2026-01-15').toISOString(),
    },
  ];
  localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function delay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSession(user, token) {
  const { password, ...safeUser } = user;
  return { user: safeUser, token: token || `mock-jwt-${user.id}-${Date.now()}` };
}

export async function login({ email, password, rememberMe }) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe }),
    });
    if (res.ok) {
      const session = await res.json();
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      return session;
    }
  } catch (err) {
    console.warn('FastAPI backend offline or unreachable, falling back to local service:', err);
  }

  // Fallback to local storage
  await delay();
  const users = readUsers();
  const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!found || found.password !== password) {
    throw new Error('Invalid email or password.');
  }
  const session = toSession(found);
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function registerAccount({ name, phone, email, password, profileImage }) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password, profileImage }),
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json();
    if (errData.detail) throw new Error(errData.detail);
  } catch (err) {
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
    console.warn('FastAPI backend offline, executing local register fallback:', err);
  }

  // Fallback
  await delay();
  const users = readUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }
  const newUser = {
    id: `USR-${users.length + 1}-${Date.now()}`,
    name,
    phone: phone || '',
    email,
    password,
    profileImage: profileImage || null,
    dateJoined: new Date().toISOString(),
  };
  users.push(newUser);
  writeUsers(users);
  const { password: _pw, ...safeUser } = newUser;
  return safeUser;
}

export function getStoredSession() {
  const local = localStorage.getItem(AUTH_STORAGE_KEY);
  const session = local || sessionStorage.getItem(AUTH_STORAGE_KEY);
  return session ? JSON.parse(session) : null;
}

export function clearSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function updateUserProfile(userId, patch) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/profile/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updatedUser = await res.json();
      const session = getStoredSession();
      if (session?.user?.id === userId) {
        const updatedSession = { ...session, user: updatedUser };
        const target = localStorage.getItem(AUTH_STORAGE_KEY) ? localStorage : sessionStorage;
        target.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedSession));
      }
      return updatedUser;
    }
  } catch (err) {
    console.warn('FastAPI profile update fallback:', err);
  }

  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  writeUsers(users);

  const session = getStoredSession();
  if (session?.user?.id === userId) {
    const updatedSession = { ...session, user: { ...session.user, ...patch } };
    const target = localStorage.getItem(AUTH_STORAGE_KEY) ? localStorage : sessionStorage;
    target.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedSession));
  }

  const { password, ...safeUser } = users[idx];
  return safeUser;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/change-password?user_id=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json();
    if (errData.detail) throw new Error(errData.detail);
  } catch (err) {
    if (err.message && !err.message.includes('fetch')) throw err;
  }

  await delay(500);
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('Account not found.');
  if (users[idx].password !== currentPassword) {
    throw new Error('Current password is incorrect.');
  }
  users[idx].password = newPassword;
  writeUsers(users);
  return { message: 'Password updated successfully.' };
}
