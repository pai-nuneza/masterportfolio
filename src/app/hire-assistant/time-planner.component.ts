import { Component, OnDestroy, OnInit } from '@angular/core';
import { CONTACT, PAI_HOURS, VISITOR_HOURS } from './hire-assistant.data';

interface ZoneTime {
  hour: number;
  minute: number;
  /** 0 = Sunday to 6 = Saturday. */
  day: number;
}

interface Slot {
  at: Date;
  visitor: ZoneTime;
  pai: ZoneTime;
  visitorFree: boolean;
  paiFree: boolean;
  /** Midnight in the visitor's zone: labelled with the day instead of the hour. */
  newDay: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** The time zones on offer, with everyday names; the dropdown labels them with their current UTC offset. */
const ZONES: [zone: string, name: string][] = [
  ['Pacific/Honolulu', 'Hawaii'],
  ['America/Anchorage', 'Alaska'],
  ['America/Los_Angeles', 'Pacific Time (Los Angeles, Vancouver)'],
  ['America/Denver', 'Mountain Time (Denver)'],
  ['America/Chicago', 'Central Time (Chicago, Mexico City)'],
  ['America/New_York', 'Eastern Time (New York, Toronto)'],
  ['America/Halifax', 'Atlantic Time (Halifax)'],
  ['America/Sao_Paulo', 'Brazil (São Paulo)'],
  ['UTC', 'UTC'],
  ['Europe/London', 'UK & Ireland (London, Dublin)'],
  ['Africa/Lagos', 'West Africa (Lagos)'],
  ['Europe/Berlin', 'Central Europe (Berlin, Paris, Madrid)'],
  ['Africa/Johannesburg', 'South Africa (Johannesburg)'],
  ['Europe/Helsinki', 'Eastern Europe (Helsinki, Athens)'],
  ['Africa/Nairobi', 'East Africa (Nairobi)'],
  ['Europe/Moscow', 'Moscow'],
  ['Asia/Dubai', 'Gulf (Dubai, Abu Dhabi)'],
  ['Asia/Karachi', 'Pakistan (Karachi)'],
  ['Asia/Kolkata', 'India (Mumbai, Delhi)'],
  ['Asia/Dhaka', 'Bangladesh (Dhaka)'],
  ['Asia/Bangkok', 'Indochina (Bangkok, Jakarta, Hanoi)'],
  ['Asia/Singapore', 'Singapore & Malaysia'],
  ['Asia/Manila', 'Philippines (Manila)'],
  ['Asia/Shanghai', 'China & Hong Kong'],
  ['Australia/Perth', 'Western Australia (Perth)'],
  ['Asia/Tokyo', 'Japan & Korea (Tokyo, Seoul)'],
  ['Australia/Adelaide', 'Central Australia (Adelaide)'],
  ['Australia/Brisbane', 'Queensland (Brisbane)'],
  ['Australia/Sydney', 'Eastern Australia (Sydney, Melbourne)'],
  ['Pacific/Auckland', 'New Zealand (Auckland)'],
];

/**
 * A small WorldTimeBuddy-style planner: the next 24 hours side by side in the visitor's time zone and Pai's,
 * highlighting the visitor's usual hours, Pai's working hours, and the hours that suit both. Picking an hour
 * offers an email that proposes it, written out in both time zones.
 */
@Component({
  selector: 'app-time-planner',
  templateUrl: './time-planner.component.html',
  styleUrls: ['./time-planner.component.css'],
})
export class TimePlannerComponent implements OnInit, OnDestroy {
  readonly paiPlace = PAI_HOURS.place;
  readonly paiZone = PAI_HOURS.zone;
  /** The dropdown: the zones above (plus the visitor's own if it isn't one), labelled and sorted by UTC offset. */
  options: { zone: string; label: string }[] = [];
  zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  slots: Slot[] = [];
  selected?: Slot;
  private timer?: number;
  private readonly partsFormats = new Map<string, Intl.DateTimeFormat>();

  ngOnInit(): void {
    this.options = this.listOptions();
    this.build();
    // Keeps the "now" column current while the chat is open.
    this.timer = window.setInterval(() => this.build(), 60000);
  }

  ngOnDestroy(): void {
    window.clearInterval(this.timer);
  }

  setZone(zone: string): void {
    this.zone = zone;
    this.selected = undefined;
    this.build();
  }

  zoneName(zone: string): string {
    return zone.replace(/_/g, ' ');
  }

  /** "+7h" style difference from the visitor to Pai. */
  get difference(): string {
    const now = new Date();
    const minutes = this.offset(now, PAI_HOURS.zone) - this.offset(now, this.zone);
    if (!minutes) {
      return 'same time';
    }
    const hours = Math.abs(minutes) / 60;
    return `Pai is ${hours % 1 ? hours.toFixed(1) : hours}h ${minutes > 0 ? 'ahead' : 'behind'}`;
  }

  get bestRange(): string {
    const both = this.slots.filter(slot => slot.visitorFree && slot.paiFree);
    if (!both.length) {
      return "Your usual hours don't overlap with Pai's this coming day, but Pai can flex for an early or late call.";
    }
    const first = both[0];
    const last = both[both.length - 1];
    return `Good for both: ${this.time(first.at, this.zone)} – ${this.time(new Date(last.at.getTime() + 3600000), this.zone)} your time.`;
  }

  time(at: Date, zone: string, withDay = false): string {
    return new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit', weekday: withDay ? 'short' : undefined }).format(at);
  }

  label(time: ZoneTime): string {
    return time.minute ? `${time.hour}:${String(time.minute).padStart(2, '0')}` : String(time.hour);
  }

  /** Two letters, so it fits an hour cell. */
  dayName(time: ZoneTime): string {
    return DAYS[time.day].slice(0, 2);
  }

  describe(slot: Slot): string {
    const fit = slot.visitorFree && slot.paiFree ? ', good for both' : slot.paiFree ? ", in Pai's hours" : '';
    return `${this.time(slot.at, this.zone, true)} your time, ${this.time(slot.at, PAI_HOURS.zone, true)} for Pai${fit}`;
  }

  get requestHref(): string {
    const slot = this.selected!;
    const yours = `${this.time(slot.at, this.zone, true)} (${this.zone})`;
    const pais = `${this.time(slot.at, PAI_HOURS.zone, true)} (${PAI_HOURS.place} time)`;
    const subject = 'Call request';
    const body = `Hi Pai,\n\nCould we have a call at ${yours}, which is ${pais} for you?\n\nThanks,`;
    return `mailto:${CONTACT['email']}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  /** The next 24 hours from the start of the visitor's current hour. */
  private build(): void {
    const now = new Date();
    const start = new Date(now.getTime() - this.parts(now, this.zone).minute * 60000);
    start.setSeconds(0, 0);
    this.slots = Array.from({ length: 24 }, (_, i) => {
      const at = new Date(start.getTime() + i * 3600000);
      const visitor = this.parts(at, this.zone);
      const pai = this.parts(at, PAI_HOURS.zone);
      return {
        at,
        visitor,
        pai,
        visitorFree: VISITOR_HOURS.days.includes(visitor.day) && visitor.hour >= VISITOR_HOURS.start && visitor.hour < VISITOR_HOURS.end,
        paiFree: PAI_HOURS.days.includes(pai.day) && pai.hour >= PAI_HOURS.start && pai.hour < PAI_HOURS.end,
        newDay: visitor.hour === 0,
      };
    });
    // Keep the picked hour if it's still on the strip, otherwise suggest the first hour that suits both.
    this.selected =
      this.slots.find(slot => slot.at.getTime() === this.selected?.at.getTime()) ??
      this.slots.find(slot => slot.visitorFree && slot.paiFree);
  }

  private parts(at: Date, zone: string): ZoneTime & { year: number; month: number; date: number } {
    let format = this.partsFormats.get(zone);
    if (!format) {
      format = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
      });
      this.partsFormats.set(zone, format);
    }
    const get = (type: string) => format!.formatToParts(at).find(part => part.type === type)?.value ?? '0';
    return {
      year: +get('year'), month: +get('month'), date: +get('day'),
      hour: +get('hour') % 24, minute: +get('minute'), day: DAYS.indexOf(get('weekday')),
    };
  }

  /** The zone's offset from UTC at that moment, in minutes. */
  private offset(at: Date, zone: string): number {
    const p = this.parts(at, zone);
    // The parts stop at minutes, so compare against the start of that minute.
    const minuteStart = at.getTime() - (at.getTime() % 60000);
    return Math.round((Date.UTC(p.year, p.month - 1, p.date, p.hour, p.minute) - minuteStart) / 60000);
  }

  private listOptions(): { zone: string; label: string }[] {
    const now = new Date();
    const zones = ZONES.some(([zone]) => zone === this.zone) ? ZONES : [...ZONES, [this.zone, 'Your local time'] as [string, string]];
    return zones
      .map(([zone, name]) => ({ zone, name, offset: this.offset(now, zone) }))
      .sort((a, b) => a.offset - b.offset)
      .map(({ zone, name, offset }) => ({ zone, label: `${this.utc(offset)} · ${name}` }));
  }

  /** "UTC+8", "UTC−5", "UTC+5:30". */
  private utc(minutes: number): string {
    if (!minutes) {
      return 'UTC±0';
    }
    const sign = minutes > 0 ? '+' : '−';
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
  }
}
