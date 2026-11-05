import { z } from "zod";

const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const aiLive = Boolean(API_KEY);

type GeminiResponse = { candidates?: { content?: { parts?: { text?: string }[] } }[] };

async function generate(system: string, prompt: string, temperature: number) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as GeminiResponse;
  return body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

function parseJson(text: string) {
  return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
}

// One retry with the validation error appended; Gemini occasionally drops a field.
export async function generateJson<T>({ system, prompt, schema, temperature = 0.4 }: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
}): Promise<T> {
  if (!aiLive) throw new Error("GEMINI_API_KEY is not set");

  let input = prompt;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await generate(system, input, temperature);
    try {
      return schema.parse(parseJson(text));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      input = `${prompt}\n\nThe previous response did not match the schema (${lastError.slice(0, 400)}). Respond with valid JSON only.`;
    }
  }
  throw new Error(`Invalid JSON from Gemini: ${lastError}`);
}
