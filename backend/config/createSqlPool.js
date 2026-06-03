import sql from "mssql";

/**
 * Dedicated pool per database. Do not use sql.connect() — it is global and
 * reuses the first database (e.g. KMCH_Frontoffice) for all HIS modules.
 */
export const createSqlPool = (config = {}) => {
  const pool = new sql.ConnectionPool(config);
  const connectPromise = pool.connect();
  return { pool, connect: () => connectPromise };
};

export { sql };
