export interface Project {
  id: string;
  title: string;
  text: string;
  description: string;
  buttonText: string;
  link: string;
  tech: string;
  technologies: string[];
  category: string;
  date: string;
  imgLink: string;
  featured: boolean;
  isLargeCard?: boolean;
  status: string;
  projectType?: 'Professional' | 'Personal';
  isPersonal?: boolean;
  githubLink?: string;
  liveLink?: string | null;
  isPrivate?: boolean;
  clientName?: string;
  coreFeatures?: string[];
  /** What I personally did on the project; shown as "What I did". */
  projectHighlights?: string[];
  /** Notable technical points; shown when there are no project highlights. */
  highlights?: string[];
  /** My role, e.g. "Lead Developer / Technical Lead". */
  role?: string;
}
