import { redirect } from "next/navigation";
import { loadBrandingForOwner } from "./_lib/load-branding";
import { BrandingEditor } from "./_components/branding-editor";

export default async function BrandingPage() {
  const state = await loadBrandingForOwner();
  if (!state) redirect("/app/unlinked");

  return (
    <div className="max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Branding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your logo and pick your primary color. Changes apply to the
          public booking page, the embeddable widget, and email templates.
        </p>
      </header>
      <BrandingEditor state={state} />
    </div>
  );
}
