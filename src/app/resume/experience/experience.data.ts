export interface Experience {
  company: string;
  short: string;
  /** Work that ran in parallel with the main jobs; drawn as a branch off the main road. */
  side?: boolean;
  /** Font Awesome class used as the role's illustration. */
  icon: string;
  industry: string;
  /** One first-person sentence for the home story panel. */
  story: string;
  position: string;
  date: string;
  /** YYYY-MM; roles without a start are left off the timeline. */
  start?: string;
  /** YYYY-MM, or null while the role is current. */
  end?: string | null;
  location: string;
  description: string;
  highlights: string[];
  companyWebsite?: string;
  skills: string[];
}

export const EXPERIENCES: Experience[] = [
  {
    company: 'Civica (via Cloudstaff)',
    story: 'Now modernizing a legacy regulatory system for a UK public-sector client.',
    icon: 'fas fa-landmark',
    industry: 'Public sector',
    short: 'Civica',
    position: 'Senior Software Developer (Contractor)',
    date: 'Jul 2026 - Present',
    start: '2026-07',
    end: null,
    location: 'Remote',
    description: 'Modernizing a legacy regulatory system for a UK public-sector client into a secure, maintainable web application.',
    highlights: [
      'Rebuild legacy workflows and business rules as modern web features while keeping existing processes and data intact.',
      'Work with an international team on delivery, code reviews, and releases.',
    ],
    companyWebsite: 'https://www.civica.com/',
    skills: ['React', 'Docker', 'Legacy Modernization', 'Web Applications', 'Public Sector'],
  },
  {
    company: 'Codev',
    story: 'Built fee and due-date logic for an IP management platform, with AI tools in my kit.',
    icon: 'fas fa-copyright',
    industry: 'IP management',
    short: 'Codev',
    position: 'Senior Software Developer',
    date: 'Mar 2024 - Jul 2026',
    start: '2024-03',
    end: '2026-07',
    location: 'International team',
    description: 'IPR management platform for patents, trademarks, copyrights, renewals, due dates, and official fee workflows.',
    highlights: [
      'Build C#/.NET backend features for official fee calculation, due date calculation, validation rules, and IP-related business logic.',
      'Develop Vue.js frontend features and maintain PHP applications built with Slim and Blade templates.',
      'Use GitHub Copilot and ChatGPT to support code analysis, debugging, documentation review, and test-case preparation.',
    ],
    companyWebsite: 'https://www.codev.com/',
    skills: ['C#', '.NET', 'Vue.js', 'PHP', 'Slim', 'Blade', 'Agile'],
  },
  {
    company: 'Contract / Freelance',
    side: true,
    story: 'Led a team bringing a FoxPro desktop system back to life as a web app.',
    icon: 'fas fa-database',
    industry: 'Legacy rebuild',
    short: 'FoxPro rebuild',
    position: 'Technical Lead Developer',
    date: '2023 - Oct 2026',
    start: '2023-01',
    end: '2026-10',
    location: 'Remote',
    description: 'Led a small team rebuilding a legacy FoxPro desktop system into a PHP/MySQL web application.',
    highlights: [
      'Led 4 developers, managed tasks, reviewed pull requests, and guided technical decisions throughout the project.',
      'Designed the new relational MySQL database and mapped legacy FoxPro data into the new schema.',
      'Built a C# WPF migration tool to convert FoxPro DBF files into MySQL relational tables.',
      'Coordinated with the project manager and joined client meetings to clarify requirements and align priorities.',
    ],
    skills: ['PHP', 'MySQL', 'C#', 'WPF', 'FoxPro', 'DBF Migration', 'Team Leadership'],
  },
  {
    company: 'Unient',
    story: 'Built terminal-ops features for Australian clients, plus a timesheet app that cut subscription costs.',
    icon: 'fas fa-ship',
    industry: 'Terminal ops & HR',
    short: 'Unient',
    position: 'Senior Application Specialist',
    date: 'Feb 2021 - Mar 2024',
    start: '2021-02',
    end: '2024-03',
    location: 'Cebu, Philippines',
    description: 'Developed terminal operations systems for Australian clients, plus an in-house timesheet app that replaced paid HR subscriptions.',
    highlights: [
      'Built C# and Angular features for terminal operations workflows, including integrations with Navis N4.',
      'Rebuilt the company website using Umbraco CMS so management could update content without developer support.',
      'Built an in-house timesheet app for 90-100 employees that saved the company subscription costs, with time-in/time-out, task logs, hours reporting, and task statistics.',
      'Built a Team Configuration Management tool that helped sales estimate team cost by role, seniority, and staffing needs.',
    ],
    companyWebsite: 'https://www.unient.biz/',
    skills: ['C#', 'Angular', 'Umbraco', 'SQL Server', 'Navis N4', 'Reporting'],
  },
  {
    company: 'Digital Excellence Group Cebu',
    story: 'Built Health Watch, helping employees track their wellness with surveys and charts.',
    icon: 'fas fa-heartbeat',
    industry: 'Health & wellness',
    short: 'DEG',
    position: 'Full Stack Developer',
    date: 'Jun 2020 - Jan 2021',
    start: '2020-06',
    end: '2021-01',
    location: 'Cebu, Philippines',
    description: 'Worked on Health Watch, a web application used by employees to track and report health and wellness information.',
    highlights: [
      'Built full-stack features using ASP.NET MVC, C#, JavaScript, jQuery, and Chart.js.',
      'Developed survey, reporting, and chart-based features for employee wellness data.',
      'Improved usability by fixing issues, updating screens, and supporting backend and frontend changes.',
    ],
    companyWebsite: 'http://digitalexcellencegroup.com/',
    skills: ['ASP.NET MVC', 'C#', 'JavaScript', 'jQuery', 'Chart.js', 'Bootstrap'],
  },
  {
    company: 'Alliance Software, Inc.',
    story: 'Kept an HRIS running in production, fixing what mattered most first.',
    icon: 'fas fa-users',
    industry: 'HRIS',
    short: 'Alliance',
    position: 'Technical Specialist II',
    date: 'Nov 2018 - May 2020',
    start: '2018-11',
    end: '2020-05',
    location: 'Cebu, Philippines',
    description: 'Supported and enhanced an HRIS application through feature updates, bug fixes, and production support.',
    highlights: [
      'Assessed reported issues by urgency and business impact, then worked with QA and release teams to move fixes into production.',
      'Prepared technical documentation, diagrams, and low-level design notes for feature work and project manager review.',
    ],
    companyWebsite: 'https://www.alliance.com.ph/index.html',
    skills: ['HRIS', '.NET', 'SQL Server', 'QA Support', 'Documentation'],
  },
  {
    company: 'M. Lhuillier Financial Services',
    story: 'Started my career moving paper branch requests into an online approval workflow.',
    icon: 'fas fa-store',
    industry: 'Financial services',
    short: 'M. Lhuillier',
    position: 'Junior Developer',
    date: 'Sept 2015 - Nov 2018',
    start: '2015-09',
    end: '2018-11',
    location: 'Cebu, Philippines',
    description: 'Supported internal business application development for nationwide branch operations.',
    highlights: [
      'Worked on C#, ASP.NET MVC, jQuery, and Bootstrap while supporting internal business systems.',
      'Helped build an Online Request Application for nationwide branch supply, equipment, and business requests.',
      'Moved paper-based branch requests into an online approval workflow for branch managers, regional managers, and other approvers.',
    ],
    companyWebsite: 'https://mlhuillier.com/',
    skills: ['C#', 'ASP.NET MVC', 'jQuery', 'Bootstrap', 'SQL Server', 'Workflow Systems'],
  },
  {
    company: 'Freelance Project Support',
    side: true,
    story: 'Pick up PHP tasks for a food and beverage management app on the side.',
    icon: 'fas fa-utensils',
    industry: 'Food & beverage',
    short: 'Freelance Project Support',
    position: 'PHP / CodeIgniter Developer',
    date: 'Additional project work',
    location: 'Belgium-based client',
    description: 'Support a task-based food and beverage management project when development tasks are available.',
    highlights: [
      'Handle PHP/CodeIgniter development tasks for a food and beverage management application.',
    ],
    skills: ['PHP', 'CodeIgniter', 'Task-Based Development'],
  },
];
