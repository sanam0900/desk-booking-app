// Thin API client. Stores the session token in localStorage and attaches it as
// a Bearer header. All business rules live in the backend; this just calls it.

const TOKEN_KEY = 'desk_booking_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (username, password) =>
    request('/api/register', { method: 'POST', body: { username, password } }),
  login: (username, password) =>
    request('/api/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/api/logout', { method: 'POST' }),
  me: () => request('/api/me'),
  listDesks: () => request('/api/desks'),
  addDesk: (name) => request('/api/desks', { method: 'POST', body: { name } }),
  createBooking: (deskId, start, end) =>
    request('/api/bookings', { method: 'POST', body: { deskId, start, end } }),
  listBookings: () => request('/api/bookings'),
  cancelBooking: (id) => request(`/api/bookings/${id}`, { method: 'DELETE' }),
};
