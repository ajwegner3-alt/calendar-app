"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Compact range computation:
// - <= 7 pages: show all
// - >  7 pages: show 1, 2, ..., current-1, current, current+1, ..., N-1, N
//   with a "..." sentinel where ranges collapse.
type Token = number | "ellipsis-left" | "ellipsis-right";

function buildRange(current: number, total: number): Token[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const tokens: Token[] = [];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  tokens.push(1);
  if (left > 2) tokens.push("ellipsis-left");
  for (let p = left; p <= right; p++) tokens.push(p);
  if (right < total - 1) tokens.push("ellipsis-right");
  tokens.push(total);

  return tokens;
}

export function BookingsPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Preserve current filter searchParams when constructing page links.
  function hrefForPage(target: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  if (totalPages <= 1) return null;

  const tokens = buildRange(page, totalPages);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav
      aria-label="Bookings pagination"
      className="flex items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <Button
          asChild={!prevDisabled}
          variant="ghost"
          size="sm"
          disabled={prevDisabled}
          aria-label="Previous page"
        >
          {prevDisabled ? (
            <span>
              <ChevronLeft className="size-4" />
              Prev
            </span>
          ) : (
            <Link href={hrefForPage(page - 1)}>
              <ChevronLeft className="size-4" />
              Prev
            </Link>
          )}
        </Button>

        {tokens.map((tok, idx) => {
          if (tok === "ellipsis-left" || tok === "ellipsis-right") {
            return (
              <span
                key={`${tok}-${idx}`}
                className="px-2 text-sm text-muted-foreground"
                aria-hidden="true"
              >
                &hellip;
              </span>
            );
          }
          const isCurrent = tok === page;
          return (
            <Button
              key={tok}
              asChild={!isCurrent}
              variant={isCurrent ? "default" : "ghost"}
              size="sm"
              aria-current={isCurrent ? "page" : undefined}
              className={cn("min-w-9", isCurrent && "pointer-events-none")}
            >
              {isCurrent ? (
                <span>{tok}</span>
              ) : (
                <Link href={hrefForPage(tok)}>{tok}</Link>
              )}
            </Button>
          );
        })}

        <Button
          asChild={!nextDisabled}
          variant="ghost"
          size="sm"
          disabled={nextDisabled}
          aria-label="Next page"
        >
          {nextDisabled ? (
            <span>
              Next
              <ChevronRight className="size-4" />
            </span>
          ) : (
            <Link href={hrefForPage(page + 1)}>
              Next
              <ChevronRight className="size-4" />
            </Link>
          )}
        </Button>
      </div>
    </nav>
  );
}
