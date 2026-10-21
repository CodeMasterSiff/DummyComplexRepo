import { useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentApi } from '../api/endpoints';
import type { AppointmentView } from '../api/types';
import ErrorBanner from '../components/ErrorBanner';
import StatusBadge from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import { formatDateTime, SPECIALTY_LABELS, TYPE_LABELS, UPCOMING_STATUSES } from '../utils/format';

type Tab = 'upcoming' | 'past';

function isUpcoming(a: AppointmentView): boolean {
  return UPCOMING_STATUSES.includes(a.status) && new Date(a.end).getTime() > Date.now();
}

export default function AppointmentsPage() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { data, error, loading } = useApi(() => appointmentApi.list(), []);

  const all = data?.appointments ?? [];
  const shown =
    tab === 'upcoming'
      ? all.filter(isUpcoming).sort((a, b) => a.start.localeCompare(b.start))
      : all.filter((a) => !isUpcoming(a)).sort((a, b) => b.start.localeCompare(a.start));

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Appointments</h1>
        <Link to="/book" className="btn btn-primary">
          Book an appointment
        </Link>
      </div>

      <div className="tabs" role="tablist" aria-label="Appointments">
        {(['upcoming', 'past'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls="appointments-panel"
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
          >
            {t === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>

      <section id="appointments-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="card">
        <ErrorBanner error={error} />
        {loading ? (
          <p className="muted" role="status">
            Loading appointments…
          </p>
        ) : shown.length === 0 ? (
          <p className="muted">{tab === 'upcoming' ? 'No upcoming appointments.' : 'No past appointments.'}</p>
        ) : (
          <ul className="list">
            {shown.map((a) => (
              <li key={a.id} className="list-item">
                <div>
                  <Link to={`/appointments/${a.id}`} className="list-title">
                    {SPECIALTY_LABELS[a.specialty]} · {TYPE_LABELS[a.type]}
                  </Link>
                  <p className="muted">
                    {formatDateTime(a.start)} · {a.practitionerName} · {a.patientName}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
