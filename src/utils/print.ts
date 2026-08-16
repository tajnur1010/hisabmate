/**
 * Print an arbitrary HTML document through a hidden, same-origin iframe.
 *
 * This is how HisabMate turns an on-screen report into a shareable PDF: the
 * browser's own print dialog offers "Save as PDF" on both desktop and mobile.
 * Using an iframe (rather than window.open) avoids popup blockers and keeps
 * everything offline — no network, no third-party PDF library. The frame is
 * removed once the dialog has taken its snapshot.
 */
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let printed = false;
  const trigger = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } catch {
      /* dialog dismissed or unavailable — nothing to do */
    }
    // Keep the frame alive briefly so the print preview can render it.
    window.setTimeout(() => iframe.remove(), 1500);
  };

  // Print once the document has settled; fall back to a short timer for
  // browsers that report "complete" synchronously after document.write.
  if (doc.readyState === 'complete') {
    window.setTimeout(trigger, 150);
  } else {
    win.addEventListener('load', () => window.setTimeout(trigger, 150));
    // Safety net in case the load event never fires for the written doc.
    window.setTimeout(trigger, 600);
  }
}
