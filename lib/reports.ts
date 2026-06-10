/** Keys for i18n (`safety.reportReasons.*`) and report submission. */
export const REPORT_REASON_KEYS = [
  'inappropriate',
  'scam',
  'illegal',
  'other'
] as const;

export type ReportReasonKey = (typeof REPORT_REASON_KEYS)[number];

/** @deprecated Use REPORT_REASON_KEYS */
export const REPORT_REASONS = REPORT_REASON_KEYS;

/** @deprecated Use ReportReasonKey */
export type ReportReasonLabel = ReportReasonKey;

/** Values stored in `public.reports.reason` (DB check constraint). */
const REPORT_REASON_DB_VALUES: Record<ReportReasonKey, string> = {
  inappropriate: 'Contenu inapproprie',
  scam: 'Arnaque',
  illegal: 'Contenu illegal',
  other: 'Autre'
};

export function reportReasonToDbValue(key: ReportReasonKey): string {
  return REPORT_REASON_DB_VALUES[key];
}
