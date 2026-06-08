/** Encode token id for URL paths (supports spaces and special characters). */
export const encodeTokenIdForPath = (tokenId = "") => encodeURIComponent(String(tokenId ?? "").trim());

export const tokenDetailPath = (tokenId = "") => `/tokens/${encodeTokenIdForPath(tokenId)}`;

/** Navigate to token detail when id is present. */
export const goToTokenDetail = (navigate, tokenId = "") => {
  const id = String(tokenId ?? "").trim();
  if (!id || typeof navigate !== "function") {
    return false;
  }
  navigate(tokenDetailPath(id));
  return true;
};
