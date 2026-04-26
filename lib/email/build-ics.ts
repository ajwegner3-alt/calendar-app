import "server-only";
import ical, { ICalCalendarMethod, ICalEventStatus } from "ical-generator";
import { tzlib_get_ical_block } from "timezones-ical-library";

export interface BuildIcsOptions {
  /** Stable identifier — MUST equal booking.id (Postgres UUID).
   *  Phase 6 reschedule sends the same UID with SEQUENCE:1 to update the
   *  existing calendar event. Phase 6 cancel sends the same UID with
   *  METHOD:CANCEL + STATUS:CANCELLED to remove it. Never pass crypto.randomUUID() here. */
  uid: string;
  /** Event title — typically event_type.name */
  summary: string;
  /** Optional plain-text description (event_type.description or null/undefined) */
  description?: string;
  /** Booking start time as UTC Date from DB timestamptz */
  startAt: Date;
  /** Booking end time as UTC Date from DB timestamptz */
  endAt: Date;
  /** IANA timezone for the owner's locale, e.g. "America/Chicago".
   *  The VTIMEZONE block uses this zone so calendar clients localize naturally.
   *  Booker confirmation email formats times in BOOKER timezone separately. */
  timezone: string;
  /** Display name for ORGANIZER field (account.name) */
  organizerName: string;
  /** Email for ORGANIZER field (account.owner_email) */
  organizerEmail: string;
  /** Booker email — added as ATTENDEE with RSVP=TRUE */
  attendeeEmail: string;
  /** Booker display name */
  attendeeName: string;
  /** iCalendar METHOD field. Defaults to REQUEST (Phase 5 confirmation + Phase 6 reschedule).
   *  Use CANCEL for Phase 6 cancellation .ics — calendar clients then remove the event
   *  matched by UID. */
  method?: ICalCalendarMethod;
  /** SEQUENCE field. Defaults to 0 (matches Phase 5 confirmation behavior).
   *  Phase 6 reschedule + cancel MUST pass 1 — RFC 5546 requires SEQUENCE to
   *  increment on update. ical-generator v10 does NOT auto-increment between
   *  createEvent() calls (verified in node_modules/ical-generator/src/event.ts). */
  sequence?: number;
}

/**
 * Build an RFC 5545 iCalendar buffer.
 *
 * Phase 5 default behavior (METHOD:REQUEST, SEQUENCE:0) is preserved when the
 * new optional params are omitted — backward-compatible extension.
 *
 * Phase 6 use cases:
 *   - Cancellation .ics: { method: ICalCalendarMethod.CANCEL, sequence: 1 }
 *     → also sets event STATUS:CANCELLED so calendar clients remove the event.
 *   - Reschedule .ics: { method: ICalCalendarMethod.REQUEST, sequence: 1, ...new times }
 *     → calendar clients UPDATE the existing event (same UID).
 *
 * Correctness invariants (RESEARCH Pitfalls 2, 3, 4):
 *   - METHOD:REQUEST/CANCEL  → Gmail/Outlook show inline calendar card / removal hint
 *   - VTIMEZONE block         → no floating times; calendar clients localize correctly
 *   - UID == booking.id       → Phase 6 reschedule + cancel target the same event
 *   - SEQUENCE:1 on updates   → calendar clients accept the modification
 *   - STATUS:CANCELLED on CANCEL → belt-and-suspenders for non-iTIP clients
 *
 * ical-generator handles CRLF line endings, 75-octet line folding, and UTC
 * DTSTAMP automatically — do NOT hand-roll these (RFC 5545 trap).
 */
export function buildIcsBuffer(opts: BuildIcsOptions): Buffer {
  const cal = ical({ name: opts.summary });

  const method = opts.method ?? ICalCalendarMethod.REQUEST;
  cal.method(method);

  // VTIMEZONE block via timezones-ical-library generator.
  // tzlib_get_ical_block(tz) returns an array; [0] is the requested zone block.
  // This must be set BEFORE createEvent() to ensure correct VTIMEZONE embedding.
  cal.timezone({
    name: opts.timezone,
    generator: (tz) => tzlib_get_ical_block(tz)[0],
  });

  const event = cal.createEvent({
    id:          opts.uid,    // ICalEventData field name is `id`, not `uid`
    summary:     opts.summary,
    description: opts.description,
    start:       opts.startAt,
    end:         opts.endAt,
    timezone:    opts.timezone,
    organizer: {
      name:  opts.organizerName,
      email: opts.organizerEmail,
    },
  });

  // SEQUENCE: explicit pass-through — library defaults to 0 and does NOT auto-increment
  // between createEvent calls (RESEARCH Pitfall 2: verified in node_modules/ical-generator/src/event.ts).
  event.sequence(opts.sequence ?? 0);

  // STATUS:CANCELLED on cancellation .ics — paired with METHOD:CANCEL for max
  // calendar client compatibility (RESEARCH §Pattern 6).
  if (method === ICalCalendarMethod.CANCEL) {
    event.status(ICalEventStatus.CANCELLED);
  }

  event.createAttendee({
    email: opts.attendeeEmail,
    name:  opts.attendeeName,
    rsvp:  true,
  });

  return Buffer.from(cal.toString(), "utf-8");
}
