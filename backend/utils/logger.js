const formatMessage = (level, message, meta = null) => {
  const payload = {
    level,
    message,
    meta,
    timestamp: new Date().toISOString()
  };
  return `${JSON.stringify(payload)}\n`;
};

export const logger = {
  info: (message, meta = null) => {
    process.stdout.write(formatMessage("info", message, meta));
  },
  error: (message, meta = null) => {
    process.stderr.write(formatMessage("error", message, meta));
  }
};
