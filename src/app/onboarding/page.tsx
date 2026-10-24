import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { listMyWorkspaces } from "@/features/workspaces/queries";
import { requireUser } from "@/lib/auth/session";
import { currencyOptions, timeZoneOptions } from "@/lib/locale-options";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const claims = await requireUser("/onboarding");
  const workspaces = await listMyWorkspaces(claims);
  return (
    <AuthShell
      title="Set up your business"
      description="This is what your receptionist will use. You can change it later."
    >
      <WorkspaceForm
        timeZones={timeZoneOptions()}
        currencies={currencyOptions()}
      />
      {workspaces.length > 0 ? (
        <p className="mt-6 text-sm">
          <Link href="/dashboard" className="font-medium text-primary">
            Back to dashboard
          </Link>
        </p>
      ) : null}
    </AuthShell>
  );
}
