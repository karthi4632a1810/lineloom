import sql from "mssql";
import { env } from "./env.js";

let poolPromise;

const sqlConfig = {
  server: env.hisSql.host,
  port: env.hisSql.port,
  database: env.hisSql.database,
  user: env.hisSql.user,
  password: env.hisSql.password,
  options: {
    encrypt: env.hisSql.encrypt,
    trustServerCertificate: env.hisSql.trustServerCertificate
  },
  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 30000
  }
};

export const getHisPool = async () => {
  poolPromise ??= sql.connect(sqlConfig);
  return poolPromise;
};

export { sql };
