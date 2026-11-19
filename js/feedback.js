let dialog, message, closeButton, previousFocus;
export function showError(text) {
  if (!dialog) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = new URL('../css/feedback.css', import.meta.url).href;
    document.head.append(style);
    dialog = document.createElement('dialog');
    dialog.className = 'error-dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-labelledby', 'error-dialog-title');
    dialog.setAttribute('aria-describedby', 'error-dialog-message');
    const title = document.createElement('h2');
    title.id = 'error-dialog-title'; title.textContent = 'Something needs attention';
    message = document.createElement('p'); message.id = 'error-dialog-message';
    closeButton = document.createElement('button'); closeButton.type = 'button';
    closeButton.textContent = 'Close'; closeButton.onclick = () => dialog.close();
    dialog.append(title, message, closeButton);
    dialog.addEventListener('close', () => previousFocus?.focus());
    document.body.append(dialog);
  }
  message.textContent = String(text);
  if (!dialog.open) {
    previousFocus = document.activeElement;
    dialog.showModal();
  }
  closeButton.focus();
}
