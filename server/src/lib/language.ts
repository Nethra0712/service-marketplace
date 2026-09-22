import type { AppLanguage } from '../db/schema/index.js';

export const SUPPORTED_LANGUAGES = ['en', 'si', 'ta'] as const satisfies readonly AppLanguage[];
export const DEFAULT_LANGUAGE: AppLanguage = 'en';

const isSupported = (value: string): value is AppLanguage =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

/**
 * Picks the language to answer in. An explicit `?lang=` wins. Otherwise the
 * `Accept-Language` header is honoured in q-value order, matching on the
 * primary subtag (`si-LK` counts as `si`). Anything unsupported falls back to
 * English, so a request never fails because of its language.
 */
export function resolveLanguage(options: {
  queryLang?: string | undefined;
  acceptLanguage?: string | undefined;
}): AppLanguage {
  const { queryLang, acceptLanguage } = options;
  if (queryLang !== undefined && isSupported(queryLang)) return queryLang;
  if (!acceptLanguage) return DEFAULT_LANGUAGE;

  const candidates = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const qParam = params.find((param) => param.trim().startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return {
        language: tag.trim().toLowerCase().split('-')[0] ?? '',
        q: Number.isNaN(q) ? 0 : q,
        index,
      };
    })
    .filter((candidate) => candidate.q > 0)
    // Highest q first; on a tie, the order the client listed them in.
    .sort((a, b) => b.q - a.q || a.index - b.index);

  return (
    (candidates.find((c) => isSupported(c.language))?.language as AppLanguage | undefined) ??
    DEFAULT_LANGUAGE
  );
}
