import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appointmentApi, patientApi } from '../../api/endpoints';
import ErrorBanner from '../../components/ErrorBanner';
import { useApi } from '../../hooks/useApi';
import { coveringPolicy, needsReferralStep } from '../../utils/referralRules';
import ReferralStep from './ReferralStep';
import ReviewStep from './ReviewStep';

// Confirm an appointment that is already HELD, e.g. after claiming a waitlist offer.
export default function ReviewPage() {
  const { appointmentId = '' } = useParams();
  const navigate = useNavigate();
  const [referral, setReferral] = useState<{ id?: string } | null>(null);

  const { data, error, loading } = useApi(async () => {
    const [{ appointment }, household] = await Promise.all([appointmentApi.get(appointmentId), patientApi.me()]);
    return { appointment, household };
  }, [appointmentId]);

  if (loading) {
    return (
      <p className="muted" role="status">
        Loading booking…
      </p>
    );
  }
  if (!data) return <ErrorBanner error={error} />;

  const { appointment, household } = data;

  if (appointment.status !== 'HELD') {
    return (
      <div className="narrow card">
        <h1>Nothing to confirm</h1>
        <p>This time is no longer on hold for you.</p>
        <Link to={`/appointments/${appointment.id}`}>View the appointment</Link>
      </div>
    );
  }

  const patient = [household.patient, ...household.dependents].find((p) => p.id === appointment.patientId);
  const policy = patient ? coveringPolicy(patient, household.patient) : undefined;
  const askForReferral = needsReferralStep(appointment.specialty, policy) && referral === null;

  return (
    <div className="stack narrow">
      <h1>Confirm your booking</h1>
      <section className="card">
        {askForReferral ? (
          <ReferralStep
            patientId={appointment.patientId}
            specialty={appointment.specialty}
            appointmentStart={appointment.start}
            onNext={(id) => setReferral({ id })}
          />
        ) : (
          <ReviewStep
            appointment={appointment}
            patientName={appointment.patientName}
            practitionerName={appointment.practitionerName}
            referralId={referral?.id}
            defaultPayer={policy ? 'INSURANCE' : 'SELF_PAY'}
            insuranceAvailable={Boolean(policy)}
            onBack={referral ? () => setReferral(null) : undefined}
            onHoldExpired={(message) => navigate('/book', { state: { notice: message } })}
            onConfirmed={(confirmed) =>
              navigate(`/appointments/${confirmed.id}`, { replace: true, state: { booked: confirmed.status } })
            }
          />
        )}
      </section>
    </div>
  );
}
