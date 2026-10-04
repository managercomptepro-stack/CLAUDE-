import { render, type ComponentChild } from 'preact';
import { initShell } from './client';

/** Wires the static shell, then replaces the skeleton in <main id="app"> with the page. */
export function mountPage(content: ComponentChild): void {
  initShell();
  const root = document.getElementById('app');
  if (!root) return;
  root.textContent = '';
  render(content, root);
}
