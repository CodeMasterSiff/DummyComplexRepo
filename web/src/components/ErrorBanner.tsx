import type { ReactNode } from 'react';
import { isApiError } from '../api/client';

const FRIENDLY_MESSAGES: Record<string, string> = {
  PATIENT_BLOCKED:
    'Your account is temporarily blocked from online booking. Please call the clinic and we will help you book.',
  MINOR_SIGNUP: 'Under 18? Ask a parent or guardian to add you as a dependent.',
  SLOT_TAKEN: 'Sorry, someone else just took that time. Please pick another one.',
  HOLD_EXPIRED: 'Your hold on this time expired. Please pick a time again.',
  CHECKIN_WINDOW: 'Check-in opens 30 minutes before the appointment and closes 15 minutes after it starts.',
  FOLLOW_UP_REQUIRES_PRIOR_VISIT:
    'A follow-up needs an earlier completed visit with the same practitioner. Please book a first visit instead.',
  OFFER_EXPIRED: 'This waitlist offer has expired or was already taken.',
  REFERRAL_REQUIRED: 'Your insurer requires a referral for this visit.',
  REFERRAL_INVALID:
    'That referral can’t be used for this appointment. It may have expired, have no visits left, or be for another specialty.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before booking.',
};

export function errorMessage(error: unknown): string {
  if (isApiError(error)) return FRIENDLY_MESSAGES[error.code] ?? error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

interface Props {
  error: unknown;
  onDismiss?: () => void;
  children?: ReactNode;
}

export default function ErrorBanner({ error, onDismiss, children }: Props) {
  if (!error) return null;

  return (
    <div className="banner banner-error" role="alert">
      <p>{errorMessage(error)}</p>
      {children}
      {onDismiss && (
        <button type="button" className="btn-link" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
