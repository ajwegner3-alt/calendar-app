// @vitest-environment node
/**
 * Plan 12-06 Task 1 — unit tests for renderEmailBrandedHeader and stripHtml.
 *
 * These tests run without any DB connection (pure function tests on branding-blocks.ts).
 * No Supabase / email-sender / server-only imports required.
 */
import { describe, it, expect } from "vitest";
import {
  renderEmailBrandedHeader,
  stripHtml,
  type EmailBranding,
} from "@/lib/email/branding-blocks";

function baseBranding(overrides: Partial<EmailBranding> = {}): EmailBranding {
  return {
    name: "Acme Plumbing",
    logo_url: null,
    brand_primary: "#0A2540",
    backgroundColor: null,
    ...overrides,
  };
}

describe("renderEmailBrandedHeader", () => {
  it("[#1] dark backgroundColor → white text (WCAG contrast)", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({ backgroundColor: "#0A2540" }),
    );
    // Dark bg: pickTextColor returns #ffffff
    expect(html).toContain("background-color:#0A2540");
    expect(html).toContain("bgcolor=\"#0A2540\"");
    // Name rendered as fallback text with white color
    expect(html).toContain("color:#ffffff");
    expect(html).toContain("Acme Plumbing");
  });

  it("[#2] light backgroundColor → black text (WCAG contrast)", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({ backgroundColor: "#ffffff" }),
    );
    expect(html).toContain("background-color:#ffffff");
    expect(html).toContain("bgcolor=\"#ffffff\"");
    // Light bg: pickTextColor returns #000000
    expect(html).toContain("color:#000000");
    expect(html).toContain("Acme Plumbing");
  });

  it("[#3] logoUrl set → renders <img> not text fallback", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({
        backgroundColor: "#0A2540",
        logo_url: "https://example.com/logo.png",
      }),
    );
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/logo.png"');
    expect(html).toContain('alt="Acme Plumbing"');
    // Should NOT contain the span text fallback
    expect(html).not.toContain("<span");
  });

  it("[#4] logo_url null → text fallback span rendered", () => {
    const html = renderEmailBrandedHeader(baseBranding({ logo_url: null }));
    expect(html).not.toContain("<img");
    expect(html).toContain("<span");
    expect(html).toContain("Acme Plumbing");
  });

  it("[#5] backgroundColor null → falls back to brand_primary", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({ backgroundColor: null, brand_primary: "#F97316" }),
    );
    expect(html).toContain("background-color:#F97316");
    expect(html).toContain("bgcolor=\"#F97316\"");
  });

  it("[#6] both backgroundColor and brand_primary null → falls back to gray-50 (#F8FAFC) default", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({ backgroundColor: null, brand_primary: null }),
    );
    // DEFAULT_BRAND_PRIMARY is #0A2540
    expect(html).toContain("background-color:#0A2540");
  });

  it("[#7] table structure: role=presentation, width=100%, bgcolor attr for Outlook", () => {
    const html = renderEmailBrandedHeader(baseBranding());
    expect(html).toContain('role="presentation"');
    expect(html).toContain('width="100%"');
    expect(html).toMatch(/bgcolor="#[0-9A-Fa-f]{6}"/);
  });

  it("[#8] HTML-encodes special chars in account name", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({ name: `Bob's & "Best" Plumbing <Co>` }),
    );
    expect(html).toContain("Bob&#39;s &amp; &quot;Best&quot; Plumbing &lt;Co&gt;");
  });
});

describe("stripHtml (moved to branding-blocks)", () => {
  it("[#1] strips tags and decodes entities", () => {
    const input = `<div><h1>Hello &amp; world</h1><p>Line one.<br/>Line two.</p></div>`;
    const text = stripHtml(input);
    expect(text).toContain("Hello & world");
    expect(text).toContain("Line one.");
    expect(text).toContain("Line two.");
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
  });

  it("[#2] removes style/script blocks entirely", () => {
    const input = `<style>.foo{color:red}</style><p>Keep this</p><script>alert(1)</script>`;
    const text = stripHtml(input);
    expect(text).not.toContain(".foo");
    expect(text).not.toContain("alert");
    expect(text).toContain("Keep this");
  });

  it("[#3] collapses 3+ blank lines to double newline", () => {
    const input = `<p>A</p><p>B</p><p>C</p>`;
    const text = stripHtml(input);
    // Should not have more than 2 consecutive newlines
    expect(text).not.toMatch(/\n{3,}/);
  });
});
