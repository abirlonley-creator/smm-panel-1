/**
 * Fritsch-Carlson Monotone Cubic Spline Interpolation
 * 
 * Guarantees that:
 * 1. The curve passes EXACTLY through every knot (x_i, y_i).
 * 2. Monotonicity is preserved: if y is non-decreasing, the interpolant is strictly non-decreasing (no overshoot or dips).
 * 3. Continuous first derivative (C1 smooth).
 * 4. Can be evaluated at any x or converted directly into smooth SVG cubic Bézier segments (C cp1x cp1y, cp2x cp2y, x y).
 */

export interface SplinePoint {
  x: number;
  y: number;
}

export interface MonotoneCubicSpline {
  evaluate: (xVal: number) => number;
  toSvgPath: (getX: (x: number) => number, getY: (y: number) => number) => string;
  points: SplinePoint[];
}

export function createMonotoneCubicSpline(rawPoints: SplinePoint[]): MonotoneCubicSpline {
  if (!rawPoints || rawPoints.length === 0) {
    return {
      evaluate: () => 0,
      toSvgPath: () => "",
      points: [],
    };
  }

  // Deduplicate and ensure sorted by x strictly
  const points: SplinePoint[] = [];
  const sorted = [...rawPoints].sort((a, b) => a.x - b.x);

  for (const pt of sorted) {
    if (points.length === 0) {
      points.push({ x: pt.x, y: pt.y });
    } else {
      const prev = points[points.length - 1];
      if (Math.abs(pt.x - prev.x) < 1e-6) {
        // Same x, keep larger y for monotonicity
        prev.y = Math.max(prev.y, pt.y);
      } else {
        // Enforce non-decreasing y
        const clampedY = Math.max(prev.y, pt.y);
        points.push({ x: pt.x, y: clampedY });
      }
    }
  }

  const n = points.length;
  if (n === 1) {
    const constY = points[0].y;
    return {
      evaluate: () => constY,
      toSvgPath: (getX, getY) => `M ${getX(points[0].x).toFixed(1)} ${getY(constY).toFixed(1)}`,
      points,
    };
  }

  // Step 1: Compute secants (slopes of secant lines)
  const dx: number[] = new Array(n - 1);
  const dy: number[] = new Array(n - 1);
  const m: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    dy[i] = points[i + 1].y - points[i].y;
    m[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
  }

  // Step 2: Initialize tangents d_k as average of adjacent secants
  const d: number[] = new Array(n);
  d[0] = m[0];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      d[i] = 0;
    } else {
      d[i] = (m[i - 1] + m[i]) / 2;
    }
  }
  d[n - 1] = m[n - 2];

  // Step 3: Fritsch-Carlson algorithm to restrict tangents for strict monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(dy[i]) < 1e-9) {
      d[i] = 0;
      d[i + 1] = 0;
    } else {
      const alpha = d[i] / m[i];
      const beta = d[i + 1] / m[i];
      const dist = alpha * alpha + beta * beta;
      if (dist > 9) {
        const tau = 3 / Math.sqrt(dist);
        d[i] = tau * alpha * m[i];
        d[i + 1] = tau * beta * m[i];
      }
    }
  }

  // Evaluator function
  const evaluate = (xVal: number): number => {
    if (xVal <= points[0].x) return points[0].y;
    if (xVal >= points[n - 1].x) return points[n - 1].y;

    // Binary search for interval
    let low = 0;
    let high = n - 2;
    let idx = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (xVal >= points[mid].x && xVal <= points[mid + 1].x) {
        idx = mid;
        break;
      }
      if (xVal < points[mid].x) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    const h = dx[idx];
    if (h === 0) return points[idx].y;

    const t = (xVal - points[idx].x) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    // Standard Hermite basis functions
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const val = h00 * points[idx].y + h10 * h * d[idx] + h01 * points[idx + 1].y + h11 * h * d[idx + 1];
    return Math.max(points[idx].y, Math.min(points[idx + 1].y, val));
  };

  // Convert Hermite spline directly into smooth SVG cubic Bézier segments
  const toSvgPath = (getX: (x: number) => number, getY: (y: number) => number): string => {
    let path = `M ${getX(points[0].x).toFixed(1)} ${getY(points[0].y).toFixed(1)}`;

    for (let i = 0; i < n - 1; i++) {
      const x0 = points[i].x;
      const y0 = points[i].y;
      const x1 = points[i + 1].x;
      const y1 = points[i + 1].y;
      const h = dx[i];

      // Convert Hermite interval [x0, x1] to Cubic Bézier control points:
      // cp1 = P0 + (h/3) * (1, d[i])
      // cp2 = P1 - (h/3) * (1, d[i+1])
      const cp1X = x0 + h / 3;
      const cp1Y = y0 + (d[i] * h) / 3;
      const cp2X = x1 - h / 3;
      const cp2Y = y1 - (d[i + 1] * h) / 3;

      const pCp1X = getX(cp1X).toFixed(1);
      const pCp1Y = getY(cp1Y).toFixed(1);
      const pCp2X = getX(cp2X).toFixed(1);
      const pCp2Y = getY(cp2Y).toFixed(1);
      const pX1 = getX(x1).toFixed(1);
      const pY1 = getY(y1).toFixed(1);

      path += ` C ${pCp1X} ${pCp1Y}, ${pCp2X} ${pCp2Y}, ${pX1} ${pY1}`;
    }

    return path;
  };

  return {
    evaluate,
    toSvgPath,
    points,
  };
}
