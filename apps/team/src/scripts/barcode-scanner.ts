import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

export type ScanResultHandler = (code: string) => void;

export type BarcodeScannerController = {
  stop: () => void;
};

function isScanMiss(error: unknown) {
  return error instanceof Error && error.name === "NotFoundException";
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera access was denied. Allow camera permission in your browser settings, or enter the code manually below.";
    }
    if (error.name === "NotFoundError") {
      return "No camera found on this device. Enter the barcode or QR code manually below.";
    }
    if (error.name === "NotReadableError") {
      return "Camera is in use by another app. Close it and try again, or enter the code manually.";
    }
    if (error.name === "SecurityError") {
      return "Camera requires a secure connection (HTTPS). Enter the code manually, or use HTTPS.";
    }
  }
  return "Could not access camera. Check permissions or use manual entry.";
}

const SCAN_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
];

export async function startBarcodeScanner(
  videoEl: HTMLVideoElement,
  onScan: ScanResultHandler,
  onError?: (message: string) => void,
): Promise<BarcodeScannerController | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    onError?.("Camera not supported in this browser. Enter the code manually below.");
    return null;
  }

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, SCAN_FORMATS);

  const reader = new BrowserMultiFormatReader(hints);
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

  const callback = (
    result: { getText: () => string } | undefined,
    error: unknown,
  ) => {
    if (result) {
      handleScan(result.getText());
      return;
    }
    if (error && !isScanMiss(error)) {
      console.warn("barcode scan error", error);
    }
  };

  const rearCameraConstraints: MediaStreamConstraints = {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };

  try {
    await reader.decodeFromConstraints(
      rearCameraConstraints,
      videoEl,
      callback,
    );
  } catch (err) {
    console.warn("rear camera unavailable, trying default device", err);
    try {
      await reader.decodeFromVideoDevice(undefined, videoEl, callback);
    } catch (fallbackErr) {
      console.error("camera start failed", fallbackErr);
      onError?.(cameraErrorMessage(fallbackErr));
      return null;
    }
  }

  return {
    stop() {
      active = false;
      reader.reset();
      BrowserMultiFormatReader.releaseAllStreams();
    },
  };
}
