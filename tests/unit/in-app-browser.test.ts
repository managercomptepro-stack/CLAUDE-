/**
 * User-agents in the formats sent by real devices (Android 13/14 Samsung, Tecno, itel phones
 * common in Cameroon; iPhone iOS 17). In-app browsers append their marker to the system WebView
 * user-agent: WhatsApp « WhatsApp/x », Facebook « [FBAN/…;FBAV/…] » or « [FB_IAB/FB4A;…] »,
 * Instagram « Instagram x Android/iPhone », TikTok « musical_ly » / « BytedanceWebview ».
 */
import { describe, expect, it } from 'vitest';
import { chromeIntentUrl, detectInAppBrowser, googleMode, isAndroid } from '../../src/lib/in-app-browser';

const UA = {
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  operaAndroid:
    'Mozilla/5.0 (Linux; Android 13; TECNO KI5q) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.193 Mobile Safari/537.36 OPR/80.0.2254.73545',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  whatsappAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A145F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36 WhatsApp/2.24.19.86',
  whatsappIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/24.19.86',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/482.0.0.42.81;]',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/481.0.0.51.108;FBBV/650000000;FBDV/iPhone14,7;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBCR/;FBID/phone;FBLC/fr_FR;FBOP/5]',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 13; TECNO CK7n Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36 Instagram 349.0.0.39.105 Android (33/13; 480dpi; 1080x2296; TECNO; TECNO CK7n; TECNO-CK7n; mt6789; fr_FR; 640123456)',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 349.0.0.20.104 (iPhone14,7; iOS 17_6; fr_FR; fr; scale=3.00; 1170x2532; 640123456)',
  tiktokAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A145F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36 trill_360701 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/36.7.1 ByteLocale/fr Region/CM BytedanceWebview/d8a21c6',
  genericWebView:
    'Mozilla/5.0 (Linux; Android 12; itel A665L Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.5993.111 Mobile Safari/537.36',
};

describe('detectInAppBrowser', () => {
  it.each([
    ['chromeAndroid', null],
    ['safariIos', null],
    ['chromeIos', null],
    ['operaAndroid', null],
    ['desktopChrome', null],
    ['whatsappAndroid', 'whatsapp'],
    ['whatsappIos', 'whatsapp'],
    ['facebookAndroid', 'facebook'],
    ['facebookIos', 'facebook'],
    ['instagramAndroid', 'instagram'],
    ['instagramIos', 'instagram'],
    ['tiktokAndroid', 'tiktok'],
    ['genericWebView', 'webview'],
  ] as const)('%s → %s', (key, expected) => {
    expect(detectInAppBrowser(UA[key])).toBe(expected);
  });

  it('knows Android', () => {
    expect(isAndroid(UA.whatsappAndroid)).toBe(true);
    expect(isAndroid(UA.whatsappIos)).toBe(false);
  });

  it('builds the Chrome intent link', () => {
    expect(chromeIntentUrl('https://nioxxer.com/connexion?next=%2Fpublier')).toBe(
      'intent://nioxxer.com/connexion?next=%2Fpublier#Intent;scheme=https;package=com.android.chrome;end',
    );
  });
});

describe('googleMode', () => {
  it('redirect only on mobile with the auth handler on the same domain', () => {
    expect(googleMode({ mobile: true, authDomain: 'nioxxer.com', hostname: 'nioxxer.com' })).toBe('redirect');
    expect(googleMode({ mobile: false, authDomain: 'nioxxer.com', hostname: 'nioxxer.com' })).toBe('popup');
    expect(
      googleMode({
        mobile: true,
        authDomain: 'nioxxer-staging.firebaseapp.com',
        hostname: 'nioxxer-staging--preview-abc.web.app',
      }),
    ).toBe('popup');
  });
});
