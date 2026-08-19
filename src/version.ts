/**
 * The server's identity, in one place.
 *
 * These used to live in index.ts while http.ts carried its own hardcoded
 * default of "2.0.0". Only the HTTP path is used by the hosted endpoint, so
 * `initialize` reported 2.0.0 to every directory that scans it long after the
 * package reached 5.x — a drift invisible from the file that looks like the
 * source of truth. Both transports now read this constant.
 *
 * Keep SERVER_VERSION in step with package.json.
 */
export const SERVER_NAME = "misarreach";
/** Package version reported by `initialize`. Keep in step with package.json. */
export const SERVER_VERSION = "5.1.2";
