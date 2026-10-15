# Pai Nuñeza · Portfolio

**I bring legacy systems back to life.**

The personal portfolio of Ramer Pailou "Pai" Nuñeza, a Software & Product Engineer with 11+ years
across HRIS, hotel booking, IP management, and FoxPro-to-web rebuilds.

**Live site:** [painuneza.netlify.app](https://painuneza.netlify.app/)

## What's inside

| Section | What it shows |
| --- | --- |
| Hero | The story in one line and the main stack (C#/.NET, React, Angular, Vue, SQL Server, Docker, Claude AI) |
| Before → After | Legacy systems and what they became, e.g. a FoxPro desktop app rebuilt as a web platform for 200K+ members |
| Selected Works | Legacy rebuilds, client work, and personal projects, each with a details popup |
| About | Who I am and how I work |
| My Journey | A winding road of career stops, with parallel work (like the FoxPro rebuild) branching off it; each stop tells its story and opens the full chapter |
| `/experience` | Every role as a vertical timeline, plus a chart of roles and the tech that came with them, including the AI era |
| Contact | A message form (Netlify Forms) and direct email |

## Tech stack

- [Angular 18](https://angular.dev) (NgModules, `@defer` blocks for below-the-fold sections)
- Bootstrap 5 and Tailwind CSS for layout, plus component CSS for the custom design
- Font Awesome icons
- Hosted on [Netlify](https://www.netlify.com), with Netlify Forms for the contact form

## Running it locally

Requires Node.js 18.19+ (developed on Node 22).

```bash
npm install
npm start            # http://localhost:4200
npm run build        # production build in dist/browser
```

The contact form only sends on Netlify. Locally, use the "Use email app" button instead.

## Editing the content

Most content lives in data files, so you rarely need to touch templates.

| To change | Edit |
| --- | --- |
| Roles, dates, stories, icons, skills | [`src/app/resume/experience/experience.data.ts`](src/app/resume/experience/experience.data.ts) |
| Projects (set `"isPersonal": true` to label a personal project) | [`src/assets/data/projects-enhanced.json`](src/assets/data/projects-enhanced.json) |
| Hero text, stack, Before → After rows | [`src/app/resume/home/`](src/app/resume/home/) |
| Tech and AI tools on the career timeline | [`experience-timeline.component.ts`](src/app/resume/experience-timeline/experience-timeline.component.ts) |
| Page width for every section | `--content-max` in [`src/styles.css`](src/styles.css) |

A role needs `start` and `end` (`YYYY-MM`, or `end: null` for a current role) to appear in the
carousel and on the timeline.

## Deployment

Pushing to `main` deploys to Netlify using [`netlify.toml`](netlify.toml):

- Builds with `ng build --configuration production` and publishes `dist/browser`.
- Replaces the `__SITE_URL__` placeholders in `index.html` with Netlify's `$URL`, so link
  previews (LinkedIn, Slack, etc.) get absolute URLs.
- Redirects every path to `index.html` so routes like `/experience` work on refresh.

The hidden `contact` form in [`src/index.html`](src/index.html) lets Netlify detect the form at deploy
time. Keep its fields in sync with [`email.service.ts`](src/services/email.service.ts).
