import * as THREE from 'three';
import type { ExpoWebGLRenderingContext } from 'expo-gl';

type ExpoGlRendererOptions = {
  gl: ExpoWebGLRenderingContext;
  canvas?: HTMLCanvasElement;
  pixelRatio?: number;
  clearColor?: THREE.ColorRepresentation;
  width?: number;
  height?: number;
} & THREE.WebGLRendererParameters;

/**
 * Minimal THREE.WebGLRenderer adapter for expo-gl contexts.
 * Replaces expo-three's Renderer (same API, no extra polyfill deps).
 */
export class ExpoGlRenderer extends THREE.WebGLRenderer {
  constructor({ gl: context, canvas, pixelRatio = 1, clearColor, width, height, ...props }: ExpoGlRendererOptions) {
    const inputCanvas =
      canvas ??
      ({
        width: context.drawingBufferWidth,
        height: context.drawingBufferHeight,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        clientHeight: context.drawingBufferHeight,
      } as HTMLCanvasElement);

    super({
      canvas: inputCanvas,
      context: context as unknown as WebGLRenderingContext,
      ...props,
    });

    this.setPixelRatio(pixelRatio);
    if (width && height) {
      this.setSize(width, height);
    }
    if (clearColor !== undefined) {
      this.setClearColor(clearColor);
    }
  }
}
