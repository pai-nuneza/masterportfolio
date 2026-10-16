import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { AssistantDockService } from '../hire-assistant/assistant-dock.service';

/**
 * The robot dives in and upgrades the regions in random order, never waiting: it starts work the moment it
 * arrives and leaves the moment it finishes. Once the whole planet is done (about 30 seconds), it flies down to
 * the corner of the screen and docks as the hire assistant.
 */
/** How long the whole repair should take, entrance included; the torch paces itself to finish on time. */
const REPAIR_MS = 30000;
/** Time allowed for each flight between regions when pacing the torch. */
const FLIGHT_ALLOWANCE_MS = 700;
/** Torch speed limits, in planet units per ms. */
const MIN_WELD_SPEED = 0.02;
const MAX_WELD_SPEED = 0.12;
/** Flying speed range, in planet units per ms; it flies faster the further it has to go. */
const CRUISE_SPEED = 0.09;
const MAX_SPEED = 0.6;
const SPEED_PER_UNIT = 0.003;
/** How close to a trace's end the torch must get before work starts. */
const ARRIVE_DIST = 3;
/** If it has hovered this close to the start for this long without arriving, it starts work anyway. */
const NEAR_DIST = 20;
const NEAR_MAX_MS = 900;
/** A region powers up over this long once its work is done. */
const REVIVE_MS = 1400;
/** The bright pulse when a region's work is done. */
const FLASH_MS = 850;
/** Upgrade traces glow and fade over this long once the robot has passed. */
const TRACE_FADE_MS = 4000;
/** Satellites fade in over this long once launched. */
const LAUNCH_MS = 1500;
/** Wedge regions around a central region. */
const WEDGES = 9;
const CORE_R = 22;
/** The torch tip, in the robot's own coordinates (under its nose, before it turns to face its heading). */
const SPARK = { x: -1, y: 8 };
/** The robot's head, in its own coordinates. */
const BOT_HEAD = { x: 4, r: 3.6 };
/**
 * The assistant's face: a head this big in a viewBox this many units wide, centred. As it docks, the flying
 * robot's head grows to that size and lands on it, while its body and flame fade away.
 */
const DOCK_VIEW_WIDTH = 20;
const DOCK_HEAD_R = 8.5;
/** Docking flight speed range, in planet units per ms: it still slows as it lands, but never to a crawl. */
const DOCK_MIN_SPEED = 0.28;
const DOCK_MAX_SPEED = 0.9;
/** The planet's radius; satellites passing behind it within this distance of the centre are hidden. */
const PLANET_R = 80;

const points = (list: number[][]) => list.map(([x, y]) => ({ x, y }));
/** The legacy planet's lights: few and dim, but on. */
const LEGACY_LIGHTS = points([
  [44, 58], [56, 52], [64, 62], [40, 72], [50, 80], [48, 112], [54, 124], [50, 138],
  [108, 48], [124, 44], [140, 48], [150, 56], [118, 58], [104, 80], [118, 84], [112, 100],
  [122, 108], [110, 124], [152, 134], [160, 138],
]);
/** Extra lights the upgrade switches on alongside the legacy ones. */
const NEW_LIGHTS = points([
  [40, 58], [50, 54], [60, 52], [70, 56], [44, 66], [54, 64], [36, 70], [46, 74], [52, 72], [42, 80], [46, 84],
  [46, 108], [54, 110], [44, 118], [56, 120], [50, 130], [58, 130], [48, 140], [54, 142], [52, 152],
  [104, 44], [116, 40], [130, 40], [142, 44], [152, 52], [108, 52], [120, 50], [134, 52], [146, 56], [112, 60],
  [126, 58], [156, 58], [100, 78], [112, 76], [124, 82], [96, 90], [108, 88], [122, 94], [98, 104], [126, 106],
  [104, 118], [118, 118], [110, 130], [116, 138], [150, 132], [158, 132], [164, 136], [152, 140], [160, 142],
]);
/** Orbits (tilted ellipses around the planet) for the satellites the upgrade launches, in launch order. */
const SATELLITES = [
  { rx: 100, ry: 24, tilt: -18, periodMs: 14000, phase: 0 },
  { rx: 94, ry: 32, tilt: 30, periodMs: 19000, phase: 2.5 },
];
/** On far trips the robot sometimes goes round the back: out past the rim here, behind the planet, and back out. */
const BEHIND_CHANCE = 0.6;
const BEHIND_MIN_TURN = (100 * Math.PI) / 180;
const BEHIND_R = 106;
/** How close it must pass a waypoint before heading for the next. */
const WAYPOINT_DIST = 8;
/**
 * The entrance, as fractions of the viewport. The splash robot launches straight up off the top centre, so this
 * one drops back in from there to the middle of the screen, then curves right to the planet. It flies one smooth
 * curve through these points that ends exactly where its first trace starts.
 */
const ENTRY_START = [0.5, -0.05];
const ENTRY_PATH = [[0.5, 0.45]];
/** Top entrance speed, in planet units per ms; it eases down to cruising speed as it reaches the planet. */
const ENTRY_MAX_SPEED = 1.1;

interface Point {
  x: number;
  y: number;
}

interface Region {
  /** Region shape (reaches past the rim so the planet's circle forms its outer edge). */
  outline: string;
  /** The traces the robot lays: in from the rim, along the centre region, and back out. */
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
  @ViewChildren('orbit') orbitEls?: QueryList<ElementRef<SVGGElement>>;
  @ViewChildren('sat') satEls?: QueryList<ElementRef<SVGGElement>>;
  @ViewChild('halo') halo?: ElementRef<SVGCircleElement>;
  @ViewChild('bot') bot?: ElementRef<SVGGElement>;
  /** Layers the robot moves between: behind the planet, and in front of it. */
  @ViewChild('botBehind') botBehind?: ElementRef<SVGGElement>;
  @ViewChild('botFront') botFront?: ElementRef<SVGGElement>;

  readonly legacyLights = LEGACY_LIGHTS;
  readonly satellites = SATELLITES;
  readonly regions: Region[] = this.dividePlanet();

  /** When each region's upgrade finished: its trace done and its power-up pulse begun. */
  private readonly upgradedAt: (number | undefined)[] = this.regions.map(() => undefined);
  /** Whether each region's trace was last laid end-to-start (from whichever end the robot reached first). */
  private readonly reversed: boolean[] = this.regions.map(() => false);
  private readonly launchedAt: (number | undefined)[] = SATELLITES.map(() => undefined);

  private elapsed = 0;
  private last = 0;
  private frame?: number;
  private pos?: Point;
  private velocity: Point = { x: 0, y: 0 };
  /** Direction the robot faces, in radians; it turns smoothly toward where it's going. */
  private heading = 0;
  /** The region the robot is heading for or working on, and how far along its trace the torch is. */
  private current = -1;
  private welding = false;
  private progress = 0;
  /** Torch speed for the current trace, paced so the whole repair takes REPAIR_MS. */
  private weldSpeed = MIN_WELD_SPEED;
  /** How long it has been close to the start of its next trace without arriving. */
  private nearMs = 0;
  /** Points to pass on the way there; reaching one puts the robot behind the planet or back in front. */
  private waypoints: { at: Point; behind: boolean }[] = [];
  /**
   * A curve the robot flies exactly, as closely spaced points, and how far along it it has got: the entrance (ending
   * at its first trace) or the docking flight (ending at the assistant, growing to its size on the way).
   */
  private path: Point[] = [];
  private pathAt = 0;
  private docking = false;
  private dockScale = 1;
  private docked = false;
  private behind = false;
  /** Eases 0 (in front) to 1 (behind) so it shrinks and dims smoothly as it goes round the back. */
  private depth = 0;

  constructor(
    private zone: NgZone,
    private dock: AssistantDockService,
  ) {}

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
    if (!document.getElementById('splash') && delta > 0) {
      this.elapsed += delta;
      if (!this.docked) {
        this.moveBot(delta);
      }
      this.render();
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private render(): void {
    const now = this.elapsed;
    let power = 0;

    this.regions.forEach((_, i) => {
      const upgradedAt = this.upgradedAt[i];
      const since = upgradedAt === undefined ? -1 : now - upgradedAt;
      const life = since < 0 ? 0 : this.clamp(since / (REVIVE_MS * 0.6));
      const lights = since < 0 ? 0 : this.clamp((since - REVIVE_MS * 0.5) / (REVIVE_MS * 0.5));
      power += life;
      this.aliveEls?.get(i)?.nativeElement.setAttribute('opacity', String(this.ease(life)));
      this.lightEls?.get(i)?.nativeElement.setAttribute('opacity', String(lights));

      const pulse = since < 0 ? 1 : this.clamp(since / FLASH_MS);
      this.flashEls?.get(i)?.nativeElement.setAttribute('opacity', String(pulse < 1 ? 0.5 * (1 - pulse) : 0));

      const seam = this.seamEls?.get(i)?.nativeElement;
      if (seam) {
        const active = this.welding && i === this.current;
        const traced = active ? this.progress : since < 0 ? 0 : 1;
        const faded = active || since < 0 ? 0 : this.clamp(since / TRACE_FADE_MS);
        // A dash of the whole length, shifted to reveal the trace from whichever end it was started.
        seam.style.strokeDashoffset = String(this.reversed[i] ? 1 + traced : 1 - traced);
        seam.style.stroke = this.mix('#ffffff', '#38e1ff', this.clamp(faded * 3));
        seam.setAttribute('opacity', String(1 - faded));
      }
    });

    const launched = this.launchedAt.map(at => (at === undefined ? 0 : this.clamp((now - at) / LAUNCH_MS)));
    launched.forEach((opacity, j) => this.placeSatellite(j, now, opacity));
    // Each orbit has a far ring behind the planet and a near arc in front, listed in that order.
    this.orbitEls?.forEach((ref, i) => ref.nativeElement.setAttribute('opacity', String(launched[i % launched.length])));
    this.halo?.nativeElement.setAttribute('opacity', String(power / this.regions.length));
  }

  /** Puts satellite j where its orbit has it at time `now`, hidden while the planet is in front of it. */
  private placeSatellite(j: number, now: number, opacity: number): void {
    const sat = this.satEls?.get(j)?.nativeElement;
    if (!sat) {
      return;
    }
    const { rx, ry, tilt, periodMs, phase } = this.satellites[j];
    const angle = phase + (2 * Math.PI * now) / periodMs;
    const x = rx * Math.cos(angle);
    const y = ry * Math.sin(angle);
    // The near half of the orbit is its lower half (before tilting).
    const behind = y < 0 && Math.hypot(x, y) < PLANET_R;
    const r = (tilt * Math.PI) / 180;
    const px = 100 + x * Math.cos(r) - y * Math.sin(r);
    const py = 100 + x * Math.sin(r) + y * Math.cos(r);
    sat.setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${tilt})`);
    sat.setAttribute('opacity', String(behind ? 0 : opacity));
  }

  /** Flies the robot to the current region's trace, works along it, then sets off for the next one straight away. */
  private moveBot(delta: number): void {
    const bot = this.bot?.nativeElement;
    if (!bot) {
      return;
    }
    if (!this.pos) {
      const screen = ([x, y]: number[]) => this.fromScreen(bot, x * window.innerWidth, y * window.innerHeight);
      this.pos = screen(ENTRY_START);
      // Already diving nose-down, as if coming back from the launch.
      this.heading = Math.PI / 2;
      this.pickNext();
      this.waypoints = [];
      const workHeading = this.seamHeading(this.current, 0);
      const points = [this.pos, ...ENTRY_PATH.map(screen), this.torchAt(this.current, 0, workHeading)];
      this.path = this.curve(points, Math.PI / 2, workHeading);
    }
    if (this.dock.summoned && !this.docking) {
      this.hurryToDock();
    }
    const prev = this.pos;
    let turnTo = this.heading;
    let grow = 1;

    if (this.path.length) {
      // Flies the curve exactly, fast at first and easing to cruising speed near the end.
      const total = this.pathLength(0);
      const left = this.pathLength(this.pathAt);
      const minSpeed = this.docking ? DOCK_MIN_SPEED : CRUISE_SPEED;
      const maxSpeed = this.docking ? DOCK_MAX_SPEED : ENTRY_MAX_SPEED;
      let travel = Math.min(Math.max(minSpeed, left * SPEED_PER_UNIT), maxSpeed) * delta;
      while (travel > 0 && this.pathAt < this.path.length - 1) {
        const i = Math.floor(this.pathAt);
        const a = this.path[i];
        const b = this.path[i + 1];
        const seg = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
        const step = Math.min(travel, (i + 1 - this.pathAt) * seg);
        this.pathAt = Math.min(this.pathAt + step / seg, i + 1);
        travel -= step;
      }
      const i = Math.min(Math.floor(this.pathAt), this.path.length - 2);
      const a = this.path[i];
      const b = this.path[i + 1];
      const f = this.pathAt - i;
      this.pos = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      this.velocity = { x: (this.pos.x - prev.x) / delta, y: (this.pos.y - prev.y) / delta };
      turnTo = Math.atan2(b.y - a.y, b.x - a.x);
      if (this.docking) {
        const done = this.ease(1 - left / (total || 1));
        grow = 1 + (this.dockScale - 1) * done;
        // Only the head arrives: the body and flame fade over the last stretch.
        const tail = String(1 - this.clamp((done - 0.6) / 0.35));
        bot.querySelectorAll<SVGElement>('.lp-bot-tail').forEach(el => (el.style.opacity = tail));
        // If it set off from behind the planet, it comes back in front once clear of the rim.
        if (this.behind && Math.hypot(this.pos.x - 100, this.pos.y - 100) > BEHIND_R) {
          this.setBehind(false);
        }
      }
      if (this.pathAt >= this.path.length - 1) {
        this.path = [];
        if (this.docking) {
          this.land(bot);
          return;
        }
        this.startWork();
      }
    } else if (this.welding) {
      const seam = this.seamEls?.get(this.current)?.nativeElement;
      this.progress = Math.min(this.progress + (this.weldSpeed * delta) / (seam?.getTotalLength() || 1), 1);
      turnTo = this.seamHeading(this.current, this.progress);
      const target = this.torchAt(this.current, this.progress, turnTo);
      // Tight easing keeps the torch on the trace.
      this.pos = { x: prev.x + (target.x - prev.x) * 0.5, y: prev.y + (target.y - prev.y) * 0.5 };
      this.velocity = { x: (this.pos.x - prev.x) / delta, y: (this.pos.y - prev.y) / delta };
      if (this.progress >= 1) {
        this.finishWork();
      }
    } else {
      // Steers via any waypoints to the trace's starting end, slowing as it closes in but never stopping.
      // The hover point is worked out for the heading it will work at, so it doesn't shift as the robot turns.
      const start = this.torchAt(this.current, 0, this.seamHeading(this.current, 0));
      const target = this.waypoints[0]?.at ?? start;
      const dx = target.x - prev.x;
      const dy = target.y - prev.y;
      const dist = Math.hypot(dx, dy) || 1;
      let remaining = dist;
      this.waypoints.forEach((w, i) => {
        const next = this.waypoints[i + 1]?.at ?? start;
        remaining += Math.hypot(next.x - w.at.x, next.y - w.at.y);
      });
      const final = !this.waypoints.length;
      const speed = Math.min(Math.max(CRUISE_SPEED, remaining * SPEED_PER_UNIT), MAX_SPEED);
      const steer = 1 - Math.pow(final && dist < NEAR_DIST ? 0.6 : 0.88, delta / 16.7);
      this.velocity = {
        x: this.velocity.x + ((dx / dist) * speed - this.velocity.x) * steer,
        y: this.velocity.y + ((dy / dist) * speed - this.velocity.y) * steer,
      };
      this.pos = { x: prev.x + this.velocity.x * delta, y: prev.y + this.velocity.y * delta };
      turnTo = Math.atan2(this.velocity.y, this.velocity.x);
      const left = Math.hypot(target.x - this.pos.x, target.y - this.pos.y);
      // A waypoint counts as passed once it's close, or once the robot is past it, so it never circles back for one.
      const passed = (target.x - this.pos.x) * this.velocity.x + (target.y - this.pos.y) * this.velocity.y < 0;
      this.nearMs = final && left < NEAR_DIST ? this.nearMs + delta : 0;
      if (!final) {
        if (left < WAYPOINT_DIST || (passed && left < WAYPOINT_DIST * 4)) {
          this.setBehind(this.waypoints.shift()!.behind);
        }
      } else if (left < ARRIVE_DIST || this.nearMs > NEAR_MAX_MS) {
        this.startWork();
      }
    }

    // Faces along the trace while working, otherwise the way it's flying.
    this.heading += Math.atan2(Math.sin(turnTo - this.heading), Math.cos(turnTo - this.heading)) * 0.25;
    this.depth += ((this.behind ? 1 : 0) - this.depth) * (1 - Math.pow(0.9, delta / 16.7));
    const scale = (1 - 0.3 * this.depth) * grow;
    bot.setAttribute(
      'transform',
      `translate(${this.pos.x} ${this.pos.y}) rotate(${(this.heading * 180) / Math.PI}) scale(${scale.toFixed(3)})`,
    );
    bot.style.opacity = String(1 - 0.35 * this.depth);
    bot.classList.toggle('lp-welding', this.welding);
  }

  /**
   * A smooth curve through the points (Catmull-Rom), as closely spaced points. It leaves the first point heading
   * `startDir` and reaches the last heading `endDir` (radians), so the hand-offs either side are seamless.
   */
  private curve(points: Point[], startDir: number, endDir: number): Point[] {
    const first = points[0];
    const last = points[points.length - 1];
    const lead = Math.hypot(points[1].x - first.x, points[1].y - first.y);
    const tail = Math.hypot(last.x - points[points.length - 2].x, last.y - points[points.length - 2].y);
    const all = [
      { x: first.x - Math.cos(startDir) * lead, y: first.y - Math.sin(startDir) * lead },
      ...points,
      { x: last.x + Math.cos(endDir) * tail, y: last.y + Math.sin(endDir) * tail },
    ];
    const out: Point[] = [];
    for (let i = 1; i < all.length - 2; i++) {
      const [p0, p1, p2, p3] = [all[i - 1], all[i], all[i + 1], all[i + 2]];
      for (let s = 0; s < 40; s++) {
        const t = s / 40;
        const blend = (a: number, b: number, c: number, d: number) =>
          0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
        out.push({ x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) });
      }
    }
    out.push(last);
    return out;
  }

  /** Moves the robot into the layer behind the planet or back in front (only ever done while it is clear of the rim). */
  private setBehind(behind: boolean): void {
    const bot = this.bot?.nativeElement;
    const layer = (behind ? this.botBehind : this.botFront)?.nativeElement;
    this.behind = behind;
    if (bot && layer && bot.parentNode !== layer) {
      layer.appendChild(bot);
    }
  }

  /**
   * Starts laying the current region's trace, pacing the torch so the traces still to do (this one included)
   * fit in the time left, after allowing for the flights between them.
   */
  private startWork(): void {
    const todo = this.regions.map((_, i) => i).filter(i => this.upgradedAt[i] === undefined);
    const length = todo.reduce((sum, i) => sum + (this.seamEls?.get(i)?.nativeElement.getTotalLength() ?? 0), 0);
    const time = REPAIR_MS - this.elapsed - (todo.length - 1) * FLIGHT_ALLOWANCE_MS;
    this.weldSpeed = Math.min(Math.max(length / Math.max(time, 1), MIN_WELD_SPEED), MAX_WELD_SPEED);
    this.welding = true;
    this.progress = 0;
    this.nearMs = 0;
  }

  /** The region is done: power it up, launch any satellites it has earned, and move on (or go and dock). */
  private finishWork(): void {
    const now = this.elapsed;
    this.upgradedAt[this.current] = now;
    const upgraded = this.upgradedAt.filter(at => at !== undefined).length;
    this.launchedAt.forEach((at, j) => {
      if (at === undefined && upgraded >= Math.ceil(((j + 1) * this.regions.length) / SATELLITES.length)) {
        this.launchedAt[j] = now;
      }
    });
    this.welding = false;
    if (upgraded === this.regions.length) {
      this.flyToDock();
    } else {
      this.pickNext();
    }
  }

  /**
   * The visitor needs the assistant now: the regions still to do power up in a quick wave (with any satellites
   * not yet launched), and the robot drops what it's doing and heads straight for its spot.
   */
  private hurryToDock(): void {
    const now = this.elapsed;
    let wave = 0;
    this.regions.forEach((_, i) => {
      if (this.upgradedAt[i] === undefined) {
        this.upgradedAt[i] = now + 150 * wave++;
      }
    });
    this.launchedAt.forEach((at, j) => {
      if (at === undefined) {
        this.launchedAt[j] = now + 150 * wave + 300 * j;
      }
    });
    this.welding = false;
    this.waypoints = [];
    this.flyToDock();
  }

  /** Plots a swoop down to the assistant's spot, arriving facing right at the assistant's size. */
  private flyToDock(): void {
    const bot = this.bot?.nativeElement;
    const anchor = this.dock.anchor?.getBoundingClientRect();
    const svg = bot?.ownerSVGElement?.getBoundingClientRect();
    if (!bot || !anchor || !svg || !this.pos) {
      this.land(bot);
      return;
    }
    const unit = svg.width / 200;
    this.dockScale = (DOCK_HEAD_R * anchor.width) / DOCK_VIEW_WIDTH / (BOT_HEAD.r * unit);
    // Facing right on arrival, so its head sits this far right of where the robot itself ends up.
    const x = anchor.left + anchor.width / 2 - BOT_HEAD.x * this.dockScale * unit;
    const y = anchor.top + anchor.height / 2;
    const target = this.fromScreen(bot, x, y);
    const approach = this.fromScreen(bot, x - Math.min(window.innerWidth * 0.3, 260), y - 40);
    this.path = this.curve([this.pos, approach, target], this.heading, 0);
    this.pathAt = 0;
    this.docking = true;
  }

  /** Hands over to the assistant: the flying robot disappears as the docked one appears in its place. */
  private land(bot?: SVGGElement): void {
    this.docked = true;
    if (bot) {
      bot.style.display = 'none';
    }
    this.zone.run(() => this.dock.docked.set(true));
  }

  /** Length of the current path from `from` (a fractional point index) to its end. */
  private pathLength(from: number): number {
    let length = 0;
    for (let i = Math.floor(from); i < this.path.length - 1; i++) {
      length += Math.hypot(this.path[i + 1].x - this.path[i].x, this.path[i + 1].y - this.path[i].y);
    }
    return length;
  }

  /**
   * Picks a random region still on the legacy look (never one already upgraded), starting from its trace's
   * nearer end. If that's round the far side, it sometimes flies behind the planet to get there.
   */
  private pickNext(): void {
    const pool = this.regions.map((_, i) => i).filter(i => i !== this.current && this.upgradedAt[i] === undefined);
    this.current = pool[Math.floor(Math.random() * pool.length)];
    const seam = this.seamEls?.get(this.current)?.nativeElement;
    const pos = this.pos;
    if (!seam || !pos) {
      return;
    }
    const first = seam.getPointAtLength(0);
    const last = seam.getPointAtLength(seam.getTotalLength());
    const reversed = Math.hypot(last.x - pos.x, last.y - pos.y) < Math.hypot(first.x - pos.x, first.y - pos.y);
    this.reversed[this.current] = reversed;

    const start = reversed ? last : first;
    const from = Math.atan2(pos.y - 100, pos.x - 100);
    const to = Math.atan2(start.y - 100, start.x - 100);
    const turn = Math.abs(Math.atan2(Math.sin(to - from), Math.cos(to - from)));
    const nearPlanet = Math.hypot(pos.x - 100, pos.y - 100) < BEHIND_R + 10;
    if (nearPlanet && turn > BEHIND_MIN_TURN && Math.random() < BEHIND_CHANCE) {
      const rim = (a: number): Point => ({ x: 100 + BEHIND_R * Math.cos(a), y: 100 + BEHIND_R * Math.sin(a) });
      this.waypoints = [
        { at: rim(from), behind: true },
        { at: rim(to), behind: false },
      ];
    }
  }

  /** Where the robot hovers so its spark is `share` of the way along region k's trace, in its working direction. */
  private torchAt(k: number, share: number, heading = this.heading): Point {
    const seam = this.seamEls?.get(k)?.nativeElement;
    const at = this.reversed[k] ? 1 - this.clamp(share) : this.clamp(share);
    const p = seam ? seam.getPointAtLength(at * seam.getTotalLength()) : this.regions[k].centre;
    return {
      x: p.x - (SPARK.x * Math.cos(heading) - SPARK.y * Math.sin(heading)),
      y: p.y - (SPARK.x * Math.sin(heading) + SPARK.y * Math.cos(heading)),
    };
  }

  /** Direction the torch moves along region k's trace at `share` of the way through its work. */
  private seamHeading(k: number, share: number): number {
    const seam = this.seamEls?.get(k)?.nativeElement;
    if (!seam) {
      return this.heading;
    }
    const length = seam.getTotalLength();
    const step = this.reversed[k] ? -1 : 1;
    const at = (this.reversed[k] ? 1 - this.clamp(share) : this.clamp(share)) * length;
    const p = seam.getPointAtLength(at);
    const ahead = seam.getPointAtLength(Math.min(Math.max(at + step, 0), length));
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

  /** Divides the planet's surface into a centre region and a ring of wedge regions, ready to upgrade. */
  private dividePlanet(): Region[] {
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
      lights: [...LEGACY_LIGHTS, ...NEW_LIGHTS].filter(c => inside(c, shape)),
    });

    const base = Math.random() * 360;
    const angles = Array.from({ length: WEDGES }, (_, i) => base + (i * 360) / WEDGES + (Math.random() - 0.5) * 14);
    // Each boundary steps from the centre region out past the rim, like a circuit trace.
    const lines = angles.map(a =>
      [CORE_R, 38, 54, 70, 86].map((r, j) => polar(a + (j === 0 ? 0 : (Math.random() - 0.5) * 5), r)),
    );

    const regions = angles.map((a, j) => {
      const next = (j + 1) % WEDGES;
      const b = next === 0 ? angles[0] + 360 : angles[next];
      const rim = Array.from({ length: 7 }, (_, s) => polar(a + ((b - a) * s) / 6, 86));
      const shape = [...lines[j], ...rim, ...[...lines[next]].reverse()];
      const toRim = (line: Point[], deg: number) => [...line.slice(0, -1), polar(deg, 80)];
      return region(shape, path([...toRim(lines[j], a).reverse(), ...toRim(lines[next], b)]), polar((a + b) / 2, 52));
    });

    const core = lines.map(c => c[0]);
    regions.push(region(core, path(core) + ' Z', { x: 100, y: 100 }));
    return regions;
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

  /** Reduced motion: show the fully upgraded planet, satellites parked, and the assistant already docked. */
  private finish(): void {
    // After this view check, so the assistant isn't changed mid-check.
    setTimeout(() => this.dock.docked.set(true));
    this.aliveEls?.forEach(ref => ref.nativeElement.setAttribute('opacity', '1'));
    this.lightEls?.forEach(ref => ref.nativeElement.setAttribute('opacity', '1'));
    this.flashEls?.forEach(ref => ref.nativeElement.setAttribute('opacity', '0'));
    this.seamEls?.forEach(ref => ref.nativeElement.setAttribute('opacity', '0'));
    this.orbitEls?.forEach(ref => ref.nativeElement.setAttribute('opacity', '1'));
    this.satellites.forEach((_, j) => this.placeSatellite(j, 0, 1));
    this.halo?.nativeElement.setAttribute('opacity', '1');
    if (this.bot) {
      this.bot.nativeElement.style.display = 'none';
    }
  }
}
