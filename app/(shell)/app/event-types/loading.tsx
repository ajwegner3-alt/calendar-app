import { Skeleton } from "@/components/ui/skeleton";

export default function EventTypesLoading() {
  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="border-b bg-muted/40 h-10" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-b last:border-b-0 grid grid-cols-5 gap-4 px-4 py-3"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-6 w-6 ml-auto rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
