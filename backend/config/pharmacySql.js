import { env } from "./env.js";
import { createSqlPool, sql } from "./createSqlPool.js";

let pharmacyPoolRef;

const pharmacySqlConfig = {
  server: env.pharmacySql.host,
  port: env.pharmacySql.port,
  database: env.pharmacySql.database,
  user: env.pharmacySql.user,
  password: env.pharmacySql.password,
  options: {
    encrypt: env.pharmacySql.encrypt,
    trustServerCertificate: env.pharmacySql.trustServerCertificate,
    requestTimeout: env.hisQueryTimeoutMs
  },
  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 30000
  }
};

export const getPharmacyPool = async () => {
  if (!pharmacyPoolRef) {
    pharmacyPoolRef = createSqlPool(pharmacySqlConfig);
  }
  return pharmacyPoolRef.connect();
};

export { sql };
