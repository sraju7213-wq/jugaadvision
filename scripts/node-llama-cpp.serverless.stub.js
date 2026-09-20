/**
 * Serverless stand-in for `node-llama-cpp`.
 *
 * The bundles under api/ are deployed to Vercel, where:
 *   - the project directory is read-only and the disk is ephemeral, so no GGUF
 *     model can ever live there, and
 *   - @vercel/nft would trace the real package (~1 GB once every
 *     @node-llama-cpp/* platform binary is counted) into all 17 functions,
 *     which OOM-kills Vercel's 8 GB build container (SIGKILL, "Out of Memory
 *     event detected during the build").
 *
 * scripts/bundle-api.mjs aliases the real package to this file so the deployed
 * functions stay small. Throwing here is deliberate: every caller
 * (checkLocalInferenceReady, getLlamaRuntime/loadModel) wraps the import in
 * try/catch, so local-model endpoints report `native_unavailable` instead of
 * taking the whole serverless function down. Local GGUF inference keeps working
 * on a self-hosted Node runtime, which never uses these bundles.
 */

const MESSAGE =
  'node-llama-cpp is unavailable in this serverless build: local GGUF inference requires a self-hosted Node runtime.';

throw new Error(MESSAGE);

export function getLlama() {
  throw new Error(MESSAGE);
}

export class LlamaChatSession {
  constructor() {
    throw new Error(MESSAGE);
  }
}

export default { getLlama, LlamaChatSession };
