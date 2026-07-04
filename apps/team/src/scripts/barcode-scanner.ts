import { BrowserMultiFormatReader } from "@zxing/browser";

export type ScanResultHandler = (code: string) => void;

export type BarcodeScannerController = {
  stop: () => void;
};

function isScanMiss(error: unknown) {
  return error instanceof Error && error.name === "NotFoundException";
}

export async function startBarcodeScanner(
  videoEl: HTMLVideoElement,
  onScan: ScanResultHandler,
  onError?: (message: string) => void,
): Promise<BarcodeScannerController | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    onError?.("Camera not supported in this browser.");
    return null;
  }

  const reader = new BrowserMultiFormatReader();
  let active = true;
  let lastCode = "";
  let lastAt = 0;

  const handleScan = (code: string | undefined) => {
    if (!active || !code) return;
    const trimmed = code.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (trimmed === lastCode && now - lastAt < 1500) return;
    lastCode = trimmed;
    lastAt = now;
    onScan(trimmed);
  };

  try {
    await reader.decodeFromVideoDevice(undefined, videoEl, (result, error) => {
      if (result) {
        handleScan(result.getText());
        return;
      }
      if (error && !isScanMiss(error)) {
        console.warn("barcode scan error", error);
      }
    });
  } catch (err) {
    console.error("camera start failed", err);
    onError?.("Could not access camera. Check permissions or use manual entry.");
    return null;
  }

  return {
    stop() {
      active = false;
      reader.reset();
      BrowserMultiFormatReader.releaseAllStreams();
    },
  };
}
