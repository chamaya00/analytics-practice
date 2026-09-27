// A small confirm modal: a title, one line of body, "Cancel" and a
// destructive confirm button. Used by the cart's stepper so that the minus
// at quantity 1 asks before it removes a dish — the keyboard and desktop way
// to remove a line, alongside the row's swipe-to-reveal "Remove".
//
// Accessibility: role="dialog" + aria-modal, labelled by its title and
// described by its body; focus moves to Cancel on open (the safe choice
// under a stray Enter), Tab cycles between the two buttons, and Esc or a tap
// on the scrim cancel. On cancel, focus goes back to whatever opened it.
// Styled by BaseLayout.astro's global `.confirm-*` rules.

export interface ConfirmDialogOptions {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  /** Where focus returns when the dialog is cancelled. */
  returnFocusTo?: HTMLElement | null;
}

export interface ConfirmDialogHandle {
  readonly element: HTMLElement;
  cancel(): void;
}

let idCounter = 0;
let current: ConfirmDialogHandle | null = null;

export function openConfirmDialog(options: ConfirmDialogOptions, doc: Document = document): ConfirmDialogHandle {
  current?.cancel();

  idCounter += 1;
  const titleId = `confirm-title-${idCounter}`;
  const bodyId = `confirm-body-${idCounter}`;

  const overlay = doc.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.setAttribute('data-testid', 'confirm-overlay');

  const scrim = doc.createElement('div');
  scrim.className = 'confirm-scrim';
  scrim.setAttribute('data-testid', 'confirm-scrim');
  scrim.setAttribute('aria-hidden', 'true');

  const dialog = doc.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.setAttribute('aria-describedby', bodyId);
  dialog.setAttribute('data-testid', 'confirm-dialog');

  const title = doc.createElement('h2');
  title.className = 'confirm-title';
  title.id = titleId;
  title.textContent = options.title;

  const body = doc.createElement('p');
  body.className = 'confirm-body';
  body.id = bodyId;
  body.textContent = options.body;

  const actions = doc.createElement('div');
  actions.className = 'confirm-actions';

  const cancelButton = doc.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'confirm-button confirm-cancel';
  cancelButton.setAttribute('data-testid', 'confirm-cancel');
  cancelButton.textContent = options.cancelLabel ?? 'Cancel';

  const confirmButton = doc.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = 'confirm-button confirm-danger';
  confirmButton.setAttribute('data-testid', 'confirm-confirm');
  confirmButton.textContent = options.confirmLabel;

  actions.append(cancelButton, confirmButton);
  dialog.append(title, body, actions);
  overlay.append(scrim, dialog);

  let closed = false;

  function teardown(): void {
    closed = true;
    doc.removeEventListener('keydown', onKeydown, true);
    overlay.remove();
    if (current === handle) current = null;
  }

  function cancel(): void {
    if (closed) return;
    teardown();
    options.onCancel?.();
    options.returnFocusTo?.focus();
  }

  function confirm(): void {
    if (closed) return;
    teardown();
    options.onConfirm();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (event.key === 'Tab') {
      // Keep focus inside the dialog: its only two stops are the buttons.
      event.preventDefault();
      const next = doc.activeElement === cancelButton ? confirmButton : cancelButton;
      next.focus();
    }
  }

  scrim.addEventListener('click', cancel);
  cancelButton.addEventListener('click', cancel);
  confirmButton.addEventListener('click', confirm);
  doc.addEventListener('keydown', onKeydown, true);

  const handle: ConfirmDialogHandle = { element: overlay, cancel };
  current = handle;

  doc.body.append(overlay);
  cancelButton.focus();
  return handle;
}
