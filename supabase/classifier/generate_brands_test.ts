import { assertEquals, assertThrows } from "@std/assert";
import {
  brandKey,
  brandsUrl,
  migrationsUrl,
  parseBrands,
  storeSeeds,
  toMigration,
} from "./generate_brands.ts";

const brands = async () => parseBrands(await Deno.readTextFile(brandsUrl));

Deno.test("the newest brands migration is generated from brands.tsv", async () => {
  const names: string[] = [];
  for await (const entry of Deno.readDir(migrationsUrl)) {
    if (entry.name.includes("_classifier_brands")) names.push(entry.name);
  }
  const newest = names.sort().at(-1)!;
  const migration = await Deno.readTextFile(new URL(newest, migrationsUrl));
  assertEquals(
    migration,
    toMigration(await brands()),
    `regenerate ${newest} with generate_brands.ts`,
  );
});

Deno.test("several hundred brands, store brands for dm, Lidl and Edeka", async () => {
  const all = await brands();
  if (all.length < 300) throw new Error(`only ${all.length} brands`);
  const byStore = Object.groupBy(all, (b) => b.store ?? "none");
  for (const store of storeSeeds) {
    if ((byStore[store]?.length ?? 0) < 5) {
      throw new Error(`${store} has too few store brands`);
    }
  }
  const find = (name: string) =>
    all.find((b) => brandKey(b.brand) === brandKey(name));
  assertEquals(find("Pampers")?.product, "Windeln");
  assertEquals(find("Tempo")?.product, "Taschentücher");
  assertEquals(find("Balea")?.store, "dm");
  assertEquals(find("Milbona")?.store, "lidl");
  assertEquals(find("Gut & Günstig")?.store, "edeka");
  assertEquals(find("Nutella")?.product, null);
});

Deno.test("ordinary words, properties and voice filler are not brands", async () => {
  const keys = new Set((await brands()).map((b) => brandKey(b.brand)));
  for (
    const word of [
      "Kinder",
      "Danke",
      "Ja",
      "Bio",
      "Extra",
      "Absolut",
      "Klar",
      "Lillydoo",
    ]
  ) {
    if (keys.has(brandKey(word))) {
      throw new Error(`"${word}" must not be a brand`);
    }
  }
  if (!keys.has(brandKey("Ja!"))) throw new Error('"Ja!" is a brand');
});

Deno.test("brandKey folds like public.brand_key", () => {
  assertEquals(brandKey("Coca-Cola"), brandKey("Coca Cola"));
  assertEquals(brandKey("Dr. Oetker"), brandKey("Dr Oetker"));
  assertEquals(brandKey("Beck's"), "becks");
  assertEquals(brandKey("Müller"), brandKey("Mueller"));
  assertEquals(brandKey("L'Oréal"), "loreal");
  assertEquals(brandKey("Gut & Günstig"), "gut&gunstig");
  assertEquals(brandKey("Ja!"), "ja!");
});

Deno.test("malformed lines are refused with their line number", () => {
  assertThrows(
    () => parseBrands("Coca-Cola\nCoca Cola"),
    Error,
    "repeats line 1",
  );
  assertThrows(() => parseBrands("# x\nBalea\t\taldi"), Error, "brands.tsv:2");
  assertThrows(() => parseBrands("3 Glocken"), Error, "starts with an amount");
  assertThrows(() => parseBrands("a\tb\tdm\tx"), Error, "expected");
  assertThrows(() => parseBrands(" Balea"), Error, "invalid brand");
});

Deno.test("quotes are escaped and empty fields are null", () => {
  const sql = toMigration(parseBrands("Beck's\tBier\nBalea\t\tdm"));
  assertEquals(
    sql.split("\n").filter((l) => l.startsWith("  (")),
    ["  ('Balea', null, 'dm'),", "  ('Beck''s', 'Bier', null);"],
  );
});
