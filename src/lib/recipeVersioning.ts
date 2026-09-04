import type { RecipeItem } from "@/lib/types";
import type {
  RecipeVersion,
  RecipeVersionIngredient,
} from "@/features/reports/types/usageVariance";

const RECIPE_VERSIONS_KEY = "hana-recipe-versions-v1";

/**
 * Loads stored recipe versions or initializes default version 1.0 from existing active recipes.
 */
export function loadRecipeVersions(currentRecipes: RecipeItem[]): RecipeVersion[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(RECIPE_VERSIONS_KEY);
      if (raw) {
        const parsed: RecipeVersion[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse error
    }
  }

  // Generate initial v1.0 versions from current recipes grouped by menu
  return generateInitialVersionsFromRecipes(currentRecipes || []);
}

/**
 * Saves recipe versions to persistent storage
 */
export function saveRecipeVersions(versions: RecipeVersion[]): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(RECIPE_VERSIONS_KEY, JSON.stringify(versions || []));
    } catch {
      // Ignore write failures
    }
  }
}

/**
 * Group flat RecipeItem[] into initial RecipeVersion[] (v1.0, effective from 2026-01-01)
 */
export function generateInitialVersionsFromRecipes(recipes: RecipeItem[]): RecipeVersion[] {
  const grouped = new Map<
    string,
    {
      menuCode: string;
      menuName: string;
      ingredients: RecipeVersionIngredient[];
    }
  >();

  (recipes || []).forEach((r) => {
    if (!r || !r.menuCode || r.isDeleted || r.active === false) return;
    const code = r.menuCode.toUpperCase().trim();
    if (!grouped.has(code)) {
      grouped.set(code, {
        menuCode: r.menuCode,
        menuName: r.menuName || r.menuCode,
        ingredients: [],
      });
    }
    grouped.get(code)!.ingredients.push({
      ingredientCode: r.ingredientCode,
      ingredientName: r.ingredientName,
      quantity: r.quantity,
      unit: r.unit,
      subRecipeCode: r.subRecipeCode,
    });
  });

  const initialVersions: RecipeVersion[] = [];
  grouped.forEach((val) => {
    initialVersions.push({
      id: `ver-${val.menuCode.toLowerCase()}-1`,
      menuCode: val.menuCode,
      menuName: val.menuName,
      versionNumber: 1,
      versionTag: "v1.0",
      effectiveDate: "2026-01-01",
      ingredients: val.ingredients || [],
      changeSummary: "สูตรเริ่มต้น (Initial Release)",
      isActive: true,
      createdBy: "System",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  return initialVersions;
}

/**
 * Finds the effective Recipe / BOM version for a specific menu and target date.
 * If multiple versions exist, chooses the one with effectiveDate <= targetDate that is latest.
 * If no matching version is found, falls back to current active recipes.
 */
export function getEffectiveRecipeIngredients(
  versions: RecipeVersion[],
  menuCode: string,
  targetDate: string,
  fallbackRecipes: RecipeItem[],
): {
  versionTag: string;
  effectiveDate: string;
  ingredients: RecipeVersionIngredient[];
} {
  const cleanCode = (menuCode || "").toUpperCase().trim();
  const dateStr = (targetDate || new Date().toISOString()).slice(0, 10);

  // Filter versions for this menu
  const menuVersions = (versions || []).filter(
    (v) =>
      v &&
      v.menuCode &&
      v.menuCode.toUpperCase().trim() === cleanCode &&
      v.effectiveDate <= dateStr,
  );

  if (menuVersions.length > 0) {
    // Sort descending by effectiveDate, then by versionNumber
    menuVersions.sort((a, b) => {
      if (a.effectiveDate !== b.effectiveDate) {
        return b.effectiveDate.localeCompare(a.effectiveDate);
      }
      return (b.versionNumber || 0) - (a.versionNumber || 0);
    });

    const matched = menuVersions[0];
    return {
      versionTag: matched.versionTag || `v${matched.versionNumber || 1}.0`,
      effectiveDate: matched.effectiveDate,
      ingredients: matched.ingredients || [],
    };
  }

  // Fallback to active recipes from store
  const matchedRecipes = (fallbackRecipes || []).filter(
    (r) =>
      r &&
      r.menuCode &&
      r.menuCode.toUpperCase().trim() === cleanCode &&
      !r.isDeleted &&
      r.active !== false &&
      r.quantity > 0,
  );

  return {
    versionTag: "Current",
    effectiveDate: "2026-01-01",
    ingredients: matchedRecipes.map((r) => ({
      ingredientCode: r.ingredientCode,
      ingredientName: r.ingredientName,
      quantity: r.quantity,
      unit: r.unit,
      subRecipeCode: r.subRecipeCode,
    })),
  };
}
