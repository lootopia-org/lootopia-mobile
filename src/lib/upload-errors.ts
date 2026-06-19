type UploadErrorLabels = {
  wrongAccount: string;
  uploadFailed: string;
  serverUnavailable: string;
  networkFailed: string;
};

/** Maps raw upload API errors to user-facing messages. */
export function mapUploadErrorMessage(message: string, labels: UploadErrorLabels): string {
  if (/insufficient permissions|forbidden|unauthorized|403|401/i.test(message)) {
    return labels.wrongAccount;
  }
  if (looksLikeHtmlErrorPage(message)) {
    if (/502|503|504|bad gateway|service unavailable|gateway timeout/i.test(message)) {
      return labels.serverUnavailable;
    }
    return labels.uploadFailed;
  }
  if (/502|503|504|bad gateway|service unavailable|gateway timeout/i.test(message)) {
    return labels.serverUnavailable;
  }
  if (/network request failed|failed to fetch|network error/i.test(message)) {
    return labels.networkFailed;
  }
  return message;
}

function looksLikeHtmlErrorPage(message: string): boolean {
  const trimmed = message.trimStart();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
}
