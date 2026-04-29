export interface AccountListingData {
  account: {
    id: string;
    slug: string;
    name: string;
    timezone: string;
    owner_email: string | null;
    logo_url: string | null;
    brand_primary: string | null;
    /** Phase 12: gradient backdrop hex tint. null = gray-50 fallback. */
    background_color: string | null;
    /** Phase 12: gradient intensity. Never null (DB DEFAULT 'subtle'). */
    background_shade: string;
  };
  eventTypes: EventTypeCardData[];
}

export interface EventTypeCardData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
}
