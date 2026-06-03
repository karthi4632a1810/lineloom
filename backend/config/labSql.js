import { env } from "./env.js";
import { createSqlPool, sql } from "./createSqlPool.js";

let labPoolRef;

const labSqlConfig = {
  server: env.labSql.host,
  port: env.labSql.port,
  database: env.labSql.database,
  user: env.labSql.user,
  password: env.labSql.password,
  options: {
    encrypt: env.labSql.encrypt,
    trustServerCertificate: env.labSql.trustServerCertificate,
    requestTimeout: env.hisQueryTimeoutMs
  },
  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 30000
  }
};

export const getLabPool = async () => {
  if (!labPoolRef) {
    labPoolRef = createSqlPool(labSqlConfig);
  }
  return labPoolRef.connect();
};

export { sql };
