import { useState, type FormEvent } from 'react';
import { catalogApi } from '../../api/endpoints';
import type { AppointmentType, Specialty } from '../../api/types';
import ErrorBanner from '../../components/ErrorBanner';
import { useApi } from '../../hooks/useApi';
import { TYPE_LABELS } from '../../utils/format';

const TYPE_HINTS: Record<AppointmentType, string> = {
  FIRST_VISIT: 'A new problem, or your first time seeing this practitioner.',
  FOLLOW_UP: 'A check-up after a completed visit with the same practitioner.',
  TELEHEALTH: 'A video call from home.',
};

interface Props {
  initialSpecialty: Specialty | null;
  initialType: AppointmentType;
  onNext: (specialty: Specialty, type: AppointmentType) => void;
  onBack: () => void;
}

export default function SpecialtyStep({ initialSpecialty, initialType, onNext, onBack }: Props) {
  const { data, error, loading } = useApi(() => catalogApi.specialties(), []);
  const [specialty, setSpecialty] = useState<Specialty | null>(initialSpecialty);
  const [type, setType] = useState<AppointmentType>(initialType);

  const specialties = data?.specialties ?? [];
  const selected = specialties.find((s) => s.code === specialty);
  const types: AppointmentType[] = selected?.telehealth
    ? ['FIRST_VISIT', 'FOLLOW_UP', 'TELEHEALTH']
    : ['FIRST_VISIT', 'FOLLOW_UP'];

  function chooseSpecialty(code: Specialty) {
    setSpecialty(code);
    const supportsTelehealth = specialties.find((s) => s.code === code)?.telehealth;
    if (type === 'TELEHEALTH' && !supportsTelehealth) setType('FIRST_VISIT');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (specialty) onNext(specialty, type);
  }

  if (loading) {
    return (
      <p className="muted" role="status">
        Loading…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <ErrorBanner error={error} />

      <fieldset className="choice-list">
        <legend>What kind of care?</legend>
        {specialties.map((s) => (
          <label key={s.code} className="choice">
            <input
              type="radio"
              name="specialty"
              value={s.code}
              checked={specialty === s.code}
              onChange={() => chooseSpecialty(s.code)}
            />
            <span>
              <strong>{s.name}</strong>
              {s.telehealth && <span className="muted"> · video consultations available</span>}
            </span>
          </label>
        ))}
      </fieldset>

      {specialty && (
        <fieldset className="choice-list">
          <legend>Visit type</legend>
          {types.map((t) => (
            <label key={t} className="choice">
              <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} />
              <span>
                <strong>{TYPE_LABELS[t]}</strong>
                <span className="muted"> · {TYPE_HINTS[t]}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn btn-primary" disabled={!specialty}>
          Continue
        </button>
      </div>
    </form>
  );
}
