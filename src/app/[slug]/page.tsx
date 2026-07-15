import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedMenu, getRestaurantBySlug } from "@/lib/database";
import type { MenuPrice, MenuVariant } from "@/lib/menus";
import type { Restaurant } from "@/lib/restaurants";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const record = await getRestaurantBySlug(slug);
  const restaurant = record?.data;
  if (!restaurant) return { title: "Restaurant | Limon" };

  return {
    title: `${restaurant.name} | ${restaurant.city ?? restaurant.category}`,
    description: restaurant.description,
  };
}

function StarRating({ rating = 0 }: { rating?: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex gap-0.5">
      <span className="sr-only">{rating} de 5 estrellas</span>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          aria-hidden="true"
          className={star <= rounded ? "text-[#f3c94d]" : "text-white/25"}
          fill="currentColor"
          height="16"
          key={star}
          viewBox="0 0 20 20"
          width="16"
        >
          <path d="m10 1.7 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L10 1.7Z" />
        </svg>
      ))}
    </span>
  );
}

function displayPrice(price: MenuPrice | MenuVariant) {
  if (!price.amount) return null;
  if (!price.currency) return price.amount;
  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: price.currency,
    }).format(Number(price.amount.replace(",", ".")));
  } catch {
    return `${price.currency} ${price.amount}`;
  }
}

function PhotoGrid({ restaurant }: { restaurant: Restaurant }) {
  const photos = restaurant.photos.slice(0, 5);

  if (photos.length === 0) {
    return (
      <div className="restaurant-placeholder relative h-[68vh] min-h-[520px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#112117] via-transparent to-black/10" />
      </div>
    );
  }

  return (
    <div
      className={`grid h-[68vh] min-h-[520px] grid-cols-1 gap-1 overflow-hidden ${
        photos.length > 1 ? "md:grid-cols-[1.5fr_0.7fr]" : ""
      }`}
    >
      <figure className="relative min-h-0 overflow-hidden">
        <Image
          alt={`Una vista de ${restaurant.name}`}
          className="object-cover transition-transform duration-700 hover:scale-[1.02]"
          fill
          preload
          sizes="(max-width: 768px) 100vw, 68vw"
          src={photos[0].url}
        />
        {photos[0].author ? (
          <figcaption className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-[10px] text-white backdrop-blur">
            Foto: {photos[0].author}
          </figcaption>
        ) : null}
      </figure>
      {photos.length > 1 ? (
        <div className="hidden grid-rows-2 gap-1 md:grid">
          {[photos[1], photos[2] ?? photos[1]].map((photo, index) => (
            <figure
              className="relative overflow-hidden"
              key={`${photo.url}-${index}`}
            >
              <Image
                alt={`Galeria de ${restaurant.name}`}
                className="object-cover"
                fill
                sizes="32vw"
                src={photo.url}
              />
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const record = await getRestaurantBySlug(slug);
  if (!record?.data) notFound();
  const restaurant = record.data;
  const menu = await getPublishedMenu(record.id);

  const directionsUrl = restaurant.googleMapsUrl;
  const telUrl = restaurant.phone
    ? `tel:${restaurant.phone.replace(/[^+\d]/g, "")}`
    : undefined;
  const mapUrl =
    restaurant.latitude !== undefined && restaurant.longitude !== undefined
      ? `https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&z=16&output=embed`
      : undefined;

  return (
    <main className="restaurant-page min-h-screen bg-[#f4edda] text-[#17231a]">
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/20 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a className="font-display max-w-[60%] truncate text-2xl" href="#top">
            {restaurant.name}
          </a>
          <nav className="flex items-center gap-5 text-sm font-semibold">
            <a
              className="hidden hover:text-[#d7ef58] sm:block"
              href="#historia"
            >
              Nosotros
            </a>
            {menu ? (
              <a className="hidden hover:text-[#d7ef58] sm:block" href="#menu">
                Menu
              </a>
            ) : null}
            <a
              className="hidden hover:text-[#d7ef58] sm:block"
              href="#visitanos"
            >
              Visitanos
            </a>
            {telUrl ? (
              <a
                className="rounded-full bg-[#d7ef58] px-5 py-2.5 text-[#17231a] transition-transform hover:-translate-y-0.5"
                href={telUrl}
              >
                Llamar ahora
              </a>
            ) : null}
          </nav>
        </div>
      </header>

      <section className="relative bg-[#112117]" id="top">
        <PhotoGrid restaurant={restaurant} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#112117] via-[#112117]/10 to-black/40" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-5 pb-10 text-white sm:px-8 sm:pb-14">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.17em] text-[#d7ef58]">
            <span>{restaurant.category}</span>
            {restaurant.city ? (
              <>
                <span className="size-1 rounded-full bg-current" />
                <span>{restaurant.city}</span>
              </>
            ) : null}
          </div>
          <h1 className="font-display max-w-5xl text-[clamp(3.8rem,9vw,8.5rem)] leading-[0.84] tracking-[-0.055em]">
            {restaurant.name}
          </h1>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            {restaurant.rating ? (
              <div className="flex items-center gap-2">
                <StarRating rating={restaurant.rating} />
                <span className="font-semibold">
                  {restaurant.rating.toFixed(1)}
                </span>
                {restaurant.reviewCount ? (
                  <span className="text-white/60">
                    ({restaurant.reviewCount} opiniones)
                  </span>
                ) : null}
              </div>
            ) : null}
            {restaurant.openingStatus ? (
              <span className="rounded-full border border-white/30 px-3 py-1 text-sm">
                {restaurant.openingStatus}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 md:grid-cols-[0.72fr_1.28fr] md:py-28"
        id="historia"
      >
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#c34d31]">
            Nuestra mesa
          </p>
          <div className="mt-5 h-px w-16 bg-[#17231a]" />
        </div>
        <div>
          <h2 className="font-display max-w-4xl text-5xl leading-[0.98] tracking-[-0.035em] sm:text-7xl">
            Sabor local, hecho para compartir.
          </h2>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-[#4e5b52] sm:text-xl sm:leading-9">
            {restaurant.description}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              className="rounded-full bg-[#17231a] px-6 py-3.5 font-bold text-white transition-transform hover:-translate-y-0.5"
              href={directionsUrl}
              rel="noreferrer"
              target="_blank"
            >
              Como llegar
            </a>
            {restaurant.website ? (
              <a
                className="rounded-full border border-[#17231a]/25 px-6 py-3.5 font-bold hover:border-[#17231a]"
                href={restaurant.website}
                rel="noreferrer"
                target="_blank"
              >
                Sitio oficial
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {menu ? (
        <section
          className="border-y border-[#17231a]/15 bg-[#fffaf0] px-5 py-20 sm:px-8 md:py-28"
          id="menu"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 md:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#c34d31]">
                  Menu encontrado
                </p>
                <h2 className="font-display mt-5 text-6xl leading-none sm:text-8xl">
                  Para la mesa.
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-6 text-[#657067]">
                  Generado a partir de las fotos publicas del restaurante.
                </p>
              </div>
              <div className="grid gap-12">
                {menu.sections.map((section, sectionIndex) => (
                  <article key={`${section.name}-${sectionIndex}`}>
                    <div className="flex items-center gap-4">
                      <h3 className="font-display text-4xl sm:text-5xl">
                        {section.name}
                      </h3>
                      <span className="h-px flex-1 bg-[#17231a]/20" />
                    </div>
                    <div className="mt-6 divide-y divide-[#17231a]/12">
                      {section.items.map((item, itemIndex) => (
                        <div
                          className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:gap-8"
                          key={`${item.name}-${itemIndex}`}
                        >
                          <div>
                            <h4 className="text-lg font-bold">{item.name}</h4>
                            {item.description ? (
                              <p className="mt-1 max-w-2xl leading-6 text-[#657067]">
                                {item.description}
                              </p>
                            ) : null}
                            {item.variants.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2 text-sm text-[#526057]">
                                {item.variants.map((variant, variantIndex) => (
                                  <span
                                    className="rounded-full border border-[#17231a]/15 px-3 py-1"
                                    key={`${variant.name}-${variantIndex}`}
                                  >
                                    {variant.name}
                                    {displayPrice(variant)
                                      ? ` / ${displayPrice(variant)}`
                                      : ""}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-3 font-bold sm:justify-end">
                            {item.prices.map((price, priceIndex) => (
                              <span key={`${price.label}-${priceIndex}`}>
                                {price.label ? `${price.label} ` : ""}
                                {displayPrice(price)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-[#17231a] px-5 py-20 text-white sm:px-8 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#d7ef58]">
                Lo que dicen
              </p>
              <h2 className="font-display mt-4 text-5xl sm:text-7xl">
                Buenas razones para volver.
              </h2>
            </div>
            <a
              className="text-sm font-bold text-[#d7ef58] underline underline-offset-4"
              href={restaurant.googleMapsUrl}
              rel="noreferrer"
              target="_blank"
            >
              Ver en Google Maps
            </a>
          </div>

          {restaurant.reviews.length > 0 ? (
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {restaurant.reviews.slice(0, 3).map((review, index) => (
                <article
                  className="flex min-h-72 flex-col rounded-[1.75rem] border border-white/15 bg-white/[0.055] p-7"
                  key={`${review.author}-${index}`}
                >
                  <StarRating rating={review.rating} />
                  <blockquote className="font-display mt-7 flex-1 text-2xl leading-snug">
                    &ldquo;{review.text}&rdquo;
                  </blockquote>
                  <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-5">
                    {review.avatarUrl ? (
                      <Image
                        alt=""
                        className="rounded-full"
                        height={36}
                        src={review.avatarUrl}
                        width={36}
                      />
                    ) : (
                      <span className="grid size-9 place-items-center rounded-full bg-[#d7ef58] font-bold text-[#17231a]">
                        {review.author.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-bold">{review.author}</p>
                      <p className="text-xs text-white/45">
                        {review.relativeTime ?? "Google Maps"}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-12 grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-[1.75rem] bg-[#d7ef58] p-8 text-[#17231a]">
                <p className="font-display text-7xl">
                  {restaurant.rating?.toFixed(1) ?? "Local"}
                </p>
                <p className="mt-2 font-bold">Valoracion en Google Maps</p>
                <div className="mt-5">
                  <StarRating rating={restaurant.rating} />
                </div>
              </div>
              <div className="rounded-[1.75rem] border border-white/15 p-8 sm:p-10">
                <p className="font-display text-3xl leading-snug sm:text-4xl">
                  Las opiniones completas estan disponibles directamente en el
                  perfil del restaurante.
                </p>
                <a
                  className="mt-8 inline-flex rounded-full border border-white/30 px-5 py-3 text-sm font-bold hover:border-[#d7ef58] hover:text-[#d7ef58]"
                  href={restaurant.googleMapsUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Leer opiniones
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      <section
        className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-2 md:py-28"
        id="visitanos"
      >
        <div className="flex flex-col justify-between rounded-[2rem] bg-[#ff7448] p-8 sm:p-10">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em]">
              Visitanos
            </p>
            <h2 className="font-display mt-5 text-5xl sm:text-7xl">
              Aqui te esperamos.
            </h2>
          </div>
          <div className="mt-16 divide-y divide-[#17231a]/20">
            <div className="py-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-60">
                Direccion
              </p>
              <p className="mt-2 text-lg font-semibold leading-7">
                {restaurant.address}
              </p>
            </div>
            {restaurant.phone ? (
              <div className="py-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-60">
                  Telefono
                </p>
                <a className="mt-2 block text-lg font-semibold" href={telUrl}>
                  {restaurant.phone}
                </a>
              </div>
            ) : null}
            <div className="py-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-60">
                Horario
              </p>
              {restaurant.openingHours.length > 0 ? (
                <div className="mt-3 space-y-1 text-sm font-medium">
                  {restaurant.openingHours.map((hours) => (
                    <p key={hours}>{hours}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-lg font-semibold">
                  {restaurant.openingStatus ??
                    "Consulta el horario en Google Maps"}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="min-h-[480px] overflow-hidden rounded-[2rem] border border-[#17231a]/15 bg-[#d8ddcf]">
          {mapUrl ? (
            <iframe
              className="h-full min-h-[480px] w-full border-0 grayscale-[0.25]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={mapUrl}
              title={`Mapa de ${restaurant.name}`}
            />
          ) : (
            <div className="grid h-full min-h-[480px] place-items-center p-8 text-center">
              <a className="font-bold underline" href={directionsUrl}>
                Abrir ubicacion en Google Maps
              </a>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-[#17231a]/15 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-sm text-[#657067] sm:flex-row sm:items-center">
          <p>
            {restaurant.name} <span className="mx-2">/</span> {slug}.limon.lat
          </p>
          <div className="flex items-center gap-4">
            <a
              className="font-roboto text-xs font-normal text-[#5e5e5e]"
              href={restaurant.googleMapsUrl}
              rel="noreferrer"
              target="_blank"
              translate="no"
            >
              Google Maps
            </a>
            <Link className="font-bold text-[#17231a]" href="/">
              Made with limon
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
