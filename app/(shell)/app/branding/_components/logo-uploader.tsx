"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadLogoAction, deleteLogoAction } from "../_lib/actions";
import { MAX_LOGO_BYTES } from "../_lib/schema";

interface LogoUploaderProps {
  currentLogoUrl: string | null;
  onUpload: (newUrl: string) => void;
  onDelete: () => void;
}

export function LogoUploader({ currentLogoUrl, onUpload, onDelete }: LogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation for fast UX feedback
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("File too large (max 2 MB).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.type !== "image/png") {
      toast.error("PNG only.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    startTransition(async () => {
      const result = await uploadLogoAction(fd);
      if (result.error) {
        toast.error(result.error);
      } else if (result.ok && result.data) {
        toast.success("Logo updated.");
        onUpload(result.data.logoUrl);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteLogoAction();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Logo removed.");
        onDelete();
      }
    });
  }

  return (
    <div className="space-y-4">
      {currentLogoUrl ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Current logo</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentLogoUrl}
            alt="Current logo"
            className="h-16 w-auto max-w-[200px] rounded border bg-white object-contain p-2"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No logo uploaded yet.</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="logo-file-input" className="cursor-pointer">
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-8 text-center transition-colors hover:border-primary hover:bg-muted/40">
            <p className="text-sm font-medium">Click to upload a PNG logo</p>
            <p className="text-xs text-muted-foreground mt-1">PNG only · max 2 MB</p>
          </div>
        </Label>
        <input
          id="logo-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/png"
          className="sr-only"
          onChange={handleFileChange}
          disabled={isPending}
        />
      </div>

      {currentLogoUrl && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          className="text-destructive hover:text-destructive"
        >
          Remove logo
        </Button>
      )}
    </div>
  );
}
