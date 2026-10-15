import { AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { EXPERIENCES, Experience } from './experience.data';

/** Matches the AI era start on the career timeline. */
const AI_ERA_START = '2022-12';

/** One accent per main role, oldest first, so each chapter has its own colour. */
const ACCENTS = ['#ff8a5c', '#5cc8ff', '#ff6fa8', '#b38cff', '#7ee081', '#ffd25c', '#00cba9'];
/** Side projects share the legacy amber. */
const SIDE_ACCENT = '#ffb547';

/** Autoplay on the home road: a quick ring fills around each checkpoint, then the road travels slowly to the next. */
const FILL_MS = 1200;
const TRAVEL_MS = 4000;
/** At the finish line the whole road stays lit this long before the journey restarts. */
const FINISH_HOLD_MS = 1500;

interface Chapter {
  exp: Experience;
  label: string;
  year: string;
  endYear: string;
  accent: string;
  /** Show the "AI era begins" marker just below this chapter. */
  aiEraBelow: boolean;
}

@Component({
  selector: 'app-experience',
  templateUrl: './experience.component.html',
  styleUrls: ['./experience.component.css', './experience-journey.css'],
})
export class ExperienceComponent implements AfterViewInit, OnDestroy {
  /** Full shows the vertical chapter timeline; otherwise the home road and story. */
  @Input() full = false;

  @ViewChild('road') road?: ElementRef<HTMLElement>;
  @ViewChild('progressPath') progressPath?: ElementRef<SVGPathElement>;
  @ViewChild('ring') ring?: ElementRef<SVGSVGElement>;
  @ViewChild('robot') robot?: ElementRef<HTMLElement>;
  @ViewChild('parallelRobot') parallelRobot?: ElementRef<HTMLElement>;

  /** Dated main roles, oldest first: the stops on the road. */
  journey: Chapter[];
  /** Dated side projects that ran alongside the main roles. */
  sideQuests: Chapter[];
  /** Every role, newest first. */
  chapters: Chapter[];

  /** Road geometry in SVG units; stops alternate high and low along a wave. */
  readonly roadWidth = 1000;
  readonly roadHeight = 300;
  stopPoints: { x: number; y: number }[];
  roadPath: string;
  /** Side projects drawn as detours that leave the road and rejoin it later. */
  detours: { quest: Chapter; path: string; x: number; y: number; startX: number; endX: number }[];

  /** Index into journey of the stop whose story is shown. */
  selected = 0;
  /** A side project shown in the story instead of the selected stop. */
  side: Chapter | null = null;
  /** Autoplay is on: checkpoint rings fill, the road travels between stops, and the next stop pulses. */
  autoplaying = false;
  /** Time spent on the selected stop so far; holds still only while the full chapter is open. */
  private dwell = 0;
  /** Time spent showing the parallel track, which then hands back to the road. */
  private sideDwell = 0;
  private frame?: number;
  /** Length along the road (SVG units) of each stop's centre, measured once the road is drawn. */
  private stopLengths: number[] = [];

  constructor(private zone: NgZone) {
    const byStart = (a: Experience, b: Experience) => a.start!.localeCompare(b.start!);
    const main = EXPERIENCES.filter(e => e.start && !e.side).sort(byStart);
    const toChapter = (exp: Experience): Chapter => {
      const index = main.indexOf(exp);
      return {
        exp,
        label: exp.side ? 'Parallel track' : '',
        year: exp.start ? exp.start.slice(0, 4) : '',
        endYear: exp.end ? exp.end.slice(0, 4) : 'Now',
        accent: exp.side ? SIDE_ACCENT : ACCENTS[index % ACCENTS.length],
        aiEraBelow: false,
      };
    };

    this.journey = main.map(toChapter);
    this.sideQuests = EXPERIENCES.filter(e => e.start && e.side).sort(byStart).map(toChapter);
    this.chapters = EXPERIENCES.map(toChapter);

    // Newest first: the marker goes below the oldest role that started in the AI era.
    const aiRoles = this.chapters.filter(c => c.exp.start && c.exp.start >= AI_ERA_START);
    if (aiRoles.length) {
      aiRoles[aiRoles.length - 1].aiEraBelow = true;
    }

    const inset = 50;
    const step = (this.roadWidth - inset * 2) / Math.max(this.journey.length - 1, 1);
    this.stopPoints = this.journey.map((_, i) => ({ x: inset + i * step, y: i % 2 === 0 ? 85 : 145 }));
    this.roadPath = this.stopPoints
      .map((p, i) => {
        if (i === 0) {
          return `M ${p.x} ${p.y}`;
        }
        const prev = this.stopPoints[i - 1];
        const mid = (prev.x + p.x) / 2;
        return `C ${mid} ${prev.y}, ${mid} ${p.y}, ${p.x} ${p.y}`;
      })
      .join(' ');

    this.detours = this.sideQuests.map(quest => {
      const last = this.stopPoints[this.stopPoints.length - 1];
      const startX = this.xForDate(main, quest.exp.start!);
      // Rejoin just before the last stop so the detour doesn't run into its label.
      const endX = Math.min(this.xForDate(main, quest.exp.end ?? '9999-12'), last.x - 45);
      const startY = this.roadYAt(startX);
      const endY = this.roadYAt(endX);
      const x = (startX + endX) / 2;
      const y = 222;
      const c1 = (startX + x) / 2;
      const c2 = (x + endX) / 2;
      const path = `M ${startX} ${startY} C ${c1} ${startY}, ${c1} ${y}, ${x} ${y} C ${c2} ${y}, ${c2} ${endY}, ${endX} ${endY}`;
      return { quest, path, x, y, startX, endX };
    });
  }

  /** Where a YYYY-MM date falls on the road, between the stops that bracket it. */
  private xForDate(main: Experience[], ym: string): number {
    const months = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
    const t = months(ym);
    const starts = main.map(e => months(e.start!));
    if (t <= starts[0]) {
      return this.stopPoints[0].x;
    }
    for (let i = 0; i < starts.length - 1; i++) {
      if (t < starts[i + 1]) {
        const share = (t - starts[i]) / (starts[i + 1] - starts[i]);
        return this.stopPoints[i].x + share * (this.stopPoints[i + 1].x - this.stopPoints[i].x);
      }
    }
    return this.stopPoints[this.stopPoints.length - 1].x;
  }

  /** The road's height at x, sampled from the curve segment that contains it. */
  private roadYAt(x: number): number {
    const i = Math.max(this.stopPoints.findIndex(p => p.x >= x) - 1, 0);
    const a = this.stopPoints[i];
    const b = this.stopPoints[Math.min(i + 1, this.stopPoints.length - 1)];
    const mid = (a.x + b.x) / 2;
    const bezier = (t: number, p0: number, p1: number, p2: number, p3: number) =>
      (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;
    let best = { dx: Infinity, y: a.y };
    for (let s = 0; s <= 60; s++) {
      const t = s / 60;
      const dx = Math.abs(bezier(t, a.x, mid, mid, b.x) - x);
      if (dx < best.dx) {
        best = { dx, y: bezier(t, a.y, a.y, b.y, b.y) };
      }
    }
    return best.y;
  }

  get current(): Chapter {
    return this.side ?? this.journey[this.selected];
  }

  ngAfterViewInit(): void {
    if (this.full) {
      return;
    }
    this.drawProgress();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    // Set after the first check so the template doesn't change mid-check.
    setTimeout(() => (this.autoplaying = true));
    // Animation frames run outside Angular so the creeping line doesn't re-render the page every frame.
    this.zone.runOutsideAngular(() => {
      let last = performance.now();
      const tick = (now: number) => {
        // Capped so a backgrounded tab doesn't skip a whole stop when it comes back.
        const delta = Math.min(now - last, 100);
        last = now;
        if (this.side) {
          this.sideDwell += delta;
        } else {
          this.dwell += delta;
        }
        if (this.side && this.sideDwell >= FILL_MS + TRAVEL_MS) {
          // The parallel track gets the same time as a stop, then the road carries on.
          this.zone.run(() => this.select(this.nextIndex));
        } else if (!this.side && this.dwell >= this.stopDuration) {
          this.zone.run(() => this.select(this.nextIndex));
        }
        this.drawProgress();
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    });
  }

  ngOnDestroy(): void {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
    }
  }

  selectSide(quest: Chapter): void {
    this.side = quest;
    this.sideDwell = 0;
    this.scrollToStop(this.road?.nativeElement.querySelectorAll<HTMLElement>('.road-stop-side')[this.sideQuests.indexOf(quest)]);
  }

  /** Prev/next from a side project returns to the road at the stop it came from. */
  step(direction: 1 | -1): void {
    this.select(this.side ? this.selected : this.selected + direction);
  }

  select(index: number): void {
    this.selected = Math.min(Math.max(index, 0), this.journey.length - 1);
    this.side = null;
    this.dwell = 0;
    this.drawProgress();

    this.scrollToStop(this.road?.nativeElement.querySelectorAll<HTMLElement>('.road-stop:not(.road-stop-side)')[this.selected]);
  }

  /** On narrow screens the road scrolls sideways; keep the chosen stop in view. */
  private scrollToStop(stop?: HTMLElement): void {
    const road = this.road?.nativeElement;
    if (road && stop && road.scrollWidth > road.clientWidth) {
      road.scrollTo({ left: stop.offsetLeft - road.clientWidth / 2, behavior: 'smooth' });
    }
  }

  /** The next stop on the road; after the finish line that's the start again. */
  get nextIndex(): number {
    return (this.selected + 1) % this.journey.length;
  }

  /** How long the current stop lasts: ring plus travel, or ring plus a short hold at the finish line. */
  private get stopDuration(): number {
    return FILL_MS + (this.selected === this.journey.length - 1 ? FINISH_HOLD_MS : TRAVEL_MS);
  }

  /** Wraps the road around the checkpoint, then lights it toward the next stop. */
  private drawProgress(): void {
    const fillShare = Math.min(this.dwell / FILL_MS, 1);
    this.ring?.nativeElement
      .querySelectorAll<SVGPathElement>('.road-ring-fill')
      .forEach(arc => (arc.style.strokeDashoffset = String(1 - fillShare)));

    const path = this.progressPath?.nativeElement;
    const road = path?.closest<HTMLElement>('.road');
    const last = this.journey.length - 1;
    if (!path || !road || last < 1) {
      return;
    }
    const total = path.getTotalLength();
    if (this.stopLengths.length !== this.journey.length) {
      this.stopLengths = this.stopPoints.map(p => this.lengthAtX(path, p.x));
    }

    // The lit road runs centre to centre; the robot flies straight into each checkpoint.
    const isLast = this.selected === last;
    const here = isLast ? total : this.stopLengths[this.selected];
    const travel = this.autoplaying ? Math.min(Math.max((this.dwell - FILL_MS) / TRAVEL_MS, 0), 1) : 0;
    const litLength = isLast ? total : here + travel * (this.stopLengths[this.selected + 1] - here);
    path.style.strokeDashoffset = String(1 - litLength / total);

    // Screen scale of the stretched road, and how close the robot gets before it docks.
    const sx = road.clientWidth / this.roadWidth;
    const sy = road.clientHeight / this.roadHeight;
    const dockPx = 26;
    const head = path.getPointAtLength(litLength);

    const robot = this.robot?.nativeElement;
    if (robot) {
      const near = [this.stopPoints[this.selected], this.stopPoints[this.selected + 1]].filter(Boolean);
      this.placeRobot(robot, path, litLength, total, sx, sy, near, dockPx, 1);
    }

    // The parallel track: its robot keeps pace with the main one, at the same point in time.
    const detour = this.detours[0];
    const detourPath = road.querySelector<SVGPathElement>('.road-detour-progress');
    const twin = this.parallelRobot?.nativeElement;
    if (!detour || !detourPath) {
      return;
    }
    const detourTotal = detourPath.getTotalLength();
    const onTrack = head.x > detour.startX && head.x < detour.endX && !isLast;
    const passedAll = head.x >= detour.endX || isLast;
    const detourLength = onTrack ? this.lengthAtX(detourPath, head.x) : passedAll ? detourTotal : 0;
    detourPath.style.strokeDashoffset = String(1 - detourLength / detourTotal);
    road.querySelector('.road-stop-side')?.classList.toggle('road-stop-side-passed', passedAll || head.x >= detour.x);
    if (twin) {
      // Fade in where it branches off and out where it rejoins.
      const edge = Math.min(head.x - detour.startX, detour.endX - head.x) * sx;
      const fade = onTrack ? Math.min(Math.max(edge / 20, 0), 1) : 0;
      this.placeRobot(twin, detourPath, detourLength, detourTotal, sx, sy, [{ x: detour.x, y: detour.y }], dockPx, fade);
    }
  }

  /** Puts a robot on its path, facing along it, shrinking into any checkpoint it reaches. */
  private placeRobot(
    robot: HTMLElement,
    path: SVGPathElement,
    length: number,
    total: number,
    sx: number,
    sy: number,
    checkpoints: { x: number; y: number }[],
    dockPx: number,
    visibility: number,
  ): void {
    const p = path.getPointAtLength(length);
    const ahead = path.getPointAtLength(Math.min(length + 1, total));
    const behind = path.getPointAtLength(Math.max(length - 1, 0));
    const angle = (Math.atan2((ahead.y - behind.y) * sy, (ahead.x - behind.x) * sx) * 180) / Math.PI;
    const x = p.x * sx;
    const y = p.y * sy;
    const distance = Math.min(...checkpoints.map(c => Math.hypot(c.x * sx - x, c.y * sy - y)), Infinity);
    const docked = Math.min(Math.max(distance / dockPx, 0), 1);
    robot.style.opacity = String(Math.min(docked * 2.5, 1) * visibility);
    robot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${angle}deg) scale(${0.35 + 0.65 * docked})`;
  }

  /** Length along the road at which it reaches x (the road always moves left to right). */
  private lengthAtX(path: SVGPathElement, x: number): number {
    let lo = 0;
    let hi = path.getTotalLength();
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (path.getPointAtLength(mid).x < x) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return lo;
  }
}
