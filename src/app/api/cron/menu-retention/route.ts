import { runMenuRetentionSweep } from "@/lib/menu-deletion";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const completed = await runMenuRetentionSweep();
  return Response.json({ completed });
}
