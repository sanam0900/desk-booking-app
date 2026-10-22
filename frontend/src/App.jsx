import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On load, if a token exists, resolve the current user.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  function handleAuthed(token, u) {
    setToken(token);
    setUser(u);
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setToken(null);
      setUser(null);
    }
  }

  if (loading) return <p className="center">Loading…</p>;

  return (
    <div className="container">
      <header>
        <h1>Desk Booking</h1>
        {user && (
          <div className="user-bar">
            <span>
              {user.username}
              {user.role === 'admin' && <span className="role-pill">admin</span>}
            </span>
            <button onClick={handleLogout}>Log out</button>
          </div>
        )}
      </header>
      {user ? (
        <Dashboard user={user} />
      ) : (
        <div className="auth-wrap">
          <AuthForm onAuthed={handleAuthed} />
        </div>
      )}
    </div>
  );
}

function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = mode === 'login'
        ? await api.login(username, password)
        : await api.register(username, password);
      onAuthed(res.token, res.user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{mode === 'login' ? 'Log in' : 'Register'}</h2>
      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit">{mode === 'login' ? 'Log in' : 'Register'}</button>
      <p className="switch">
        {mode === 'login' ? 'No account?' : 'Have an account?'}{' '}
        <a onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Register' : 'Log in'}
        </a>
      </p>
    </form>
  );
}

function Dashboard({ user }) {
  const [desks, setDesks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState(null);

  async function refresh() {
    const [d, b] = await Promise.all([api.listDesks(), api.listBookings()]);
    setDesks(d);
    setBookings(b);
  }

  useEffect(() => {
    refresh().catch((e) => setMessage({ type: 'error', text: e.message }));
  }, []);

  return (
    <div className="dashboard">
      {message && <div className={`banner ${message.type}`}>{message.text}</div>}
      <BookingForm desks={desks} onDone={refresh} setMessage={setMessage} />
      <MyBookings bookings={bookings} onDone={refresh} setMessage={setMessage} />
      {user.role === 'admin' && <AdminDesks onDone={refresh} setMessage={setMessage} />}
    </div>
  );
}

function BookingForm({ desks, onDone, setMessage }) {
  const [deskId, setDeskId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const DURATIONS = [
    { label: '15 min', minutes: 15 },
    { label: '30 min', minutes: 30 },
    { label: '1 hr', minutes: 60 },
    { label: '2 hr', minutes: 120 },
  ];

  // Format a Date as the 'YYYY-MM-DDTHH:mm' string a datetime-local expects,
  // in local time (no UTC shift).
  function toLocalInput(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }

  // Clicking a duration chip sets End = Start + minutes. If Start is empty,
  // default it to the next quarter-hour so the pair is always valid.
  function applyDuration(minutes) {
    let base = start ? new Date(start) : null;
    if (!base || Number.isNaN(base.getTime())) {
      base = new Date();
      base.setSeconds(0, 0);
      base.setMinutes(Math.ceil((base.getMinutes() + 1) / 15) * 15);
      setStart(toLocalInput(base));
    }
    setEnd(toLocalInput(new Date(base.getTime() + minutes * 60_000)));
  }

  async function submit(e) {
    e.preventDefault();
    setMessage(null);
    try {
      // datetime-local gives 'YYYY-MM-DDTHH:mm'; send as-is (local server tz).
      await api.createBooking(Number(deskId), start, end);
      setMessage({ type: 'success', text: 'Booking created.' });
      setStart('');
      setEnd('');
      onDone();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <form className="card span-2" onSubmit={submit}>
      <h2>📅 Book a desk</h2>
      <label>
        Desk
        <select value={deskId} onChange={(e) => setDeskId(e.target.value)} required>
          <option value="" disabled>Select a desk…</option>
          {desks.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label>
          Start
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label>
          End
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </label>
      </div>
      <div className="durations">
        <span className="durations-label">Quick duration:</span>
        {DURATIONS.map((d) => (
          <button
            key={d.minutes}
            type="button"
            className="chip"
            onClick={() => applyDuration(d.minutes)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <button type="submit">Book desk</button>
    </form>
  );
}

function MyBookings({ bookings, onDone, setMessage }) {
  async function cancel(id) {
    setMessage(null);
    try {
      await api.cancelBooking(id);
      setMessage({ type: 'success', text: 'Booking cancelled.' });
      onDone();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <div className="card">
      <h2>
        🗓️ My bookings
        {bookings.length > 0 && <span className="count">{bookings.length}</span>}
      </h2>
      {bookings.length === 0 ? (
        <p className="empty">No bookings yet — book a desk to get started.</p>
      ) : (
        <ul className="bookings">
          {bookings.map((b) => (
            <li key={b.id}>
              <span>
                <strong>{b.deskName}</strong>
                <div className="when">{formatRange(b.start, b.end)}</div>
              </span>
              <button onClick={() => cancel(b.id)}>Cancel</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminDesks({ onDone, setMessage }) {
  const [name, setName] = useState('');

  async function submit(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await api.addDesk(name);
      setMessage({ type: 'success', text: `Desk "${name}" added.` });
      setName('');
      onDone();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <form className="card admin span-2" onSubmit={submit}>
      <h2>⚙️ Admin: add desk</h2>
      <label>
        Desk name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <button type="submit">Add desk</button>
    </form>
  );
}

function formatRange(start, end) {
  const fmt = (s) => new Date(s).toLocaleString();
  return `${fmt(start)} → ${fmt(end)}`;
}
