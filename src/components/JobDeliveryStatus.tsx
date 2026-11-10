import { Badge } from "@/components/ui/badge";

export interface JobDeliveryFields {
  delivery_status?: "pending" | "processing" | "sent" | "failed";
  attempt_count?: number;
  next_attempt_at?: string | null;
  last_error?: string | null;
}

export function JobDeliveryStatus({ job }: { job: JobDeliveryFields }) {
  const status = job.delivery_status || "pending";
  const attempts = job.attempt_count || 0;
  const label =
    status === "failed"
      ? "Fejlet"
      : status === "processing"
        ? "Behandles"
        : status === "sent"
          ? "Udført"
          : attempts > 0
            ? `Prøver igen (${attempts}/5 forsøg)`
            : "Afventer";
  return (
    <div className="space-y-1" aria-live="polite">
      <Badge variant={status === "failed" ? "destructive" : "outline"}>
        {label}
      </Badge>
      {job.last_error && (
        <p className="text-xs text-destructive break-words">{job.last_error}</p>
      )}
      {status === "failed" && (
        <p className="text-xs text-muted-foreground">
          Ret årsagen, kontrollér resultatet i Discord, og opret opgaven igen.
          Denne opgave gentages ikke automatisk.
        </p>
      )}
      {status === "pending" && attempts > 0 && job.next_attempt_at && (
        <p className="text-xs text-muted-foreground">
          Næste forsøg: {new Date(job.next_attempt_at).toLocaleString("da-DK")}
        </p>
      )}
    </div>
  );
}
