import { extractUpgradeOffer, renderUpgradeOffer, type UpgradeOffer } from "./upgrade.js";

export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unknown error occurred";
}

/**
 * Error carrying a structured upgrade offer, so a caller that wants the raw
 * data (rather than the rendered card) can still reach it.
 */
export class PlanLimitError extends Error {
  readonly offer: UpgradeOffer;

  constructor(offer: UpgradeOffer, rendered: string) {
    super(rendered);
    this.name = "PlanLimitError";
    this.offer = offer;
  }
}

/**
 * Turn a non-2xx API response into an Error carrying the server's own message.
 *
 * When the body is a plan-limit rejection, the message becomes the full
 * rendered upgrade card — so EVERY tool in this server surfaces the upsell
 * automatically, without each one needing to handle quota errors itself.
 */
export function apiError(status: number, body: unknown): Error {
  const offer = extractUpgradeOffer(body);
  if (offer) return new PlanLimitError(offer, renderUpgradeOffer(offer));

  const msg =
    typeof body === "object" && body !== null && "error" in body
      ? String((body as { error: unknown }).error)
      : `HTTP ${status}`;
  return new Error(msg);
}
