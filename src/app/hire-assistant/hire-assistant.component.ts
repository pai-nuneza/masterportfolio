import { AfterViewInit, Component, effect, ElementRef, HostListener, inject, OnDestroy, ViewChild } from '@angular/core';
import { AssistantDockService } from './assistant-dock.service';
import {
  BUBBLE, CAN_ASK, ChatLink, FALLBACK, FALLBACK_LINKS, GREETING, GREETING_WORDS, SEARCH_DOCS, SYNONYMS, Topic, TOPICS,
} from './hire-assistant.data';
import { KnowledgeSearch } from './knowledge-search';
import { SmartAnswers } from './smart-answers';

interface Message {
  from: 'bot' | 'visitor';
  text: string[];
  links?: ChatLink[];
  timePlanner?: boolean;
  /** Titles of other close matches, offered as follow-up buttons. */
  related?: string[];
}

/** The bubble shows for this long after docking, then again whenever the robot is hovered or focused. */
const BUBBLE_MS = 12000;
const HELLO = BUBBLE.hello;
const AT_BOTTOM = BUBBLE.atBottom;
/** How close to the end of the page counts as reaching the bottom, in px. */
const BOTTOM_SLACK = 120;
/** A short "typing" beat before each answer. */
const TYPING_MS = 550;
/** Below this search score, nothing counts as an answer. */
const MIN_SCORE = 2;
/** Other matches at least this close to the best are offered as follow-ups (up to MAX_RELATED). */
const RELATED_SHARE = 0.6;
const MAX_RELATED = 2;

/**
 * Once the repair robot has finished the planet, it docks here as a small assistant that only talks about
 * hiring Pai. Quick replies give their FAQ answer; typed questions are searched across everything in
 * src/personal-data plus the site's experience and projects, and answered with the best match (nothing is made up).
 */
@Component({
  selector: 'app-hire-assistant',
  templateUrl: './hire-assistant.component.html',
  styleUrls: ['./hire-assistant.component.css'],
})
export class HireAssistantComponent implements AfterViewInit, OnDestroy {
  @ViewChild('robot') robot?: ElementRef<SVGSVGElement>;
  @ViewChild('launcher') launcher?: ElementRef<HTMLButtonElement>;
  @ViewChild('input') input?: ElementRef<HTMLInputElement>;
  @ViewChild('log') log?: ElementRef<HTMLElement>;

  private readonly dock = inject(AssistantDockService);
  readonly docked = this.dock.docked;
  /** Quick replies still to offer: each one disappears once its topic has been answered. */
  presets = TOPICS.filter(topic => topic.label);
  open = false;
  /** The bigger chat view, toggled from the header. */
  large = false;
  /** The time planner beside the chat: open until closed (or the chat closes), and kept alive while hidden. */
  plannerShown = false;
  bubble = false;
  bubbleText = HELLO;
  /** It asks whether they found what they were looking for only once, the first time they reach the bottom. */
  private askedAtBottom = false;
  typing = false;
  draft = '';
  messages: Message[] = [];
  private readonly knowledge = new KnowledgeSearch(SEARCH_DOCS, SYNONYMS);
  private readonly smart = new SmartAnswers(this.knowledge);
  private timers: number[] = [];
  private bubbleTimer?: number;

  constructor() {
    effect(() => {
      if (this.docked()) {
        this.say(this.askedAtBottom ? AT_BOTTOM : HELLO, 500);
      }
    });
  }

  /** Reaching the bottom brings the robot straight here (if it's still repairing) to ask if they found what they needed. */
  @HostListener('window:scroll')
  onScroll(): void {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - BOTTOM_SLACK;
    if (!atBottom || this.askedAtBottom) {
      return;
    }
    this.askedAtBottom = true;
    if (this.docked()) {
      this.say(AT_BOTTOM, 0);
    } else {
      this.dock.summoned = true;
    }
  }

  ngAfterViewInit(): void {
    this.dock.anchor = this.robot?.nativeElement;
  }

  ngOnDestroy(): void {
    this.timers.forEach(t => window.clearTimeout(t));
    window.clearTimeout(this.bubbleTimer);
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.open) {
      this.open = false;
      this.hidePlanner();
      this.launcher?.nativeElement.focus();
    }
  }

  toggle(): void {
    if (this.open) {
      this.close();
      return;
    }
    this.open = true;
    this.bubble = false;
    if (!this.messages.length) {
      this.messages.push({ from: 'bot', text: GREETING });
    }
    // On touch screens focusing would pop the keyboard up over the greeting, so let them tap the input.
    if (window.matchMedia('(hover: hover)').matches) {
      this.later(() => this.input?.nativeElement.focus(), 50);
    }
  }

  togglePlanner(): void {
    this.plannerShown = !this.plannerShown;
  }

  hidePlanner(): void {
    this.plannerShown = false;
  }

  showBubble(show: boolean): void {
    this.bubble = show && !this.open;
  }

  /** Shows the bubble with this line for a while (unless the chat is open), then it goes back to the usual hello. */
  private say(text: string, delay: number): void {
    this.later(() => {
      if (this.open) {
        return;
      }
      this.bubbleText = text;
      this.bubble = true;
      window.clearTimeout(this.bubbleTimer);
      this.bubbleTimer = window.setTimeout(() => {
        this.bubble = false;
        this.bubbleText = HELLO;
      }, BUBBLE_MS);
    }, delay);
  }

  pick(topic: Topic): void {
    this.ask(topic.question, topic);
  }

  send(): void {
    const text = this.draft.trim();
    if (text) {
      this.draft = '';
      this.ask(text);
    }
  }

  /** Follow-up buttons ask about a related match by its title. */
  askAbout(title: string): void {
    this.ask(title);
  }

  /** Answers a quick reply with its topic, or a typed question with the best search match. */
  private ask(question: string, topic?: Topic): void {
    this.messages.push({ from: 'visitor', text: [question] });
    const reply: Omit<Message, 'from'> & { topic?: Topic } = topic
      ? { text: topic.answer, links: topic.links, timePlanner: topic.timePlanner, topic }
      : this.answer(question);
    this.presets = this.presets.filter(preset => preset !== reply.topic);
    this.typing = true;
    this.scrollDown();
    this.later(() => {
      this.typing = false;
      this.messages.push({ from: 'bot', text: reply.text, links: reply.links, timePlanner: reply.timePlanner, related: reply.related });
      this.scrollDown();
    }, TYPING_MS);
  }

  /**
   * Typos fixed first; then a reply built straight from the data if the question is one of the familiar kinds
   * ("Has Pai used X?", "What did Pai do at Y?", follow-ups...), otherwise the best search match.
   */
  private answer(asked: string): Omit<Message, 'from'> & { topic?: Topic } {
    const question = this.smart.correct(asked);
    const built = this.smart.answer(question);
    if (built) {
      return built;
    }
    const hits = this.knowledge.search(question);
    const best = hits[0];
    if (!best || best.score < MIN_SCORE) {
      const words = ` ${question.toLowerCase().replace(/[^a-z]+/g, ' ')} `;
      return GREETING_WORDS.some(word => words.includes(` ${word} `))
        ? { text: GREETING }
        : { text: [...FALLBACK, ...CAN_ASK], links: FALLBACK_LINKS };
    }
    const related = hits
      .slice(1)
      .filter(hit => hit.score >= best.score * RELATED_SHARE && hit.doc.title !== best.doc.title)
      .slice(0, MAX_RELATED)
      .map(hit => hit.doc.title);
    const { doc } = best;
    this.smart.remember(doc);
    return { text: doc.reply, links: doc.links, timePlanner: doc.topic?.timePlanner, related, topic: doc.topic };
  }

  private scrollDown(): void {
    this.later(() => this.log?.nativeElement.scrollTo({ top: this.log.nativeElement.scrollHeight, behavior: 'smooth' }), 0);
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(window.setTimeout(fn, ms));
  }
}
