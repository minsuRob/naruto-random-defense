'use no memo';

import { useEffect, useRef } from 'react';

import { groundFrustum } from '@/game/camera/frustum';
import { ALTARS, PLAZA_HALF, PLOT_HALF, mapBounds } from '@/game/config/map';
import type { Plot } from '@/game/engine/types';
import { ALTAR_COLOR } from '@/game/render/palette';
import { getViewHandle } from '@/game/runtime/view-handle';
import { createMinimapProjection } from './minimap-math';

const SIZE = 180;
/** ~30 Hz is plenty for dots; the 3D view still runs at full rate. */
const FRAME_MS = 33;

/**
 * 2D overlay minimap.
 *
 * Deliberately not a render-to-texture: a second scene pass would double the
 * per-frame draw cost (and the fill cost on mobile) to show a few hundred dots,
 * and clicking to pan needs the inverse transform either way.
 */
export function Minimap({
  plots,
  localPlotId,
}: {
  plots: readonly Plot[];
  localPlotId: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bounds = mapBounds();
    const proj = createMinimapProjection(bounds, SIZE, SIZE);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Static layers are identical every frame — draw them once, then blit.
    const staticLayer = document.createElement('canvas');
    staticLayer.width = SIZE * dpr;
    staticLayer.height = SIZE * dpr;
    const sctx = staticLayer.getContext('2d')!;
    sctx.scale(dpr, dpr);
    drawStatic(sctx, proj, plots, localPlotId);

    const frustum: { x: number; z: number }[] = [];
    let raf = 0;
    let last = 0;

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (now - last < FRAME_MS) return;
      last = now;

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(staticLayer, 0, 0, SIZE, SIZE);

      const { camera, engine } = getViewHandle();

      // Mobs, straight off the engine's typed arrays — no React in the path.
      if (engine) {
        const mobs = engine.state.mobs;
        for (let i = 0; i < mobs.count; i++) {
          if (!mobs.active[i]) continue;
          const [px, py] = proj.worldToMap(mobs.x[i], mobs.z[i]);
          const boss = mobs.isBoss[i] === 1;
          ctx.beginPath();
          ctx.arc(px, py, boss ? 4 : 2, 0, Math.PI * 2);
          ctx.fillStyle = boss ? '#ffb020' : '#d94b3c';
          ctx.fill();
          if (boss) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#ffe3a8';
            ctx.stroke();
          }
        }

        for (const unit of engine.state.units.values()) {
          const [px, py] = proj.worldToMap(unit.x, unit.z);
          ctx.fillStyle = '#4aa3ff';
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      }

      if (camera) {
        groundFrustum(camera, frustum);
        // Zoomed out, the view can be wider than the map — keep it in the widget.
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, SIZE, SIZE);
        ctx.clip();
        ctx.beginPath();
        for (let i = 0; i < frustum.length; i++) {
          const [px, py] = proj.worldToMap(frustum[i].x, frustum[i].z);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(240,240,245,0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [plots, localPlotId]);

  /** Click or drag anywhere on the minimap to move the camera there. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = mapBounds();
    const proj = createMinimapProjection(bounds, SIZE, SIZE);
    let dragging = false;

    const moveCamera = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const [x, z] = proj.mapToWorld(e.clientX - rect.left, e.clientY - rect.top);
      getViewHandle().rig?.setGoalTarget(x, z);
    };
    const down = (e: PointerEvent) => {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      moveCamera(e);
    };
    const move = (e: PointerEvent) => dragging && moveCamera(e);
    const up = (e: PointerEvent) => {
      dragging = false;
      canvas.releasePointerCapture(e.pointerId);
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: 6,
        border: '1px solid #2b3038',
        background: '#0e1116',
        cursor: 'crosshair',
        touchAction: 'none',
      }}
    />
  );
}

/**
 * The four islands and the plaza they surround. Drawn once per mount: at this
 * scale (about 3.5 px per world unit) the whole map is 180 px, so the layout is
 * the thing that tells you where you are.
 */
function drawStatic(
  ctx: CanvasRenderingContext2D,
  proj: ReturnType<typeof createMinimapProjection>,
  plots: readonly Plot[],
  localPlotId: number
) {
  ctx.fillStyle = '#0e1116';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const rect = (x0: number, z0: number, x1: number, z1: number) => {
    const [px0, py0] = proj.worldToMap(x0, z0);
    const [px1, py1] = proj.worldToMap(x1, z1);
    return [px0, py0, px1 - px0, py1 - py0] as const;
  };

  // The shared plaza, and the four altars in it.
  ctx.fillStyle = '#2f333b';
  ctx.fillRect(...rect(-PLAZA_HALF, -PLAZA_HALF, PLAZA_HALF, PLAZA_HALF));
  for (const altar of ALTARS) {
    const [x, y] = proj.worldToMap(altar.pos.x, altar.pos.z);
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = ALTAR_COLOR[altar.kind];
    ctx.fill();
  }

  for (const plot of plots) {
    const mine = plot.id === localPlotId;
    const { origin, lane } = plot;

    ctx.fillStyle = mine ? '#243021' : '#191d17';
    ctx.fillRect(
      ...rect(
        origin.x - PLOT_HALF,
        origin.z - PLOT_HALF,
        origin.x + PLOT_HALF,
        origin.z + PLOT_HALF
      )
    );

    // Lane samples are plot-local, like everything else about a lane.
    ctx.beginPath();
    const count = lane.samples.length / 2;
    for (let i = 0; i < count; i++) {
      const [x, y] = proj.worldToMap(
        lane.samples[i * 2] + origin.x,
        lane.samples[i * 2 + 1] + origin.z
      );
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = mine ? '#8a7550' : '#4c4334';
    ctx.lineWidth = mine ? 2 : 1;
    ctx.stroke();

    const gate = (s: number, color: string, r: number) => {
      const p = lane.positionAt(s);
      const [x, y] = proj.worldToMap(p.x + origin.x, p.z + origin.z);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };
    if (mine) {
      gate(lane.spawnS, '#e8e3d4', 3.5);
      gate(lane.leftBossS, '#e8862c', 3);
      gate(lane.rightBossS, '#e8862c', 3);
    }
  }

  // Which one is mine. A glyph would be unreadable at 35 px a side.
  const local = plots.find((p) => p.id === localPlotId);
  if (local) {
    ctx.strokeStyle = '#4aa3ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      ...rect(
        local.origin.x - PLOT_HALF,
        local.origin.z - PLOT_HALF,
        local.origin.x + PLOT_HALF,
        local.origin.z + PLOT_HALF
      )
    );
  }

  // Map border.
  ctx.strokeStyle = '#2b3038';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
}
