// @vitest-environment node
/**
 * Plan 12-06 Task 1 — unit tests for renderEmailBrandedHeader and stripHtml.
 * Plan 12.6-03 Task 1 — extended for sidebarColor priority chain (EMAIL-14).
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
  it("[#1] dark sidebarColor → uses sidebarColor for header band (EMAIL-14 priority chain)", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({ sidebarColor: "#1A3A5C" }),
    );
    // sidebarColor takes top priority
    expect(html).toContain("background-color:#1A3A5C");
    expect(html).toContain('bgcolor="#1A3A5C"');
    // Dark bg: pickTextColor returns #ffffff
    expect(html).toContain("color:#ffffff");
    expect(html).toContain("Acme Plumbing");
  });

  it("[#2] light sidebarColor → white band, black text (WCAG contrast)", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({ sidebarColor: "#ffffff" }),
    );
    expect(html).toContain("background-color:#ffffff");
    expect(html).toContain('bgcolor="#ffffff"');
    // Light bg: pickTextColor returns #000000
    expect(html).toContain("color:#000000");
    expect(html).toContain("Acme Plumbing");
  });

  it("[#3] logoUrl set → renders <img> not text fallback", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({
        sidebarColor: "#1A3A5C",
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

  it("[#5] sidebarColor null/undefined → falls back to brand_primary (EMAIL-14)", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({ sidebarColor: null, brand_primary: "#F97316" }),
    );
    expect(html).toContain("background-color:#F97316");
    expect(html).toContain('bgcolor="#F97316"');
  });

  it("[#6] sidebarColor and brand_primary both null → falls back to DEFAULT_BRAND_PRIMARY (#0A2540)", () => {
    const html = renderEmailBrandedHeader(
      baseBranding({ sidebarColor: null, brand_primary: null }),
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

  it("[#9] sidebarColor takes precedence over brand_primary (EMAIL-14 chain)", () => {
    // sidebarColor=#FF0000 should win even when brand_primary is different
    const html = renderEmailBrandedHeader(
      baseBranding({ sidebarColor: "#FF0000", brand_primary: "#0A2540" }),
    );
    expect(html).toContain("background-color:#FF0000");
    expect(html).not.toContain("background-color:#0A2540");
  });

  it("[#10] chromeTintIntensity is accepted (backward compat, ignored by resolver)", () => {
    // chromeTintIntensity is kept in the interface for backward compat;
    // it no longer drives color resolution in Phase 12.6
    const html = renderEmailBrandedHeader(
      baseBranding({ sidebarColor: "#1A3A5C", chromeTintIntensity: "none" }),
    );
    // sidebarColor still wins regardless of chromeTintIntensity
    expect(html).toContain("background-color:#1A3A5C");
  });

  it("[#11] backgroundColor field accepted (backward compat, ignored by resolver since 12.6)", () => {
    // backgroundColor is kept in interface for backward compat but no longer drives header band
    const html = renderEmailBrandedHeader(
      baseBranding({ backgroundColor: "#AABBCC", sidebarColor: null, brand_primary: "#0A2540" }),
    );
    // brand_primary wins because sidebarColor is null and backgroundColor is ignored
    expect(html).toContain("background-color:#0A2540");
    expect(html).not.toContain("background-color:#AABBCC");
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
