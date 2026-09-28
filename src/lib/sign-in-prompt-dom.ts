// The sign-in sheet — checkout (#149) and the tracker's tip control (#171)
// both open it, reused rather than redrawn with only its heading (and
// optionally its body) varying by caller (docs/design/162-*, "History rows":
// "opens the existing sign-in sheet, titled 'Sign in to tip'"). Extracted
// from checkout-dom.ts, which is still its only caller for the default copy.

import type { OAuthProvider } from './auth-client';

/** New accounts' one-time preload (ADR 0008, amended by #145; owner, 2026-09-27, O6). Used only in the default body copy below. */
const STARTING_BALANCE_TEXT = '$30.00 and 750.000 ₫';

const DEFAULT_HEADING = 'Sign in to place your order';
const DEFAULT_BODY = `Orders spend play money from a wallet. New accounts start with ${STARTING_BALANCE_TEXT}. Your cart and offers stay as they are.`;

export interface SignInPromptOptions {
  heading?: string;
  body?: string;
}

export function renderSignInPrompt(
  providers: { google: boolean; apple: boolean },
  onProvider: (provider: OAuthProvider) => void,
  onClose: () => void,
  options: SignInPromptOptions = {},
): { close: () => void; element: HTMLElement } {
  const overlay = document.createElement('div');
  overlay.className = 'sign-in-sheet-overlay';
  overlay.setAttribute('data-testid', 'sign-in-prompt');

  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.setAttribute('data-testid', 'sign-in-prompt-scrim');

  const panel = document.createElement('div');
  panel.className = 'sheet';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'sign-in-prompt-heading');
  panel.tabIndex = -1;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'sheet-close';
  closeButton.setAttribute('data-testid', 'sign-in-prompt-close');
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>';

  const heading = document.createElement('h1');
  heading.id = 'sign-in-prompt-heading';
  heading.textContent = options.heading ?? DEFAULT_HEADING;

  const body = document.createElement('p');
  body.textContent = options.body ?? DEFAULT_BODY;

  const buttons = document.createElement('div');
  buttons.className = 'sign-in-provider-buttons';

  function providerButton(provider: OAuthProvider, label: string, testId: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `sign-in-provider sign-in-provider--${provider}`;
    button.setAttribute('data-testid', testId);
    button.textContent = label;
    button.addEventListener('click', () => onProvider(provider));
    return button;
  }

  if (providers.google) buttons.append(providerButton('google', 'Continue with Google', 'google-signin'));
  if (providers.apple) buttons.append(providerButton('apple', 'Continue with Apple', 'apple-signin'));

  const fine = document.createElement('p');
  fine.className = 'sign-in-prompt-fine';
  fine.textContent = 'We keep the email Google or Apple shares with us, to hold your wallet. No payment is taken.';

  const notNow = document.createElement('button');
  notNow.type = 'button';
  notNow.className = 'sign-in-not-now';
  notNow.setAttribute('data-testid', 'sign-in-not-now');
  notNow.textContent = 'Not now';

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    onClose();
  }
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') close();
  }
  scrim.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  notNow.addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);

  panel.append(closeButton, heading, body, buttons, fine, notNow);
  overlay.append(scrim, panel);

  return { close, element: overlay };
}
