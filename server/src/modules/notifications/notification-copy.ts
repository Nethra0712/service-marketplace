import type { AppLanguage, NotificationKind } from '../../db/schema/index.js';

export interface NotificationCopyParams {
  amount?: string;
  currency?: string;
}

export interface NotificationCopy {
  title: string;
  body: string;
}

type CopyTable = Record<NotificationKind, (params: NotificationCopyParams) => NotificationCopy>;

const EN: CopyTable = {
  booking_accepted: () => ({
    title: 'Booking accepted',
    body: 'A provider has accepted your booking.',
  }),
  provider_en_route: () => ({
    title: 'Provider on the way',
    body: 'Your provider is on their way.',
  }),
  provider_arrived: () => ({ title: 'Provider arrived', body: 'Your provider has arrived.' }),
  booking_completed: () => ({
    title: 'Booking completed',
    body: 'Your booking has been marked as complete.',
  }),
  booking_cancelled: () => ({
    title: 'Booking cancelled',
    body: 'The customer has cancelled this booking.',
  }),
  quote_created: () => ({
    title: 'New quote received',
    body: 'A provider has sent a quote for your booking.',
  }),
  quote_accepted: () => ({
    title: 'Quote accepted',
    body: 'The customer has accepted your quote.',
  }),
  quote_rejected: () => ({
    title: 'Quote declined',
    body: 'The customer has declined your quote.',
  }),
  payment_succeeded: ({ amount, currency }) => ({
    title: 'Payment received',
    body: `Your payment of ${amount} ${currency} was received.`,
  }),
  payment_failed: ({ amount, currency }) => ({
    title: 'Payment failed',
    body: `Your payment of ${amount} ${currency} could not be completed.`,
  }),
  payout_paid: ({ amount, currency }) => ({
    title: 'Payout sent',
    body: `Your payout of ${amount} ${currency} has been sent.`,
  }),
};

const SI: CopyTable = {
  booking_accepted: () => ({
    title: 'වෙන්කිරීම අනුමතයි',
    body: 'සේවා සපයන්නෙකු ඔබේ වෙන්කිරීම පිළිගෙන ඇත.',
  }),
  provider_en_route: () => ({
    title: 'සපයන්නා මාර්ගයේ',
    body: 'ඔබේ සේවා සපයන්නා මාර්ගයේ පවතී.',
  }),
  provider_arrived: () => ({
    title: 'සපයන්නා පැමිණ ඇත',
    body: 'ඔබේ සේවා සපයන්නා පැමිණ ඇත.',
  }),
  booking_completed: () => ({
    title: 'වෙන්කිරීම සම්පූර්ණයි',
    body: 'ඔබේ වෙන්කිරීම සම්පූර්ණ ලෙස සලකුණු කර ඇත.',
  }),
  booking_cancelled: () => ({
    title: 'වෙන්කිරීම අවලංගුයි',
    body: 'පාරිභෝගිකයා මෙම වෙන්කිරීම අවලංගු කර ඇත.',
  }),
  quote_created: () => ({
    title: 'නව මිල ගණනක්',
    body: 'සේවා සපයන්නෙකු ඔබේ වෙන්කිරීම සඳහා මිල ගණනක් යවා ඇත.',
  }),
  quote_accepted: () => ({
    title: 'මිල ගණන් පිළිගන්නා ලදී',
    body: 'පාරිභෝගිකයා ඔබේ මිල ගණන පිළිගෙන ඇත.',
  }),
  quote_rejected: () => ({
    title: 'මිල ගණන් ප්‍රතික්ෂේප විය',
    body: 'පාරිභෝගිකයා ඔබේ මිල ගණන ප්‍රතික්ෂේප කර ඇත.',
  }),
  payment_succeeded: ({ amount, currency }) => ({
    title: 'ගෙවීම ලැබුණි',
    body: `ඔබේ ${amount} ${currency} ගෙවීම ලැබී ඇත.`,
  }),
  payment_failed: ({ amount, currency }) => ({
    title: 'ගෙවීම අසාර්ථකයි',
    body: `ඔබේ ${amount} ${currency} ගෙවීම සම්පූර්ණ කළ නොහැකි විය.`,
  }),
  payout_paid: ({ amount, currency }) => ({
    title: 'ගෙවීම යවන ලදී',
    body: `ඔබේ ${amount} ${currency} ගෙවීම යවා ඇත.`,
  }),
};

const TA: CopyTable = {
  booking_accepted: () => ({
    title: 'முன்பதிவு ஏற்கப்பட்டது',
    body: 'ஒரு சேவை வழங்குநர் உங்கள் முன்பதிவை ஏற்றுக்கொண்டார்.',
  }),
  provider_en_route: () => ({
    title: 'வழங்குநர் வழியில்',
    body: 'உங்கள் சேவை வழங்குநர் வழியில் உள்ளார்.',
  }),
  provider_arrived: () => ({
    title: 'வழங்குநர் வந்துவிட்டார்',
    body: 'உங்கள் சேவை வழங்குநர் வந்துவிட்டார்.',
  }),
  booking_completed: () => ({
    title: 'முன்பதிவு முடிந்தது',
    body: 'உங்கள் முன்பதிவு முடிந்ததாக குறிக்கப்பட்டது.',
  }),
  booking_cancelled: () => ({
    title: 'முன்பதிவு ரத்து',
    body: 'வாடிக்கையாளர் இந்த முன்பதிவை ரத்து செய்துள்ளார்.',
  }),
  quote_created: () => ({
    title: 'புதிய மதிப்பீடு',
    body: 'ஒரு சேவை வழங்குநர் உங்கள் முன்பதிவிற்கு மதிப்பீடு அனுப்பியுள்ளார்.',
  }),
  quote_accepted: () => ({
    title: 'மதிப்பீடு ஏற்கப்பட்டது',
    body: 'வாடிக்கையாளர் உங்கள் மதிப்பீட்டை ஏற்றுக்கொண்டார்.',
  }),
  quote_rejected: () => ({
    title: 'மதிப்பீடு நிராகரிக்கப்பட்டது',
    body: 'வாடிக்கையாளர் உங்கள் மதிப்பீட்டை நிராகரித்தார்.',
  }),
  payment_succeeded: ({ amount, currency }) => ({
    title: 'கட்டணம் பெறப்பட்டது',
    body: `உங்கள் ${amount} ${currency} கட்டணம் பெறப்பட்டது.`,
  }),
  payment_failed: ({ amount, currency }) => ({
    title: 'கட்டணம் தோல்வி',
    body: `உங்கள் ${amount} ${currency} கட்டணத்தை முடிக்க முடியவில்லை.`,
  }),
  payout_paid: ({ amount, currency }) => ({
    title: 'பணம் அனுப்பப்பட்டது',
    body: `உங்கள் ${amount} ${currency} கொடுப்பனவு அனுப்பப்பட்டது.`,
  }),
};

const TABLES: Record<AppLanguage, CopyTable> = { en: EN, si: SI, ta: TA };

/** Builds a notification's title/body in the recipient's own preferred language — never the caller's. */
export function buildNotificationCopy(
  kind: NotificationKind,
  language: AppLanguage,
  params: NotificationCopyParams = {},
): NotificationCopy {
  return TABLES[language][kind](params);
}
