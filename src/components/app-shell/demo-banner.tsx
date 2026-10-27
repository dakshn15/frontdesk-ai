import { formatDistanceStrict } from "date-fns";
import Link from "next/link";

/** Across the top of a demo sandbox: what it is, when it goes, and the way back. */
export function DemoBanner({
  slug,
  expiresAt,
}: {
  slug: string;
  expiresAt: Date;
}) {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-primary/10 px-4 py-2 text-sm"
    >
      <p>
        This is your private demo copy of the salon. It&apos;s deleted in{" "}
        {formatDistanceStrict(expiresAt, new Date())}, and its emails go to{" "}
        <Link href={`/w/${slug}/emails`} className="font-medium underline">
          Emails
        </Link>{" "}
        instead of real inboxes.
      </p>
      {/* A full page load, so the salon's chat starts fresh on its own page. */}
      <a href={`/demo/${slug}`} className="font-medium underline">
        Back to the salon website
      </a>
    </div>
  );
}
