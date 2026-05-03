import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CampaignReport, Customer, Outreach } from '../backend/domain/types.ts';
import { ApiClient, type Session } from './lib/api.ts';
import { formatDate, priorityLabel } from './lib/format.ts';
import './styles.css';

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem('growth-session');
    return raw ? JSON.parse(raw) as Session : null;
  });
  const api = useMemo(() => new ApiClient(() => session?.token), [session]);

  if (!session) {
    return <Login api={api} onLogin={(next) => {
      localStorage.setItem('growth-session', JSON.stringify(next));
      setSession(next);
    }} />;
  }

  return <Dashboard api={api} session={session} onLogout={() => {
    localStorage.removeItem('growth-session');
    setSession(null);
  }} />;
}

function Login({ api, onLogin }: { api: ApiClient; onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      onLogin(await api.login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <div>
          <p className="eyebrow">MCP Growth Intelligence</p>
          <h1>Growth Copilot</h1>
        </div>
        <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={!username.trim() || !password}>Sign in</button>
      </form>
    </main>
  );
}

function Dashboard({ api, session, onLogout }: { api: ApiClient; session: Session; onLogout: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [reports, setReports] = useState<CampaignReport[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [activeReport, setActiveReport] = useState<CampaignReport | null>(null);
  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function refresh(nextQuery = query) {
    const [nextCustomers, nextReports] = await Promise.all([
      api.listCustomers(nextQuery),
      api.listReports(),
    ]);
    setCustomers(nextCustomers);
    setReports(nextReports);
    setSelected((current) => current ?? nextCustomers[0] ?? null);
  }

  useEffect(() => {
    refresh().catch((err) => setStatus(err.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.listOutreach(selected.id).then(setOutreach).catch((err) => setStatus(err.message));
  }, [selected?.id]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    await refresh(query);
  }

  async function importCsv() {
    setLoading(true);
    setStatus('');
    try {
      const result = await api.importCustomers(csvText);
      setStatus(`Imported ${result.inserted} customers. Skipped ${result.skipped}.`);
      setCsvText('');
      setCsvFileName('');
      if (csvInputRef.current) csvInputRef.current.value = '';
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  async function selectCsvFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setStatus('');
    setCsvText('');
    setCsvFileName('');

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStatus('Select a .csv file.');
      event.target.value = '';
      return;
    }

    setCsvText(await file.text());
    setCsvFileName(file.name);
  }

  async function askAgent(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus('');
    try {
      const result = await api.chat(message);
      setActiveReport(result.report);
      setStatus(result.answer);
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Copilot failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <aside>
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Growth Copilot</h2>
        </div>
        <nav>
          <a href="#chat">Chat</a>
          <a href="#customers">Customers</a>
          <a href="#import">Import</a>
          <a href="#reports">Reports</a>
        </nav>
        <div className="session-box">
          <strong>{session.username}</strong>
          <span>{session.role}</span>
          <button className="ghost" onClick={onLogout}>Sign out</button>
        </div>
      </aside>

      <main>
        <section className="topbar">
          <div>
            <p className="eyebrow">Agent Dashboard</p>
            <h1>Customer growth intelligence</h1>
          </div>
          <form className="search" onSubmit={search}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers" />
            <button type="submit">Search</button>
          </form>
        </section>

        {status && <div className="notice">{status}</div>}

        <section className="grid">
          <section id="chat" className="panel wide">
            <div className="panel-header">
              <h2>Copilot Chat</h2>
              <span>{loading ? 'Working' : 'Ready'}</span>
            </div>
            <form onSubmit={askAgent} className="chat-form">
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask for a campaign recommendation" />
              <button type="submit" disabled={loading || !message.trim()}>{loading ? 'Thinking...' : 'Ask Copilot'}</button>
            </form>
          </section>

          <section id="customers" className="panel">
            <div className="panel-header">
              <h2>Customers</h2>
              <span>{customers.length}</span>
            </div>
            <div className="customer-list">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  className={selected?.id === customer.id ? 'selected row-button' : 'row-button'}
                  onClick={() => setSelected(customer)}
                >
                  <strong>{customer.name}</strong>
                  <span>{customer.segment ?? 'Unsegmented'}</span>
                </button>
              ))}
              {!customers.length && <p className="muted">No customers found.</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Customer Detail</h2>
              <span>{selected ? 'Selected' : 'Empty'}</span>
            </div>
            {selected ? (
              <div className="detail">
                <h3>{selected.name}</h3>
                <p>{selected.email ?? selected.phone}</p>
                <p>{selected.interests.join(', ') || 'No interests yet'}</p>
                <p>Last contact: {formatDate(selected.lastContactAt)}</p>
                <h4>Outreach</h4>
                {outreach.map((item) => <p key={item.id} className="timeline">{item.channel}: {item.note}</p>)}
                {!outreach.length && <p className="muted">No outreach recorded.</p>}
              </div>
            ) : <p className="muted">Select a customer.</p>}
          </section>

          <section id="import" className="panel wide">
            <div className="panel-header">
              <h2>CSV Import</h2>
              <span>{session.role === 'admin' ? 'Admin' : 'Read only'}</span>
            </div>
            <label className="file-picker">
              <span>CSV file</span>
              <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={selectCsvFile} disabled={session.role !== 'admin' || loading} />
            </label>
            <p className="muted">{csvFileName || 'No file selected.'}</p>
            <button onClick={importCsv} disabled={session.role !== 'admin' || loading || !csvText.trim()}>Import Customers</button>
          </section>

          <section id="reports" className="panel">
            <div className="panel-header">
              <h2>Reports</h2>
              <span>{reports.length}</span>
            </div>
            {reports.map((report) => (
              <button key={report.id} className="row-button" onClick={() => setActiveReport(report)}>
                <strong>{report.title}</strong>
                <span>{formatDate(report.createdAt)}</span>
              </button>
            ))}
            {!reports.length && <p className="muted">No reports generated yet.</p>}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Recommendation</h2>
              <span>{activeReport ? 'Generated' : 'Waiting'}</span>
            </div>
            {activeReport ? (
              <div className="report">
                <p>{activeReport.summary}</p>
                {activeReport.recommendedActions.map((action) => (
                  <article key={`${action.customerId}-${action.title}`}>
                    <strong>{priorityLabel(action.priority)}: {action.title}</strong>
                    <p>{action.rationale}</p>
                  </article>
                ))}
                <pre>{activeReport.markdown}</pre>
              </div>
            ) : <p className="muted">Ask the copilot to generate a recommendation.</p>}
          </section>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
