// WebGL capability check and a tiny lifecycle registry used by tests and by the lab's diagnostics line.

export function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    // release the probe context immediately
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** `frames` counts rendered frames: it rises continuously only while a studio animates (used to verify Pause). */
type LabStats = { live: number; mounts: number; disposed: number; contextLost: number; sceneLoads: Record<string, number>; camera?: number[]; frames?: number };

declare global {
  interface Window { __spacefireLab?: LabStats }
}

export function labStats(): LabStats {
  if (typeof window === "undefined") return { live: 0, mounts: 0, disposed: 0, contextLost: 0, sceneLoads: {} };
  window.__spacefireLab ??= { live: 0, mounts: 0, disposed: 0, contextLost: 0, sceneLoads: {} };
  return window.__spacefireLab;
}
