import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { patientApi } from '../../api/endpoints';
import type { Appointment, AppointmentType, Patient, Specialty } from '../../api/types';
import ErrorBanner from '../../components/ErrorBanner';
import { useApi } from '../../hooks/useApi';
import { coveringPolicy, needsReferralStep } from '../../utils/referralRules';
import ReferralStep from './ReferralStep';
import ReviewStep from './ReviewStep';
import SlotStep from './SlotStep';
import SpecialtyStep from './SpecialtyStep';
import WhoStep from './WhoStep';

type StepKey = 'who' | 'specialty' | 'slot' | 'referral' | 'review';

const STEP_LABELS: Record<StepKey, string> = {
  who: 'Who',
  specialty: 'Visit',
  slot: 'Time',
  referral: 'Referral',
  review: 'Review',
};

export default function BookingWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: household, error, loading } = useApi(() => patientApi.me(), []);

  const [step, setStep] = useState<StepKey>('who');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [type, setType] = useState<AppointmentType>('FIRST_VISIT');
  const [held, setHeld] = useState<{ appointment: Appointment; practitionerName?: string } | null>(null);
  const [referralId, setReferralId] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  );

  if (loading) {
    return (
      <p className="muted" role="status">
        Loading…
      </p>
    );
  }
  if (!household) return <ErrorBanner error={error} />;

  const policy = patient ? coveringPolicy(patient, household.patient) : undefined;
  const withReferral = specialty ? needsReferralStep(specialty, policy) : false;
  const steps: StepKey[] = withReferral
    ? ['who', 'specialty', 'slot', 'referral', 'review']
    : ['who', 'specialty', 'slot', 'review'];
  const currentIndex = steps.indexOf(step);

  function backToSlots(message: string | null) {
    setHeld(null);
    setNotice(message);
    setStep('slot');
  }

  return (
    <div className="stack narrow">
      <h1>Book an appointment</h1>
      {notice && (
        <p className="banner banner-warning" role="status">
          {notice}
        </p>
      )}

      <ol className="steps" aria-label="Booking progress">
        {steps.map((s, i) => (
          <li
            key={s}
            className={i === currentIndex ? 'current' : i < currentIndex ? 'done' : ''}
            aria-current={i === currentIndex ? 'step' : undefined}
          >
            <span className="step-number">{i + 1}</span> {STEP_LABELS[s]}
          </li>
        ))}
      </ol>

      <section className="card">
        {step === 'who' && (
          <WhoStep
            household={household}
            selectedId={patient?.id}
            onSelect={(p) => {
              setPatient(p);
              setStep('specialty');
            }}
          />
        )}

        {step === 'specialty' && (
          <SpecialtyStep
            initialSpecialty={specialty}
            initialType={type}
            onBack={() => setStep('who')}
            onNext={(s, t) => {
              setSpecialty(s);
              setType(t);
              setStep('slot');
            }}
          />
        )}

        {step === 'slot' && patient && specialty && (
          <SlotStep
            patient={patient}
            specialty={specialty}
            type={type}
            onBack={() => setStep('specialty')}
            onHeld={(appointment, practitionerName) => {
              setHeld({ appointment, practitionerName });
              setReferralId(undefined);
              setNotice(null);
              setStep(withReferral ? 'referral' : 'review');
            }}
          />
        )}

        {step === 'referral' && patient && specialty && held && (
          <ReferralStep
            patientId={patient.id}
            specialty={specialty}
            appointmentStart={held.appointment.start}
            selectedReferralId={referralId}
            onBack={() => backToSlots(null)}
            onNext={(id) => {
              setReferralId(id);
              setStep('review');
            }}
          />
        )}

        {step === 'review' && patient && held && (
          <ReviewStep
            appointment={held.appointment}
            patientName={patient.fullName}
            practitionerName={held.practitionerName}
            referralId={referralId}
            defaultPayer={policy ? 'INSURANCE' : 'SELF_PAY'}
            insuranceAvailable={Boolean(policy)}
            onBack={() => (withReferral ? setStep('referral') : backToSlots(null))}
            onHoldExpired={backToSlots}
            onConfirmed={(confirmed) =>
              navigate(`/appointments/${confirmed.id}`, { state: { booked: confirmed.status } })
            }
          />
        )}
      </section>
    </div>
  );
}
