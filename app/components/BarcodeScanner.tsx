"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeBarcode, SCAN_FORMATS } from "@/domain/barcode";
import { FlashlightIcon } from "./icons";

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string; format: string }[]>;
};

type NativeDetector = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats: () => Promise<string[]>;
};

type Status =
  | { kind: "starting" }
  | { kind: "scanning"; torch: boolean | null }
  | { kind: "error"; message: string };

const SCAN_INTERVAL_MS = 150;

/**
 * The browser's own BarcodeDetector where it reads EAN (Chrome on Android),
 * else the ZXing polyfill (Safari), whose WebAssembly is served by the app.
 */
async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: NativeDetector }).BarcodeDetector;
  if (native) {
    try {
      const supported = await native.getSupportedFormats();
      if (supported.includes("ean_13")) return new native({ formats: [...SCAN_FORMATS] });
    } catch {
      // Fall through to the polyfill.
    }
  }

  const { BarcodeDetector, setZXingModuleOverrides, ZXING_WASM_VERSION } = await import(
    "barcode-detector/ponyfill"
  );
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) =>
      path.endsWith(".wasm") ? `/zxing/zxing_reader-${ZXING_WASM_VERSION}.wasm` : prefix + path
  });
  return new BarcodeDetector({ formats: [...SCAN_FORMATS] });
}

function cameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") {
    return "No hay permiso para usar la cámara. Actívalo en los ajustes del navegador o escribe el número.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No se encontró ninguna cámara. Escribe el número.";
  }
  if (name === "NotReadableError") {
    return "La cámara está ocupada por otra app. Ciérrala o escribe el número.";
  }
  return "No se pudo abrir la cámara. Escribe el número.";
}

/**
 * Rear camera reading EAN-13, EAN-8 and UPC codes. Calls `onDetected` once
 * with the first valid code; remount it to scan again.
 */
export function BarcodeScanner({
  onDetected
}: {
  onDetected: (code: string, format: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [status, setStatus] = useState<Status>({ kind: "starting" });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stream: MediaStream | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus({
          kind: "error",
          message: "Este navegador no deja usar la cámara aquí (necesita HTTPS). Escribe el número."
        });
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (error) {
        if (!stopped) setStatus({ kind: "error", message: cameraError(error) });
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current!;
      video.srcObject = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      // The torch is a Chrome-on-Android extra; elsewhere the button is hidden.
      const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;

      let detector: Detector;
      try {
        await video.play();
        detector = await createDetector();
      } catch {
        if (!stopped) {
          setStatus({ kind: "error", message: "No se pudo iniciar el lector. Escribe el número." });
        }
        return;
      }
      if (stopped) return;
      setStatus({ kind: "scanning", torch: capabilities?.torch ? false : null });

      const scan = async () => {
        if (stopped) return;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            for (const { rawValue, format } of await detector.detect(video)) {
              if (stopped) return;
              if (normalizeBarcode(rawValue, format)) {
                stopped = true;
                navigator.vibrate?.(50);
                onDetectedRef.current(rawValue, format);
                return;
              }
            }
          } catch {
            // A frame that cannot be read; try the next one.
          }
        }
        timer = setTimeout(scan, SCAN_INTERVAL_MS);
      };
      void scan();
    }

    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      trackRef.current = null;
    };
  }, []);

  async function toggleTorch() {
    if (status.kind !== "scanning" || status.torch === null || !trackRef.current) return;
    const next = !status.torch;
    try {
      await trackRef.current.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet]
      });
      setStatus({ kind: "scanning", torch: next });
    } catch {
      setStatus({ kind: "scanning", torch: null });
    }
  }

  if (status.kind === "error") {
    return (
      <p
        className="rounded-lg border border-dashed border-line bg-white px-4 py-6 text-center text-sm leading-6 text-muted"
        role="status"
      >
        {status.message}
      </p>
    );
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-ink">
      <video
        aria-label="Imagen de la cámara"
        className="h-full w-full object-cover"
        muted
        playsInline
        ref={videoRef}
      />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white">
        {status.kind === "starting" ? "Abriendo la cámara..." : "Centra el código de barras"}
      </p>
      {status.kind === "scanning" && status.torch !== null ? (
        <button
          aria-label={status.torch ? "Apagar la linterna" : "Encender la linterna"}
          aria-pressed={status.torch}
          className={`absolute right-2 top-2 grid h-12 w-12 place-items-center rounded-full ${
            status.torch ? "bg-white text-ink" : "bg-black/50 text-white"
          }`}
          onClick={toggleTorch}
          type="button"
        >
          <FlashlightIcon on={status.torch} />
        </button>
      ) : null}
    </div>
  );
}
