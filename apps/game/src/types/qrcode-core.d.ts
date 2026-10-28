/**
 * The QR encoder core of the `qrcode` package (pure JS, no Node or DOM
 * dependency). Imported directly so neither Metro target ever pulls the
 * package's Node entry (fs, streams) or its canvas renderers.
 */
declare module 'qrcode/lib/core/qrcode' {
  export { create } from 'qrcode';
}
