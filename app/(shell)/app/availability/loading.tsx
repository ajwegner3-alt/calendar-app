import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function AvailabilityLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <section>
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </section>

      <Separator />

      <section>
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="h-32 w-full" />
      </section>

      <Separator />

      <section>
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
