// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, '../..');
const escape = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The app never imports server code; ignoring these folders also keeps the
// file watcher away from the embedded database files written at runtime.
const ignored = ['services', 'database', 'docs', 'e2e', 'test-results', 'references'].map(
  (dir) => new RegExp(`^${escape(path.join(root, dir))}[\\\\/].*`),
);
config.watchFolders = (config.watchFolders ?? []).filter((f) => !path.resolve(f).startsWith(path.join(root, 'services')));
const existing = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), ...ignored];

module.exports = config;
