// Runs the test descriptions of phase 7 against the real API and prints the
// breakdowns, to review them by hand. Spends a few cents.
//   node --import tsx scripts/eval-text.ts [filter]
import { loadEnvConfig } from "@next/env";
import {
  buildEstimatePrompt,
  ESTIMATE_SCHEMA,
  ESTIMATE_SYSTEM_PROMPT,
  numberLibrary,
  parseEstimate,
} from "../src/domain/textEstimate";

loadEnvConfig(process.cwd(), true);

// A small library, so the "mi …" cases have something to match.
const library = numberLibrary([
  {
    id: "bread",
    name: "Pan de molde integral",
    brand: "Bimbo",
    baseUnit: "g",
    kcalPer100: 243,
    portions: [{ name: "rebanada", amount: 28 }],
  },
  {
    id: "kefir",
    name: "Kéfir natural",
    brand: "Hacendado",
    baseUnit: "ml",
    kcalPer100: 52,
    portions: [{ name: "vaso", amount: 250 }],
  },
  {
    id: "yogurt",
    name: "Yogur griego ligero",
    brand: "Danone",
    baseUnit: "g",
    kcalPer100: 77,
    portions: [{ name: "unidad", amount: 115 }],
  },
]);

const DESCRIPTIONS = [
  "50 g de avena con 200 ml de leche semidesnatada y un plátano",
  "un plato de lentejas con chorizo",
  "2 huevos fritos",
  "2 huevos fritos, 60 g de pan y un café con leche",
  "100 g de arroz y un filete de pollo a la plancha",
  "un bocadillo de jamón serrano",
  "una ración de tortilla de patatas",
  "ensalada mixta con atún",
  "150 g de macarrones con tomate y queso rallado",
  "una caña y una tapa de patatas bravas",
  "un puñado de almendras",
  "200 g de merluza al horno con patatas cocidas",
  "un cuenco de cereales con leche",
  "paella de marisco",
  "un croissant y un zumo de naranja natural",
  "medio aguacate y 2 huevos revueltos",
  "dos rebanadas de mi pan de molde con 10 g de mantequilla",
  "un vaso de mi kéfir con 30 g de nueces",
  "mi yogur griego con una cucharada de miel",
];

async function main() {
  const { requestJson, aiSettings } = await import("../src/lib/claude");
  const filter = process.argv[2]?.toLowerCase();
  const { model, effort } = aiSettings();
  console.log(`Modelo ${model}, esfuerzo ${effort}\n`);

  for (const description of DESCRIPTIONS.filter(
    (d) => !filter || d.toLowerCase().includes(filter),
  )) {
    const started = Date.now();
    try {
      const answer = await requestJson("eval", {
        system: ESTIMATE_SYSTEM_PROMPT,
        prompt: buildEstimatePrompt(description, library),
        schema: ESTIMATE_SCHEMA as unknown as Record<string, unknown>,
      });
      const result = parseEstimate(answer, library);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (!result.ok) {
        console.log(`✗ ${description} (${seconds} s): ${result.error}\n`);
        continue;
      }
      const total = result.items.reduce((sum, { kcal }) => sum + kcal, 0);
      console.log(`▶ ${description} → ${total} kcal (${seconds} s)`);
      for (const item of result.items) {
        console.log(
          `   ${item.name}: ${item.amount} ${item.unit} × ${item.kcalPer100}/100 = ${item.kcal} kcal` +
            ` [${item.confidence}${item.foodId ? `, biblioteca ${item.foodId}` : ""}${item.cookingOil ? ", aceite" : ""}]` +
            (item.assumption ? ` — ${item.assumption}` : ""),
        );
      }
      console.log();
    } catch (error) {
      console.log(`✗ ${description}: ${error instanceof Error ? error.message : error}\n`);
    }
  }
}

main().then(() => process.exit(0));
