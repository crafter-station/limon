import { generateRestaurant } from "./actions";

const sampleMapsUrl =
  "https://www.google.com/maps/place/Cevicheria+%22Las+Palmeras%22/@-6.0546499,-77.2167419,13z/data=!4m6!3m5!1s0x91b7279870584b0f:0x44e376e36c0739b3!8m2!3d-6.050179!4d-77.1720976!16s%2Fg%2F11b5qh5cn0";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; maps?: string }>;
}) {
  const { error, maps } = await searchParams;

  return (
    <main className="home-shell min-h-screen overflow-hidden bg-[#f2efe4] text-[#1d2a20]">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <a className="flex items-center gap-2.5" href="/">
          <span className="relative grid size-9 place-items-center rounded-full bg-[#d7ef58] shadow-[inset_-3px_-3px_0_rgba(29,42,32,0.12)]">
            <span className="absolute -top-1 right-0 h-2.5 w-4 rotate-[-25deg] rounded-full bg-[#1d2a20]" />
            <span className="font-display text-xl leading-none">L</span>
          </span>
          <span className="text-xl font-bold tracking-[-0.04em]">limon</span>
        </a>
        <span className="hidden rounded-full border border-[#1d2a20]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] sm:block">
          Website generator for local businesses
        </span>
      </nav>

      <section className="relative mx-auto grid w-full max-w-7xl gap-14 px-5 pb-24 pt-12 sm:px-8 lg:grid-cols-[1.04fr_0.96fr] lg:px-12 lg:pb-32 lg:pt-20">
        <div className="relative z-10 max-w-3xl">
          <div className="mb-8 inline-flex rotate-[-2deg] items-center gap-2 rounded-full bg-[#ff7448] px-4 py-2 text-sm font-bold text-[#1d2a20] shadow-[3px_3px_0_#1d2a20]">
            <span className="size-2 rounded-full bg-[#1d2a20]" />
            From Google Maps to a real website
          </div>
          <h1 className="font-display text-[clamp(4rem,9vw,8.4rem)] leading-[0.82] tracking-[-0.065em]">
            Already on
            <br />
            the map.
            <br />
            <span className="relative inline-block italic">
              Now online.
              <svg
                aria-hidden="true"
                className="absolute -bottom-3 left-0 -z-10 h-8 w-full text-[#d7ef58]"
                viewBox="0 0 500 40"
                preserveAspectRatio="none"
              >
                <path
                  d="M7 29C119 6 344 7 493 21"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="18"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-10 max-w-xl text-lg leading-8 text-[#435047] sm:text-xl">
            Paste a restaurant&apos;s Google Maps link. Limon turns its public
            details, photos, contact information, and reviews into a polished
            landing page in seconds.
          </p>

          <form
            action={generateRestaurant}
            className="mt-10 max-w-2xl rounded-[1.75rem] border-2 border-[#1d2a20] bg-white p-2 shadow-[7px_7px_0_#1d2a20]"
          >
            <label className="sr-only" htmlFor="maps-url">
              Google Maps restaurant URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="min-h-14 min-w-0 flex-1 rounded-[1.2rem] bg-[#f2efe4] px-5 text-sm outline-none ring-[#ff7448] placeholder:text-[#6b746d] focus:ring-2"
                defaultValue={maps ?? ""}
                id="maps-url"
                name="mapsUrl"
                placeholder="Paste a Google Maps restaurant link"
                required
                type="url"
              />
              <button
                className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-[1.2rem] bg-[#1d2a20] px-6 font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d2a20]"
                type="submit"
              >
                Build the site
                <span className="transition-transform group-hover:translate-x-1">
                  -&gt;
                </span>
              </button>
            </div>
            {error ? (
              <p
                className="px-4 pb-2 pt-3 text-sm font-medium text-[#b63b20]"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </form>
          <p className="mt-5 text-sm text-[#5c675f]">
            Need an example?{" "}
            <a
              className="font-semibold text-[#1d2a20] underline decoration-[#ff7448] decoration-2 underline-offset-4"
              href={`/?maps=${encodeURIComponent(sampleMapsUrl)}`}
            >
              Try Cevicheria Las Palmeras
            </a>
          </p>
        </div>

        <div
          className="relative hidden min-h-[690px] lg:block"
          aria-hidden="true"
        >
          <div className="absolute left-4 top-14 h-[590px] w-[86%] rotate-[3deg] rounded-[2.8rem] border-2 border-[#1d2a20] bg-[#d7ef58] shadow-[14px_14px_0_#1d2a20]" />
          <div className="absolute right-0 top-0 w-[88%] rotate-[-2deg] overflow-hidden rounded-[2.8rem] border-2 border-[#1d2a20] bg-[#fffaf0] shadow-[10px_10px_0_rgba(29,42,32,0.2)]">
            <div className="flex items-center justify-between border-b-2 border-[#1d2a20] px-6 py-4">
              <span className="font-display text-xl">Las Palmeras</span>
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-[#ff7448]" />
                <span className="size-2.5 rounded-full bg-[#d7ef58]" />
                <span className="size-2.5 rounded-full bg-[#1d2a20]" />
              </div>
            </div>
            <div className="restaurant-placeholder relative h-72 overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#142419] to-transparent p-7 pt-24 text-white">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#d7ef58]">
                  Rioja, Peru
                </p>
                <p className="font-display text-5xl leading-none">
                  Fresh from the coast.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6">
              <div className="rounded-2xl bg-[#1d2a20] p-5 text-white">
                <p className="text-xs uppercase tracking-[0.15em] text-white/60">
                  Rating
                </p>
                <p className="mt-3 font-display text-4xl">4.0</p>
              </div>
              <div className="rounded-2xl bg-[#ff7448] p-5">
                <p className="text-xs uppercase tracking-[0.15em] text-[#1d2a20]/60">
                  Call
                </p>
                <p className="mt-3 text-lg font-bold">(042) 558342</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-[#1d2a20]/15 p-5">
                <div className="mb-3 h-2 w-24 rounded-full bg-[#1d2a20]/15" />
                <div className="h-2 w-full rounded-full bg-[#1d2a20]/10" />
                <div className="mt-2 h-2 w-2/3 rounded-full bg-[#1d2a20]/10" />
              </div>
            </div>
          </div>
          <span className="absolute bottom-5 left-0 rotate-[-8deg] rounded-full border-2 border-[#1d2a20] bg-[#ff7448] px-6 py-4 font-display text-2xl shadow-[5px_5px_0_#1d2a20]">
            palmeras.limon.lat
          </span>
        </div>
      </section>

      <section className="border-y-2 border-[#1d2a20] bg-[#1d2a20] text-[#f2efe4]">
        <div className="mx-auto grid max-w-7xl gap-px bg-white/20 sm:grid-cols-3">
          {[
            ["01", "Paste the map link", "No forms with thirty empty fields."],
            [
              "02",
              "We gather the details",
              "Photos, hours, calls, directions, reviews.",
            ],
            [
              "03",
              "Meet the new website",
              "Ready to share with customers immediately.",
            ],
          ].map(([number, title, body]) => (
            <article className="bg-[#1d2a20] px-8 py-12" key={number}>
              <p className="mb-8 font-mono text-sm text-[#d7ef58]">/{number}</p>
              <h2 className="font-display text-3xl">{title}</h2>
              <p className="mt-4 leading-7 text-white/60">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
