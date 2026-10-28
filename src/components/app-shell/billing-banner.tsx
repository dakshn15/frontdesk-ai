import Link from "next/link";

/** Across the top when the receptionist has stopped answering website chats. */
export function BillingBanner({
  slug,
  reason,
}: {
  slug: string;
  reason: "trial_ended" | "limit";
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-destructive/10 px-4 py-2 text-sm"
    >
      <p>
        {reason === "trial_ended"
          ? "Your trial has ended, so your receptionist is offering visitors the contact form instead of answering. Nothing has been deleted."
          : "You've reached this month's chat limit, so your receptionist is offering visitors the contact form instead of answering."}
      </p>
      <Link href={`/w/${slug}/billing`} className="font-medium underline">
        Choose a plan
      </Link>
    </div>
  );
}
