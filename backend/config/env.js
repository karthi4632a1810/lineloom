import dotenv from "dotenv";

dotenv.config();

const parseBoolean = (value, fallback = false) => {
  if (value == null) {
    return fallback;
  }
  return String(value).toLowerCase() === "true";
};

export const env = {
  port: Number(process.env.PORT ?? 5000),
  mongoUri:
    process.env.MONGO_URI ??
    "mongodb://127.0.0.1:27017/patient_waiting_tracker",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  hisSql: {
    host: process.env.HIS_SQL_HOST ?? process.env.OP_IP_DB_SERVER ?? "localhost",
    port: Number(process.env.HIS_SQL_PORT ?? 1433),
    database:
      process.env.HIS_SQL_DATABASE ?? process.env.OP_IP_DB_NAME ?? "KMCH_Frontoffice",
    user: process.env.HIS_SQL_USER ?? process.env.OP_IP_DB_USER ?? "readonly_user",
    password:
      process.env.HIS_SQL_PASSWORD ?? process.env.OP_IP_DB_PASS ?? "readonly_password",
    encrypt: parseBoolean(process.env.HIS_SQL_ENCRYPT, true),
    trustServerCertificate: parseBoolean(process.env.HIS_SQL_TRUST_CERT, true)
  }
};
