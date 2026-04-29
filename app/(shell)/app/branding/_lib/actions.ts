"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  primaryColorSchema,
  MAX_LOGO_BYTES,
  backgroundColorSchema,
  backgroundShadeSchema,
} from "./schema";
import type { BackgroundShade } from "@/lib/branding/types";

export interface ActionResult<T = void> {
  ok?: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Two-stage owner authorization (mirrors Phase 6 cancelBookingAsOwner pattern):
 * 1. RLS-scoped client confirms current owner OWNS this accountId via current_owner_account_ids RPC
 * 2. Service-role admin client performs Storage upload + accounts UPDATE
 */
async function getOwnerAccountIdOrThrow(): Promise<string> {
  const supabase = await createClient();
  const { data: ids } = await supabase.rpc("current_owner_account_ids");
  const arr = Array.isArray(ids) ? ids : [];
  if (arr.length === 0) throw new Error("Not linked to any account.");
  return arr[0];
}

export async function uploadLogoAction(
  formData: FormData,
): Promise<ActionResult<{ logoUrl: string }>> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) return { error: "No file provided." };
    if (file.size > MAX_LOGO_BYTES) return { error: "File too large (max 2 MB)." };

    // file.type is the browser-reported MIME (spoofable: a renamed JPEG
    // can carry Content-Type: image/png). Reject on MIME mismatch first
    // for fast UX, then verify magic bytes from the actual file buffer.
    if (file.type !== "image/png") return { error: "PNG only." };

    // Magic-byte validation: read first 4 bytes, must equal PNG magic
    // [0x89, 0x50, 0x4E, 0x47]. This is the security check that catches
    // a renamed JPEG (or any non-PNG) that bypassed the client-side
    // accept="image/png" filter and the file.type sniff.
    const headBuf = await file.slice(0, 4).arrayBuffer();
    const head = new Uint8Array(headBuf);
    const isPng =
      head.length === 4 &&
      head[0] === 0x89 &&
      head[1] === 0x50 &&
      head[2] === 0x4e &&
      head[3] === 0x47;
    if (!isPng) return { error: "PNG only." };

    const accountId = await getOwnerAccountIdOrThrow();

    const admin = createAdminClient();
    const path = `${accountId}/logo.png`;

    const { error: uploadError } = await admin.storage
      .from("branding")
      .upload(path, file, {
        contentType: "image/png",
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

    // Cache-bust: append ?v={timestamp} so Gmail/CDN cache misses on the new URL.
    // Public URLs don't change on upsert, so we add a query param the DB stores.
    const { data: urlData } = admin.storage.from("branding").getPublicUrl(path);
    const versionedUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await admin
      .from("accounts")
      .update({ logo_url: versionedUrl })
      .eq("id", accountId);

    if (updateError) return { error: `DB update failed: ${updateError.message}` };

    revalidatePath("/app/branding");
    return { ok: true, data: { logoUrl: versionedUrl } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function savePrimaryColorAction(hex: string): Promise<ActionResult> {
  const parsed = primaryColorSchema.safeParse(hex);
  if (!parsed.success) {
    return { fieldErrors: { primaryColor: parsed.error.issues.map((i) => i.message) } };
  }

  try {
    const accountId = await getOwnerAccountIdOrThrow();
    const admin = createAdminClient();
    const { error } = await admin
      .from("accounts")
      .update({ brand_primary: parsed.data })
      .eq("id", accountId);

    if (error) return { error: `DB update failed: ${error.message}` };

    revalidatePath("/app/branding");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function deleteLogoAction(): Promise<ActionResult> {
  try {
    const accountId = await getOwnerAccountIdOrThrow();
    const admin = createAdminClient();
    // Best-effort delete from Storage (ignore not-found); always clear DB column.
    await admin.storage.from("branding").remove([`${accountId}/logo.png`]);
    const { error } = await admin
      .from("accounts")
      .update({ logo_url: null })
      .eq("id", accountId);
    if (error) return { error: `DB update failed: ${error.message}` };
    revalidatePath("/app/branding");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/**
 * Phase 12: persist background_color + background_shade to the owner's account.
 *
 * Defensive: empty string backgroundColor is treated as null (clears the column).
 * Validates both fields via Zod before writing.
 */
export async function saveBrandingAction(payload: {
  backgroundColor: string | null;
  backgroundShade: BackgroundShade;
}): Promise<ActionResult> {
  // Treat empty string as null (owner cleared the field)
  const rawColor =
    payload.backgroundColor === "" ? null : payload.backgroundColor;

  const colorResult = backgroundColorSchema.safeParse(rawColor);
  if (!colorResult.success) {
    return {
      fieldErrors: {
        backgroundColor: colorResult.error.issues.map((i) => i.message),
      },
    };
  }

  const shadeResult = backgroundShadeSchema.safeParse(payload.backgroundShade);
  if (!shadeResult.success) {
    return {
      fieldErrors: {
        backgroundShade: shadeResult.error.issues.map((i) => i.message),
      },
    };
  }

  try {
    const accountId = await getOwnerAccountIdOrThrow();
    const admin = createAdminClient();
    const { error } = await admin
      .from("accounts")
      .update({
        background_color: colorResult.data ?? null,
        background_shade: shadeResult.data,
      })
      .eq("id", accountId);

    if (error) return { error: `DB update failed: ${error.message}` };

    revalidatePath("/app/branding");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
