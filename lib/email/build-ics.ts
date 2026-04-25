import "server-only";
import ical, { ICalCalendarMethod } from "ical-generator";
import { tzlib_get_ical_block } from "timezones-ical-library";

export interface BuildIcsOptions {
  /** Stable identifier — MUST equal booking.id (Postgres UUID).
   *  Phase 6 reschedule sends the same UID with SEQUENCE:1 to update the
   *  existing calendar event. Never pass crypto.randomUUID() here. */
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
}

/**
 * Build an RFC 5545 iCalendar buffer.
 *
 * Correctness invariants (RESEARCH Pitfalls 2, 3, 4):
 *   - METHOD:REQUEST    → Gmail/Outlook render inline "Add to Calendar" card
 *   - VTIMEZONE block   → no floating times; calendar clients localize correctly
 *   - UID == booking.id → Phase 6 reschedule can UPDATE the same calendar event
 *
 * ical-generator handles CRLF line endings, 75-octet line folding, and UTC
 * DTSTAMP automatically — do NOT hand-roll these (RFC 5545 trap).
 */
export function buildIcsBuffer(opts: BuildIcsOptions): Buffer {
  const cal = ical({ name: opts.summary });

  // METHOD:REQUEST is required for Gmail/Outlook to show an inline calendar card
  // instead of a plain attachment download.
  cal.method(ICalCalendarMethod.REQUEST);

  // VTIMEZONE block via timezones-ical-library generator.
  // tzlib_get_ical_block(tz) returns an array; [0] is the requested zone block.
  // This must be set BEFORE createEvent() to ensure correct VTIMEZONE embedding.
  cal.timezone({
    name: opts.timezone,
    generator: (tz) => tzlib_get_ical_block(tz)[0],
  });

  // ical-generator v10: ICalEventData uses `id` for the UID field.
  // The getter/setter on the returned event object is named `uid()` but the
  // data argument to createEvent() uses `id`. Both result in UID:<value> in the
  // .ics output — confirmed via index.d.mts interface inspection.
  cal
    .createEvent({
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
    })
    .createAttendee({
      email: opts.attendeeEmail,
      name:  opts.attendeeName,
      rsvp:  true,
    });

  return Buffer.from(cal.toString(), "utf-8");
}
