import type { Metadata } from "next";
import { listStaff } from "@/features/staff/queries";
import { requireManager } from "@/lib/auth/session";
import { AddStaffDialog } from "./add-staff-dialog";
import { StaffList } from "./staff-list";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage({
  params,
}: PageProps<"/w/[slug]/staff">) {
  const { slug } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  const staff = await listStaff(claims, workspace.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Staff
        </h1>
        <AddStaffDialog slug={workspace.slug} />
      </div>

      {staff.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No staff yet. Add the people customers can book with.
        </p>
      ) : (
        <StaffList slug={workspace.slug} staff={staff} />
      )}
    </div>
  );
}
