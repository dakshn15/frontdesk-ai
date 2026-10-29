import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { getServerEnv } from "@/env/server";
import { fakeModel } from "@/features/assistant/fake-model";
import { withFallback } from "@/features/assistant/fallback";
import type { AiKeys } from "../ai-keys";

export type ModelChoice = {
  model: LanguageModelV4;
  provider: string;
  modelId: string;
  /** Called when the first provider fails and the other one answers instead. */
  onFallback: (handler: (provider: string, modelId: string) => void) => void;
};

/** Small, current models from each provider; checked against the providers' lists. */
export const MODEL_IDS = {
  openai: "gpt-5.4-mini",
  google: "gemini-3.5-flash",
} as const;

/**
 * The workspace's preferred provider, falling back to the other one when both keys are set.
 * Null when no key is set. AI_FAKE=1 (never on Vercel) uses the scripted test model.
 */
export function chooseModel(
  preferred: "openai" | "google",
  keys: AiKeys,
): ModelChoice | null {
  const env = getServerEnv();
  let fallbackHandler: (provider: string, modelId: string) => void = () => {};
  const onFallback = (handler: typeof fallbackHandler) => {
    fallbackHandler = handler;
  };

  if (env.AI_FAKE === "1" && !process.env.VERCEL) {
    return {
      model: fakeModel(),
      provider: "fake",
      modelId: "scripted",
      onFallback,
    };
  }

  const available = {
    openai: keys.openai
      ? createOpenAI({ apiKey: keys.openai })(MODEL_IDS.openai)
      : null,
    google: keys.google
      ? createGoogleGenerativeAI({ apiKey: keys.google })(MODEL_IDS.google)
      : null,
  };
  const order =
    preferred === "google"
      ? (["google", "openai"] as const)
      : (["openai", "google"] as const);
  const [first, second] = order.filter((name) => available[name]);
  if (!first) return null;
  const primary = available[first]!;
  if (!second) {
    return {
      model: primary,
      provider: first,
      modelId: MODEL_IDS[first],
      onFallback,
    };
  }
  const model = withFallback(primary, available[second]!, (error) => {
    console.warn(`receptionist: ${first} failed, using ${second}`, error);
    fallbackHandler(second, MODEL_IDS[second]);
  });
  return { model, provider: first, modelId: MODEL_IDS[first], onFallback };
}

/** Whether the receptionist can answer at all (a key is set, or the scripted test model). */
export function assistantReady(keys: AiKeys): boolean {
  return chooseModel("openai", keys) !== null;
}

/**
 * The model that grades test answers by meaning, or null without a real key. The scripted
 * test model can't judge meaning, so it never grades.
 */
export function chooseGrader(keys: AiKeys): LanguageModelV4 | null {
  if (keys.openai)
    return createOpenAI({ apiKey: keys.openai })(MODEL_IDS.openai);
  if (keys.google)
    return createGoogleGenerativeAI({ apiKey: keys.google })(MODEL_IDS.google);
  return null;
}
