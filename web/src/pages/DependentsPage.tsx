import { useState, type FormEvent } from 'react';
import { patientApi } from '../api/endpoints';
import type { InsurancePolicy, Patient } from '../api/types';
import ErrorBanner from '../components/ErrorBanner';
import InsuranceForm from '../components/InsuranceForm';
import { useApi } from '../hooks/useApi';
import { ageOn, firstName, formatCalendarDate, PLAN_LABELS, todayIso } from '../utils/format';

export default function DependentsPage() {
  const { data, error, loading, reload } = useApi(() => patientApi.me(), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function saveInsurance(dependent: Patient, policy: InsurancePolicy) {
    await patientApi.setInsurance(policy, dependent.id);
    setEditingId(null);
    setNotice(`Insurance saved for ${dependent.fullName}.`);
    reload();
  }

  const guardian = data?.patient;

  return (
    <div className="stack">
      <h1>Family</h1>
      <p className="muted">Children under 18 are booked through your account. Notifications about them come to you.</p>

      {notice && (
        <p className="banner banner-success" role="status">
          {notice}
        </p>
      )}
      <ErrorBanner error={error} />

      {loading && !data ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : (
        <section className="card">
          <h2>Your dependents</h2>
          {data?.dependents.length === 0 ? (
            <p className="muted">No dependents added yet.</p>
          ) : (
            <ul className="list">
              {data?.dependents.map((d) => (
                <li key={d.id} className="list-item list-item-stacked">
                  <div className="list-row">
                    <div>
                      <span className="list-title">{d.fullName}</span>
                      <p className="muted">
                        Born {formatCalendarDate(d.dateOfBirth)} · age {ageOn(d.dateOfBirth)}
                      </p>
                      <p className="muted">
                        {d.insurance
                          ? `Own policy: ${d.insurance.provider}, ${PLAN_LABELS[d.insurance.plan]} plan`
                          : guardian?.insurance
                            ? `Covered by your policy (${PLAN_LABELS[guardian.insurance.plan]} plan)`
                            : 'No insurance'}
                      </p>
                    </div>
                    {editingId !== d.id && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingId(d.id)}>
                        {d.insurance ? 'Update insurance' : 'Set own insurance'}
                      </button>
                    )}
                  </div>
                  {editingId === d.id && (
                    <InsuranceForm
                      initial={d.insurance}
                      submitLabel={`Save insurance for ${firstName(d.fullName)}`}
                      onSubmit={(policy) => saveInsurance(d, policy)}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <AddDependentForm
        onAdded={(child) => {
          setNotice(`${child.fullName} was added to your family.`);
          reload();
        }}
      />
    </div>
  );
}

function AddDependentForm({ onAdded }: { onAdded: (child: Patient) => void }) {
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { patient } = await patientApi.addDependent(fullName.trim(), dateOfBirth);
      setFullName('');
      setDateOfBirth('');
      onAdded(patient);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>Add a child</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="child-name">Full name</label>
            <input id="child-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="child-dob">Date of birth</label>
            <input
              id="child-dob"
              type="date"
              max={todayIso()}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              aria-describedby="child-dob-hint"
              required
            />
            <p id="child-dob-hint" className="hint">
              Dependents must be under 18.
            </p>
          </div>
        </div>
        <ErrorBanner error={error} />
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Adding…' : 'Add child'}
          </button>
        </div>
      </form>
    </section>
  );
}
