import { getCloudflareContext } from '@opennextjs/cloudflare'

export function getBrowser() {
  return getCloudflareContext().env.BROWSER
}
