import { env } from "./env.js";
import { createSqlPool, sql } from "./createSqlPool.js";

let billingPoolRef;

const billingSqlConfig = {
  server: env.billingSql.host,
  port: env.billingSql.port,
  database: env.billingSql.database,
  user: env.billingSql.user,
  password: env.billingSql.password,
  options: {
    encrypt: env.billingSql.encrypt,
    trustServerCertificate: env.billingSql.trustServerCertificate,
    requestTimeout: env.hisQueryTimeoutMs
  },
  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 30000
  }
};

export const getBillingPool = async () => {
  if (!billingPoolRef) {
    billingPoolRef = createSqlPool(billingSqlConfig);
  }
  return billingPoolRef.connect();
};

export { sql };
