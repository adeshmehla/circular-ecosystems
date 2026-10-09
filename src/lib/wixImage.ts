/**
 * Converts a Wix media URI to a Wix CDN image URL.
 *
 * Input format:  wix:image://v1/{fileId}/{filename}#originWidth=W&originHeight=H
 * Output format: https://static.wixstatic.com/media/{fileId}/v1/fill/w_{w},h_{h},al_c,q_85,usm_0.66_1.00_0.01,enc_avif/{fileId}
 *
 * Usage:
 *   wixImageUrl(post.media?.wixMedia?.image, 800, 450)
 */
export function wixImageUrl(
  wixUri: string | null | undefined,
  width = 800,
  height = 450
): string {
  if (!wixUri) return '';
  const match = wixUri.match(/wix:image:\/\/v1\/([^/]+)/);
  if (!match) return '';
  const fileId = match[1];
  return (
    `https://static.wixstatic.com/media/${fileId}/v1/fill/` +
    `w_${width},h_${height},al_c,q_85,usm_0.66_1.00_0.01,enc_avif/${fileId}`
  );
}
