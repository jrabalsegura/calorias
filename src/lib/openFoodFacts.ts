import { OFF_FIELDS, parseOffResponse, type OffLookup } from "@/domain/off";

const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/";
// OFF asks every app to identify itself with its own User-Agent.
const USER_AGENT = "Calorias/0.1 (+https://calorias.joserabalsegura.com)";
const TIMEOUT_MS = 8000;

/** Looks a barcode up in Open Food Facts. Throws when it cannot be reached. */
export async function fetchOffProduct(barcode: string): Promise<OffLookup> {
  const response = await fetch(
    `${PRODUCT_URL}${barcode}.json?fields=${OFF_FIELDS.join(",")}`,
    {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store"
    }
  );
  console.info(`[off] ${barcode}: HTTP ${response.status}`);

  // An unknown code answers 404 with a JSON body that says so.
  if (response.status === 404) return { kind: "notFound" };
  if (!response.ok) throw new Error(`Open Food Facts answered ${response.status}`);
  return parseOffResponse(barcode, await response.json());
}
