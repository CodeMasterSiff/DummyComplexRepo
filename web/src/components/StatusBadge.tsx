import type { AppointmentStatus } from '../api/types';
import { STATUS_LABELS } from '../utils/format';

export default function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`badge status-${status.toLowerCase().replace('_', '-')}`}>{STATUS_LABELS[status]}</span>;
}
