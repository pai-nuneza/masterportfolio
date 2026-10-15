import { Component } from '@angular/core';
import { EXPERIENCES, Experience } from '../experience/experience.data';

interface TimelineBar {
  label: string;
  title: string;
  left: number;
  width: number;
  lane: number;
  current: boolean;
}

interface TechGroup {
  left: number;
  techs: string[];
}

/** Technologies worth plotting, in the order they should stack. */
const TRACKED_TECH = [
  'C#', 'ASP.NET MVC', 'SQL Server', 'jQuery', '.NET', 'Angular', 'Umbraco',
  'PHP', 'MySQL', 'WPF', 'FoxPro', 'Vue.js', 'React', 'Docker',
];

/** AI tools by when they joined daily work; the first one starts the AI era band. */
const AI_TOOLS: { name: string; since: string }[] = [
  { name: 'ChatGPT', since: '2022-12' },
  { name: 'GitHub Copilot', since: '2024-03' },
  { name: 'Claude', since: '2024-03' },
];

const toMonths = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
};

@Component({
  selector: 'app-experience-timeline',
  templateUrl: './experience-timeline.component.html',
  styleUrls: ['./experience-timeline.component.css'],
})
export class ExperienceTimelineComponent {
  readonly laneHeight = 44;

  years: { year: number; left: number }[] = [];
  bars: TimelineBar[] = [];
  techGroups: TechGroup[] = [];
  laneCount = 0;
  aiLeft = 0;
  aiGroups: TechGroup[] = [];

  constructor() {
    const roles = EXPERIENCES.filter((e): e is Experience & { start: string } => !!e.start)
      .sort((a, b) => toMonths(a.start) - toMonths(b.start));

    const firstYear = Number(roles[0].start.slice(0, 4));
    const lastYear = new Date().getFullYear();
    const min = firstYear * 12;
    const max = (lastYear + 1) * 12;
    const pct = (months: number) => ((months - min) / (max - min)) * 100;

    for (let year = firstYear; year <= lastYear; year++) {
      this.years.push({ year, left: pct(year * 12) });
    }

    // Overlapping roles go on separate lanes.
    const laneEnds: number[] = [];
    for (const role of roles) {
      const start = toMonths(role.start);
      const end = role.end ? toMonths(role.end) : max;
      let lane = laneEnds.findIndex(laneEnd => laneEnd <= start);
      if (lane === -1) {
        lane = laneEnds.length;
      }
      laneEnds[lane] = end;
      this.bars.push({
        label: role.short,
        title: `${role.position} · ${role.company} · ${role.date}`,
        left: pct(start),
        width: pct(end) - pct(start),
        lane,
        current: !role.end,
      });
    }
    this.laneCount = laneEnds.length;

    // Each tracked technology appears where it was first used.
    const seen = new Set<string>();
    for (const role of roles) {
      const skills = role.skills.map(s => s.toLowerCase());
      const techs = TRACKED_TECH.filter(t => !seen.has(t) && skills.includes(t.toLowerCase()));
      if (techs.length) {
        techs.forEach(t => seen.add(t));
        this.techGroups.push({ left: pct(toMonths(role.start)), techs });
      }
    }

    this.aiLeft = pct(toMonths(AI_TOOLS[0].since));
    for (const tool of AI_TOOLS) {
      const left = pct(toMonths(tool.since));
      const group = this.aiGroups.find(g => g.left === left);
      if (group) {
        group.techs.push(tool.name);
      } else {
        this.aiGroups.push({ left, techs: [tool.name] });
      }
    }
  }
}
