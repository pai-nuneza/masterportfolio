import { Experience, EXPERIENCES } from '../resume/experience/experience.data';
import {
  ChatLink, links, MAIN_STACK, NOT_LISTED, NOT_TECHNOLOGIES, PHRASES, ProjectJson, PROJECTS, SearchDoc, TOPICS,
} from './hire-assistant.data';
import { KnowledgeSearch } from './knowledge-search';

export interface SmartReply {
  text: string[];
  links: ChatLink[];
}

interface Tech {
  /** As written in the data, e.g. "Vue.js". */
  name: string;
  /** Normalised for comparing, e.g. "vue". */
  key: string;
  /** False for technologies only in skills.json's notListed. */
  listed: boolean;
}

type Intent = 'used' | 'where' | 'role' | 'when' | 'project';

/** What the conversation was last about, so follow-ups like "what about Vue?" or "how long was Pai there?" work. */
interface Context {
  techs?: Tech[];
  job?: Experience;
  project?: ProjectJson;
  intent?: Intent;
}

/** Trailing words that can be dropped to get a shorter alias ("SQL Server" → "sql", "Claude AI" → "claude"). */
const DROPPABLE = ['ai', 'runtime', 'core', 'server', 'cms', 'dbf'];
const WHERE = /\b(where|in which)\b|\b(which|what) (projects?|companies|company|jobs?|roles?|places?|clients?)\b/;
const WHEN = /\b(when|how long|dates?|what year|which year|since when|duration|period|started|start|leave|left)\b/;
const MORE = /\b(tell me more|more (about|on|details?|info)|elaborate|go on|expand)\b|^(more|details)\b/;
const CURRENT = /\b(current|currently|now|present|right now|these days|today|at the moment)\b/;
const JOBISH = /\b(job|work|works|working|role|company|employer|position|doing|employed)\b/;
const COMPANIES = /\b(companies|employers|work history|employment history|previous (jobs|roles|companies|employers)|where (has|have|did) (pai|he|she|they) worked)\b/;
const PROJECT_LIST = /\bprojects\b/;
const LISTISH = /\b(what|which|list|show|any|examples?|all|see)\b/;
const FOLLOW_UP = /^(and|what about|how about|also)\b/;
const PRONOUN = /\b(it|that|this|there|them)\b/;
const PROJECT_WORDS = /\b(project|website|site|app|built|build)\b/;

/**
 * Answers common hiring questions by building replies straight from Pai's data, the way a person would:
 * "Has Pai used Angular?" → which roles and projects used it. It understands technologies, companies and
 * projects, a handful of question types, follow-ups, and small typos. Anything else returns nothing, and
 * the assistant falls back to searching. Every sentence comes from the data, so nothing is invented.
 */
export class SmartAnswers {
  private readonly techs: Tech[] = [];
  private readonly techAliases: [string, Tech][] = [];
  private readonly companyAliases: [string, Experience][] = [];
  private readonly projectAliases: [string, ProjectJson][] = [];
  private readonly vocabulary: string[];
  private context: Context = {};

  constructor(private readonly search: KnowledgeSearch) {
    const skip = new Set(NOT_TECHNOLOGIES.map(name => this.key(name)));
    const technologies = [
      ...MAIN_STACK.flatMap(item => item.split('/').map(part => part.trim())),
      ...EXPERIENCES.flatMap(job => job.skills),
      ...PROJECTS.flatMap(project => project.technologies ?? []),
    ];
    technologies.filter(name => !skip.has(this.key(name))).forEach(name => this.addTech(name, true));
    NOT_LISTED.forEach(name => this.addTech(name, false));

    for (const job of EXPERIENCES) {
      const names = job.side ? [job.short] : [job.short, job.company.split(' (')[0]];
      const lastWord = job.short.split(' ').pop() ?? '';
      if (!job.side && lastWord.length >= 5) {
        names.push(lastWord);
      }
      names.forEach(name => this.companyAliases.push([this.search.fold(name), job]));
    }
    for (const project of PROJECTS) {
      const title = this.search.fold(project.title);
      const words = title.split(/\s+/).filter(word => word.length >= 4);
      const names = [title, title.split(' & ')[0], project.id.replace(/-/g, ' ')];
      words.slice(1).forEach((word, i) => names.push(`${words[i]} ${word}`));
      names.forEach(name => this.projectAliases.push([name, project]));
    }
    // Longest first, so "react native" wins over "react" and "asp.net mvc" over ".net".
    [this.techAliases, this.companyAliases, this.projectAliases].forEach(list => list.sort((a, b) => b[0].length - a[0].length));

    const words = [
      ...this.techAliases.map(([alias]) => alias),
      ...this.companyAliases.map(([alias]) => alias),
      ...this.projectAliases.map(([alias]) => alias),
      ...TOPICS.flatMap(topic => topic.keywords),
    ].flatMap(phrase => phrase.split(/\s+/));
    this.vocabulary = [...new Set(words.filter(word => /^[a-z][a-z.#+]{3,}$/.test(word)))];
  }

  /** Fixes likely typos of known names and keywords ("anguler" → "angular", "expirience" → "experience"). */
  correct(question: string): string {
    return question.replace(/[A-Za-z][A-Za-z.#+]{4,}/g, word => {
      const lower = word.toLowerCase();
      // Plurals of known words aren't typos ("projects", "technologies").
      const singulars = [lower.replace(/ies$/, 'y'), lower.replace(/es$/, ''), lower.replace(/s$/, '')];
      if (this.vocabulary.includes(lower) || singulars.some(singular => this.vocabulary.includes(singular))) {
        return word;
      }
      const limit = lower.length >= 8 ? 2 : 1;
      let best: string | undefined;
      let bestDistance = limit + 1;
      for (const known of this.vocabulary) {
        if (known[0] === lower[0] && Math.abs(known.length - lower.length) <= limit) {
          const distance = editDistance(lower, known);
          if (distance < bestDistance) {
            best = known;
            bestDistance = distance;
          }
        }
      }
      return best ?? word;
    });
  }

  /** A reply built from the data, or undefined if the question isn't one it understands. */
  answer(question: string): SmartReply | undefined {
    const folded = ` ${this.search.fold(question).replace(/[?!,;:]/g, ' ')} `;
    // A name shared by a company and a project ("Unient") means the company, unless the question is about a build.
    const projectFirst = PROJECT_WORDS.test(folded);
    const companyHits = projectFirst ? undefined : this.find(this.companyAliases, folded);
    const projectHits = this.find(this.projectAliases, companyHits?.masked ?? folded);
    const companies = companyHits ?? this.find(this.companyAliases, projectHits.masked);
    const rest = projectFirst ? companies.masked : projectHits.masked;
    const techs = this.find(this.techAliases, rest).found;
    const q = rest.trim();
    const followUp = FOLLOW_UP.test(q) || q.split(/\s+/).length <= 3;
    const project = projectHits.found[0];
    // "Did Pai use C# there?": "there" is the company last talked about.
    const job = companies.found[0] ?? (techs.length && PRONOUN.test(q) ? this.context.job : undefined);

    if (job && (techs.length || (PRONOUN.test(q) && this.context.techs))) {
      return this.usedAtCompany(techs.length ? techs : this.context.techs!, job);
    }
    if (job) {
      const asWhen = WHEN.test(q) || (followUp && this.context.intent === 'when');
      return asWhen ? this.when(job) : this.role(job);
    }
    if (project) {
      return this.aboutProject(project);
    }
    if (techs.length) {
      const asWhere = WHERE.test(q) || (FOLLOW_UP.test(q) && this.context.intent === 'where');
      return asWhere ? this.where(techs) : this.used(techs);
    }
    if (CURRENT.test(q) && JOBISH.test(q)) {
      return this.current();
    }
    if (COMPANIES.test(q)) {
      return this.companies();
    }
    if (PROJECT_LIST.test(q) && LISTISH.test(q)) {
      return this.projects();
    }

    // Follow-ups about whatever was discussed last.
    const last = this.context;
    if (MORE.test(q)) {
      if (last.job) {
        return this.role(last.job, true);
      }
      if (last.project) {
        return this.aboutProject(last.project);
      }
      if (last.techs) {
        return this.where(last.techs);
      }
    }
    if (WHEN.test(q) && last.job) {
      return this.when(last.job);
    }
    if (WHERE.test(q) && last.techs && (followUp || PRONOUN.test(q))) {
      return this.where(last.techs);
    }
    if (PRONOUN.test(q) && last.job) {
      return this.role(last.job);
    }
    if (PRONOUN.test(q) && last.project) {
      return this.aboutProject(last.project);
    }
    return undefined;
  }

  /** Lets a search answer set the topic too, so "how long was Pai there?" works after it. */
  remember(doc: SearchDoc): void {
    if (doc.job) {
      this.context = { job: doc.job, intent: 'role' };
    } else if (doc.project) {
      this.context = { project: doc.project, intent: 'project' };
    }
  }

  private used(techs: Tech[]): SmartReply {
    this.context = { techs, intent: 'used' };
    return this.techReply(techs, (tech, where) =>
      where ? this.say('usedYes', { tech: tech.name, where }) : this.inStack(tech) ? this.say('usedStackOnly', { tech: tech.name }) : '',
    );
  }

  private where(techs: Tech[]): SmartReply {
    this.context = { techs, intent: 'where' };
    return this.techReply(techs, (tech, where) =>
      where ? this.say('usedWhere', { tech: tech.name, where }) : this.inStack(tech) ? this.say('usedStackOnly', { tech: tech.name }) : '',
    );
  }

  /** One sentence per technology; ones Pai hasn't listed get an honest "not listed" instead. */
  private techReply(techs: Tech[], sentence: (tech: Tech, where: string) => string): SmartReply {
    const text: string[] = [];
    const projectLinks: ChatLink[] = [];
    let missing = false;
    let usedInJobs = false;
    for (const tech of techs) {
      const jobs = EXPERIENCES.filter(job => job.skills.some(skill => this.matches(skill, tech)));
      const projects = PROJECTS.filter(project => (project.technologies ?? []).some(name => this.matches(name, tech)));
      // Positions only when there are a couple of roles; side work reads as "in the ... work".
      const main = jobs.filter(job => !job.side);
      const side = jobs.filter(job => job.side);
      const brief = main.length > 2;
      const places = [
        main.length ? `at ${list(main.map(job => (brief ? job.short : `${job.short} as ${job.position}`)))}` : '',
        side.length ? `in the ${list(side.map(job => job.short))} work` : '',
        projects.length ? `on the ${list(projects.map(project => project.title))} project${projects.length > 1 ? 's' : ''}` : '',
      ].filter(Boolean);
      const line = sentence(tech, places.join(' and '));
      if (line) {
        text.push(line);
      } else {
        missing = true;
        text.push(this.say('notListed', { tech: tech.name, stack: list(MAIN_STACK) }));
      }
      usedInJobs ||= jobs.length > 0;
      projects.forEach(project => projectLinks.push(this.projectLink(project)));
    }
    if (missing) {
      text.push(PHRASES.askDirectly);
    }
    return {
      text,
      links: [
        ...projectLinks.slice(0, 2),
        ...(usedInJobs ? links(['experience']) : []),
        ...(missing ? links(['email']) : []),
      ],
    };
  }

  private usedAtCompany(techs: Tech[], job: Experience): SmartReply {
    this.context = { techs, job, intent: 'used' };
    const text = techs.map(tech =>
      job.skills.some(skill => this.matches(skill, tech))
        ? this.say('usedAtCompanyYes', { tech: tech.name, company: job.short })
        : this.say('usedAtCompanyNo', { tech: tech.name, company: job.short, skills: list(job.skills) }),
    );
    return { text, links: this.jobLinks(job) };
  }

  private role(job: Experience, full = false): SmartReply {
    this.context = { job, intent: 'role' };
    return {
      text: [
        this.say('roleAt', { company: job.company, was: job.end === null ? 'is' : 'was', position: job.position, date: job.date }),
        job.description,
        ...job.highlights.slice(0, full ? undefined : 2).map(line => `• ${line}`),
        `Skills: ${list(job.skills)}.`,
      ],
      links: this.jobLinks(job),
    };
  }

  private when(job: Experience): SmartReply {
    this.context = { job, intent: 'when' };
    return {
      text: [
        this.say('roleWhen', {
          company: job.company, was: job.end === null ? 'is' : 'was', position: job.position, date: job.date, duration: duration(job),
        }),
      ],
      links: this.jobLinks(job),
    };
  }

  private current(): SmartReply {
    const job = EXPERIENCES.find(item => item.end === null && !item.side) ?? EXPERIENCES[0];
    this.context = { job, intent: 'role' };
    return {
      text: [this.say('current', { position: job.position, company: job.company, since: job.date.split(' - ')[0] }), job.description],
      links: this.jobLinks(job),
    };
  }

  private companies(): SmartReply {
    this.context = {};
    const jobs = EXPERIENCES.map(job => `${job.short} (${job.position}, ${job.date})`);
    return { text: [this.say('companies', { list: list(jobs) })], links: links(['experience', 'resume']) };
  }

  private projects(): SmartReply {
    this.context = {};
    return {
      text: [this.say('projects', { list: list(PROJECTS.map(project => project.title)) })],
      links: [...links(['projects']), ...PROJECTS.slice(0, 2).map(project => this.projectLink(project))],
    };
  }

  private aboutProject(project: ProjectJson): SmartReply {
    this.context = { project, intent: 'project' };
    const live = project.liveLink ?? project.link;
    return {
      text: [
        `${project.title}: ${project.description ?? project.text ?? ''}`,
        ...(project.projectHighlights ?? []).slice(0, 3).map(line => `• ${line}`),
        ...(project.tech ? [`Built with: ${project.tech}.`] : []),
        ...(project.role ? [`Pai's role: ${project.role}.`] : []),
        ...(project.status ? [`Status: ${project.status}.`] : []),
      ],
      links: [
        this.projectLink(project),
        ...(live ? [{ label: project.buttonText ?? 'Open', href: live, icon: 'fas fa-external-link-alt', external: true }] : []),
      ],
    };
  }

  /** Every alias found in the text (longest first), with each match blanked out so shorter aliases can't re-match it. */
  private find<T>(aliases: [string, T][], text: string): { found: T[]; masked: string } {
    const hits: { item: T; at: number }[] = [];
    let masked = text;
    for (const [alias, item] of aliases) {
      const pattern = new RegExp(`(?<![a-z0-9.#])${escape(alias)}(?![a-z0-9#])`);
      const hit = masked.match(pattern);
      if (hit?.index !== undefined) {
        masked = masked.slice(0, hit.index) + ' '.repeat(alias.length) + masked.slice(hit.index + alias.length);
        if (!hits.some(existing => existing.item === item)) {
          hits.push({ item, at: hit.index });
        }
      }
    }
    // In the order they were asked about.
    return { found: hits.sort((a, b) => a.at - b.at).map(hit => hit.item), masked };
  }

  private addTech(name: string, listed: boolean): void {
    const key = this.key(name);
    if (!key || this.techs.some(tech => tech.key === key)) {
      return;
    }
    const tech = { name, key, listed };
    this.techs.push(tech);
    const aliases = new Set([key, this.search.fold(name)]);
    const words = key.split(' ');
    if (words.length > 1 && DROPPABLE.includes(words[words.length - 1])) {
      aliases.add(words.slice(0, -1).join(' '));
    }
    aliases.forEach(alias => this.techAliases.push([alias, tech]));
  }

  /** "Vue.js" → "vue", ".NET 8" → ".net", "Umbraco CMS" → "umbraco cms" (aliases handle the rest). */
  private key(name: string): string {
    return this.search
      .fold(name)
      .trim()
      .replace(/\.js$/, '')
      .replace(/\s+\d+(\.\d+)*$/, '');
  }

  /** Whether a skill from the data is (or is a version or flavour of) the technology: ".NET 8" and "ASP.NET MVC" count as .NET. */
  private matches(skill: string, tech: Tech): boolean {
    const key = this.key(skill);
    return key === tech.key || key.startsWith(`${tech.key} `) || (tech.key === '.net' && key.includes('.net'));
  }

  private inStack(tech: Tech): boolean {
    return tech.listed && MAIN_STACK.some(item => item.split('/').some(part => this.key(part.trim()) === tech.key));
  }

  private jobLinks(job: Experience): ChatLink[] {
    return [
      ...links(['experience']),
      ...(job.companyWebsite ? [{ label: job.short, href: job.companyWebsite, icon: 'fas fa-building', external: true }] : []),
    ];
  }

  private projectLink(project: ProjectJson): ChatLink {
    return { label: project.title, href: `/projects/${project.id}`, icon: 'fas fa-folder-open' };
  }

  /** One of the phrase's wordings at random, with {placeholders} filled in. */
  private say(name: keyof typeof PHRASES, values: Record<string, string>): string {
    const options = PHRASES[name];
    const template = Array.isArray(options) ? options[Math.floor(Math.random() * options.length)] : options;
    return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
  }
}

/** "A", "A and B", "A, B and C". */
function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** " (2 years, 4 months)" from the role's start and end (or today), or "" if the dates aren't known. */
function duration(job: Experience): string {
  if (!job.start) {
    return '';
  }
  const [startYear, startMonth] = job.start.split('-').map(Number);
  const end = job.end ? job.end.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const months = (end[0] - startYear) * 12 + (end[1] - startMonth);
  if (months < 1) {
    return '';
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years ? `${years} year${years > 1 ? 's' : ''}` : '', rest ? `${rest} month${rest > 1 ? 's' : ''}` : ''];
  return ` (${parts.filter(Boolean).join(', ')})`;
}

/** How many single-letter edits turn one word into the other. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
