import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isApiError } from '../../api/client';
import { appointmentApi, catalogApi, waitlistApi } from '../../api/endpoints';
import type { Appointment, AppointmentType, Patient, Practitioner, Specialty } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import ErrorBanner from '../../components/ErrorBanner';
import SlotPicker from '../../components/SlotPicker';
import { useApi } from '../../hooks/useApi';
import { addDays, formatDateTime, SPECIALTY_LABELS, todayIso } from '../../utils/format';

const FIRST_AVAILABLE = 'first-available';

interface Props {
  patient: Patient;
  specialty: Specialty;
  type: AppointmentType;
  onHeld: (appointment: Appointment, practitionerName?: string) => void;
  onBack: () => void;
}

export default function SlotStep({ patient, specialty, type, onHeld, onBack }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, error: practitionersError } = useApi(() => catalogApi.practitioners(specialty), [specialty]);
  const practitioners = (data?.practitioners ?? []).filter((p) => type !== 'TELEHEALTH' || p.offersTelehealth);

  const [choice, setChoice] = useState(FIRST_AVAILABLE);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function hold(practitionerId: string, start: string) {
    setHolding(true);
    setError(null);
    try {
      const { appointment } = await appointmentApi.hold({ patientId: patient.id, practitionerId, type, start });
      onHeld(appointment, practitioners.find((p) => p.id === practitionerId)?.name);
    } catch (err) {
      if (isApiError(err, 'EMAIL_NOT_VERIFIED')) {
        navigate('/verify-email', { state: { email: user?.email } });
        return;
      }
      if (isApiError(err, 'SLOT_TAKEN')) setRefreshKey((k) => k + 1);
      setError(err);
      setHolding(false);
    }
  }

  const waitlistForm = (
    <WaitlistForm
      patientId={patient.id}
      specialty={specialty}
      type={type}
      practitionerId={choice === FIRST_AVAILABLE ? undefined : choice}
    />
  );

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="practitioner">Practitioner</label>
        <select id="practitioner" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value={FIRST_AVAILABLE}>First available</option>
          {practitioners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <ErrorBanner error={error ?? practitionersError} />

      {choice === FIRST_AVAILABLE ? (
        <FirstAvailable
          key={`${specialty}-${type}-${refreshKey}`}
          specialty={specialty}
          type={type}
          practitioners={practitioners}
          disabled={holding}
          onHold={hold}
          emptyContent={waitlistForm}
        />
      ) : (
        <SlotPicker
          key={`${choice}-${refreshKey}`}
          practitionerId={choice}
          type={type}
          disabled={holding}
          onPick={(slot) => hold(choice, slot.start)}
          emptyContent={waitlistForm}
        />
      )}

      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

interface FirstAvailableProps {
  specialty: Specialty;
  type: AppointmentType;
  practitioners: Practitioner[];
  disabled: boolean;
  onHold: (practitionerId: string, start: string) => void;
  emptyContent: ReactNode;
}

function FirstAvailable({ specialty, type, practitioners, disabled, onHold, emptyContent }: FirstAvailableProps) {
  const { data, error, loading } = useApi(() => catalogApi.firstAvailable(specialty, type), [specialty, type]);

  if (loading) {
    return (
      <p className="muted" role="status">
        Looking for the first free time…
      </p>
    );
  }
  if (error) return <ErrorBanner error={error} />;

  const slot = data?.slot;
  if (!slot) return <>{emptyContent}</>;

  const name = practitioners.find((p) => p.id === slot.practitionerId)?.name;

  return (
    <div className="card highlight">
      <p className="muted">First free time</p>
      <p className="lead">
        {formatDateTime(slot.start)}
        {name && <> with {name}</>}
      </p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled}
        onClick={() => onHold(slot.practitionerId, slot.start)}
      >
        Hold this time
      </button>
    </div>
  );
}

interface WaitlistFormProps {
  patientId: string;
  specialty: Specialty;
  type: AppointmentType;
  practitionerId?: string;
}

function WaitlistForm({ patientId, specialty, type, practitionerId }: WaitlistFormProps) {
  const [anyPractitioner, setAnyPractitioner] = useState(!practitionerId);
  const [earliest, setEarliest] = useState(todayIso());
  const [latest, setLatest] = useState(addDays(todayIso(), 14));
  const [saving, setSaving] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await waitlistApi.join({
        patientId,
        practitionerId: anyPractitioner ? undefined : practitionerId,
        specialty,
        anyPractitioner,
        type,
        earliest: `${earliest}T00:00:00.000Z`,
        latest: `${latest}T23:59:59.999Z`,
      });
      setJoined(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (joined) {
    return (
      <p className="banner banner-success" role="status">
        You’re on the waitlist. We’ll text or email you a link as soon as a time opens up.{' '}
        <Link to="/">Back to your overview</Link>
      </p>
    );
  }

  return (
    <div className="card">
      <h3>No free times found</h3>
      <p className="muted">
        Join the waitlist for {SPECIALTY_LABELS[specialty].toLowerCase()} and we’ll offer you the first time that frees
        up in your date range.
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="wl-earliest">From</label>
            <input
              id="wl-earliest"
              type="date"
              min={todayIso()}
              value={earliest}
              onChange={(e) => setEarliest(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="wl-latest">To</label>
            <input
              id="wl-latest"
              type="date"
              min={earliest}
              value={latest}
              onChange={(e) => setLatest(e.target.value)}
              required
            />
          </div>
        </div>
        {practitionerId && (
          <label className="checkbox">
            <input type="checkbox" checked={anyPractitioner} onChange={(e) => setAnyPractitioner(e.target.checked)} />
            Any practitioner is fine
          </label>
        )}
        <ErrorBanner error={error} />
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Joining…' : 'Join waitlist'}
          </button>
        </div>
      </form>
    </div>
  );
}
