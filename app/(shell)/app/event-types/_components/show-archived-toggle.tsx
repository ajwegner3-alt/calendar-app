"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ShowArchivedToggle({
  defaultChecked,
}: {
  defaultChecked: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("archived", "true");
    else params.delete("archived");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="show-archived"
        checked={defaultChecked}
        onCheckedChange={handleChange}
      />
      <Label htmlFor="show-archived" className="text-sm font-normal cursor-pointer">
        Show archived
      </Label>
    </div>
  );
}
