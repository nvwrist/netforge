// Camera: world ↔ screen transform. UI never touches world coordinates directly.

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  minZoom = 0.35;
  maxZoom = 2.5;
  private vw = 1;
  private vh = 1;

  setViewport(w: number, h: number): void {
    this.vw = w;
    this.vh = h;
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - this.x) * this.zoom + this.vw / 2, y: (wy - this.y) * this.zoom + this.vh / 2 };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.vw / 2) / this.zoom + this.x, y: (sy - this.vh / 2) / this.zoom + this.y };
  }

  // Zoom keeping the world point under (sx, sy) visually fixed.
  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  pan(dxScreen: number, dyScreen: number): void {
    this.x -= dxScreen / this.zoom;
    this.y -= dyScreen / this.zoom;
    this.clamp();
  }

  clamp(): void {
    const B = 4200;
    this.x = Math.min(B, Math.max(-B, this.x));
    this.y = Math.min(B, Math.max(-B, this.y));
  }
}
