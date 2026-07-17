import { LandingExperience } from "./_landing/landing-experience";
import { generateRestaurant } from "./actions";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; maps?: string }>;
}) {
  const { error, maps } = await searchParams;

  return (
    <LandingExperience
      action={generateRestaurant}
      defaultMaps={maps}
      error={error}
    />
  );
}
