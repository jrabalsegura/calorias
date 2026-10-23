// Estimates real photos of meals (free photos of Wikimedia Commons) with the
// real API, with and without a note, to review by hand. The photos are
// fetched into memory at 1.500 px, never saved. Spends 1-2 cents per photo.
//   node --import tsx scripts/eval-photo.ts [filter] [--save]
// --save writes each answer to tests/fixtures/photo/ with the kcal of the
// estimate as what to expect: review them before committing.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { buildMealPhotoPrompt, MEAL_PHOTO_SYSTEM_PROMPT, NO_FOOD_IN_PHOTO } from "../src/domain/mealPhoto";
import { PHOTO_MAX_SIDE } from "../src/domain/photo";
import { ESTIMATE_SCHEMA, numberLibrary, parseEstimate } from "../src/domain/textEstimate";

loadEnvConfig(process.cwd(), true);

const USER_AGENT = "Calorias/0.1 (+https://calorias.joserabalsegura.com)";

// A small library, so a note that names "mi pan de molde" can use it.
const LIBRARY = numberLibrary([
  {
    id: "bread",
    name: "Pan de molde integral",
    brand: "Bimbo",
    baseUnit: "g",
    kcalPer100: 240,
    portions: [{ name: "rebanada", amount: 28 }],
  },
  { id: "milk", name: "Leche semidesnatada", brand: null, baseUnit: "ml", kcalPer100: 46, portions: [] },
]);

// A spoon dish, combined plates, a sandwich, things with sauce, a breakfast
// and a photo without food; some twice, to see what the note changes.
const PHOTOS = [
  { slug: "lentejas", file: "Lentejas estilo de la abuela.jpg", note: "" },
  {
    slug: "combinado",
    file: "Plato-combinado-huevo-cebolla-tomate-pimiento-patatas-carne-venta-aurelio-restaurante-chipiona.JPG",
    note: "",
  },
  { slug: "bocadillo", file: "Bocadillo de calamares-2009.jpg", note: "" },
  { slug: "bocadillo-mitad", file: "Bocadillo de calamares-2009.jpg", note: "solo me como la mitad" },
  { slug: "macarrones", file: "Macarrones con tomate y queso.jpg", note: "" },
  { slug: "paella", file: "Plato de paella (Comunidad Valenciana).jpg", note: "" },
  { slug: "paella-200", file: "Plato de paella (Comunidad Valenciana).jpg", note: "son unos 200 g de arroz" },
  { slug: "tortilla", file: "Pincho de tortilla - Madrid.jpg", note: "" },
  {
    slug: "ensalada",
    file: "Ensalada-mixta-lechuga-huevo-tomates-cebolla-maiz-remolacha-restaurante-chipiona.JPG",
    note: "",
  },
  { slug: "bravas", file: "Patatas bravas. Tapa de bar (España).jpg", note: "" },
  { slug: "bravas-sin-salsa", file: "Patatas bravas. Tapa de bar (España).jpg", note: "sin la salsa" },
  { slug: "desayuno", file: "Cafe con leche y cruasán.jpg", note: "" },
  { slug: "teclado", file: "Camera zoom burst on a Microsoft computer keyboard in Tuntorp 8.jpg", note: "" },
];

/** The photo at 1.500 px wide, as the phone would send it (roughly). */
async function commonsPhoto(file: string): Promise<{ url: string; data: Buffer }> {
  const api =
    "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&format=json" +
    `&iiurlwidth=${PHOTO_MAX_SIDE}&titles=${encodeURIComponent(`File:${file}`)}`;
  const response = await fetch(api, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} en Commons`);
  const pages = Object.values((await response.json()).query.pages) as Record<string, any>[];
  const info = pages[0]?.imageinfo?.[0];
  if (!info) throw new Error(`no existe File:${file}`);
  const url: string = info.thumburl ?? info.url;
  const image = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!image.ok) throw new Error(`HTTP ${image.status} en ${url}`);
  return { url: info.descriptionurl, data: Buffer.from(await image.arrayBuffer()) };
}

async function main() {
  const { requestJson, aiSettings } = await import("../src/lib/claude");
  const args = process.argv.slice(2);
  const save = args.includes("--save");
  const filter = args.find((arg) => !arg.startsWith("--"))?.toLowerCase();
  const { model, effort } = aiSettings();
  console.log(`Modelo ${model}, esfuerzo ${effort}\n`);

  for (const { slug, file, note } of PHOTOS.filter((p) => !filter || p.slug.includes(filter))) {
    try {
      const photo = await commonsPhoto(file);
      const started = Date.now();
      const answer = await requestJson("eval", {
        system: MEAL_PHOTO_SYSTEM_PROMPT,
        prompt: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: photo.data.toString("base64") },
          },
          { type: "text", text: buildMealPhotoPrompt(note, LIBRARY) },
        ],
        schema: ESTIMATE_SCHEMA as unknown as Record<string, unknown>,
      });
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      const result = parseEstimate(answer, LIBRARY, NO_FOOD_IN_PHOTO);

      console.log(`▶ ${slug}${note ? ` «${note}»` : ""} (${Math.round(photo.data.length / 1024)} KB, ${seconds} s)`);
      console.log(`   foto: ${photo.url}`);
      if (result.ok) {
        for (const item of result.items) {
          console.log(
            `   ${item.name}: ${item.amount} ${item.unit} × ${item.kcalPer100}/100 = ${item.kcal} kcal` +
              ` [${item.confidence}${item.cookingOil ? ", aceite" : ""}${item.foodId ? `, ${item.foodId}` : ""}]` +
              (item.assumption ? ` — ${item.assumption}` : ""),
          );
        }
        console.log(`   total: ${result.items.reduce((sum, { kcal }) => sum + kcal, 0)} kcal`);
      } else {
        console.log(`   ✗ ${result.error}`);
      }
      console.log();

      if (save) {
        const dir = join(process.cwd(), "tests/fixtures/photo");
        mkdirSync(dir, { recursive: true });
        const expected = result.ok
          ? { kcal: result.items.reduce((sum, { kcal }) => sum + kcal, 0) }
          : { error: true };
        writeFileSync(
          join(dir, `${slug}.json`),
          `${JSON.stringify({ file, photo: photo.url, note, answer, expected }, null, 2)}\n`,
        );
      }
    } catch (error) {
      console.log(`✗ ${slug}: ${error instanceof Error ? error.message : error}\n`);
    }
  }
}

main().then(() => process.exit(0));
