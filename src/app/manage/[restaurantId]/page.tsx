import Link from "next/link";
import { notFound } from "next/navigation";
import { getMenuRepresentative } from "@/lib/menu-auth";
import { getMenuDashboard } from "@/lib/menu-database";
import type { MenuSection } from "@/lib/menus";
import {
  approveMenu,
  loginMenuRepresentative,
  logoutMenuRepresentative,
  publishMenu,
  retryMenuDeletion,
  retryMenuExtraction,
  revokeMenu,
  saveMenuReview,
} from "./actions";

function reviewText(
  sections: MenuSection[],
  assets: { id: string; pageIndex: number }[],
) {
  const pages = new Map(assets.map((asset) => [asset.id, asset.pageIndex + 1]));
  return sections
    .flatMap((section) =>
      section.items.map((item) => {
        const assetId = item.evidence.find((entry) =>
          entry.fieldPath.endsWith(".name"),
        )?.sourceAssetId;
        const price = item.prices[0];
        const variant = item.variants[0];
        return [
          assetId ? (pages.get(assetId) ?? 1) : 1,
          section.name,
          item.name,
          item.description ?? "",
          price?.label ?? "",
          price?.amount ?? "",
          price?.currency ?? variant?.currency ?? "",
          variant?.name ?? "",
          variant?.amount ?? "",
        ].join("\t");
      }),
    )
    .join("\n");
}

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-[#17231a]/20 bg-white px-4 outline-none focus:border-[#ff7448] focus:ring-2 focus:ring-[#ff7448]/25";

export default async function MenuManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ error?: string; message?: string; replace?: string }>;
}) {
  const { restaurantId } = await params;
  const [{ error, message, replace }, dashboard, representative] =
    await Promise.all([
      searchParams,
      getMenuDashboard(restaurantId),
      getMenuRepresentative(restaurantId),
    ]);
  if (!dashboard) notFound();
  const { restaurant, version, assets, grant, extraction } = dashboard;

  if (!representative) {
    const login = loginMenuRepresentative.bind(null, restaurantId);
    return (
      <main className="min-h-screen bg-[#17231a] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto max-w-lg rounded-[2rem] bg-[#f4edda] p-7 text-[#17231a] shadow-[10px_10px_0_#ff7448] sm:p-10">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#c34d31]">
            Verified representative
          </p>
          <h1 className="font-display mt-5 text-5xl leading-none">
            Manage {restaurant.name}
          </h1>
          <p className="mt-5 leading-7 text-[#526057]">
            Enter the one-time access token issued after restaurant
            verification.
          </p>
          <form action={login} className="mt-8">
            <label className="font-bold" htmlFor="token">
              Restaurant access token
            </label>
            <input
              className={inputClass}
              id="token"
              name="token"
              required
              type="password"
            />
            {error ? (
              <p
                className="mt-3 text-sm font-semibold text-[#b63b20]"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <button
              className="mt-5 w-full rounded-xl bg-[#17231a] px-5 py-3.5 font-bold text-white"
              type="submit"
            >
              Continue securely
            </button>
          </form>
        </div>
      </main>
    );
  }

  const logout = logoutMenuRepresentative.bind(null, restaurantId);
  const save = saveMenuReview.bind(null, restaurantId);
  const approve = approveMenu.bind(null, restaurantId);
  const publish = publishMenu.bind(null, restaurantId);
  const revoke = revokeMenu.bind(null, restaurantId);
  const retryDeletion = grant
    ? retryMenuDeletion.bind(null, restaurantId, grant.id)
    : undefined;
  const retryExtraction = version
    ? retryMenuExtraction.bind(null, restaurantId, version.id)
    : undefined;
  const editable = version?.status === "needs_review";
  const text = version ? reviewText(version.sections, assets) : "";

  return (
    <main className="min-h-screen bg-[#f4edda] text-[#17231a]">
      <header className="border-b border-[#17231a]/15 bg-[#17231a] px-5 py-5 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7ef58]">
              Menu studio
            </p>
            <h1 className="font-display mt-1 text-3xl">{restaurant.name}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {restaurant.slug ? (
              <Link
                className="font-bold text-[#d7ef58]"
                href={`/${restaurant.slug}`}
              >
                View site
              </Link>
            ) : null}
            <form action={logout}>
              <button className="underline underline-offset-4" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {error ? (
          <p
            className="mb-7 rounded-xl border border-[#b63b20]/30 bg-[#b63b20]/10 p-4 font-semibold text-[#8f2f1b]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {message ? (
          <output className="mb-7 block rounded-xl border border-[#58700c]/30 bg-[#d7ef58]/30 p-4 font-semibold">
            {message}
          </output>
        ) : null}

        {!version || replace === "1" ? (
          <section className="rounded-[2rem] border border-[#17231a]/15 bg-white p-6 sm:p-9">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#c34d31]">
              Step 1
            </p>
            <h2 className="font-display mt-4 text-4xl">
              Upload a rights-cleared menu
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-[#526057]">
              Upload only material the grantor created or has sufficient
              sublicensable rights to provide. Google Maps, Places, and Business
              Profile content is excluded.
            </p>
            <form
              action={`/api/restaurants/${restaurantId}/menus`}
              className="mt-8 grid gap-6"
              encType="multipart/form-data"
              method="post"
            >
              <label className="font-bold">
                Menu PDF or static images
                <input
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className={`${inputClass} py-3`}
                  multiple
                  name="files"
                  required
                  type="file"
                />
                <span className="mt-2 block text-xs font-normal text-[#657067]">
                  Up to 20 pages and 4 MB total, within the server upload cap.
                </span>
              </label>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="font-bold">
                  Grantor identifier
                  <input
                    className={inputClass}
                    name="grantorId"
                    placeholder="Legal entity or verified account ID"
                    required
                  />
                </label>
                <label className="font-bold">
                  Signer authority
                  <input
                    className={inputClass}
                    name="signerAuthority"
                    placeholder="Owner, director, authorized agent"
                    required
                  />
                </label>
                <label className="font-bold">
                  Ownership representation
                  <select
                    className={inputClass}
                    name="ownershipRepresentation"
                    required
                  >
                    <option value="creator">Creator / owner</option>
                    <option value="licensee">
                      Licensee with sublicensing rights
                    </option>
                    <option value="authorized_agent">Authorized agent</option>
                    <option value="other">Other documented basis</option>
                  </select>
                </label>
                <label className="font-bold">
                  Retention class
                  <select className={inputClass} name="retentionClass" required>
                    <option value="durable_license">Durable license</option>
                    <option value="time_limited">Time limited</option>
                  </select>
                </label>
                <label className="font-bold md:col-span-2">
                  Deletion date for time-limited grants
                  <input
                    className={inputClass}
                    name="deleteAfter"
                    type="datetime-local"
                  />
                </label>
              </div>
              <fieldset className="rounded-2xl border border-[#17231a]/15 p-5">
                <legend className="px-2 font-bold">
                  Required asset-specific rights
                </legend>
                <p className="mb-4 text-sm leading-6 text-[#526057]">
                  The grant applies to every uploaded asset and expressly
                  permits all listed uses.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    "copy",
                    "model_process",
                    "evaluate",
                    "review",
                    "retain",
                    "derive",
                    "publish",
                  ].map((scope) => (
                    <label
                      className="flex items-center gap-3 text-sm font-semibold"
                      key={scope}
                    >
                      <input
                        name="scope"
                        required
                        type="checkbox"
                        value={scope}
                      />{" "}
                      {scope.replaceAll("_", " ")}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-start gap-3 rounded-2xl bg-[#d7ef58]/35 p-5 text-sm font-semibold leading-6">
                <input
                  className="mt-1"
                  name="ownershipConfirmed"
                  required
                  type="checkbox"
                  value="yes"
                />
                I represent that the grantor created every asset or holds
                sufficient sublicensable rights, and that I have authority to
                grant these uses.
              </label>
              <button
                className="rounded-xl bg-[#17231a] px-6 py-4 font-bold text-white"
                type="submit"
              >
                Validate, scan, and create draft
              </button>
            </form>
          </section>
        ) : (
          <div className="grid gap-7">
            <section className="flex flex-col justify-between gap-5 rounded-[2rem] bg-[#17231a] p-6 text-white sm:flex-row sm:items-center sm:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7ef58]">
                  Current state
                </p>
                <p className="font-display mt-2 text-4xl capitalize">
                  {version.status.replaceAll("_", " ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/65">
                <span>
                  Version {version.id.slice(0, 8)} / {assets.length} source
                  pages
                </span>
                {version.status === "published" ||
                version.status === "superseded" ||
                version.status === "revoked" ? (
                  <Link
                    className="font-bold text-[#d7ef58]"
                    href={`/manage/${restaurantId}?replace=1`}
                  >
                    Upload replacement
                  </Link>
                ) : null}
              </div>
            </section>

            {version.status === "draft" ? (
              <section className="rounded-[2rem] border border-[#b63b20]/25 bg-white p-6 sm:p-9">
                <h2 className="font-display text-4xl">
                  Extraction needs attention
                </h2>
                <p className="mt-3 text-[#526057]">
                  {extraction?.error ??
                    "The durable extraction job has not completed."}
                </p>
                <form action={retryExtraction} className="mt-5">
                  <button
                    className="rounded-xl bg-[#17231a] px-5 py-3 font-bold text-white"
                    type="submit"
                  >
                    Retry deterministic extraction
                  </button>
                </form>
              </section>
            ) : null}

            <section className="rounded-[2rem] border border-[#17231a]/15 bg-white p-6 sm:p-9">
              <h2 className="font-display text-4xl">
                Rights and source evidence
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {assets.map((asset) => (
                  <a
                    className="rounded-xl border border-[#17231a]/15 p-4 font-semibold hover:border-[#ff7448]"
                    href={`/api/restaurants/${restaurantId}/menu-assets/${asset.id}`}
                    key={asset.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Page {asset.pageIndex + 1}:{" "}
                    {asset.originalName ?? "deleted source"}
                  </a>
                ))}
              </div>
              {grant ? (
                <p className="mt-5 text-sm text-[#657067]">
                  Grant {grant.id.slice(0, 8)} /{" "}
                  {grant.retentionClass.replaceAll("_", " ")} / deletion:{" "}
                  {grant.cascadeStatus}
                </p>
              ) : null}
            </section>

            {editable ? (
              <section className="rounded-[2rem] border border-[#17231a]/15 bg-white p-6 sm:p-9">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#c34d31]">
                  Step 2
                </p>
                <h2 className="font-display mt-4 text-4xl">
                  Review every field
                </h2>
                <p className="mt-4 max-w-3xl leading-7 text-[#526057]">
                  One item per line. Use tab-separated columns: page, section,
                  item, description, price label, decimal amount, ISO currency,
                  variant, variant amount. Missing values stay blank and are
                  never inferred.
                </p>
                <form action={save} className="mt-7">
                  <input name="versionId" type="hidden" value={version.id} />
                  <input
                    name="expectedRevision"
                    type="hidden"
                    value={version.revision}
                  />
                  <label className="font-bold" htmlFor="menu-text">
                    Reviewed menu rows
                  </label>
                  <textarea
                    className="mt-2 min-h-80 w-full overflow-auto rounded-xl border border-[#17231a]/20 bg-[#f8f5eb] p-4 font-mono text-sm leading-7 outline-none focus:border-[#ff7448]"
                    defaultValue={text}
                    id="menu-text"
                    name="menuText"
                    placeholder={
                      "1\tEntradas\tCeviche clasico\tPescado fresco\tPersonal\t29.90\tPEN"
                    }
                    required
                    spellCheck={false}
                  />
                  <label className="mt-5 flex items-start gap-3 text-sm font-semibold leading-6">
                    <input
                      className="mt-1"
                      name="sourceReviewed"
                      required
                      type="checkbox"
                      value="yes"
                    />{" "}
                    I transcribed every non-empty value literally from the
                    linked source page; the full-page evidence box records
                    manual review, not model localization.
                  </label>
                  <label className="mt-3 flex items-start gap-3 text-sm font-semibold leading-6">
                    <input
                      className="mt-1"
                      name="pricesReviewed"
                      required
                      type="checkbox"
                      value="yes"
                    />{" "}
                    I checked every price and currency against the identified
                    source page.
                  </label>
                  <button
                    className="mt-5 rounded-xl border border-[#17231a] px-6 py-3.5 font-bold"
                    type="submit"
                  >
                    Save corrections
                  </button>
                </form>
                {version.sections.length > 0 ? (
                  <form
                    action={approve}
                    className="mt-8 border-t border-[#17231a]/15 pt-7"
                  >
                    <input name="versionId" type="hidden" value={version.id} />
                    <input
                      name="expectedRevision"
                      type="hidden"
                      value={version.revision}
                    />
                    <label className="flex items-start gap-3 rounded-xl bg-[#ff7448]/15 p-4 text-sm font-semibold leading-6">
                      <input
                        className="mt-1"
                        name="approve"
                        required
                        type="checkbox"
                        value="yes"
                      />{" "}
                      I explicitly approve this exact menu version. All prices
                      were reviewed; unsupported safety, dietary, ingredient,
                      allergen, and availability claims remain null.
                    </label>
                    <button
                      className="mt-5 rounded-xl bg-[#ff7448] px-6 py-3.5 font-bold"
                      type="submit"
                    >
                      Approve and freeze this version
                    </button>
                  </form>
                ) : null}
              </section>
            ) : null}

            {version.status === "approved" ? (
              <section className="rounded-[2rem] bg-[#d7ef58] p-6 sm:p-9">
                <h2 className="font-display text-4xl">Approved, not public</h2>
                <p className="mt-3 max-w-2xl leading-7">
                  The content is immutable. Publication will make this exact
                  approved version the restaurant page’s only menu source.
                </p>
                <form action={publish} className="mt-6">
                  <input name="versionId" type="hidden" value={version.id} />
                  <label className="flex items-start gap-3 text-sm font-semibold">
                    <input
                      className="mt-1"
                      name="publish"
                      required
                      type="checkbox"
                      value="yes"
                    />{" "}
                    Publish this exact approved version.
                  </label>
                  <button
                    className="mt-5 rounded-xl bg-[#17231a] px-6 py-3.5 font-bold text-white"
                    type="submit"
                  >
                    Publish menu
                  </button>
                </form>
              </section>
            ) : null}

            {grant && grant.cascadeStatus !== "complete" ? (
              <section className="rounded-[2rem] border border-[#b63b20]/25 bg-white p-6 sm:p-9">
                <h2 className="font-display text-4xl">
                  Revoke rights and delete
                </h2>
                <p className="mt-3 max-w-3xl leading-7 text-[#526057]">
                  Revocation immediately unpublishes the menu, then deletes
                  originals, transforms, OCR/model artifacts, derived drafts,
                  and app-controlled backup copies. Only non-content audit
                  identifiers remain.
                </p>
                {grant.cascadeStatus === "failed" ? (
                  <form action={retryDeletion} className="mt-5">
                    <button
                      className="rounded-xl border border-[#b63b20] px-5 py-3 font-bold text-[#8f2f1b]"
                      type="submit"
                    >
                      Retry failed deletion
                    </button>
                  </form>
                ) : (
                  <form action={revoke} className="mt-5">
                    <input
                      name="rightsGrantId"
                      type="hidden"
                      value={grant.id}
                    />
                    <label className="flex items-start gap-3 text-sm font-semibold">
                      <input
                        className="mt-1"
                        name="revoke"
                        required
                        type="checkbox"
                        value="yes"
                      />{" "}
                      Revoke this grant and run the governed deletion cascade.
                    </label>
                    <button
                      className="mt-5 rounded-xl bg-[#b63b20] px-5 py-3 font-bold text-white"
                      type="submit"
                    >
                      Unpublish and delete menu
                    </button>
                  </form>
                )}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
