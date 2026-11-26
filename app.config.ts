import type { ConfigContext, ExpoConfig } from 'expo/config';
import brand from './src/core/config/brand.json';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: brand.name,
  slug: brand.slug,
  version: brand.version,
});
