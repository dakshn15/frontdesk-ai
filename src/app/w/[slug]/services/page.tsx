import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { listServices, type Service } from "@/features/services/queries";
import { requireManager } from "@/lib/auth/session";
import { formatDuration } from "@/lib/duration";
import { formatPrice } from "@/lib/money";
import { DeleteServiceButton } from "./delete-service-button";
import { ServiceDialog } from "./service-dialog";

export const metadata: Metadata = { title: "Services" };

/** Groups by category, keeping the query's order, with uncategorised services last. */
function byCategory(services: Service[]): [string, Service[]][] {
  const groups = new Map<string, Service[]>();
  for (const service of services) {
    const list = groups.get(service.category) ?? [];
    list.push(service);
    groups.set(service.category, list);
  }
  return [...groups].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0));
}

export default async function ServicesPage({
  params,
}: PageProps<"/w/[slug]/services">) {
  const { slug } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  const services = await listServices(claims, workspace.id);
  const categories = [
    ...new Set(services.map((s) => s.category).filter(Boolean)),
  ];
  const dialogProps = {
    slug: workspace.slug,
    currency: workspace.currency,
    categories,
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Services
        </h1>
        <ServiceDialog {...dialogProps} />
      </div>

      {services.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No services yet. Add the first one your customers can book.
        </p>
      ) : (
        <div className="mt-8 grid gap-8">
          {byCategory(services).map(([category, group]) => (
            <section key={category || "other"} aria-label={category || "Other"}>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {category || "Other"}
              </h2>
              <ul className="divide-y rounded-xl border">
                {group.map((service) => (
                  <li
                    key={service.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate font-medium">{service.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDuration(service.durationMinutes)}
                        {service.bufferMinutes > 0
                          ? ` + ${service.bufferMinutes} min buffer`
                          : ""}
                        {", "}
                        {formatPrice(
                          service.priceCents,
                          workspace.currency,
                          service.priceIsFrom,
                        )}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {service.staffCount} staff
                    </span>
                    {service.bookableOnline ? null : (
                      <Badge variant="secondary">Not bookable online</Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <ServiceDialog {...dialogProps} service={service} />
                      <DeleteServiceButton
                        slug={workspace.slug}
                        serviceId={service.id}
                        name={service.name}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
