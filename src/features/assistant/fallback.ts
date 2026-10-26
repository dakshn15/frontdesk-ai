import type { LanguageModelV4 } from "@ai-sdk/provider";

/**
 * A model that tries `primary` and, if it fails before anything streams (an outage, a
 * timeout, a bad key), retries once on `secondary`. Errors after streaming has started
 * aren't retried, so a reply is never sent twice.
 */
export function withFallback(
  primary: LanguageModelV4,
  secondary: LanguageModelV4,
  onSwitch: (error: unknown) => void,
): LanguageModelV4 {
  return {
    specificationVersion: "v4",
    provider: primary.provider,
    modelId: primary.modelId,
    supportedUrls: primary.supportedUrls,
    async doGenerate(options) {
      try {
        return await primary.doGenerate(options);
      } catch (error) {
        if (options.abortSignal?.aborted) throw error;
        onSwitch(error);
        return secondary.doGenerate(options);
      }
    },
    async doStream(options) {
      try {
        return await primary.doStream(options);
      } catch (error) {
        if (options.abortSignal?.aborted) throw error;
        onSwitch(error);
        return secondary.doStream(options);
      }
    },
  };
}
