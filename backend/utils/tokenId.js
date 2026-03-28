import crypto from "crypto";

export const generateTokenId = () => {
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const unix = Date.now().toString().slice(-6);
  return `T-${unix}-${suffix}`;
};
