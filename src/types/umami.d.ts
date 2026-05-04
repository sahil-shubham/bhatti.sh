// Ambient type for the Umami tracker's window globals. Loaded by the
// proxied script at /cf/script.js (see worker/index.js). The tracker
// attaches `umami` to window once it boots; on dev/preview/non-bhatti.sh
// it never attaches, hence the optional chaining everywhere we use it.
//
// Reference: https://docs.umami.is/docs/tracker-functions

export {};

declare global {
    interface Window {
        umami?: {
            /** Track a pageview, custom event, or pre-built payload. */
            track: (
                eventNameOrPayload?:
                    | string
                    | Record<string, unknown>
                    | ((props: Record<string, unknown>) => Record<string, unknown>),
                eventData?: Record<string, unknown>,
            ) => void;
            /** Identify the current session (with optional session data). */
            identify: (
                idOrData: string | Record<string, unknown>,
                data?: Record<string, unknown>,
            ) => void;
        };
    }
}
