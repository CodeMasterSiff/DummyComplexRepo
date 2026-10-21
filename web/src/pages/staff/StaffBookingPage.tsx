import { useState, type FormEvent } from 'react';
import { isApiError } from '../../api/client';
import { catalogApi, staffApi } from '../../api/endpoints';
import type { Appointment, AppointmentType, Patient, Slot } from '../../api/types';
import ErrorBanner from '../../components/ErrorBanner';
import SlotPicker from '../../components/SlotPicker';
import StatusBadge from '../../components/StatusBadge';
import { useApi } from '../../hooks/useApi';
import { ageOn, formatCalendarDate, formatDateTime, SPECIALTY_LABELS, TYPE_LABELS } from '../../utils/format';
import ReviewStep from '../booking/ReviewStep';

function isBlocked(patient: Patient): boolean {
  return Boolean(patient.blockedUntil && new Date(patient.blockedUntil).getTime() > Date.now());
}

export default function StaffBookingPage() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [held, setHeld] = useState<Appointment | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reset() {
    setPatient(null);
    setHeld(null);
    setBooked(null);
    setNotice(null);
  }

  return (
    <div className="stack narrow">
      <h1>Book for a patient</h1>

      {booked && patient ? (
        <section className="card">
          <h2>Booking saved</h2>
          <p>
            {patient.fullName} · {formatDateTime(booked.start)} <StatusBadge status={booked.status} />
          </p>
          {booked.status === 'PENDING_REVIEW' && (
            <p className="muted">This booking went to the review queue.</p>
          )}
          <button type="button" className="btn btn-primary" onClick={reset}>
            Book another
          </button>
        </section>
      ) : !patient ? (
        <PatientSearch onSelect={setPatient} />
      ) : (
        <>
          <section className="card">
            <div className="section-header">
              <div>
                <h2>{patient.fullName}</h2>
                <p className="muted">
                  Born {formatCalendarDate(patient.dateOfBirth)} · age {ageOn(patient.dateOfBirth)}
                  {patient.email && ` · ${patient.email}`}
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
                Change patient
              </button>
            </div>
            {isBlocked(patient) && (
              <p className="banner banner-warning">
                Blocked from online booking until {formatCalendarDate(patient.blockedUntil!)}.
              </p>
            )}
          </section>

          {notice && (
            <p className="banner banner-warning" role="status">
              {notice}
            </p>
          )}

          {held ? (
            <section className="card">
              <h2>Confirm</h2>
              <ReviewStep
                appointment={held}
                patientName={patient.fullName}
                defaultPayer={patient.insurance || patient.guardianId ? 'INSURANCE' : 'SELF_PAY'}
                insuranceAvailable
                onBack={() => setHeld(null)}
                onHoldExpired={(message) => {
                  setHeld(null);
                  setNotice(message);
                }}
                onConfirmed={setBooked}
              />
            </section>
          ) : (
            <SlotSelection
              patient={patient}
              onHeld={(appointment) => {
                setNotice(null);
                setHeld(appointment);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function PatientSearch({ onSelect }: { onSelect: (patient: Patient) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const { patients } = await staffApi.searchPatients(query.trim());
      setResults(patients);
    } catch (err) {
      setError(err);
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="card">
      <form className="toolbar" role="search" onSubmit={handleSearch}>
        <div className="field grow">
          <label htmlFor="patient-search">Find patient</label>
          <input
            id="patient-search"
            type="search"
            placeholder="Name, email or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>
      <ErrorBanner error={error} />
      {results && results.length === 0 && <p className="muted">No patients found.</p>}
      {results && results.length > 0 && (
        <ul className="list">
          {results.map((p) => (
            <li key={p.id} className="list-item">
              <div>
                <span className="list-title">{p.fullName}</span>
                <p className="muted">
                  {formatCalendarDate(p.dateOfBirth)}
                  {p.email && ` · ${p.email}`}
                  {p.guardianId && ' · dependent'}
                  {isBlocked(p) && ' · blocked online'}
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelect(p)}>
                Select
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SlotSelection({ patient, onHeld }: { patient: Patient; onHeld: (appointment: Appointment) => void }) {
  const { data } = useApi(() => catalogApi.practitioners(), []);
  const practitioners = data?.practitioners ?? [];
  const [practitionerId, setPractitionerId] = useState('');
  const [type, setType] = useState<AppointmentType>('FIRST_VISIT');
  const [overrideBlock, setOverrideBlock] = useState(false);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const practitioner = practitioners.find((p) => p.id === practitionerId);
  const types: AppointmentType[] = practitioner?.offersTelehealth
    ? ['FIRST_VISIT', 'FOLLOW_UP', 'TELEHEALTH']
    : ['FIRST_VISIT', 'FOLLOW_UP'];

  function choosePractitioner(id: string) {
    setPractitionerId(id);
    const next = practitioners.find((p) => p.id === id);
    if (type === 'TELEHEALTH' && !next?.offersTelehealth) setType('FIRST_VISIT');
  }

  async function hold(slot: Slot) {
    setHolding(true);
    setError(null);
    try {
      const { appointment } = await staffApi.hold({
        patientId: patient.id,
        practitionerId,
        type,
        start: slot.start,
        overrideBlock,
      });
      onHeld(appointment);
    } catch (err) {
      if (isApiError(err, 'SLOT_TAKEN')) setRefreshKey((k) => k + 1);
      setError(err);
      setHolding(false);
    }
  }

  return (
    <section className="card stack">
      <h2>Choose a time</h2>
      <div className="field-row">
        <div className="field">
          <label htmlFor="sb-practitioner">Practitioner</label>
          <select id="sb-practitioner" value={practitionerId} onChange={(e) => choosePractitioner(e.target.value)}>
            <option value="">Select…</option>
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({SPECIALTY_LABELS[p.specialty]})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sb-type">Visit type</label>
          <select id="sb-type" value={type} onChange={(e) => setType(e.target.value as AppointmentType)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="checkbox">
        <input type="checkbox" checked={overrideBlock} onChange={(e) => setOverrideBlock(e.target.checked)} />
        Override online-booking block
      </label>

      <ErrorBanner error={error} />

      {practitionerId ? (
        <SlotPicker
          key={`${practitionerId}-${type}-${refreshKey}`}
          practitionerId={practitionerId}
          type={type}
          disabled={holding}
          onPick={hold}
        />
      ) : (
        <p className="muted">Pick a practitioner to see free times.</p>
      )}
    </section>
  );
}
