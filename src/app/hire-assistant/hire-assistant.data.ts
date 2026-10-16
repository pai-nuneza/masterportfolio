/**
 * Loads what the hire assistant knows from src/personal-data/*.json (edit those, not this file), fills in
 * {placeholders} from contact.json, and turns everything it can search into documents: the FAQ topics, extra
 * facts, and the site's own experience and project data.
 */
import contactJson from '../../personal-data/contact.json';
import hoursJson from '../../personal-data/hours.json';
import linksJson from '../../personal-data/links.json';
import chatJson from '../../personal-data/chat.json';
import topicsJson from '../../personal-data/topics.json';
import knowledgeJson from '../../personal-data/knowledge.json';
import skillsJson from '../../personal-data/skills.json';
import projectsJson from '../../assets/data/projects-enhanced.json';
import { Experience, EXPERIENCES } from '../resume/experience/experience.data';

export interface ChatLink {
  label: string;
  /** '#section' scrolls the home page, '/path' is an app route, anything else is a normal link. */
  href: string;
  icon: string;
  /** Opens in a new tab. */
  external?: boolean;
}

export interface Topic {
  /** Short text for a quick-reply button; topics without one are only found by searching. */
  label?: string;
  question: string;
  keywords: string[];
  answer: string[];
  links: ChatLink[];
  /** Adds a "Compare times" button that opens the time-zone planner beside the chat. */
  timePlanner?: boolean;
}

/** Something the assistant can find and reply with. */
export interface SearchDoc {
  kind: 'faq' | 'fact' | 'experience' | 'project';
  title: string;
  reply: string[];
  links: ChatLink[];
  /** Searched with extra weight: titles, names, keywords and skills. */
  strong: string;
  /** Searched normally: the rest of the text. */
  body: string;
  topic?: Topic;
  /** The role or project it describes, so follow-up questions know what "there" or "it" means. */
  job?: Experience;
  project?: ProjectJson;
}

const contact = contactJson as Record<string, string>;
const linkDefs = linksJson as Record<string, ChatLink>;

/** Replaces {key} with that contact.json value ({key:url} URL-encodes it). */
const fill = (text: string) =>
  text.replace(/\{(\w+)(:url)?\}/g, (_, key: string, url?: string) => {
    const value = contact[key] ?? '';
    return url ? encodeURIComponent(value) : value;
  });

/** Turns link names from links.json into buttons, leaving out any whose address is still empty. */
export const links = (names: string[]): ChatLink[] =>
  names
    .map(name => linkDefs[name])
    .filter(Boolean)
    .map(link => ({ ...link, href: fill(link.href) }))
    .filter(link => link.href);

export const CONTACT = contact;
export const PAI_HOURS = hoursJson.pai;
export const VISITOR_HOURS = hoursJson.visitor;
export const BUBBLE = chatJson.bubble;
export const GREETING = chatJson.greeting.map(fill);
export const FALLBACK = chatJson.fallback.map(fill);
export const FALLBACK_LINKS = links(chatJson.fallbackLinks);
export const GREETING_WORDS = chatJson.greetingWords;
export const SYNONYMS = chatJson.synonyms as Record<string, string[]>;
export const PHRASES = chatJson.phrases;
export const MAIN_STACK = skillsJson.mainStack;
export const NOT_LISTED = skillsJson.notListed;
export const NOT_TECHNOLOGIES = skillsJson.notTechnologies;
export const CAN_ASK = [chatJson.canAskIntro, ...chatJson.canAsk.map(line => `• ${fill(line)}`)];

export const TOPICS: Topic[] = [
  ...(topicsJson as (Omit<Topic, 'links'> & { links: string[] })[]).map(topic => ({
    ...topic,
    answer: topic.answer.map(fill),
    links: links(topic.links),
  })),
  {
    label: 'What can I ask?',
    question: 'What can I ask you?',
    keywords: ['ask', 'questions', 'topics', 'options', 'menu'],
    answer: CAN_ASK,
    links: [],
  },
];

export interface ProjectJson {
  id: string;
  title: string;
  text?: string;
  description?: string;
  tech?: string;
  category?: string;
  role?: string;
  status?: string;
  date?: string;
  buttonText?: string;
  liveLink?: string;
  link?: string;
  technologies?: string[];
  coreFeatures?: string[];
  projectHighlights?: string[];
}

export const PROJECTS = projectsJson as ProjectJson[];

export const SEARCH_DOCS: SearchDoc[] = [
  ...TOPICS.map(topic => ({
    kind: 'faq' as const,
    title: topic.question,
    reply: topic.answer,
    links: topic.links,
    strong: [topic.question, ...topic.keywords].join(' '),
    // "What can I ask?" is only found by its keywords, not by the examples in its answer.
    body: topic.answer === CAN_ASK ? '' : topic.answer.join(' '),
    topic,
  })),
  ...(knowledgeJson as { title: string; text: string[]; keywords?: string[]; links?: string[] }[]).map(fact => ({
    kind: 'fact' as const,
    title: fact.title,
    reply: fact.text.map(fill),
    links: links(fact.links ?? []),
    strong: [fact.title, ...(fact.keywords ?? [])].join(' '),
    body: fact.text.join(' '),
  })),
  ...EXPERIENCES.map(job => ({
    kind: 'experience' as const,
    title: `${job.position} at ${job.short}`,
    reply: [
      `${job.position} at ${job.company} (${job.date}, ${job.location}).`,
      job.description,
      ...job.highlights.slice(0, 3).map(line => `• ${line}`),
      `Skills: ${job.skills.join(', ')}.`,
    ],
    links: [
      ...links(['experience']),
      ...(job.companyWebsite ? [{ label: job.short, href: job.companyWebsite, icon: 'fas fa-building', external: true }] : []),
    ],
    strong: [job.company, job.short, job.position, job.industry, ...job.skills].join(' '),
    body: [job.story, job.description, ...job.highlights, job.location, job.date].join(' '),
    job,
  })),
  ...PROJECTS.map(project => ({
    kind: 'project' as const,
    title: project.title,
    reply: [
      project.description ?? project.text ?? '',
      ...(project.projectHighlights ?? []).slice(0, 3).map(line => `• ${line}`),
      ...(project.tech ? [`Built with: ${project.tech}.`] : []),
      ...(project.role ? [`Pai's role: ${project.role}.`] : []),
    ].filter(Boolean),
    links: [
      { label: 'Project details', href: `/projects/${project.id}`, icon: 'fas fa-folder-open' },
      ...((project.liveLink ?? project.link)
        ? [{ label: project.buttonText ?? 'Open', href: (project.liveLink ?? project.link)!, icon: 'fas fa-external-link-alt', external: true }]
        : []),
    ],
    strong: [project.title, project.text, project.tech, project.category, project.role].filter(Boolean).join(' '),
    body: [project.description, ...(project.coreFeatures ?? []), ...(project.projectHighlights ?? []), project.status, project.date]
      .filter(Boolean)
      .join(' '),
    project,
  })),
];
