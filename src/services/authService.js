import { AUTH_STORAGE_KEY } from '@/constants';

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

function delay(ms = 700) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSession(user) {
  const { password, ...safeUser } = user;
  return { user: safeUser, token: `mock-jwt-${user.id}-${Date.now()}` };
}

export async function login({ email, password, rememberMe }) {
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

/**
 * Creates a new account WITHOUT starting a session — per the "Create
 * Account" flow, the user is returned to the Login popup afterwards
 * rather than being signed straight in.
 */
export async function registerAccount({ name, phone, email, password, profileImage }) {
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

/** Updates a user's profile fields (name, phone, email, profileImage) everywhere it's stored. */
export function updateUserProfile(userId, patch) {
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

/** Mock password change — validates the current password against the stored record. */
export async function changePassword(userId, { currentPassword, newPassword }) {
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
