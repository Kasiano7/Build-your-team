/**
 * App variants (https://docs.expo.dev/tutorial/eas/multiple-app-variants/).
 * Static values live in app.json; this file only adjusts them per variant,
 * selected by APP_VARIANT (set per build profile in eas.json).
 *
 *  - production : com.buildyourteam.app, HTTPS only.
 *  - preview    : com.buildyourteam.app.preview, installs next to production,
 *                 and may reach a game server on the local network over plain
 *                 HTTP (testing a server running on a PC). Never in production.
 *  - development: com.buildyourteam.app.dev (development client).
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

type Variant = 'development' | 'preview' | 'production';
const variant: Variant =
  process.env.APP_VARIANT === 'development' || process.env.APP_VARIANT === 'preview' ? process.env.APP_VARIANT : 'production';

const suffix = { development: '.dev', preview: '.preview', production: '' }[variant];
const nameSuffix = { development: ' (Dev)', preview: ' (Preview)', production: '' }[variant];
const allowLocalHttp = variant !== 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `${config.name ?? 'Build Your Team'}${nameSuffix}`,
  slug: config.slug ?? 'build-your-team',
  ios: {
    ...config.ios,
    bundleIdentifier: `com.buildyourteam.app${suffix}`,
    infoPlist: {
      ...config.ios?.infoPlist,
      ...(allowLocalHttp
        ? {
            // Test builds may talk to a game server on the LAN over plain HTTP.
            NSAppTransportSecurity: { NSAllowsArbitraryLoads: true, NSAllowsLocalNetworking: true },
            NSLocalNetworkUsageDescription: 'Se connecter au serveur de jeu de test sur votre réseau local.',
          }
        : {}),
    },
  },
  android: {
    ...config.android,
    package: `com.buildyourteam.app${suffix}`,
  },
  plugins: [...(config.plugins ?? []), ['expo-build-properties', { android: { usesCleartextTraffic: allowLocalHttp } }]],
  extra: {
    ...config.extra,
    appVariant: variant,
  },
});
