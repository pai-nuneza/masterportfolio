import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, QueryList, ViewChild, ViewChildren } from '@angular/core';

/** The robot flies in from the left, reworks every region one by one (~1 minute in all), then flies off. */
const TOTAL_MS = 60000;
const ENTRY_MS = 1800;
const EXIT_MS = 1600;
/** How each region's rework is split: fly over, weld its cracks; the rest brings it to life and upgrades it. */
const FLY = 0.2;
const WELD = 0.55;
/** Weld scars cool and fade over this long once a region is alive again. */
const SCAR_FADE_MS = 4000;
/** Wedge regions around a central region. */
const WEDGES = 9;
const CORE_R = 22;
/** The torch tip, in the robot's own coordinates (under its nose, before it turns to face its heading). */
const SPARK = { x: -1, y: 8 };
/** City lights on the continents; each region switches on the ones it contains. */
const CITIES = [
  [44, 58], [56, 52], [64, 62], [40, 72], [50, 80], [48, 112], [54, 124], [50, 138],
  [108, 48], [124, 44], [140, 48], [150, 56], [118, 58], [104, 80], [118, 84], [112, 100],
  [122, 108], [110, 124], [152, 134], [160, 138],
].map(([x, y]) => ({ x, y }));

interface Point {
  x: number;
  y: number;
}

interface Region {
  /** Region shape (reaches past the rim so the planet's circle forms its outer edge). */
  outline: string;
  /** The cracks the robot welds: in from the rim, along the centre region, and back out. */
  seam: string;
  centre: Point;
  lights: Point[];
}

@Component({
  selector: 'app-legacy-planet',
  templateUrl: './legacy-planet.component.html',
})
export class LegacyPlanetComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('alive') aliveEls?: QueryList<ElementRef<SVGUseElement>>;
  @ViewChildren('lights') lightEls?: QueryList<ElementRef<SVGGElement>>;
  @ViewChildren('flash') flashEls?: QueryList<ElementRef<SVGCircleElement>>;
  @ViewChildren('seam') seamEls?: QueryList<ElementRef<SVGPathElement>>;
  @ViewChild('bot') bot?: ElementRef<SVGGElement>;

  /** In rework order: the robot always heads for a nearby region that still needs it. */
  readonly regions: Region[] = this.planRoute(this.crackPlanet());
  private readonly stepMs = (TOTAL_MS - ENTRY_MS - EXIT_MS) / this.regions.length;

  private elapsed = 0;
  private last = 0;
  private frame?: number;
  private pos?: Point;
  /** Direction the robot faces, in radians; it turns smoothly toward where it's going. */
  private heading = 0;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.finish();
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    });
  }

  ngOnDestroy(): void {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
    }
  }

  private tick = (now: number): void => {
    // Capped so a backgrounded tab resumes where it left off; held until the splash has gone.
    const delta = Math.min(now - this.last, 100);
    this.last = now;
    if (!document.getElementById('splash')) {
      this.elapsed += delta;
    }
    if (this.elapsed >= TOTAL_MS) {
      this.finish();
      return;
    }
    if (this.elapsed > 0) {
      this.render();
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private render(): void {
    const fly = this.stepMs * FLY;
    const weld = this.stepMs * WELD;
    const revive = this.stepMs - fly - weld;

    this.regions.forEach((_, i) => {
      const t = this.elapsed - ENTRY_MS - i * this.stepMs;
      const welded = this.clamp((t - fly) / weld);
      const life = this.clamp((t - fly - weld) / (revive * 0.6));
      const lights = this.clamp((t - fly - weld - revive * 0.5) / (revive * 0.5));

      this.aliveEls?.get(i)?.nativeElement.setAttribute('opacity', String(this.ease(life)));
      this.lightEls?.get(i)?.nativeElement.setAttribute('opacity', String(lights));
      this.flashEls?.get(i)?.nativeElement.setAttribute('opacity', String(life > 0 && life < 1 ? 0.5 * (1 - life) : 0));
      const seam = this.seamEls?.get(i)?.nativeElement;
      if (seam) {
        const cooled = this.clamp((t - fly - weld) / SCAR_FADE_MS);
        seam.style.strokeDashoffset = String(1 - welded);
        seam.style.stroke = this.mix('#fff1b8', '#ff7a1a', this.clamp(cooled * 3));
        seam.setAttribute('opacity', String(1 - cooled));
      }
    });

    this.moveBot(fly, weld);
  }

  /** Steers the robot toward where the current step needs it; easing smooths the hand-offs between steps. */
  private moveBot(fly: number, weld: number): void {
    const bot = this.bot?.nativeElement;
    if (!bot) {
      return;
    }
    // It arrives from the left edge of the screen, level with the top of the planet.
    this.pos ??= this.fromScreen(bot, -40, (bot.ownerSVGElement?.getBoundingClientRect().top ?? 0) + 20);
    const n = this.regions.length;
    const t = this.elapsed - ENTRY_MS;
    const k = Math.min(Math.max(Math.floor(t / this.stepMs), 0), n - 1);
    const local = t - k * this.stepMs;
    let target: Point;
    let welding = false;
    let opacity = 1;
    let weldHeading: number | null = null;

    if (t < 0 || local < fly) {
      target = this.torchAt(k, 0);
    } else if (local < fly + weld) {
      welding = true;
      const share = (local - fly) / weld;
      weldHeading = this.seamHeading(k, share);
      target = this.torchAt(k, share, weldHeading);
    } else if (k < n - 1) {
      // The region comes back to life; it heads on to the next one.
      target = this.torchAt(k + 1, 0);
    } else {
      // Everything reworked: fly off and fade out before the total time runs out.
      const exitStart = fly + weld;
      opacity = 1 - this.clamp((local - exitStart) / (TOTAL_MS - ENTRY_MS - k * this.stepMs - exitStart));
      target = { x: this.pos.x + 8, y: this.pos.y - 6 };
    }

    const prev = this.pos;
    // Tight easing while welding keeps the torch on the crack; looser elsewhere gives swooping flights.
    const follow = welding ? 0.5 : t < 0 ? 0.045 : 0.07;
    this.pos = { x: prev.x + (target.x - prev.x) * follow, y: prev.y + (target.y - prev.y) * follow };

    // Faces along the crack while welding, otherwise the way it's flying.
    const moved = Math.hypot(this.pos.x - prev.x, this.pos.y - prev.y);
    const turnTo = weldHeading ?? (moved > 0.05 ? Math.atan2(this.pos.y - prev.y, this.pos.x - prev.x) : this.heading);
    this.heading += Math.atan2(Math.sin(turnTo - this.heading), Math.cos(turnTo - this.heading)) * 0.25;

    bot.setAttribute('transform', `translate(${this.pos.x} ${this.pos.y}) rotate(${(this.heading * 180) / Math.PI})`);
    bot.style.opacity = String(opacity);
    bot.classList.toggle('lp-welding', welding);
  }

  /** Where the robot hovers so its spark is `share` of the way along region k's cracks. */
  private torchAt(k: number, share: number, heading = this.heading): Point {
    const seam = this.seamEls?.get(k)?.nativeElement;
    const p = seam ? seam.getPointAtLength(this.clamp(share) * seam.getTotalLength()) : this.regions[k].centre;
    return {
      x: p.x - (SPARK.x * Math.cos(heading) - SPARK.y * Math.sin(heading)),
      y: p.y - (SPARK.x * Math.sin(heading) + SPARK.y * Math.cos(heading)),
    };
  }

  /** Direction of region k's crack line at `share` of the way along it. */
  private seamHeading(k: number, share: number): number {
    const seam = this.seamEls?.get(k)?.nativeElement;
    if (!seam) {
      return this.heading;
    }
    const length = seam.getTotalLength();
    const at = this.clamp(share) * length;
    const p = seam.getPointAtLength(at);
    const ahead = seam.getPointAtLength(Math.min(at + 1, length));
    return Math.atan2(ahead.y - p.y, ahead.x - p.x);
  }

  /** Converts a screen point into the planet's own coordinates. */
  private fromScreen(el: SVGGraphicsElement, x: number, y: number): Point {
    const matrix = el.ownerSVGElement?.getScreenCTM()?.inverse();
    if (!matrix) {
      return { x: -140, y: -60 };
    }
    const p = new DOMPoint(x, y).matrixTransform(matrix);
    return { x: p.x, y: p.y };
  }

  /** Cracks the old planet's surface into a centre region and a ring of jagged wedge regions. */
  private crackPlanet(): Region[] {
    const polar = (deg: number, r: number): Point => {
      const a = (deg * Math.PI) / 180;
      return { x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a) };
    };
    const pts = (list: Point[]) => list.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const path = (list: Point[]) => 'M' + list.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L');
    const inside = (p: Point, poly: Point[]) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
          hit = !hit;
        }
      }
      return hit;
    };
    const region = (shape: Point[], seam: string, centre: Point): Region => ({
      outline: pts(shape),
      seam,
      centre,
      lights: CITIES.filter(c => inside(c, shape)),
    });

    const base = Math.random() * 360;
    const angles = Array.from({ length: WEDGES }, (_, i) => base + (i * 360) / WEDGES + (Math.random() - 0.5) * 14);
    // Each crack zig-zags from the centre region out past the rim.
    const cracks = angles.map(a =>
      [CORE_R, 38, 54, 70, 86].map((r, j) => polar(a + (j === 0 ? 0 : (Math.random() - 0.5) * 10), r)),
    );

    const regions = angles.map((a, j) => {
      const next = (j + 1) % WEDGES;
      const b = next === 0 ? angles[0] + 360 : angles[next];
      const rim = Array.from({ length: 7 }, (_, s) => polar(a + ((b - a) * s) / 6, 86));
      const shape = [...cracks[j], ...rim, ...[...cracks[next]].reverse()];
      const toRim = (crack: Point[], deg: number) => [...crack.slice(0, -1), polar(deg, 80)];
      return region(shape, path([...toRim(cracks[j], a).reverse(), ...toRim(cracks[next], b)]), polar((a + b) / 2, 52));
    });

    const core = cracks.map(c => c[0]);
    regions.push(region(core, path(core) + ' Z', { x: 100, y: 100 }));
    return regions;
  }

  /** From wherever the robot is, head for a nearby region (a little randomness varies the route each visit). */
  private planRoute(todo: Region[]): Region[] {
    const route: Region[] = [];
    let at: Point = { x: 60, y: 10 };
    while (todo.length) {
      let best = 0;
      let bestScore = Infinity;
      todo.forEach((region, i) => {
        const score = Math.hypot(region.centre.x - at.x, region.centre.y - at.y) + Math.random() * 40;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      });
      at = todo[best].centre;
      route.push(todo[best]);
      todo = todo.filter((_, i) => i !== best);
    }
    return route;
  }

  /** Blends two #rrggbb colours. */
  private mix(from: string, to: string, t: number): string {
    const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    const rgb = [0, 1, 2].map(i => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t));
    return `rgb(${rgb.join(',')})`;
  }

  private clamp(v: number): number {
    return Math.min(Math.max(v, 0), 1);
  }

  private ease(t: number): number {
    return t * t * (3 - 2 * t);
  }

  private finish(): void {
    this.aliveEls?.forEach(ref => ref.nativeElement.setAttribute('opacity', '1'));
    this.lightEls?.forEach(ref => ref.nativeElement.setAttribute('opacity', '1'));
    this.flashEls?.forEach(ref => ref.nativeElement.setAttribute('opacity', '0'));
    this.seamEls?.forEach(ref => ref.nativeElement.setAttribute('opacity', '0'));
    if (this.bot) {
      this.bot.nativeElement.style.display = 'none';
    }
  }
}