import { useNavigate } from 'react-router-dom';
import { patientApi } from '../api/endpoints';
import type { InsurancePolicy } from '../api/types';
import ErrorBanner from '../components/ErrorBanner';
import InsuranceForm from '../components/InsuranceForm';
import { useApi } from '../hooks/useApi';

export default function InsuranceOnboardingPage() {
  const navigate = useNavigate();
  const { data, error, loading } = useApi(() => patientApi.me(), []);

  async function save(policy: InsurancePolicy) {
    await patientApi.setInsurance(policy);
    navigate('/', { state: { notice: 'Your insurance details were saved.' } });
  }

  const existing = data?.patient.insurance;

  return (
    <div className="narrow">
      <h1>{existing ? 'Update your insurance' : 'Add your insurance'}</h1>
      <p className="muted">
        Optional. With your policy on file we can bill your insurer directly and show what you’ll pay when you book. Your
        children are covered by your policy unless you give them their own.
      </p>

      <ErrorBanner error={error} />
      {loading ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : (
        <section className="card">
          <InsuranceForm initial={existing} onSubmit={save} />
        </section>
      )}

      <p>
        <button type="button" className="btn-link" onClick={() => navigate('/')}>
          Skip for now
        </button>
      </p>
    </div>
  );
}
