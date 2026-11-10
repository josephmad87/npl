const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// This standalone app does not import the sibling web/admin applications.
config.watchFolders = [];
config.resolver.useWatchman = false;
module.exports = config;
