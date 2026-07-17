import { notFound, redirect } from "next/navigation";
import { getRestaurantById, isRestaurantId } from "@/lib/database";
import { GenerationProgress } from "./generation-progress";

export const metadata = {
  title: "Armando tu web | Limon",
  robots: { index: false, follow: false },
};

export default async function GeneratingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isRestaurantId(id)) notFound();
  const restaurant = await getRestaurantById(id);

  if (!restaurant) notFound();
  if (restaurant.status === "ready" && restaurant.slug) {
    redirect(`/${restaurant.slug}`);
  }

  return (
    <GenerationProgress
      id={restaurant.id}
      initialError={restaurant.error}
      initialStatus={restaurant.status}
    />
  );
}
