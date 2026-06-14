/** Maps raw upload API errors to localized messages. */
export function mapUploadErrorMessage(
  message: string,
  wrongAccountLabel: string,
): string {
  if (/insufficient permissions|forbidden|unauthorized|403|401/i.test(message)) {
    return wrongAccountLabel;
  }
  return message;
}
