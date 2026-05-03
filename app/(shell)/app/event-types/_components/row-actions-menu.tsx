"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  toggleActiveAction,
  restoreEventTypeAction,
} from "../_lib/actions";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { RestoreCollisionDialog } from "./restore-collision-dialog";
import { EmbedCodeDialog } from "./embed-code-dialog";

export function RowActionsMenu({
  id,
  name,
  slug,
  isActive,
  isArchived,
  accountSlug,
  appUrl,
}: {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isArchived: boolean;
  accountSlug: string;
  appUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [collisionOpen, setCollisionOpen] = useState(false);
  const [collisionSlug, setCollisionSlug] = useState<string | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);

  async function handleToggle() {
    startTransition(async () => {
      const result = await toggleActiveAction(id, !isActive);
      if (result.formError) {
        toast.error(result.formError);
      } else {
        toast.success(isActive ? "Set to inactive." : "Set to active.");
        router.refresh();
      }
    });
  }

  async function handleRestore() {
    startTransition(async () => {
      const result = await restoreEventTypeAction(id);
      if ("ok" in result) {
        toast.success("Restored as inactive.");
        router.refresh();
      } else if ("slugCollision" in result) {
        setCollisionSlug(result.currentSlug);
        setCollisionOpen(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${name}`}
            disabled={isPending}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isArchived && (
            <>
              <DropdownMenuItem
                asChild
                className="focus:bg-primary focus:text-primary-foreground"
              >
                <Link href={`/app/event-types/${id}/edit`}>Edit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleToggle}
                className="focus:bg-primary focus:text-primary-foreground"
              >
                {isActive ? "Make inactive" : "Make active"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setEmbedOpen(true);
                }}
                className="focus:bg-primary focus:text-primary-foreground"
              >
                Get embed code
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setArchiveOpen(true);
                }}
                className="text-destructive focus:text-destructive"
              >
                Archive
              </DropdownMenuItem>
            </>
          )}
          {isArchived && (
            <DropdownMenuItem
              onSelect={handleRestore}
              className="focus:bg-primary focus:text-primary-foreground"
            >
              Restore
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        eventTypeId={id}
        eventTypeName={name}
      />

      {collisionSlug && (
        <RestoreCollisionDialog
          open={collisionOpen}
          onOpenChange={setCollisionOpen}
          eventTypeId={id}
          originalSlug={collisionSlug}
        />
      )}

      <EmbedCodeDialog
        open={embedOpen}
        onOpenChange={setEmbedOpen}
        appUrl={appUrl}
        accountSlug={accountSlug}
        eventSlug={slug}
        eventName={name}
      />
    </>
  );
}
