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
              {user.username} {user.role === 'admin' && <em>(admin)</em>}
            </span>
            <button onClick={handleLogout}>Log out</button>
          </div>
        )}
      </header>
      {user ? <Dashboard user={user} /> : <AuthForm onAuthed={handleAuthed} />}
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
      {message && <p className={message.type}>{message.text}</p>}
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
    <form className="card" onSubmit={submit}>
      <h2>Book a desk</h2>
      <label>
        Desk
        <select value={deskId} onChange={(e) => setDeskId(e.target.value)} required>
          <option value="" disabled>Select a desk…</option>
          {desks.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      <label>
        Start
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
      </label>
      <label>
        End
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
      </label>
      <button type="submit">Book</button>
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
      <h2>My bookings</h2>
      {bookings.length === 0 ? (
        <p>No bookings yet.</p>
      ) : (
        <ul className="bookings">
          {bookings.map((b) => (
            <li key={b.id}>
              <span>
                <strong>{b.deskName}</strong>
                <br />
                {formatRange(b.start, b.end)}
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
    <form className="card admin" onSubmit={submit}>
      <h2>Admin: add desk</h2>
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
