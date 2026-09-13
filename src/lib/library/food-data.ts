export type FoodMatch = {
  fdcId: number;
  name: string;
  dataType: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
};
export type FoodSearchState = {
  status: "idle" | "success" | "error";
  message: string;
  foods: FoodMatch[];
};
export class FoodLookupError extends Error {}
const dataTypes = ["Foundation", "SR Legacy", "Survey (FNDDS)"];
const object = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

export function parseQuery(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 80) {
    throw new FoodLookupError("Enter a food name between 2 and 80 characters.");
  }
  return value.trim();
}
export function parseFdcId(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) {
    throw new FoodLookupError("Choose a valid food result and retry.");
  }
  return Number(value);
}
export function foodSource(fdcId: number): string {
  return `USDA FoodData Central: https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`;
}

// Search uses flat nutrientId/value; full details use nutrient.id/amount.
// Both non-branded datasets express these nutrient amounts per 100 g.
// Missing nutrients are not zero. Skip incomplete records instead of guessing.
export function normalizeFood(value: unknown): FoodMatch | null {
  const food = object(value);
  if (typeof food.fdcId !== "number" || !Number.isSafeInteger(food.fdcId) || food.fdcId <= 0 || food.fdcId > 9999999999 ||
      typeof food.description !== "string" || !food.description.trim() ||
      typeof food.dataType !== "string" || !dataTypes.includes(food.dataType) || !Array.isArray(food.foodNutrients)) return null;
  const nutrients = food.foodNutrients.map(object);
  function amount(ids: number[], unit: string): number | null {
    for (const id of ids) {
      for (const item of nutrients) {
        const nutrient = object(item.nutrient);
        const nutrientId = item.nutrientId ?? nutrient.id;
        const unitName = item.unitName ?? nutrient.unitName;
        const value = item.value ?? item.amount;
        if (nutrientId === id && typeof unitName === "string" && unitName.toLowerCase() === unit &&
            typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= (unit === "g" ? 100 : 1000)) {
          return Math.round(value * 100) / 100;
        }
      }
    }
    return null;
  }
  const calories = amount([1008, 2048, 2047], "kcal");
  const protein = amount([1003], "g");
  const carbs = amount([1005], "g");
  const fat = amount([1004], "g");
  if (calories === null || protein === null || carbs === null || fat === null) return null;
  return { fdcId: food.fdcId, name: food.description.trim(), dataType: food.dataType,
    calories, protein, carbs, fat, source: foodSource(food.fdcId) };
}

export interface FoodDataProvider {
  search(query: string): Promise<FoodMatch[]>;
  get(fdcId: number): Promise<FoodMatch>;
}

export function createUsdaProvider(apiKey: string | undefined, request: typeof fetch = fetch): FoodDataProvider {
  async function read(path: string, body?: object): Promise<unknown> {
    if (!apiKey?.trim()) throw new FoodLookupError("Food search needs setup: add USDA_API_KEY to .env.local and restart the app. Manual entry still works.");
    try {
      const response = await request(`https://api.nal.usda.gov/fdc/v1/${path}`, {
        method: body ? "POST" : "GET",
        headers: { "X-Api-Key": apiKey.trim(), ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 429) throw new FoodLookupError("Food search has reached its request limit. Please try again later or use manual entry.");
      if (response.status === 401 || response.status === 403) throw new FoodLookupError("Food search could not authenticate. Check the server's USDA_API_KEY.");
      if (!response.ok) throw new FoodLookupError("Food search is temporarily unavailable. Please retry.");
      return await response.json();
    } catch (error) {
      if (error instanceof FoodLookupError) throw error;
      throw new FoodLookupError("Could not reach food search. Check the connection and retry.");
    }
  }
  return {
    async search(query) {
      const result = object(await read("foods/search", { query: parseQuery(query), dataType: dataTypes, pageSize: 20, pageNumber: 1 }));
      if (!Array.isArray(result.foods)) throw new FoodLookupError("Food search returned an unexpected response. Please retry.");
      const seen = new Set<number>();
      return result.foods.map(normalizeFood).filter((food): food is FoodMatch => {
        if (!food || seen.has(food.fdcId)) return false;
        seen.add(food.fdcId);
        return true;
      }).slice(0, 10);
    },
    async get(fdcId) {
      const id = parseFdcId(String(fdcId));
      const food = normalizeFood(await read(`food/${id}?format=full`));
      if (!food || food.fdcId !== id) throw new FoodLookupError("This food has incomplete nutrition data. Choose another result or use manual entry.");
      return food;
    },
  };
}
