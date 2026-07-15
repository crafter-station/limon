import { getRestaurantById, isRestaurantId } from "@/lib/database";
import { generateStoredRestaurant } from "@/lib/generation";

export const maxDuration = 300;
export const runtime = "nodejs";

function publicStatus(record: Awaited<ReturnType<typeof getRestaurantById>>) {
  if (!record) return undefined;

  return {
    status: record.status,
    slug: record.slug,
    error: record.error,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isRestaurantId(id))
    return Response.json({ error: "Not found." }, { status: 404 });

  const record = await getRestaurantById(id);
  if (!record) return Response.json({ error: "Not found." }, { status: 404 });

  return Response.json(publicStatus(record), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isRestaurantId(id))
    return Response.json({ error: "Not found." }, { status: 404 });

  try {
    const attempt = Number(new URL(request.url).searchParams.get("attempt"));
    const record = await generateStoredRestaurant(
      id,
      Number.isInteger(attempt) && attempt > 0,
    );
    return Response.json(publicStatus(record), {
      headers: { "Cache-Control": "no-store" },
      status: record.status === "generating" ? 202 : 200,
    });
  } catch {
    return Response.json(
      { error: "The generation service is temporarily unavailable." },
      { status: 500 },
    );
  }
}
