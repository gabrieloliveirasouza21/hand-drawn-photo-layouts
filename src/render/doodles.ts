type Point = [number, number]

/** Estrela centrada em (0,0). */
export function starPoints(size: number, spikes = 5): Point[] {
  const outer = size / 2
  const inner = outer * 0.45
  const points: Point[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI * i) / spikes - Math.PI / 2
    points.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  return points
}

/** Coração centrado em (0,0), curva paramétrica clássica. */
export function heartPoints(size: number, steps = 28): Point[] {
  const k = size / 34
  const points: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const t = (Math.PI * 2 * i) / steps
    const x = 16 * Math.sin(t) ** 3
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    points.push([x * k, (y + 2) * k])
  }
  return points
}
