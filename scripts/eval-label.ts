// Reads real photos of nutrition labels (the ones people upload to Open Food
// Facts) with the real API and compares them with the product's values in
// OFF, to review by hand. The photos are fetched into memory, never saved.
// Spends 1-2 cents per photo.
//   node --import tsx scripts/eval-label.ts [filter] [--save]
// --save writes each answer to tests/fixtures/label/ with OFF's kcal and the
// warnings given as what to expect: review them before committing.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import {
  LABEL_PROMPT,
  LABEL_SCHEMA,
  LABEL_SYSTEM_PROMPT,
  parseLabelReading,
} from "../src/domain/label";

loadEnvConfig(process.cwd(), true);

const USER_AGENT = "Calorias/0.1 (+https://calorias.joserabalsegura.com)";

// Products sold in Spain whose nutrition photo is selected in OFF: solids
// and drinks, labels per 100 and per serving, glossy and wrinkled packages.
const PRODUCTS = [
  { code: "8410376009392", note: "galletas Gullón, etiqueta en español" },
  { code: "8715700407760", note: "ketchup Heinz, etiqueta en español" },
  { code: "5449000214911", note: "Coca-Cola en lata, por 100 ml" },
  { code: "3017620425035", note: "Nutella, tarro" },
  { code: "5411188110835", note: "bebida de almendra Alpro, brik" },
  { code: "3046920022606", note: "chocolate Lindt 85 %" },
  { code: "3159470000120", note: "Corn Flakes, caja" },
  { code: "7300400481595", note: "pan crujiente Wasa" },
];

type Json = Record<string, any>;

async function fetchJson(url: string): Promise<Json> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`);
  return response.json();
}

/** The full-size nutrition photo, preferably the Spanish one. */
function nutritionPhoto(product: Json): string | null {
  const display: Record<string, string> = product.selected_images?.nutrition?.display ?? {};
  const url = display.es ?? display.en ?? Object.values(display)[0];
  return url ? url.replace(/\.400\.jpg$/, ".full.jpg") : null;
}

async function main() {
  const { requestJson, aiSettings } = await import("../src/lib/claude");
  const args = process.argv.slice(2);
  const save = args.includes("--save");
  const filter = args.find((arg) => !arg.startsWith("--"))?.toLowerCase();
  const { model, effort } = aiSettings();
  console.log(`Modelo ${model}, esfuerzo ${effort}\n`);

  for (const { code, note } of PRODUCTS.filter(
    (p) => !filter || p.code.includes(filter) || p.note.toLowerCase().includes(filter),
  )) {
    try {
      const { product } = await fetchJson(
        `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,quantity,nutriments,selected_images`,
      );
      const photo = nutritionPhoto(product);
      if (!photo) {
        console.log(`✗ ${note}: sin foto de la tabla en OFF\n`);
        continue;
      }
      const image = Buffer.from(
        await (await fetch(photo, { headers: { "User-Agent": USER_AGENT } })).arrayBuffer(),
      );
      const offKcal = product.nutriments?.["energy-kcal_100g"];

      const started = Date.now();
      const answer = await requestJson("eval", {
        system: LABEL_SYSTEM_PROMPT,
        prompt: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: image.toString("base64") },
          },
          { type: "text", text: LABEL_PROMPT },
        ],
        schema: LABEL_SCHEMA as unknown as Record<string, unknown>,
      });
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      const result = parseLabelReading(answer);

      console.log(`▶ ${note} (${code}, ${Math.round(image.length / 1024)} KB, ${seconds} s)`);
      console.log(`   foto: ${photo}`);
      console.log(`   OFF: ${product.product_name} (${product.brands}) ${offKcal} kcal/100`);
      console.log(`   IA:  ${JSON.stringify(answer)}`);
      if (result.ok) {
        const { reading } = result;
        console.log(
          `   →    ${reading.name} (${reading.brand}) ${reading.kcalPer100} kcal/100 ${reading.baseUnit}` +
            ` · P ${reading.proteinPer100} H ${reading.carbsPer100} G ${reading.fatPer100}` +
            (reading.servingAmount ? ` · ración ${reading.servingAmount}` : ""),
        );
        for (const warning of reading.warnings) console.log(`   ⚠ ${warning}`);
      } else {
        console.log(`   ✗ ${result.error}`);
      }
      console.log();

      if (save) {
        const dir = join(process.cwd(), "tests/fixtures/label");
        mkdirSync(dir, { recursive: true });
        const expected = result.ok
          ? {
              baseUnit: result.reading.baseUnit,
              kcalPer100: typeof offKcal === "number" ? offKcal : result.reading.kcalPer100,
              ...(result.reading.warnings.length
                ? { warnings: result.reading.warnings.map((w) => w.split(":")[0]) }
                : {}),
            }
          : { error: true };
        writeFileSync(
          join(dir, `${code}.json`),
          `${JSON.stringify({ note, photo, answer, expected }, null, 2)}\n`,
        );
      }
    } catch (error) {
      console.log(`✗ ${note}: ${error instanceof Error ? error.message : error}\n`);
    }
  }
}

main().then(() => process.exit(0));
