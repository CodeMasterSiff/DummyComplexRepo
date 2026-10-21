import { useMemo, useState, type ReactNode } from 'react';
import { catalogApi } from '../api/endpoints';
import type { AppointmentType, Slot } from '../api/types';
import { useApi } from '../hooks/useApi';
import { addDays, formatCalendarDate, formatDay, formatTime, todayIso } from '../utils/format';
import ErrorBanner from './ErrorBanner';

const DAYS_PER_PAGE = 7;
const BOOKING_HORIZON_DAYS = 60;

interface Props {
  practitionerId: string;
  type: AppointmentType;
  onPick: (slot: Slot) => void;
  selectedStart?: string;
  disabled?: boolean;
  emptyContent?: ReactNode;
}

function groupByDay(slots: Slot[]): { key: string; label: string; slots: Slot[] }[] {
  const days = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = new Date(slot.start).toDateString();
    const list = days.get(key) ?? [];
    list.push(slot);
    days.set(key, list);
  }
  return [...days.entries()].map(([key, daySlots]) => ({
    key,
    label: formatDay(daySlots[0].start),
    slots: daySlots.sort((a, b) => a.start.localeCompare(b.start)),
  }));
}

export default function SlotPicker({ practitionerId, type, onPick, selectedStart, disabled, emptyContent }: Props) {
  const today = todayIso();
  const [from, setFrom] = useState(today);
  const to = addDays(from, DAYS_PER_PAGE - 1);
  const lastFrom = addDays(today, BOOKING_HORIZON_DAYS - DAYS_PER_PAGE);

  const { data, error, loading } = useApi(
    () => catalogApi.availability(practitionerId, type, from, to),
    [practitionerId, type, from],
  );
  const days = useMemo(() => groupByDay(data?.slots ?? []), [data]);

  return (
    <div className="slot-picker">
      <div className="slot-picker-header">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setFrom(addDays(from, -DAYS_PER_PAGE))}
          disabled={from <= today || loading}
        >
          ‹ Previous week
        </button>
        <span className="slot-range">
          {formatCalendarDate(from)} – {formatCalendarDate(to)}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setFrom(addDays(from, DAYS_PER_PAGE))}
          disabled={from >= lastFrom || loading}
        >
          Next week ›
        </button>
      </div>

      {loading ? (
        <p className="muted" role="status">
          Loading available times…
        </p>
      ) : error ? (
        <ErrorBanner error={error} />
      ) : days.length === 0 ? (
        (emptyContent ?? <p className="muted">No free times this week. Try the next week.</p>)
      ) : (
        days.map((day) => (
          <section key={day.key} className="slot-day">
            <h3>{day.label}</h3>
            <div className="slot-grid">
              {day.slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  className={`slot${slot.start === selectedStart ? ' selected' : ''}`}
                  aria-pressed={slot.start === selectedStart}
                  disabled={disabled}
                  onClick={() => onPick(slot)}
                >
                  {formatTime(slot.start)}
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
