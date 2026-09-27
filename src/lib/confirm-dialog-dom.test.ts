import { afterEach, describe, expect, it, vi } from 'vitest';
import { openConfirmDialog } from './confirm-dialog-dom';

afterEach(() => {
  document.body.innerHTML = '';
});

function opener(): HTMLButtonElement {
  const button = document.createElement('button');
  document.body.append(button);
  button.focus();
  return button;
}

function open(onConfirm = vi.fn(), onCancel = vi.fn(), returnFocusTo: HTMLElement | null = opener()) {
  openConfirmDialog({
    title: 'Remove Margherita?',
    body: "It'll be taken out of your North Beach Pizzeria cart.",
    confirmLabel: 'Remove',
    onConfirm,
    onCancel,
    returnFocusTo,
  });
  return { onConfirm, onCancel, returnFocusTo };
}

function dialog(): HTMLElement | null {
  return document.querySelector('[data-testid="confirm-dialog"]');
}

describe('openConfirmDialog', () => {
  it('is a modal dialog labelled by its title and described by its body', () => {
    open();
    const el = dialog()!;
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(el.getAttribute('aria-labelledby')!);
    expect(title?.textContent).toBe('Remove Margherita?');
    const body = document.getElementById(el.getAttribute('aria-describedby')!);
    expect(body?.textContent).toBe("It'll be taken out of your North Beach Pizzeria cart.");
  });

  it('moves focus to Cancel on open', () => {
    open();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('confirm-cancel');
  });

  it('Cancel closes it without confirming and returns focus to the opener', () => {
    const { onConfirm, onCancel, returnFocusTo } = open();
    document.querySelector<HTMLButtonElement>('[data-testid="confirm-cancel"]')?.click();
    expect(dialog()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(returnFocusTo);
  });

  it('Esc cancels', () => {
    const { onConfirm, onCancel, returnFocusTo } = open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(returnFocusTo);
  });

  it('a tap on the scrim cancels', () => {
    const { onConfirm, onCancel } = open();
    document.querySelector<HTMLElement>('[data-testid="confirm-scrim"]')?.click();
    expect(dialog()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('the confirm button confirms once and closes', () => {
    const { onConfirm, onCancel } = open();
    const confirm = document.querySelector<HTMLButtonElement>('[data-testid="confirm-confirm"]')!;
    expect(confirm.textContent).toBe('Remove');
    confirm.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it('Tab keeps focus between its two buttons', () => {
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement?.getAttribute('data-testid')).toBe('confirm-confirm');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement?.getAttribute('data-testid')).toBe('confirm-cancel');
  });

  it('after closing, Esc no longer does anything', () => {
    const { onCancel } = open();
    document.querySelector<HTMLButtonElement>('[data-testid="confirm-confirm"]')?.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
