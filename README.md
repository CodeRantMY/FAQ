# CodeRant FAQ

Community FAQ for Bangladeshi developers and families living in Malaysia.

## Browse the FAQs

- Website entry point: [`index.html`](index.html)
- GitHub-readable content: [`content/README.md`](content/README.md)
- Original imported draft: [`FAQs_ CodeRant [Draft].md`](FAQs_%20CodeRant%20%5BDraft%5D.md)

## Content Structure

Each FAQ is stored as its own Markdown file under `content/faqs/<category>/`.

That keeps the repository readable on GitHub and lets the website generate an edit link for one specific FAQ. Visitors can click **Edit this FAQ**, which opens GitHub's web editor. Contributors without write access can submit the change through a fork and pull request.

Each FAQ front matter includes `last_updated`. Update that date when the answer content changes, using `YYYY-MM-DD`.

The website also shows `Last edited by` from Git history. `scripts/build_site_data.py` reads the latest commit author for each FAQ file. The GitHub Pages workflow checks out full history and rebuilds site data before deployment so this stays current.

The **Add FAQ** button opens GitHub's create-file screen with a starter front matter template. Contributors should update the `id`, `title`, `category`, `category_slug`, `status`, `last_updated`, and body before submitting a pull request.

## Website Features

- Category navigation
- Full-text client-side search
- One-click edit links for each FAQ
- GitHub source links for each FAQ
- Frequently visited FAQ panel
- Optional Plausible or GoatCounter analytics hooks

## Update the FAQ Index

After editing Markdown files or `analytics/popular.json`, rebuild the committed site data:

```bash
python3 scripts/build_site_data.py
```

## Analytics

The site is static, so site-wide popularity needs an analytics provider or a committed export. See [`analytics/README.md`](analytics/README.md).

When no provider data is committed, the website shows FAQs frequently opened in the current browser.

## GitHub Pages

This repository includes a GitHub Actions workflow that deploys the static site to GitHub Pages. In repository settings, enable Pages with **GitHub Actions** as the source.
