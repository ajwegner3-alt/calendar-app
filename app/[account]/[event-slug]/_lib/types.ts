// Shared types between the Server Component (page.tsx) and the client shell.
// Must be JSON-serializable — Server -> Client prop boundary.

export interface AccountSummary {
  id: string;
  slug: string;
  name: string;
  timezone: string; // IANA — owner's TZ
  owner_email: string | null;
}

export interface CustomQuestion {
  id?: string;
  label: string;
  type: "short_text" | "long_text" | "select" | "radio" | string; // permissive — Phase 3 owns the enum
  required: boolean;
  options?: string[];
}

export interface EventTypeSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  custom_questions: CustomQuestion[];
}

export interface BookingPageData {
  account: AccountSummary;
  eventType: EventTypeSummary;
}
