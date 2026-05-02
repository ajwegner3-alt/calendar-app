export interface AccountListingData {
  account: {
    id: string;
    slug: string;
    name: string;
    timezone: string;
    owner_email: string | null;
    logo_url: string | null;
    brand_primary: string | null;
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
