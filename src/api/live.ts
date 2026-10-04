import { createServerFn } from "@tanstack/react-start";
import { geocodePlace } from "@/api/geocode/openMeteoGeocode";
import { assembleWorld } from "@/api/world";

export const hydrateLiveWorld = createServerFn({ method: "POST" }).handler(async () => {
  return assembleWorld();
});

export const searchPlace = createServerFn({ method: "POST" })
  .validator((input: { q: string }) => input)
  .handler(async ({ data }) => geocodePlace(data.q));
