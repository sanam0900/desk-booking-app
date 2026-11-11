import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setToken(null);
      setUser(null);
    }
  }

  if (loading) return <div className="boot"><div className="boot-logo">🪑</div></div>;

  if (!user) return <AuthScreen onAuthed={(token, u) => { setToken(token); setUser(u); }} />;

  return <Shell user={user} onLogout={handleLogout} />;
}

/* ---------------- Auth ---------------- */

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = mode === 'login'
        ? await api.login(username, password)
        : await api.register(username, password);
      onAuthed(res.token, res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-visual">
        <div className="auth-visual-inner">
          <div className="brand-lg"><span className="logo">🪑</span> Desk Booking</div>
          <h1>Reserve your spot,<br />without the clashes.</h1>
          <p>See every desk's availability at a glance and book in two clicks.</p>
          <ul className="auth-points">
            <li>Live desk availability timeline</li>
            <li>No double bookings, ever</li>
            <li>Back-to-back slots welcome</li>
          </ul>
        </div>
      </div>
      <div className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="subtle">
            {mode === 'login' ? 'Log in to manage your desk bookings.' : 'Register to start booking desks.'}
          </p>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
          <p className="switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <a onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
              {mode === 'login' ? 'Register' : 'Log in'}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Shell (sidebar + content) ---------------- */

function Shell({ user, onLogout }) {
  const [view, setView] = useState('book');
  const [desks, setDesks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [d, b] = await Promise.all([api.listDesks(), api.listBookings()]);
    setDesks(d);
    setBookings(b);
  }

  useEffect(() => {
    refresh().catch((e) => setMessage({ type: 'error', text: e.message })).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const nav = [
    { key: 'book', label: 'Book a desk', icon: '📅' },
    { key: 'availability', label: 'Availability', icon: '🗓️' },
    { key: 'mine', label: 'My bookings', icon: '🎫', badge: bookings.length },
  ];
  if (user.role === 'admin') nav.push({ key: 'admin', label: 'Manage desks', icon: '⚙️' });

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><span className="logo">🪑</span><span>Desk Booking</span></div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${view === n.key ? 'active' : ''}`}
              onClick={() => setView(n.key)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              {n.badge > 0 && <span className="nav-badge">{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div>
          <div className="who-block">
            <strong>{user.username}</strong>
            <span>{user.role === 'admin' ? 'Administrator' : 'Member'}</span>
          </div>
          <button className="ghost icon-btn" title="Log out" onClick={onLogout}>⎋</button>
        </div>
      </aside>

      <main className="content">
        {message && <div className={`banner ${message.type}`}>{message.text}</div>}

        {view === 'book' && (
          <BookView desks={desks} loading={loading} onDone={refresh} setMessage={setMessage} />
        )}
        {view === 'availability' && <AvailabilityView desks={desks} />}
        {view === 'mine' && (
          <MyBookingsView bookings={bookings} loading={loading} onDone={refresh} setMessage={setMessage} />
        )}
        {view === 'admin' && user.role === 'admin' && (
          <AdminView desks={desks} onDone={refresh} setMessage={setMessage} />
        )}
      </main>
    </div>
  );
}

/* ---------------- Book view (timeline grid) ---------------- */

const DAY_START = 8;   // 08:00
const DAY_END = 20;    // 20:00
const HOURS = DAY_END - DAY_START;

function BookView({ desks, loading, onDone, setMessage }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState(null); // { deskId, deskName, startH }
  const [duration, setDuration] = useState(60);
  const [loadingAvail, setLoadingAvail] = useState(true);

  async function load() {
    setLoadingAvail(true);
    try {
      setRows(await api.availability(date));
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoadingAvail(false);
    }
  }

  useEffect(() => { load(); }, [date, desks]);

  function hhmm(h) {
    const hr = Math.floor(h);
    const mn = Math.round((h - hr) * 60);
    return `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
  }

  async function cancelBar(b, deskName) {
    if (!window.confirm(`Cancel booking on ${deskName} at ${b.start.slice(11)}–${b.end.slice(11)}?`)) return;
    setMessage(null);
    try {
      await api.cancelBooking(b.id);
      setMessage({ type: 'success', text: 'Booking cancelled.' });
      await load();
      onDone();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function confirm() {
    if (!sel) return;
    const start = `${date}T${hhmm(sel.startH)}`;
    const end = `${date}T${hhmm(sel.startH + duration / 60)}`;
    setMessage(null);
    try {
      await api.createBooking(sel.deskId, start, end);
      setMessage({ type: 'success', text: `Booked ${sel.deskName} · ${hhmm(sel.startH)}–${hhmm(sel.startH + duration / 60)}` });
      setSel(null);
      await load();
      onDone();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <PageHeader
        title="Book a desk"
        subtitle="Pick a slot on the timeline, choose a duration, and confirm."
        right={<input type="date" value={date} onChange={(e) => setSel(null) || setDate(e.target.value)} />}
      />

      <div className="card timeline-card">
        <div className="timeline-axis">
          <span className="axis-spacer" />
          <div className="axis-hours">
            {Array.from({ length: HOURS + 1 }, (_, i) => (
              <span key={i} className="axis-hour">{String(DAY_START + i).padStart(2, '0')}</span>
            ))}
          </div>
        </div>

        {loadingAvail ? (
          <TimelineSkeleton />
        ) : rows.length === 0 ? (
          <p className="empty">No desks yet.</p>
        ) : (
          <div className="timeline">
            {rows.map((d) => (
              <div className="tl-row" key={d.id}>
                <div className="tl-label">{d.name}</div>
                <div className="tl-track">
                  {/* hour cells (click to select) */}
                  {Array.from({ length: HOURS }, (_, i) => {
                    const h = DAY_START + i;
                    const selected = sel && sel.deskId === d.id && Math.floor(sel.startH) === h;
                    return (
                      <button
                        key={i}
                        className={`tl-cell ${selected ? 'sel' : ''}`}
                        style={{ left: `${(i / HOURS) * 100}%`, width: `${(1 / HOURS) * 100}%` }}
                        onClick={() => setSel({ deskId: d.id, deskName: d.name, startH: h })}
                        title={`${d.name} · ${String(h).padStart(2, '0')}:00`}
                      />
                    );
                  })}
                  {/* existing bookings as bars (click to cancel if yours/admin) */}
                  {d.bookings.map((b, i) => {
                    const s = toHours(b.start), e = toHours(b.end);
                    const left = clampPct(s), right = clampPct(e);
                    return (
                      <div
                        key={i}
                        className={`tl-bar ${b.mine ? 'mine' : ''}`}
                        style={{ left: `${left}%`, width: `${Math.max(right - left, 1)}%` }}
                        title={b.mine ? `${b.start.slice(11)}–${b.end.slice(11)} · click to cancel` : `${b.start.slice(11)}–${b.end.slice(11)}`}
                        onClick={b.mine ? () => cancelBar(b, d.name) : undefined}
                      >
                        {b.start.slice(11)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {sel && (
        <div className="card confirm-bar">
          <div>
            <span className="subtle">Selected</span>
            <strong>{sel.deskName} · {String(Math.floor(sel.startH)).padStart(2, '0')}:00</strong>
          </div>
          <div className="dur-group">
            {[15, 30, 60, 120].map((m) => (
              <button key={m} className={`chip ${duration === m ? 'on' : ''}`} onClick={() => setDuration(m)}>
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </button>
            ))}
          </div>
          <div className="confirm-actions">
            <button className="ghost" onClick={() => setSel(null)}>Cancel</button>
            <button onClick={confirm}>Confirm booking</button>
          </div>
        </div>
      )}
    </>
  );
}

function TimelineSkeleton() {
  return (
    <div className="timeline">
      {[0, 1, 2].map((i) => (
        <div className="tl-row" key={i}>
          <div className="tl-label"><span className="shimmer sk-text" /></div>
          <div className="tl-track"><span className="shimmer sk-bar" style={{ left: `${10 + i * 20}%`, width: '22%' }} /></div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Availability view ---------------- */

function AvailabilityView({ desks }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.availability(date).then((r) => { setRows(r); setError(''); }).catch((e) => setError(e.message));
  }, [date, desks]);

  const total = rows.length;
  const free = rows.filter((d) => d.bookings.length === 0).length;

  return (
    <>
      <PageHeader
        title="Availability"
        subtitle={total ? `${free} of ${total} desks free all day` : 'Desk availability by date'}
        right={<input type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
      />
      {error && <p className="error">{error}</p>}
      <div className="avail-grid">
        {rows.map((d) => (
          <div className={`avail-card ${d.bookings.length ? 'busy' : 'free'}`} key={d.id}>
            <div className="avail-top">
              <strong>{d.name}</strong>
              <span className={d.bookings.length ? 'tag busy' : 'tag free'}>
                {d.bookings.length ? `${d.bookings.length} booked` : 'free'}
              </span>
            </div>
            <div className="mini-track">
              {d.bookings.map((b, i) => {
                const left = clampPct(toHours(b.start)), right = clampPct(toHours(b.end));
                return <span key={i} className="mini-bar" style={{ left: `${left}%`, width: `${Math.max(right - left, 2)}%` }} />;
              })}
            </div>
            <div className="avail-slots">
              {d.bookings.length === 0
                ? <span className="subtle">Open all day</span>
                : d.bookings.map((b, i) => <span className="slot" key={i}>{b.start.slice(11)}–{b.end.slice(11)}</span>)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- My bookings ---------------- */

function MyBookingsView({ bookings, loading, onDone, setMessage }) {
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
    <>
      <PageHeader title="My bookings" subtitle="Your upcoming desk reservations." />
      {loading ? (
        <div className="list">{[0, 1, 2].map((i) => <div className="row-sk shimmer" key={i} />)}</div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-ico">🗓️</div>
          <p>No bookings yet</p>
          <span className="subtle">Head to “Book a desk” to reserve your first slot.</span>
        </div>
      ) : (
        <div className="list">
          {bookings.map((b) => (
            <div className="booking-row" key={b.id}>
              <div className="br-date">
                <span className="br-day">{new Date(b.start).getDate()}</span>
                <span className="br-mon">{new Date(b.start).toLocaleString([], { month: 'short' })}</span>
              </div>
              <div className="br-main">
                <strong>{b.deskName}</strong>
                <span className="when">{formatRange(b.start, b.end)}</span>
              </div>
              <button className="danger" onClick={() => cancel(b.id)}>Cancel</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Admin ---------------- */

function AdminView({ desks, onDone, setMessage }) {
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
    <>
      <PageHeader title="Manage desks" subtitle="Add desks available for booking." />
      <form className="card add-desk" onSubmit={submit}>
        <label>
          New desk name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Desk C4" required />
        </label>
        <button type="submit">Add desk</button>
      </form>
      <div className="desk-chips">
        {desks.map((d) => <span className="desk-chip" key={d.id}>{d.name}</span>)}
      </div>
    </>
  );
}

/* ---------------- Bits ---------------- */

function PageHeader({ title, subtitle, right }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtle">{subtitle}</p>}
      </div>
      {right && <div className="page-head-right">{right}</div>}
    </div>
  );
}

function toHours(s) {
  // 'YYYY-MM-DDTHH:mm' -> fractional hours
  const hh = Number(s.slice(11, 13));
  const mm = Number(s.slice(14, 16));
  return hh + mm / 60;
}
function clampPct(h) {
  const pct = ((h - DAY_START) / HOURS) * 100;
  return Math.max(0, Math.min(100, pct));
}
function formatRange(start, end) {
  const fmt = (s) => new Date(s).toLocaleString([], { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)} → ${fmt(end)}`;
}
