import { describe, it, expect } from 'vitest';
import {
  generateBaseSlots,
  filterAvailableSlots,
  type ScheduleTemplate,
} from '@/lib/utils/slots';

const TZ_AR = 'America/Argentina/Buenos_Aires';

describe('generateBaseSlots', () => {
  const monTo9to12: ScheduleTemplate = {
    slot_minutes: 30,
    attention_windows: [{ weekday: 1, start_time: '09:00', end_time: '12:00' }],
  };

  it('generates 30-min slots in the configured window', () => {
    // 2025-01-06 is a Monday in AR
    const slots = generateBaseSlots(monTo9to12, '2025-01-06', TZ_AR);
    expect(slots).toHaveLength(6); // 9:00, 9:30, 10:00, 10:30, 11:00, 11:30
  });

  it('returns no slots when day has no attention window', () => {
    // 2025-01-07 is a Tuesday
    const slots = generateBaseSlots(monTo9to12, '2025-01-07', TZ_AR);
    expect(slots).toEqual([]);
  });

  it('first slot is at 09:00 in AR time', () => {
    const slots = generateBaseSlots(monTo9to12, '2025-01-06', TZ_AR);
    const firstAr = slots[0]!.toLocaleString('en-CA', {
      timeZone: TZ_AR,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(firstAr).toBe('09:00');
  });

  it('respects multiple windows on same day (split shift)', () => {
    const split: ScheduleTemplate = {
      slot_minutes: 60,
      attention_windows: [
        { weekday: 1, start_time: '09:00', end_time: '12:00' },
        { weekday: 1, start_time: '15:00', end_time: '18:00' },
      ],
    };
    const slots = generateBaseSlots(split, '2025-01-06', TZ_AR);
    // 9, 10, 11, 15, 16, 17 = 6
    expect(slots).toHaveLength(6);
  });

  it('does not generate slot that ends after window close', () => {
    const tight: ScheduleTemplate = {
      slot_minutes: 60,
      attention_windows: [{ weekday: 1, start_time: '09:00', end_time: '09:30' }],
    };
    const slots = generateBaseSlots(tight, '2025-01-06', TZ_AR);
    // Sólo 30min de ventana, slot de 60 no entra
    expect(slots).toEqual([]);
  });
});

describe('filterAvailableSlots', () => {
  const futureMs = Date.UTC(2030, 0, 6, 12, 0, 0);
  const TEN_AM = new Date(Date.UTC(2030, 0, 6, 13, 0, 0)); // 10:00 AR (UTC-3)
  const TEN_THIRTY = new Date(Date.UTC(2030, 0, 6, 13, 30, 0));
  const ELEVEN = new Date(Date.UTC(2030, 0, 6, 14, 0, 0));

  it('removes slots in the past', () => {
    const past = new Date(Date.UTC(2020, 0, 1));
    const slots = [past, TEN_AM];
    const result = filterAvailableSlots(slots, 30, null, [], [], futureMs);
    expect(result).toEqual([TEN_AM]);
  });

  it('removes slots overlapping a confirmed appointment', () => {
    const slots = [TEN_AM, TEN_THIRTY, ELEVEN];
    const booked = [
      {
        starts_at: TEN_THIRTY.toISOString(),
        ends_at: ELEVEN.toISOString(),
        professional_id: 'pro-1',
      },
    ];
    const result = filterAvailableSlots(slots, 30, 'pro-1', booked, [], futureMs);
    expect(result).toEqual([TEN_AM, ELEVEN]);
  });

  it('respects service duration when checking overlap', () => {
    const slots = [TEN_AM];
    const booked = [
      {
        starts_at: TEN_THIRTY.toISOString(),
        ends_at: ELEVEN.toISOString(),
        professional_id: 'pro-1',
      },
    ];
    // 60-min service starting at 10:00 would end at 11:00, overlapping 10:30-11:00
    const result = filterAvailableSlots(slots, 60, 'pro-1', booked, [], futureMs);
    expect(result).toEqual([]);
  });

  it('ignores bookings of other professionals when filtering for a specific one', () => {
    const slots = [TEN_AM];
    const booked = [
      {
        starts_at: TEN_AM.toISOString(),
        ends_at: TEN_THIRTY.toISOString(),
        professional_id: 'OTHER',
      },
    ];
    const result = filterAvailableSlots(slots, 30, 'pro-1', booked, [], futureMs);
    expect(result).toEqual([TEN_AM]);
  });

  it('removes slots blocked by a global schedule_block', () => {
    const slots = [TEN_AM, TEN_THIRTY];
    const blocks = [
      {
        starts_at: TEN_AM.toISOString(),
        ends_at: TEN_THIRTY.toISOString(),
        professional_id: null,
        resource_id: null,
        all_day: false,
      },
    ];
    const result = filterAvailableSlots(slots, 30, 'pro-1', [], blocks, futureMs);
    expect(result).toEqual([TEN_THIRTY]);
  });

  it('professional-specific block does not affect other pros', () => {
    const slots = [TEN_AM];
    const blocks = [
      {
        starts_at: TEN_AM.toISOString(),
        ends_at: TEN_THIRTY.toISOString(),
        professional_id: 'someone-else',
        resource_id: null,
        all_day: false,
      },
    ];
    const result = filterAvailableSlots(slots, 30, 'pro-1', [], blocks, futureMs);
    expect(result).toEqual([TEN_AM]);
  });
});
