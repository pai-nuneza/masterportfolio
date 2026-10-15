import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { EXPERIENCES, Experience } from './experience.data';

/** Matches the AI era start on the career timeline. */
const AI_ERA_START = '2022-12';

/** One accent per role, oldest first, so each chapter has its own colour. */
const ACCENTS = ['#ff8a5c', '#5cc8ff', '#ff6fa8', '#b38cff', '#ffb547', '#7ee081', '#ffd25c', '#00cba9'];

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
  styleUrls: ['./experience.component.css', './experience-carousel.css'],
})
export class ExperienceComponent implements OnInit, OnDestroy {
  /** Full shows the vertical chapter timeline; otherwise the home carousel. */
  @Input() full = false;

  @ViewChild('track') track?: ElementRef<HTMLElement>;

  /** Dated roles, oldest first. */
  journey: Chapter[];
  /** Every role, newest first. */
  chapters: Chapter[];
  /** Index into journey of the open chapter, if any. */
  selected: number | null = null;
  /** True while the pointer or keyboard focus is on the carousel. */
  paused = false;
  private autoplay?: ReturnType<typeof setInterval>;

  constructor() {
    const dated = EXPERIENCES.filter(e => e.start).sort((a, b) => a.start!.localeCompare(b.start!));
    const toChapter = (exp: Experience): Chapter => {
      const index = dated.indexOf(exp);
      return {
        exp,
        label: index >= 0 ? `Chapter ${String(index + 1).padStart(2, '0')}` : 'Side work',
        year: exp.start ? exp.start.slice(0, 4) : '',
        endYear: exp.end ? exp.end.slice(0, 4) : 'Now',
        accent: ACCENTS[index >= 0 ? index % ACCENTS.length : ACCENTS.length - 1],
        aiEraBelow: false,
      };
    };

    this.journey = dated.map(toChapter);
    this.chapters = EXPERIENCES.map(toChapter);

    // Newest first: the marker goes below the oldest role that started in the AI era.
    const aiRoles = this.chapters.filter(c => c.exp.start && c.exp.start >= AI_ERA_START);
    if (aiRoles.length) {
      aiRoles[aiRoles.length - 1].aiEraBelow = true;
    }
  }

  get current(): Chapter | null {
    return this.selected === null ? null : this.journey[this.selected];
  }

  ngOnInit(): void {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.full && !reducedMotion) {
      this.autoplay = setInterval(() => this.advance(), 4000);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.autoplay);
  }

  /** Opens a chapter, or closes it if it is already open. */
  toggle(index: number): void {
    this.selected = this.selected === index ? null : index;
  }

  /** Moves the carousel by one card. */
  scrollJourney(direction: 1 | -1): void {
    const track = this.track?.nativeElement;
    const card = track?.firstElementChild as HTMLElement | null;
    if (track && card) {
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: 'smooth' });
    }
  }

  /** Autoplay step: next card, wrapping to the start; holds still while someone is reading. */
  private advance(): void {
    const track = this.track?.nativeElement;
    if (!track || this.paused || this.selected !== null) {
      return;
    }
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      this.scrollJourney(1);
    }
  }
}
