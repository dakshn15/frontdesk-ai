import { formatDistanceStrict } from "date-fns";
import type { Metadata } from "next";
import { Figtree, Young_Serif } from "next/font/google";
import Image from "next/image";
import { notFound } from "next/navigation";
import Script from "next/script";
import {
  DEMO_BUSINESS,
  DEMO_LOOKS,
  DEMO_REVIEWS,
  DEMO_STORY,
} from "@/features/demo/content";
import { formatClock } from "@/lib/clock";
import { formatDuration } from "@/lib/duration";
import { formatPrice } from "@/lib/money";
import { getDemoSite } from "@/privileged/demo/site";
import "./salon.css";
import { AskButton, DashboardLink, OpenChatIcon } from "./salon-actions";
import { StreetMap } from "./street-map";
import { Swatch } from "./swatch";

// The demo salon's own website: its identity is the salon's, not the app's. Plum ink on a
// pink-white paper, with agave green and marigold from the colour swatches it's built around.
const display = Young_Serif({
  weight: "400",
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

// Team arches take turns through the salon's colours: behind a portrait while it loads, or
// with initials for anyone the owner adds who has no photo here.
const PORTRAIT = [
  "bg-[#F4C6D0] text-[#2A1430]",
  "bg-[#1F5C4F] text-[#F4C6D0]",
  "bg-[#E8A93A] text-[#2A1430]",
  "bg-[#2A1430] text-[#E8A93A]",
];

// Stock portraits of models standing in for the made-up team, matched by name. All are
// cropped to 4:5 with the same light grade so they read as one team.
const TEAM_PHOTOS: Record<string, { src: string; alt: string }> = {
  "Maya Torres": {
    src: "/demo/team-maya.jpg",
    alt: "Maya, smiling, with long auburn hair and freckles, resting her chin on her folded arms.",
  },
  "Jordan Lee": {
    src: "/demo/team-jordan.jpg",
    alt: "Jordan, in a light denim shirt, sitting at a table with hands folded.",
  },
  "Priya Nair": {
    src: "/demo/team-priya.jpg",
    alt: "Priya, laughing, with big dark curls and a floral dress.",
  },
  "Sofia Alvarez": {
    src: "/demo/team-sofia.jpg",
    alt: "Sofia, smiling, with long dark curls, leaning on a wooden table.",
  },
};

// Free photos under the Unsplash License, saved in public/demo (sources in CREDITS.md there).
// On phones the grid is two columns; from md up the two portraits run the full height.
const GALLERY = [
  {
    src: "/demo/look-colour.jpg",
    alt: "Long, lived-in brunette hair with golden lengths, seen from behind against a pink wall.",
    caption: "Lived-in colour",
    layout: "col-span-2 aspect-[3/2] md:aspect-auto",
    sizes: "(min-width: 768px) 50vw, 100vw",
  },
  {
    src: "/demo/look-makeup.jpg",
    alt: "A makeup artist brushing blush onto a bride with her hair swept back.",
    caption: "Bridal makeup",
    layout: "aspect-[2/3] md:row-span-2 md:aspect-auto",
    sizes: "(min-width: 768px) 25vw, 50vw",
  },
  {
    src: "/demo/look-brows.jpg",
    alt: "Close-up of eyebrows being shaped with tweezers.",
    caption: "Brow shaping",
    layout: "aspect-[2/3] md:row-span-2 md:aspect-auto",
    sizes: "(min-width: 768px) 25vw, 50vw",
  },
  {
    src: "/demo/look-wash.jpg",
    alt: "A client leaning back at the basin while a stylist rinses her hair.",
    caption: "The wash",
    layout: "aspect-[3/2] md:aspect-auto",
    sizes: "(min-width: 768px) 25vw, 50vw",
  },
  {
    src: "/demo/look-chairs.jpg",
    alt: "Three plum salon chairs in front of a long white counter and mirror.",
    caption: "Our chairs",
    layout: "aspect-[3/2] md:aspect-auto",
    sizes: "(min-width: 768px) 25vw, 50vw",
  },
];

const PHOTO_CREDITS = [
  "Baylee Gramling",
  "Courtney Spittle",
  "Alexander Mass",
  "Alexander Aguero",
  "Juan Encalada",
  "Sohaim Siddiquee",
  "Nolan Manning",
  "Element5 Digital",
  "Lindsay Cash",
  "Guilherme Petri",
  "Stefan Vibes",
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

const serif = "font-[family-name:var(--font-salon-display)] font-normal";
const ring =
  "focus-visible:ring-4 focus-visible:ring-[#E8A93A] focus-visible:outline-none";
const button = `inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 font-semibold transition-colors ${ring}`;
const sectionTitle = `${serif} text-4xl leading-tight tracking-[-0.01em] sm:text-5xl`;

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
  const [leadReview, ...moreReviews] = DEMO_REVIEWS;

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-full overflow-x-clip bg-[#FFF6F7] font-[family-name:var(--font-salon-body)] text-[#2A1430]`}
    >
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <a
          href="#top"
          className={`${serif} -mx-1 inline-flex min-h-11 items-center rounded-md px-1 text-xl ${ring}`}
        >
          Bloom
        </a>
        <nav aria-label="Salon" className="flex items-center gap-1">
          {[
            ["#services", "Services"],
            ["#team", "Team"],
            ["#visit", "Visit"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={`hidden min-h-11 items-center rounded-full px-4 font-medium hover:bg-[#F4C6D0]/60 sm:inline-flex ${ring}`}
            >
              {label}
            </a>
          ))}
          <AskButton
            question="I'd like to book an appointment."
            className={`${button} ml-1 bg-[#2A1430] text-sm text-[#FFF6F7] hover:bg-[#45233F]`}
          >
            Book now
          </AskButton>
        </nav>
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-6 pb-14 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pt-10 lg:pb-20">
          <div>
            <h1
              className={`${serif} text-[clamp(6rem,30vw,13.5rem)] leading-[0.82] tracking-[-0.04em]`}
            >
              Bloom
            </h1>
            <p className="mt-4 text-lg font-semibold text-[#1F5C4F] sm:text-xl">
              Hair &amp; Beauty, South Congress, Austin
            </p>
            <p className="mt-6 max-w-lg text-xl leading-relaxed sm:text-2xl">
              {DEMO_BUSINESS.tagline} Precision cuts, lived-in colour, curls,
              brows and bridal, from a team of four who never rush.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <AskButton
                question="I'd like to book an appointment."
                className={`${button} bg-[#2A1430] text-[#FFF6F7] hover:bg-[#45233F]`}
              >
                Book an appointment
              </AskButton>
              <AskButton
                className={`${button} border-2 border-[#1F5C4F] text-[#1F5C4F] hover:bg-[#1F5C4F] hover:text-white`}
              >
                <OpenChatIcon />
                Chat with {workspace.assistantName}
              </AskButton>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xs sm:max-w-sm lg:max-w-md">
            <div className="bloom-arch relative aspect-[4/5] overflow-hidden bg-[#1F5C4F]">
              <Image
                src="/demo/hero-curls.jpg"
                alt="A stylist curling a client's long brown hair with a curling iron."
                fill
                priority
                sizes="(min-width: 1024px) 28rem, (min-width: 640px) 24rem, 20rem"
                className="object-cover object-[50%_30%]"
              />
            </div>
            <div className="bloom-arch absolute -bottom-8 -left-3 aspect-[4/5] w-32 overflow-hidden bg-[#E4D3DB] ring-[6px] ring-[#FFF6F7] sm:-left-10 sm:w-40">
              <Image
                src="/demo/swatch-ring.jpg"
                alt="A ring of hair colour swatches, from blonde to dark brown, beside a pair of scissors."
                fill
                sizes="10rem"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="ask-title"
          className="bg-[#2A1430] text-[#FFF6F7]"
        >
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-12">
            <div>
              <h2 id="ask-title" className={`${serif} text-2xl sm:text-3xl`}>
                Ask {workspace.assistantName} anything
              </h2>
              <p className="mt-2 max-w-md text-[#FFF6F7]/80">
                {workspace.assistantName} answers our chat day and night. Ask
                what a customer would, or try a tricky one:{" "}
                {workspace.assistantName} says so when it doesn&apos;t know.
              </p>
            </div>
            <ul aria-label="Questions to try" className="flex flex-wrap gap-2">
              {[...workspace.suggestions, "Do you do hair extensions?"].map(
                (question) => (
                  <li key={question}>
                    <AskButton
                      question={question}
                      className={`inline-flex min-h-11 items-center rounded-full border border-[#F4C6D0]/40 px-4 py-2 text-left text-[0.95rem] hover:border-[#F4C6D0] hover:bg-[#F4C6D0] hover:text-[#2A1430] ${ring}`}
                    >
                      {question}
                    </AskButton>
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="story-title"
          className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-8 sm:py-24 md:grid-cols-[0.85fr_1.15fr] md:gap-16"
        >
          <div className="md:order-last">
            <h2 id="story-title" className={sectionTitle}>
              A small salon that takes its time
            </h2>
            <div className="mt-6 grid max-w-prose gap-5 text-lg leading-[1.7]">
              {DEMO_STORY.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <figure className="mt-10 border-l-4 border-[#E8A93A] pl-6">
              <blockquote
                className={`${serif} text-2xl leading-snug text-[#1F5C4F] sm:text-[1.7rem]`}
              >
                &ldquo;{DEMO_STORY.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-3 text-[#6B4A62]">
                {DEMO_STORY.quoteBy}
              </figcaption>
            </figure>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] bg-[#E4D3DB]">
            <Image
              src="/demo/story-updo.jpg"
              alt="A stylist pinning a client's hair into an updo in a bright salon with an arched mirror."
              fill
              sizes="(min-width: 1152px) 28rem, (min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
        </section>

        <section
          id="services"
          aria-labelledby="services-title"
          className="scroll-mt-4 bg-white"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 id="services-title" className={sectionTitle}>
                  Services and prices
                </h2>
                <p className="mt-3 max-w-xl text-[#6B4A62]">
                  Every appointment starts with a consultation. Prices marked
                  &ldquo;from&rdquo; depend on the length and thickness of your
                  hair.
                </p>
              </div>
              <AskButton
                question="Which service is right for me?"
                className={`${button} border-2 border-[#2A1430] hover:bg-[#2A1430] hover:text-[#FFF6F7]`}
              >
                Not sure? Ask {workspace.assistantName}
              </AskButton>
            </div>
            <div className="mt-12 grid gap-x-16 gap-y-14 md:grid-cols-2">
              {categories.map((category) => (
                <div key={category}>
                  <h3
                    className={`${serif} border-b-2 border-[#2A1430] pb-2 text-2xl text-[#1F5C4F]`}
                  >
                    {category}
                  </h3>
                  <ul className="divide-y divide-[#2A1430]/10">
                    {site.services
                      .filter(
                        (service) => (service.category || "Other") === category,
                      )
                      .map((service) => (
                        <li key={service.id} className="py-4">
                          <div className="flex items-baseline justify-between gap-4">
                            <span className="text-lg font-semibold">
                              {service.name}
                            </span>
                            <span className="shrink-0 text-lg font-semibold tabular-nums">
                              {formatPrice(
                                service.priceCents,
                                workspace.currency,
                                service.priceIsFrom,
                              )}
                            </span>
                          </div>
                          <p className="mt-1 text-[0.95rem] leading-relaxed text-[#6B4A62]">
                            {formatDuration(service.durationMinutes)}
                            {service.description
                              ? `. ${service.description}`
                              : ""}
                          </p>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="looks-title"
          className="bg-[#2A1430] text-[#FFF6F7]"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
            <h2 id="looks-title" className={sectionTitle}>
              The colour book
            </h2>
            <p className="mt-3 max-w-xl text-[#FFF6F7]/80">
              Swatches of colours Jordan has mixed for guests in the past few
              months. Bring a photo of the one you like to your consultation.
            </p>
            <div className="relative mt-12">
              <span
                aria-hidden
                className="absolute inset-x-0 top-1 h-1.5 rounded-full bg-[#E8A93A]"
              />
              <ul className="relative grid grid-cols-4 gap-x-3 gap-y-10 sm:grid-cols-7 sm:gap-x-5">
                {DEMO_LOOKS.map((look, index) => (
                  <li key={look.name} className="text-center">
                    <Swatch
                      id={`book-${index}`}
                      stops={look.stops}
                      className="mx-auto h-40 w-auto sm:h-52"
                    />
                    <p className="mt-3 font-semibold">{look.name}</p>
                    <p className="text-sm text-[#FFF6F7]/75">{look.visit}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          id="team"
          aria-labelledby="team-title"
          className="mx-auto max-w-6xl scroll-mt-4 px-4 py-16 sm:px-8 sm:py-24"
        >
          <h2 id="team-title" className={sectionTitle}>
            The team
          </h2>
          <ul className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {site.staff.map((person, index) => (
              <li
                key={person.id}
                className="grid grid-cols-[6.5rem_1fr] items-start gap-x-5 sm:block lg:even:mt-16"
              >
                {TEAM_PHOTOS[person.name] ? (
                  <div
                    className={`bloom-arch relative aspect-[4/5] max-w-64 overflow-hidden ${PORTRAIT[index % PORTRAIT.length]}`}
                  >
                    <Image
                      src={TEAM_PHOTOS[person.name].src}
                      alt={TEAM_PHOTOS[person.name].alt}
                      fill
                      sizes="(min-width: 1024px) 16rem, (min-width: 640px) 40vw, 6.5rem"
                      className="object-cover object-top"
                    />
                  </div>
                ) : (
                  <div
                    aria-hidden
                    className={`bloom-arch ${serif} grid aspect-[4/5] max-w-64 place-items-center text-4xl sm:text-7xl ${PORTRAIT[index % PORTRAIT.length]}`}
                  >
                    {initials(person.name)}
                  </div>
                )}
                <div>
                  <p className={`${serif} text-2xl sm:mt-5`}>{person.name}</p>
                  <p className="font-semibold text-[#1F5C4F]">{person.title}</p>
                  {person.bio ? (
                    <p className="mt-2 leading-relaxed text-[#6B4A62]">
                      {person.bio}
                    </p>
                  ) : null}
                  <AskButton
                    question={`I'd like to book with ${person.name}.`}
                    className={`-ml-1 mt-2 inline-flex min-h-11 items-center rounded-md px-1 font-semibold text-[#2A1430] underline decoration-[#E8A93A] decoration-2 underline-offset-4 hover:decoration-[#2A1430] ${ring}`}
                  >
                    Book with {person.name.split(" ")[0]}
                  </AskButton>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="salon-title"
          className="mx-auto max-w-6xl px-4 pb-16 sm:px-8 sm:pb-24"
        >
          <h2 id="salon-title" className={sectionTitle}>
            In the salon
          </h2>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:h-[38rem] md:grid-cols-4 md:grid-rows-2">
            {GALLERY.map((photo) => (
              <li
                key={photo.src}
                className={`relative overflow-hidden rounded-2xl bg-[#E4D3DB] ${photo.layout}`}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes={photo.sizes}
                  className="object-cover"
                />
                <span className="absolute bottom-2.5 left-2.5 rounded-full bg-[#FFF6F7] px-3 py-1 text-sm font-semibold">
                  {photo.caption}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="reviews-title" className="bg-[#F4C6D0]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
            <h2 id="reviews-title" className={sectionTitle}>
              What guests say
            </h2>
            <div className="mt-12 grid gap-12 md:grid-cols-[1.25fr_1fr] md:gap-16">
              <figure>
                <blockquote
                  className={`${serif} text-3xl leading-snug sm:text-4xl`}
                >
                  &ldquo;{leadReview.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5">
                  <span className="font-semibold">{leadReview.name}</span>
                  <span className="block text-[#5A3A52]">
                    {leadReview.visit}
                  </span>
                </figcaption>
              </figure>
              <ul className="divide-y divide-[#2A1430]/20 border-y border-[#2A1430]/20">
                {moreReviews.map((review) => (
                  <li key={review.name} className="py-6">
                    <figure>
                      <blockquote className="text-lg leading-relaxed">
                        &ldquo;{review.quote}&rdquo;
                      </blockquote>
                      <figcaption className="mt-3 text-[0.95rem]">
                        <span className="font-semibold">{review.name}</span>,{" "}
                        <span className="text-[#5A3A52]">{review.visit}</span>
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          id="visit"
          aria-labelledby="visit-title"
          className="mx-auto grid max-w-6xl scroll-mt-4 gap-12 px-4 py-16 sm:px-8 sm:py-24 md:grid-cols-[1.1fr_1fr] md:gap-16"
        >
          <div>
            <h2 id="visit-title" className={sectionTitle}>
              Visit us
            </h2>
            <address className="mt-6 text-xl leading-relaxed not-italic">
              {DEMO_BUSINESS.address}
              <br />
              <a
                href={`tel:${DEMO_BUSINESS.phone.replace(/\D/g, "")}`}
                className={`-ml-1 inline-flex min-h-11 items-center rounded-md px-1 font-semibold underline decoration-[#E8A93A] decoration-2 underline-offset-4 ${ring}`}
              >
                {DEMO_BUSINESS.phone}
              </a>
            </address>
            <p className="mt-4 max-w-md leading-relaxed text-[#6B4A62]">
              Free guest parking in the lot behind the salon, entered from
              Elizabeth Street. Street parking on South Congress is metered. The
              salon is on the ground floor, with step-free access.
            </p>
            <div className="mt-8 overflow-hidden rounded-2xl border-2 border-[#2A1430]">
              <StreetMap />
            </div>
          </div>
          <div>
            <h3 className={`${serif} text-2xl`}>Opening hours</h3>
            <dl className="mt-4 border-t-2 border-[#2A1430]">
              {WEEKDAY.slice(1).map((day, index) => {
                const open = site.hours.filter(
                  (row) => row.weekday === index + 1,
                );
                return (
                  <div
                    key={day}
                    className="flex justify-between gap-4 border-b border-[#2A1430]/15 py-3.5 text-lg"
                  >
                    <dt className="font-semibold">{day}</dt>
                    <dd
                      className={
                        open.length ? "tabular-nums" : "text-[#6B4A62]"
                      }
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
            <p className="mt-4 leading-relaxed text-[#6B4A62]">
              Closed on public holidays. Cancel or move an appointment at least
              24 hours ahead at no charge.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="book-title"
          className="bg-[#1F5C4F] text-white"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-8 px-4 py-16 sm:px-8 sm:py-20">
            <div className="max-w-xl">
              <h2 id="book-title" className={sectionTitle}>
                Book in a couple of minutes
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-white/85">
                Tell {workspace.assistantName} what you&apos;d like and when.{" "}
                {workspace.assistantName} checks the diary, offers real times
                and books you in, any hour of the day.
              </p>
            </div>
            <AskButton
              question="I'd like to book an appointment."
              className={`${button} bg-[#F4C6D0] text-lg text-[#2A1430] hover:bg-white`}
            >
              <OpenChatIcon />
              Book with {workspace.assistantName}
            </AskButton>
          </div>
        </section>
      </main>

      <footer className="bg-[#2A1430] text-[#FFF6F7]/80">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-6 px-4 pt-12 pb-36 sm:px-8 sm:pb-28">
          <div>
            <p className={`${serif} text-3xl text-[#FFF6F7]`}>Bloom</p>
            <p className="mt-1">{DEMO_BUSINESS.address}</p>
          </div>
          <div className="max-w-sm self-end text-sm leading-relaxed">
            <p>
              Bloom Hair &amp; Beauty is a made-up salon for the FrontDesk AI
              demo.
            </p>
            <p className="mt-2">
              The team photos show models, not real staff. Photos from Unsplash
              by {PHOTO_CREDITS.join(", ")}.
            </p>
          </div>
        </div>
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
