const root = document.querySelector<HTMLElement>("[data-confirm-root]");
if (root) {
  const shareBtn = root.querySelector<HTMLButtonElement>("[data-confirm-share]");
  const shareStatus = root.querySelector<HTMLElement>("[data-confirm-share-status]");
  const calendarBtn = root.querySelector<HTMLButtonElement>("[data-confirm-calendar]");
  const printBtn = root.querySelector<HTMLButtonElement>("[data-confirm-print]");

  const shareTitle = root.dataset.shareTitle ?? "Booking confirmed";
  const shareText = root.dataset.shareText ?? "";
  const shareUrl = root.dataset.shareUrl ?? window.location.href;
  const icsFilename = root.dataset.icsFilename ?? "appointment.ics";
  const icsContentBase64 = root.dataset.icsContentB64 ?? "";
  const icsContent = icsContentBase64
    ? decodeURIComponent(
        Array.from(atob(icsContentBase64), (char) =>
          `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`,
        ).join(""),
      )
    : "";

  function showShareStatus(message: string) {
    if (!shareStatus) return;
    shareStatus.textContent = message;
    shareStatus.hidden = false;
    window.setTimeout(() => {
      shareStatus.hidden = true;
    }, 2600);
  }

  shareBtn?.addEventListener("click", async () => {
    const payload = { title: shareTitle, text: shareText, url: shareUrl };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const clipboardText = [shareText, shareUrl].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(clipboardText);
      showShareStatus("Details copied to clipboard");
    } catch {
      showShareStatus("Copy the confirmation link from your browser bar");
    }
  });

  calendarBtn?.addEventListener("click", () => {
    if (!icsContent) return;

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = icsFilename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  });

  printBtn?.addEventListener("click", () => {
    window.print();
  });
}
