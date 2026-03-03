type ModelListResponse = {
  models?: Array<{
    name: string;
    supportedGenerationMethods?: string[];
  }>;
};

let cachedModelPath: string | null = null;
let cachedModelPathAtMs = 0;

export async function getGeminiModelPath(): Promise<string> {
  const forced = process.env.GEMINI_MODEL;
  if (forced?.trim()) {
    const v = forced.trim();
    return v.includes("/") ? v : `models/${v}`;
  }

  if (cachedModelPath && Date.now() - cachedModelPathAtMs < 10 * 60 * 1000) {
    return cachedModelPath;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "models/gemini-1.5-flash";

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error("LIST_MODELS_ERROR:", res.status, res.statusText, bodyText);
      return "models/gemini-2.0-flash";
    }

    const data = (await res.json()) as ModelListResponse;
    const candidates =
      data.models?.filter((m) => m?.name && m.supportedGenerationMethods?.includes("generateContent")) || [];

    const preferred = [
      "models/gemini-2.0-flash",
      "models/gemini-2.0-flash-lite",
      "models/gemini-1.5-flash",
      "models/gemini-1.5-pro",
      "models/gemini-1.0-pro",
      "models/gemini-pro",
    ];

    const candidateNames = new Set(candidates.map((m) => m.name));
    const chosen = preferred.find((m) => candidateNames.has(m)) || candidates[0]?.name || "models/gemini-2.0-flash";

    cachedModelPath = chosen;
    cachedModelPathAtMs = Date.now();
    console.log("GEMINI_MODEL_SELECTED:", chosen);
    return chosen;
  } catch (e) {
    console.error("getGeminiModelPath error:", e);
    return "models/gemini-2.0-flash";
  }
}
