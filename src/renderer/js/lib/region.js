// Paese e lingua scelti al primo avvio: valuta, formati, prefisso telefonico e funzioni locali
// (codice fiscale, marca da bollo e detrazione 19% esistono solo in Italia e a San Marino).
import { setLocale } from './format.js';
import { setLanguage, startTranslating } from './i18n.js';

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
];

// codice, nome inglese, lingua proposta, valuta, formato locale, prefisso telefonico
export const COUNTRIES = [
  ['IT', 'Italy', 'it', 'EUR', 'it-IT', '39'], ['SM', 'San Marino', 'it', 'EUR', 'it-SM', '378'], ['CH', 'Switzerland', 'de', 'CHF', 'de-CH', '41'],
  ['FR', 'France', 'fr', 'EUR', 'fr-FR', '33'], ['DE', 'Germany', 'de', 'EUR', 'de-DE', '49'], ['AT', 'Austria', 'de', 'EUR', 'de-AT', '43'],
  ['ES', 'Spain', 'es', 'EUR', 'es-ES', '34'], ['PT', 'Portugal', 'pt', 'EUR', 'pt-PT', '351'], ['GB', 'United Kingdom', 'en', 'GBP', 'en-GB', '44'],
  ['IE', 'Ireland', 'en', 'EUR', 'en-IE', '353'], ['BE', 'Belgium', 'fr', 'EUR', 'fr-BE', '32'], ['NL', 'Netherlands', 'en', 'EUR', 'nl-NL', '31'],
  ['LU', 'Luxembourg', 'fr', 'EUR', 'fr-LU', '352'], ['MC', 'Monaco', 'fr', 'EUR', 'fr-MC', '377'], ['MT', 'Malta', 'en', 'EUR', 'en-MT', '356'],
  ['GR', 'Greece', 'en', 'EUR', 'el-GR', '30'], ['CY', 'Cyprus', 'en', 'EUR', 'el-CY', '357'], ['HR', 'Croatia', 'en', 'EUR', 'hr-HR', '385'],
  ['SI', 'Slovenia', 'en', 'EUR', 'sl-SI', '386'], ['PL', 'Poland', 'en', 'PLN', 'pl-PL', '48'], ['CZ', 'Czechia', 'en', 'CZK', 'cs-CZ', '420'],
  ['SK', 'Slovakia', 'en', 'EUR', 'sk-SK', '421'], ['HU', 'Hungary', 'en', 'HUF', 'hu-HU', '36'], ['RO', 'Romania', 'en', 'RON', 'ro-RO', '40'],
  ['BG', 'Bulgaria', 'en', 'BGN', 'bg-BG', '359'], ['RS', 'Serbia', 'en', 'RSD', 'sr-RS', '381'], ['AL', 'Albania', 'en', 'ALL', 'sq-AL', '355'],
  ['SE', 'Sweden', 'en', 'SEK', 'sv-SE', '46'], ['NO', 'Norway', 'en', 'NOK', 'nb-NO', '47'], ['DK', 'Denmark', 'en', 'DKK', 'da-DK', '45'],
  ['FI', 'Finland', 'en', 'EUR', 'fi-FI', '358'], ['EE', 'Estonia', 'en', 'EUR', 'et-EE', '372'], ['LV', 'Latvia', 'en', 'EUR', 'lv-LV', '371'],
  ['LT', 'Lithuania', 'en', 'EUR', 'lt-LT', '370'], ['UA', 'Ukraine', 'en', 'UAH', 'uk-UA', '380'], ['TR', 'Turkey', 'en', 'TRY', 'tr-TR', '90'],
  ['US', 'United States', 'en', 'USD', 'en-US', '1'], ['CA', 'Canada', 'en', 'CAD', 'en-CA', '1'], ['MX', 'Mexico', 'es', 'MXN', 'es-MX', '52'],
  ['AR', 'Argentina', 'es', 'ARS', 'es-AR', '54'], ['BR', 'Brazil', 'pt', 'BRL', 'pt-BR', '55'], ['CL', 'Chile', 'es', 'CLP', 'es-CL', '56'],
  ['CO', 'Colombia', 'es', 'COP', 'es-CO', '57'], ['PE', 'Peru', 'es', 'PEN', 'es-PE', '51'], ['UY', 'Uruguay', 'es', 'UYU', 'es-UY', '598'],
  ['VE', 'Venezuela', 'es', 'USD', 'es-VE', '58'], ['EC', 'Ecuador', 'es', 'USD', 'es-EC', '593'], ['DO', 'Dominican Republic', 'es', 'DOP', 'es-DO', '1'],
  ['CU', 'Cuba', 'es', 'CUP', 'es-CU', '53'], ['AU', 'Australia', 'en', 'AUD', 'en-AU', '61'], ['NZ', 'New Zealand', 'en', 'NZD', 'en-NZ', '64'],
  ['ZA', 'South Africa', 'en', 'ZAR', 'en-ZA', '27'], ['MA', 'Morocco', 'fr', 'MAD', 'fr-MA', '212'], ['TN', 'Tunisia', 'fr', 'TND', 'fr-TN', '216'],
  ['DZ', 'Algeria', 'fr', 'DZD', 'fr-DZ', '213'], ['SN', 'Senegal', 'fr', 'XOF', 'fr-SN', '221'], ['EG', 'Egypt', 'en', 'EGP', 'en-EG', '20'],
  ['NG', 'Nigeria', 'en', 'NGN', 'en-NG', '234'], ['AO', 'Angola', 'pt', 'AOA', 'pt-AO', '244'], ['MZ', 'Mozambique', 'pt', 'MZN', 'pt-MZ', '258'],
  ['AE', 'United Arab Emirates', 'en', 'AED', 'en-AE', '971'], ['SA', 'Saudi Arabia', 'en', 'SAR', 'en-SA', '966'], ['IL', 'Israel', 'en', 'ILS', 'en-IL', '972'],
  ['IN', 'India', 'en', 'INR', 'en-IN', '91'], ['SG', 'Singapore', 'en', 'SGD', 'en-SG', '65'], ['PH', 'Philippines', 'en', 'PHP', 'en-PH', '63'],
  ['JP', 'Japan', 'en', 'JPY', 'ja-JP', '81'], ['CN', 'China', 'en', 'CNY', 'zh-CN', '86'], ['KR', 'South Korea', 'en', 'KRW', 'ko-KR', '82'],
].map(([code, name, lang, currency, locale, phone]) => ({ code, name, lang, currency, locale, phone }));

export const flag = code => String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));

export function regionFor(code, language) {
  const c = COUNTRIES.find(x => x.code === code) || { code: 'OT', name: 'Other', lang: 'en', currency: 'USD', locale: 'en-US', phone: '' };
  return { country: c.code, language: language || c.lang, currency: c.currency, locale: c.locale, phonePrefix: c.phone };
}

let current = regionFor('IT', 'it');
export const region = () => current;
export const isIT = () => current.country === 'IT' || current.country === 'SM';

// applica formati e lingua; restituisce dopo aver caricato il dizionario
export async function applyRegion(r) {
  current = { ...regionFor('IT', 'it'), ...(r || {}) };
  setLocale({ locale: current.locale, currency: current.currency, phonePrefix: current.phonePrefix });
  document.documentElement.classList.toggle('region-it', isIT());
  document.documentElement.classList.toggle('region-intl', !isIT());
  await setLanguage(current.language);
  startTranslating();
}
