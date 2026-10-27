import { formatDistanceStrict } from "date-fns";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { notFound } from "next/navigation";
import Script from "next/script";
import { DEMO_BUSINESS } from "@/features/demo/content";
import { formatClock } from "@/lib/clock";
import { formatDuration } from "@/lib/duration";
import { formatPrice } from "@/lib/money";
import { getDemoSite } from "@/privileged/demo/site";
import { AskButton, DashboardLink, OpenChatIcon } from "./salon-actions";

// The demo salon's own website: its identity is the salon's, not the app's.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-salon-display",
});
const body = Figtree({ subsets: ["latin"], variable: "--font-salon-body" });

export const metadata: Metadata = {
  title: { absolute: "Bloom Hair & Beauty, Austin" },
  description: DEMO_BUSINESS.tagline,
  robots: { index: false, follow: false },
};

const WEEKDAY = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Team initials take turns through the salon's colours.
const AVATAR = [
  "bg-[#F5C9CF] text-[#2E1A33]",
  "bg-[#E9B44C] text-[#2E1A33]",
  "bg-[#0F766E] text-white",
  "bg-[#2E1A33] text-[#F5C9CF]",
];

// The salon's own order for its price list; anything the owner adds comes after.
const CATEGORY_ORDER = ["Hair", "Colour", "Styling", "Beauty"];
const rank = (category: string) => {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

export default async function DemoSalonPage({
  params,
}: PageProps<"/demo/[slug]">) {
  const { slug } = await params;
  const site = await getDemoSite(slug);
  if (!site) notFound();
  const { workspace } = site;
  const categories = [
    ...new Set(site.services.map((service) => service.category || "Other")),
  ].sort((a, b) => rank(a) - rank(b));
  const timeLeft = formatDistanceStrict(workspace.demoExpiresAt, new Date());
  const pill =
    "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-4 focus-visible:ring-[#F5C9CF]/60 focus-visible:outline-none";

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-full bg-[#FBF3F1] font-[family-name:var(--font-salon-body)] text-[#2E1A33]`}
    >
      <header className="bg-[#2E1A33] text-[#FBF3F1]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <p className="font-[family-name:var(--font-salon-display)] text-lg font-semibold">
            Bloom Hair & Beauty
          </p>
          <nav className="flex items-center gap-1 text-sm">
            <a
              href="#services"
              className="hidden rounded-full px-3 py-1.5 hover:bg-white/10 sm:inline"
            >
              Services
            </a>
            <a
              href="#team"
              className="hidden rounded-full px-3 py-1.5 hover:bg-white/10 sm:inline"
            >
              Team
            </a>
            <a
              href="#visit"
              className="hidden rounded-full px-3 py-1.5 hover:bg-white/10 sm:inline"
            >
              Visit
            </a>
            <AskButton
              question="I'd like to book an appointment."
              className={`${pill} ml-2 bg-[#F5C9CF] text-[#2E1A33] hover:bg-white`}
            >
              Book now
            </AskButton>
          </nav>
        </div>
      </header>

      <section className="overflow-hidden bg-[#2E1A33] pb-14 text-[#FBF3F1] sm:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <h1
            aria-label="Bloom"
            className="font-[family-name:var(--font-salon-display)] text-[clamp(6rem,27vw,21rem)] leading-[0.8] font-extrabold tracking-[-0.06em] text-[#F5C9CF]"
          >
            Bloom
          </h1>
          <div className="mt-8 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-xl">
              <p className="font-[family-name:var(--font-salon-display)] text-2xl leading-snug font-medium sm:text-3xl">
                {DEMO_BUSINESS.tagline}
              </p>
              <p className="mt-3 text-[#FBF3F1]/75">
                {DEMO_BUSINESS.address}. Hair, colour, brows, lashes and bridal,
                by a team of four.
              </p>
            </div>
            <AskButton
              className={`${pill} inline-flex w-fit items-center gap-2 bg-[#0F766E] text-white hover:bg-[#0c625b]`}
            >
              <OpenChatIcon />
              Chat with {workspace.assistantName}
            </AskButton>
          </div>

          <div className="mt-12 border-t border-white/15 pt-6">
            <p className="text-sm text-[#FBF3F1]/75">
              Ask {workspace.assistantName}, our receptionist, what a customer
              would. Try a tricky one too: it says when it doesn&apos;t know.
            </p>
            <ul
              aria-label="Questions to try"
              className="mt-3 flex flex-wrap gap-2"
            >
              {[...workspace.suggestions, "Do you do hair extensions?"].map(
                (question) => (
                  <li key={question}>
                    <AskButton
                      question={question}
                      className={`${pill} border border-white/25 text-left hover:bg-white/10`}
                    >
                      {question}
                    </AskButton>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="services"
        aria-labelledby="services-title"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24"
      >
        <h2
          id="services-title"
          className="font-[family-name:var(--font-salon-display)] text-4xl font-bold tracking-tight sm:text-5xl"
        >
          Services and prices
        </h2>
        <p className="mt-3 max-w-xl text-[#5c4560]">
          Prices include a consultation. Colour prices marked &ldquo;from&rdquo;
          depend on length and thickness.
        </p>
        <div className="mt-10 grid gap-x-16 gap-y-12 md:grid-cols-2">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="font-[family-name:var(--font-salon-display)] text-xl font-semibold text-[#0F766E]">
                {category}
              </h3>
              <ul className="mt-4 grid gap-4">
                {site.services
                  .filter(
                    (service) => (service.category || "Other") === category,
                  )
                  .map((service) => (
                    <li key={service.id}>
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">{service.name}</span>
                        <span
                          aria-hidden
                          className="mb-1 flex-1 border-b-2 border-dotted border-[#2E1A33]/25"
                        />
                        <span className="font-semibold tabular-nums">
                          {formatPrice(
                            service.priceCents,
                            workspace.currency,
                            service.priceIsFrom,
                          )}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-[#5c4560]">
                        {formatDuration(service.durationMinutes)}
                        {service.description ? `. ${service.description}` : ""}
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="team" aria-labelledby="team-title" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
          <h2
            id="team-title"
            className="font-[family-name:var(--font-salon-display)] text-4xl font-bold tracking-tight sm:text-5xl"
          >
            The team
          </h2>
          <ul className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {site.staff.map((person, index) => (
              <li key={person.id}>
                <span
                  aria-hidden
                  className={`grid size-20 place-items-center rounded-full font-[family-name:var(--font-salon-display)] text-2xl font-bold ${AVATAR[index % AVATAR.length]}`}
                >
                  {initials(person.name)}
                </span>
                <p className="mt-4 text-lg font-semibold">{person.name}</p>
                <p className="text-sm text-[#0F766E]">{person.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#5c4560]">
                  {person.bio}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="visit"
        aria-labelledby="visit-title"
        className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-8 sm:py-24 md:grid-cols-2"
      >
        <div>
          <h2
            id="visit-title"
            className="font-[family-name:var(--font-salon-display)] text-4xl font-bold tracking-tight sm:text-5xl"
          >
            Visit us
          </h2>
          <p className="mt-6 text-lg">{DEMO_BUSINESS.address}</p>
          <p className="mt-1 text-[#5c4560]">{DEMO_BUSINESS.phone}</p>
          <p className="mt-6 max-w-md text-[#5c4560]">
            Free guest parking in the lot behind the salon, from Elizabeth
            Street. Step-free access throughout.
          </p>
        </div>
        <div>
          <h3 className="font-[family-name:var(--font-salon-display)] text-xl font-semibold">
            Opening hours
          </h3>
          <dl className="mt-4 divide-y divide-[#2E1A33]/10 rounded-2xl bg-white px-5">
            {WEEKDAY.slice(1).map((day, index) => {
              const open = site.hours.filter(
                (row) => row.weekday === index + 1,
              );
              return (
                <div key={day} className="flex justify-between py-3">
                  <dt className="font-medium">{day}</dt>
                  <dd
                    className={open.length ? "tabular-nums" : "text-[#5c4560]"}
                  >
                    {open.length
                      ? open
                          .map(
                            (row) =>
                              `${formatClock(row.startMinute)} to ${formatClock(row.endMinute)}`,
                          )
                          .join(", ")
                      : "Closed"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      <footer className="bg-[#2E1A33] px-4 py-10 text-center text-sm text-[#FBF3F1]/70 sm:px-8">
        Bloom Hair & Beauty is a made-up salon for the FrontDesk AI demo.
      </footer>

      <DashboardLink slug={workspace.slug} timeLeft={timeLeft} />
      <Script
        src="/embed.js"
        data-workspace={workspace.slug}
        strategy="afterInteractive"
      />
    </div>
  );
}
