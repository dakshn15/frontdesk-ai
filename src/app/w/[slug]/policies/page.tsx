import type { Metadata } from "next";
import { Separator } from "@/components/ui/separator";
import { listPolicies } from "@/features/policies/queries";
import { POLICY_KINDS } from "@/features/policies/schemas";
import { requireManager } from "@/lib/auth/session";
import { CustomPolicies, CustomPolicyDialog } from "./custom-policies";
import { PolicyCard } from "./policy-card";

export const metadata: Metadata = { title: "Policies" };

export default async function PoliciesPage({
  params,
}: PageProps<"/w/[slug]/policies">) {
  const { slug } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  const policies = await listPolicies(claims, workspace.id);
  const custom = policies.filter((policy) => policy.kind === "custom");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Policies
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Short answers the receptionist quotes word for word. Leave any that
        don&apos;t apply empty.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {POLICY_KINDS.map(({ kind, title, placeholder }) => {
          const saved = policies.find((policy) => policy.kind === kind);
          return (
            <PolicyCard
              key={kind}
              slug={workspace.slug}
              kind={kind}
              title={title}
              placeholder={placeholder}
              policy={saved ? { id: saved.id, body: saved.body } : undefined}
            />
          );
        })}
      </div>

      <Separator className="my-10" />

      <section aria-labelledby="custom-policies">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="custom-policies" className="text-lg font-semibold">
            Custom policies
          </h2>
          <CustomPolicyDialog slug={workspace.slug} />
        </div>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Anything else customers ask about, like children or pets.
        </p>
        <CustomPolicies slug={workspace.slug} policies={custom} />
      </section>
    </div>
  );
}
