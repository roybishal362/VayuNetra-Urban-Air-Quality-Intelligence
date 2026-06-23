/** Best-effort check that a functional WebGL context can be created (client only). */
export function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    return !!(window.WebGLRenderingContext && gl && gl.getParameter(gl.VERSION));
  } catch {
    return false;
  }
}
