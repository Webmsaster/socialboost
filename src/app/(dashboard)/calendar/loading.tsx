import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="mx-auto my-2 h-4 w-8" />
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-[100px] border-b border-r p-1.5">
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
