/**
 * In-app browsers (WhatsApp, Facebook, Instagram, TikTok…) where Google refuses its sign-in
 * (ARCHITECTURE § 7). The Google button is hidden there and the visitor is invited to open the
 * site in Chrome. E-mail sign-in stays available everywhere.
 */

export type InAppBrowser = 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'snapchat' | 'webview';

const MARKERS: readonly [InAppBrowser, RegExp][] = [
  ['whatsapp', /WhatsApp/i],
  ['instagram', /Instagram/i],
  ['facebook', /FBAN|FBAV|FB_IAB|FBIOS|\bFB4A\b|MessengerForiOS|\bOrca-Android\b/i],
  ['tiktok', /musical_ly|TikTok|BytedanceWebview|\bTrill\b/i],
  ['snapchat', /Snapchat/i],
];

/** The in-app browser named by a user-agent, or null for a regular browser. */
export function detectInAppBrowser(ua: string): InAppBrowser | null {
  for (const [name, re] of MARKERS) if (re.test(ua)) return name;
  // Android WebView: « ; wv) » in the platform part (Chrome Android never has it).
  if (/Android/i.test(ua) && /;\s*wv\)/.test(ua)) return 'webview';
  return null;
}

export function isAndroid(ua: string): boolean {
  return /Android/i.test(ua);
}

/** Link that asks Android to open an https page in Chrome. */
export function chromeIntentUrl(href: string): string {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;end`;
}

export type GoogleMode = 'popup' | 'redirect';

/**
 * Redirect on mobile, popup on desktop. Redirect is only reliable when the auth handler is
 * served by the site itself (authDomain == current host: nioxxer.com in production); on the
 * preview channel (*.web.app with authDomain on firebaseapp.com) → popup only.
 */
export function googleMode(opts: { mobile: boolean; authDomain: string; hostname: string }): GoogleMode {
  return opts.mobile && opts.authDomain === opts.hostname ? 'redirect' : 'popup';
}

/** Touch-first device with a phone/tablet user-agent. */
export function isMobileUserAgent(ua: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}
