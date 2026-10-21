import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { appointmentApi, catalogApi, patientApi, waitlistApi } from '../api/endpoints';
import type { Invoice } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import ErrorBanner from '../components/ErrorBanner';
import StatusBadge from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import {
  firstName,
  formatCalendarDate,
  formatDateTime,
  formatMoney,
  PLAN_LABELS,
  SPECIALTY_LABELS,
  TYPE_LABELS,
  UPCOMING_STATUSES,
} from '../utils/format';
import { isReferralExpired, isReferralUsable, referralValidUntil, visitsLeft } from '../utils/referralRules';

const INVOICE_KIND_LABELS: Record<Invoice['kind'], string> = {
  VISIT: 'Visit',
  LATE_CANCEL: 'Late cancellation',
  NO_SHOW: 'Missed appointment',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [leaveError, setLeaveError] = useState<unknown>(null);

  const { data, error, loading, reload } = useApi(async () => {
    const [household, appointments, waitlist, invoices, referrals, practitioners] = await Promise.all([
      patientApi.me(),
      appointmentApi.list(),
      waitlistApi.list(),
      patientApi.invoices(),
      patientApi.referrals(),
      catalogApi.practitioners(),
    ]);
    return {
      household,
      appointments: appointments.appointments,
      waitlist: waitlist.entries,
      invoices: invoices.invoices,
      referrals: referrals.referrals,
      practitioners: practitioners.practitioners,
    };
  }, []);

  async function leaveWaitlist(id: string) {
    setLeaveError(null);
    try {
      await waitlistApi.leave(id);
      reload();
    } catch (err) {
      setLeaveError(err);
    }
  }

  if (loading && !data) {
    return (
      <p className="muted" role="status">
        Loading your overview…
      </p>
    );
  }
  if (!data) return <ErrorBanner error={error} />;

  const { household, appointments, waitlist, invoices, referrals, practitioners } = data;
  const me = household.patient;
  const people = new Map([me, ...household.dependents].map((p) => [p.id, p.fullName] as const));
  const practitionerName = (id?: string) => practitioners.find((p) => p.id === id)?.name;

  const now = Date.now();
  const upcoming = appointments
    .filter((a) => UPCOMING_STATUSES.includes(a.status) && new Date(a.end).getTime() > now)
    .sort((a, b) => a.start.localeCompare(b.start));
  const activeWaitlist = waitlist.filter((w) => w.status === 'ACTIVE');
  const sortedInvoices = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const openTotal = invoices.filter((i) => i.status === 'OPEN').reduce((sum, i) => sum + i.amount, 0);
  const blocked = me.blockedUntil && new Date(me.blockedUntil).getTime() > now;

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Hello, {firstName(me.fullName)}</h1>
        <Link to="/book" className="btn btn-primary">
          Book an appointment
        </Link>
      </div>

      {notice && (
        <p className="banner banner-success" role="status">
          {notice}
        </p>
      )}
      {user && !user.emailVerified && (
        <p className="banner banner-warning">
          Verify your email address before booking. <Link to="/verify-email">Verify now</Link>
        </p>
      )}
      {blocked && (
        <p className="banner banner-error">
          Your account is temporarily blocked from online booking after missed appointments. Please call the clinic to
          book.
        </p>
      )}

      <section className="card">
        <h2>Upcoming appointments</h2>
        {upcoming.length === 0 ? (
          <p className="muted">Nothing booked right now.</p>
        ) : (
          <ul className="list">
            {upcoming.slice(0, 5).map((a) => (
              <li key={a.id} className="list-item">
                <div>
                  <Link to={`/appointments/${a.id}`} className="list-title">
                    {SPECIALTY_LABELS[a.specialty]} · {TYPE_LABELS[a.type]}
                  </Link>
                  <p className="muted">
                    {formatDateTime(a.start)} with {a.practitionerName}
                    {a.patientId !== me.id && <> · for {a.patientName}</>}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
        {upcoming.length > 5 && <Link to="/appointments">See all appointments</Link>}
      </section>

      <section className="card">
        <h2>Waitlist</h2>
        <ErrorBanner error={leaveError} onDismiss={() => setLeaveError(null)} />
        {activeWaitlist.length === 0 ? (
          <p className="muted">You’re not on any waitlist.</p>
        ) : (
          <ul className="list">
            {activeWaitlist.map((w) => (
              <li key={w.id} className="list-item">
                <div>
                  <span className="list-title">
                    {SPECIALTY_LABELS[w.specialty]} · {TYPE_LABELS[w.type]}
                  </span>
                  <p className="muted">
                    {people.get(w.patientId) ?? 'Patient'} ·{' '}
                    {w.anyPractitioner ? 'any practitioner' : (practitionerName(w.practitionerId) ?? 'chosen practitioner')}{' '}
                    · {formatCalendarDate(w.earliest)} – {formatCalendarDate(w.latest)}
                  </p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => leaveWaitlist(w.id)}>
                  Leave
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Referrals</h2>
        {referrals.length === 0 ? (
          <p className="muted">No referrals on file. Your GP can refer you to a specialist after a visit.</p>
        ) : (
          <ul className="list">
            {referrals.map((r) => {
              const usable = isReferralUsable(r, r.toSpecialty);
              return (
                <li key={r.id} className={`list-item${usable ? '' : ' is-inactive'}`}>
                  <div>
                    <span className="list-title">{SPECIALTY_LABELS[r.toSpecialty]}</span>
                    <p className="muted">
                      {people.get(r.patientId) ?? 'Patient'} · issued {formatCalendarDate(r.issuedAt)} ·{' '}
                      {usable
                        ? `${visitsLeft(r)} of ${r.visitsAllowed} visits left · valid until ${referralValidUntil(r).toLocaleDateString()}`
                        : `${r.visitsUsed} of ${r.visitsAllowed} visits used`}
                    </p>
                  </div>
                  {!usable && (
                    <span className="badge badge-muted">{isReferralExpired(r) ? 'expired' : 'used up'}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Invoices</h2>
          {openTotal > 0 && <span className="tabular">Open: {formatMoney(openTotal)}</span>}
        </div>
        {sortedInvoices.length === 0 ? (
          <p className="muted">No invoices.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">For</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{formatCalendarDate(inv.createdAt)}</td>
                  <td>
                    <Link to={`/appointments/${inv.appointmentId}`}>{INVOICE_KIND_LABELS[inv.kind]}</Link>
                  </td>
                  <td className="tabular">{formatMoney(inv.amount)}</td>
                  <td>{inv.status === 'OPEN' ? 'Open' : 'Paid'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Insurance</h2>
          <Link to="/onboarding/insurance">{me.insurance ? 'Update' : 'Add insurance'}</Link>
        </div>
        {me.insurance ? (
          <p>
            {me.insurance.provider} · {PLAN_LABELS[me.insurance.plan]} plan · member {me.insurance.memberId} · valid until{' '}
            {formatCalendarDate(me.insurance.validUntil)}
          </p>
        ) : (
          <p className="muted">No insurance on file. Visits will be billed as self-pay.</p>
        )}
      </section>
    </div>
  );
}
