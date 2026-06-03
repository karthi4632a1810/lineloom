/** Encode token id for URL paths (supports spaces and special characters). */
export const encodeTokenIdForPath = (tokenId = "") => encodeURIComponent(String(tokenId ?? "").trim());

export const tokenDetailPath = (tokenId = "") => `/tokens/${encodeTokenIdForPath(tokenId)}`;
