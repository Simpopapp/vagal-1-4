/**
 * Loads the generated AI catalog so the gateway's request and response types
 * know which models this workspace actually has.
 *
 * Regenerate with `bunx ai-gateway generate --model <slug>` whenever the model
 * selection changes; never hand-edit `src/generated`.
 */
import type {} from "./generated/ai-gateway/models";
