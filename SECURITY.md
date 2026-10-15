# Security

## No secrets in this repo

This is a static frontend: everything in `src/` is downloaded by every visitor. Never commit
API keys, tokens, passwords, or connection strings, and check screenshots before adding them to
`src/assets/images/`.

## Contact form

The contact form posts to [Netlify Forms](https://docs.netlify.com/forms/setup/), so no mail
credentials are needed in the frontend. Submissions appear in the Netlify dashboard under
**Forms → contact**, where you can also set up email notifications and spam filtering. A hidden
`bot-field` honeypot drops basic bot submissions.

## Reporting an issue

If you find a security problem, email pai.nuneza@gmail.com rather than opening a public issue.
