import { AUTH_STORAGE_KEY } from '@/constants';

const USERS_KEY = 'metroflow_users_v2';

function readUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (raw) return JSON.parse(raw);
  const seeded = [
    { id: 'USR-DEMO', name: 'Demo User', email: 'demo@metroflow.app', password: 'MetroFlow@123' },
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

export async function register({ name, email, password }) {
  await delay();
  const users = readUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }
  const newUser = { id: `USR-${users.length + 1}`, name, email, password };
  users.push(newUser);
  writeUsers(users);
  const session = toSession(newUser);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
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
