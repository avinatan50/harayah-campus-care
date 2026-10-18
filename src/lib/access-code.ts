export const EASY_CODE_MESSAGE = "נדרש להקיש 4 ספרות אחרונות של ת.ז. , אנא נסה שוב";
export const TAKEN_CODE_MESSAGE = "קוד זה כבר קיים. יש לפנות לאבי, אב הבית.";

/** Reject repeated digits/pairs and ascending or descending arithmetic sequences. */
export function isEasyCode(code: string): boolean {
  if (!/^\d{4}$/.test(code)) return false;
  if (/^(\d)\1{3}$/.test(code) || /^(\d{2})\1$/.test(code) || /^(\d)\1(\d)\2$/.test(code)) return true;
  const digits = Array.from(code, Number);
  const steps = digits.slice(1).map((digit, i) => (digit - (digits[i] ?? 0) + 10) % 10);
  return steps.every(step => step === steps[0]);
}