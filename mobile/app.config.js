module.exports = ({ config }) => {
  const googleServicesFile = process.env.NPL_GOOGLE_SERVICES_FILE;
  if (!googleServicesFile) return config;
  return { ...config, android: { ...config.android, googleServicesFile } };
};
