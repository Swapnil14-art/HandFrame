/**
 * One Euro Filter (Casiez et al., CHI 2012)
 * Adaptive low-pass filter for real-time human landmark tracking.
 * Key benefit: Eliminates static hand jitter at low speeds while eliminating lag during fast movement.
 */
export class LowPassFilter {
  private alpha: number = 1.0;
  private s: number = 0; // Filtered output state
  private hasValue: boolean = false;

  // Standard Exponential Smoothing:
  // s_t = alpha * value_t + (1 - alpha) * s_{t-1}
  // - alpha close to 1: fast response, little smoothing
  // - alpha close to 0: heavy smoothing, slow response
  public filter(value: number, alpha: number): number {
    this.alpha = alpha;
    if (!this.hasValue) {
      this.s = value;
      this.hasValue = true;
    } else {
      this.s = alpha * value + (1 - alpha) * this.s;
    }
    return this.s;
  }

  public getValue(): number {
    return this.s;
  }

  public reset(): void {
    this.hasValue = false;
    this.s = 0;
  }
}

export class OneEuroFilter {
  // minCutoff: Minimum cutoff frequency in Hz. Lower = smoother when hand is still (reduces jitter).
  private minCutoff: number;
  // beta: Speed coefficient. Higher = adjusts cutoff faster during quick moves (reduces lag).
  private beta: number;
  // dCutoff: Cutoff frequency for the velocity (derivative) filter.
  private dCutoff: number;

  private xFilter = new LowPassFilter();  // Smooths the actual coordinate values
  private dxFilter = new LowPassFilter(); // Smooths the rate of change (velocity)

  private lastTime: number | null = null;
  private lastValue: number = 0;

  constructor(minCutoff: number = 1.0, beta: number = 0.007, dCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  // Calculates exponential smoothing factor 'alpha' from cutoff frequency and time delta (dt).
  // Formula: alpha = 1 / (1 + tau / dt), where tau = 1 / (2 * pi * cutoff)
  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  public filter(value: number, timestampMs: number): number {
    // First received sample: initialize filters with direct value
    if (this.lastTime === null) {
      this.lastTime = timestampMs;
      this.lastValue = value;
      this.xFilter.filter(value, 1.0);
      this.dxFilter.filter(0, 1.0);
      return value;
    }

    // Delta time in seconds. Clamped between 1ms and 100ms to guard against frame skips / zero-division
    const dt = Math.max(0.001, Math.min(0.1, (timestampMs - this.lastTime) / 1000));
    this.lastTime = timestampMs;

    // Estimate derivative (instantaneous velocity: change in value over change in time)
    const dx = (value - this.lastValue) / dt;
    this.lastValue = value;

    // Filter the derivative velocity to prevent noisy speed spikes
    const edx = this.dxFilter.filter(dx, this.alpha(this.dCutoff, dt));

    // Core 1€ equation: Dynamically increase cutoff frequency as velocity increases
    // - Low velocity: cutoff ≈ minCutoff (maximum jitter suppression)
    // - High velocity: cutoff increases by beta * |velocity| (zero perceptible lag)
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    // Apply low-pass filter to signal using the dynamic cutoff
    return this.xFilter.filter(value, this.alpha(cutoff, dt));
  }

  public reset(): void {
    this.lastTime = null;
    this.lastValue = 0;
    this.xFilter.reset();
    this.dxFilter.reset();
  }
}

/**
 * Applies 1€ Filter independently to X and Y coordinates of a 2D point.
 */
export class Point2DOneEuroFilter {
  private xFilter: OneEuroFilter;
  private yFilter: OneEuroFilter;

  constructor(minCutoff: number = 0.8, beta: number = 0.008, dCutoff: number = 1.0) {
    this.xFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.yFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  public filter(point: { x: number; y: number }, timestampMs: number): { x: number; y: number } {
    return {
      x: this.xFilter.filter(point.x, timestampMs),
      y: this.yFilter.filter(point.y, timestampMs),
    };
  }

  public reset(): void {
    this.xFilter.reset();
    this.yFilter.reset();
  }
}

/**
 * Tracks and smooths all 4 fingertip vertices of the HandFrame quadrilateral.
 * Each vertex (P1..P4) maintains an independent 2D One Euro Filter instance.
 */
export class QuadOneEuroFilter {
  private p1Filter = new Point2DOneEuroFilter(0.8, 0.008, 1.0);
  private p2Filter = new Point2DOneEuroFilter(0.8, 0.008, 1.0);
  private p3Filter = new Point2DOneEuroFilter(0.8, 0.008, 1.0);
  private p4Filter = new Point2DOneEuroFilter(0.8, 0.008, 1.0);

  public filter(
    quad: { P1: { x: number; y: number }; P2: { x: number; y: number }; P3: { x: number; y: number }; P4: { x: number; y: number } },
    timestampMs: number
  ): { P1: { x: number; y: number }; P2: { x: number; y: number }; P3: { x: number; y: number }; P4: { x: number; y: number } } {
    return {
      P1: this.p1Filter.filter(quad.P1, timestampMs),
      P2: this.p2Filter.filter(quad.P2, timestampMs),
      P3: this.p3Filter.filter(quad.P3, timestampMs),
      P4: this.p4Filter.filter(quad.P4, timestampMs),
    };
  }

  public reset(): void {
    this.p1Filter.reset();
    this.p2Filter.reset();
    this.p3Filter.reset();
    this.p4Filter.reset();
  }
}
