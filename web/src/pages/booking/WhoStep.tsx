import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Household, Patient } from '../../api/types';
import { ageOn } from '../../utils/format';

interface Props {
  household: Household;
  selectedId?: string;
  onSelect: (patient: Patient) => void;
}

export default function WhoStep({ household, selectedId, onSelect }: Props) {
  const me = household.patient;
  const options = [me, ...household.dependents];
  const [choice, setChoice] = useState(selectedId ?? me.id);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const patient = options.find((p) => p.id === choice);
    if (patient) onSelect(patient);
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <fieldset className="choice-list">
        <legend>Who is the appointment for?</legend>
        {options.map((p) => (
          <label key={p.id} className="choice">
            <input type="radio" name="who" value={p.id} checked={choice === p.id} onChange={() => setChoice(p.id)} />
            <span>
              <strong>{p.id === me.id ? `Me (${p.fullName})` : p.fullName}</strong>
              {p.id !== me.id && <span className="muted"> · age {ageOn(p.dateOfBirth)}</span>}
            </span>
          </label>
        ))}
      </fieldset>

      {household.dependents.length === 0 && (
        <p className="muted">
          Booking for a child? <Link to="/dependents">Add them to your family</Link> first.
        </p>
      )}

      <div className="actions">
        <button type="submit" className="btn btn-primary">
          Continue
        </button>
      </div>
    </form>
  );
}
