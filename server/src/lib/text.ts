/** Trims text; anything left empty (or missing) becomes null. */
export const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
};
