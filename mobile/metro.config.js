const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);

// Share the published scorecard and standings calculations with the website.
config.watchFolders = [path.resolve(__dirname, '../website/src/lib')];
config.resolver.useWatchman = false;
module.exports = config;
