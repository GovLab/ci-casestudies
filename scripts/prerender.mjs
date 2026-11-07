#!/usr/bin/env node
// Pre-renders the CMS-driven pages of this static Vue 2 site into plain HTML,
// so crawlers that do not run JavaScript (GPTBot, ClaudeBot, PerplexityBot)
// get the page text, a real <title>, meta description, canonical URL, Open
// Graph tags and schema.org JSON-LD; and writes a Markdown copy of each page
// plus llms.txt and llms-full.txt for assistants. The same engine is used by
// the GovLab sites ci-casestudies, virtual-communities and coronavirus; what
// differs per site lives in scripts/prerender.config.mjs.
//
// How it works
//   1. Serves this repo locally with Netlify-like routing (/x -> x.html, the
//      _redirects 200 rewrites) and opens every page in headless Chrome, which
//      runs the page's own Vue code against the live CMS (read-only GETs).
//   2. Renders the page's original Vue template once more with that data,
//      off-screen, so the markup is exactly what Vue produces.
//   3. Writes the page: rendered #home-page, the original template as
//      <script type="text/x-template" id="home-page-tpl">, the CMS data as
//      <script type="application/json" id="prerender-data">, and new head tags.
//      The page's JS renders from that template and data instead of calling the
//      API, so browsers end up with the same markup and no flash.
//   4. Writes <page>.md (front matter + full text), llms.txt, llms-full.txt,
//      sitemap.xml and _headers (content types and canonical Link headers for
//      the Markdown files).
//   Detail pages are written as flat files next to their template
//   (case/<slug>.html); single pages are rendered in place from a pristine copy
//   kept in scripts/templates/<file>.tpl. Edit that copy, not the page.
//
// Usage (needs Google Chrome; set CHROME_PATH if it is not in /Applications)
//   npm --prefix scripts install          once, installs the dev dependencies
//   node scripts/prerender.mjs            render every page and the site-wide files
//   node scripts/prerender.mjs --verify   reload every written page, check that
//                                         Vue renders identical markup without
//                                         calling the API, that the JSON-LD parses,
//                                         and compare Markdown and page word counts
//   node scripts/prerender.mjs --serve [port]   serve the site like Netlify does

import { createServer } from 'node:http';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = path.join(ROOT, 'scripts', 'templates');
const MANIFEST = path.join(ROOT, 'scripts', 'prerendered.json');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const config = (await import(pathToFileURL(path.join(ROOT, 'scripts', 'prerender.config.mjs')))).default;

// Third-party requests that are not needed to render the content.
const BLOCK = /googletagmanager\.com|google-analytics\.com|hypothes\.is|kit\.fontawesome\.com|use\.typekit\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|amcharts\.com/;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.pdf': 'application/pdf', '.zip': 'application/zip',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject',
};

// ---------------------------------------------------------------- helpers

const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', eacute: 'é',
  aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', ccedil: 'ç',
  atilde: 'ã', otilde: 'õ', uuml: 'ü', ouml: 'ö', auml: 'ä', copy: '©', reg: '®',
};

function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// Plain-text summary of CMS HTML, skipping a leading heading such as "Introduction".
function summary(html, max = 160) {
  const text = htmlToText(String(html || '').replace(/^\s*<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i, ''));
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,;:.–—-]+$/, '') + '…';
}

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// JSON inside <script>: "<" must not appear, or "</script>" in the data would end the element.
const scriptJson = (value, indent) => JSON.stringify(value, null, indent).replace(/</g, '\\u003c');
const words = (text) => String(text).split(/\s+/).filter(Boolean).length;

// Netlify serves files without regard to case, and answers a page path with
// capitals with a 301 to the lower-case path (e.g. /lectures/AI-future-of-education
// -> /lectures/ai-future-of-education on aiethicscourse.org). So every address
// published here is the lower-case path; file names keep their case.
function sitePath(urlPath) {
  return encodeURI(urlPath.toLowerCase());
}

function canonicalUrl(urlPath) {
  return config.origin + sitePath(urlPath);
}

// "/" -> "index.md", "/literature-review/" -> "literature-review.md", "/case/x" -> "case/x.md"
function markdownFile(urlPath) {
  return (urlPath.replace(/\/$/, '') || '/index').slice(1) + '.md';
}

// Anonymous, read-only GET against the site's Directus API.
async function directus(collection, query = {}) {
  const url = new URL(`items/${collection}`, config.directus);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return (await res.json()).data;
}

const isFile = (rel) => {
  const abs = path.join(ROOT, rel);
  return abs.startsWith(ROOT + path.sep) && existsSync(abs) && statSync(abs).isFile();
};

async function readManifest() {
  try { return JSON.parse(await readFile(MANIFEST, 'utf8')); } catch { return { pages: [] }; }
}

// ---------------------------------------------------------------- Markdown

let markdownBase = config.origin + '/';
let pagePaths = new Set(); // lower-case paths of the pages being rendered
const redactions = { emails: 0, phones: 0 };
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g;

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*' });
turndown.use(tables);
turndown.remove(['script', 'style', 'iframe', 'noscript', 'button', 'form', 'input', 'select']);
turndown.addRule('footnote-marks', {
  filter: 'sup',
  replacement: (content) => (content.trim() ? `[${content.trim()}]` : ''),
});
turndown.addRule('images', {
  filter: 'img',
  // Embedded (base64) images are dropped, keeping their alt text.
  replacement: (content, node) => {
    const alt = (node.getAttribute('alt') || '').replace(/\s+/g, ' ').trim();
    const src = (node.getAttribute('src') || '').trim();
    if (!src || src.startsWith('data:')) return alt;
    return `![${alt}](${new URL(src, markdownBase).href})`;
  },
});
turndown.addRule('links', {
  filter: (node) => node.nodeName === 'A' && Boolean(node.getAttribute('href')),
  replacement: (content, node) => {
    const href = node.getAttribute('href').trim();
    if (!content.trim()) return '';
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return content;
    let url;
    try { url = new URL(href, markdownBase); } catch { return content; }
    // Links within the site point at the clean URLs ("/x", not "/x.html").
    if (url.origin === new URL(config.origin).origin) {
      url.pathname = url.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
      // Links to pre-rendered pages use their published (lower-case) address.
      let decoded = url.pathname;
      try { decoded = decodeURIComponent(url.pathname); } catch { /* keep as is */ }
      if (pagePaths.has(decoded.toLowerCase())) url.pathname = sitePath(decoded);
    }
    return `[${content}](${url.href})`;
  },
});
// Turndown's list items with a single space after the marker ("- item", "1. item").
turndown.addRule('list-items', {
  filter: 'li',
  replacement: (content, node) => {
    let prefix = '- ';
    const parent = node.parentNode;
    if (parent.nodeName === 'OL') {
      const start = parent.getAttribute('start');
      const index = Array.prototype.indexOf.call(parent.children, node);
      prefix = `${start ? Number(start) + index : index + 1}. `;
    }
    const paragraph = /\n$/.test(content);
    const body = content.replace(/^\n+|\n+$/g, '') + (paragraph ? '\n' : '');
    return prefix + body.replace(/\n/gm, '\n' + ' '.repeat(prefix.length)) + (node.nextSibling ? '\n' : '');
  },
});

// Elements left out by mdFrom(): tag names, ".class" or "#id".
let dropSelectors = [];
const matches = (node, sel) => {
  if (sel[0] === '.') return ` ${node.getAttribute('class') || ''} `.replace(/\s+/g, ' ').includes(` ${sel.slice(1)} `);
  if (sel[0] === '#') return node.getAttribute('id') === sel.slice(1);
  return node.nodeName === sel.toUpperCase();
};
turndown.addRule('drop', {
  filter: (node) => node.nodeType === 1 && dropSelectors.some((sel) => matches(node, sel)),
  replacement: () => '',
});

// Shift headings so the shallowest one is "##": the page title is the only "#".
function normaliseHeadings(text) {
  const levels = [...text.matchAll(/^(#{1,6}) /gm)].map((m) => m[1].length);
  if (!levels.length) return text;
  const shift = 2 - Math.min(...levels);
  return text.replace(/^(#{1,6}) /gm, (m, h) => '#'.repeat(Math.min(6, Math.max(2, h.length + shift))) + ' ');
}

// CMS HTML -> Markdown, without contact emails or phone numbers.
function md(html) {
  if (!html) return '';
  const text = turndown.turndown(String(html))
    .replace(/\u00a0/g, ' ')
    .replace(EMAIL, () => { redactions.emails += 1; return '[email removed]'; })
    .replace(PHONE, () => { redactions.phones += 1; return '[phone number removed]'; })
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normaliseHeadings(text);
}

// Rendered page HTML -> Markdown, leaving out navigation and other chrome.
function mdFrom(html, drop = []) {
  dropSelectors = drop;
  try { return md(html); } finally { dropSelectors = []; }
}

function frontMatter(fields) {
  const order = ['id', 'type', 'title', 'url', 'date', 'authors', 'summary', 'source', 'licence'];
  const lines = order
    .filter((k) => fields[k] !== undefined && fields[k] !== null && fields[k] !== '' && !(Array.isArray(fields[k]) && !fields[k].length))
    .map((k) => `${k}: ${JSON.stringify(fields[k])}`);
  return ['---', ...lines, '---'].join('\n');
}

function markdownPage(page, doc) {
  const file = markdownFile(page.path);
  const fields = {
    id: `${config.siteId}:${file.replace(/\.md$/, '')}`,
    type: doc.type,
    title: doc.title,
    url: canonicalUrl(page.path),
    date: doc.date,
    authors: doc.authors,
    summary: doc.summary ? htmlToText(doc.summary).replace(EMAIL, '') : undefined,
    source: config.source,
    licence: config.licence,
  };
  const text = `${frontMatter(fields)}\n\n# ${doc.title}\n\n${doc.body.trim()}\n`;
  return { file, url: config.origin + sitePath('/' + file), title: doc.title, summary: fields.summary, text };
}

// ---------------------------------------------------------------- local server

async function parseRedirects() {
  let text = '';
  try { text = await readFile(path.join(ROOT, '_redirects'), 'utf8'); } catch { return []; }
  return text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
    const [from, to, status = '301'] = l.split(/\s+/);
    return { from, to: to.split('?')[0], status: parseInt(status, 10) || 301 };
  });
}

function matchRule(rule, p) {
  if (rule.from.endsWith('/*')) {
    const prefix = rule.from.slice(0, -1);
    if (p.startsWith(prefix)) return rule.to.replace(':splat', p.slice(prefix.length)).replace(/^\/+/, '');
    return null;
  }
  return rule.from === p ? rule.to.replace(/^\/+/, '') : null;
}

// hide: repo files to treat as missing; overrides: repo file -> file served in its place.
async function startServer({ port = 0, hide = new Set(), overrides = new Map() } = {}) {
  const rules = await parseRedirects();
  const exists = (rel) => !hide.has(rel) && (overrides.has(rel) || isFile(rel));
  // Like Netlify: a file is found without regard to case.
  const find = (rel) => {
    if (exists(rel)) return rel;
    let dir = ROOT;
    const found = [];
    for (const seg of rel.split('/')) {
      let names;
      try { names = readdirSync(dir); } catch { return null; }
      const hit = names.find((n) => n.toLowerCase() === seg.toLowerCase());
      if (!hit) return null;
      found.push(hit);
      dir = path.join(dir, hit);
    }
    const actual = found.join('/');
    return exists(actual) ? actual : null;
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { p = url.pathname; }
    if (p.includes('\0') || p.split('/').includes('..')) return res.writeHead(400).end();
    const rel = p.replace(/^\/+/, '');
    const redirect = (to) => res.writeHead(301, { location: encodeURI(to) + url.search }).end();
    let target = null;
    let status = 200;
    if (p.endsWith('/')) {
      if (find(rel + 'index.html')) target = find(rel + 'index.html');
      else if (rel && find(rel.slice(0, -1) + '.html')) return redirect(p.slice(0, -1).toLowerCase());
    } else if (find(rel)) target = find(rel);
    else if (find(rel + '.html')) {
      // Like Netlify: a page path with capitals gets a 301 to the lower-case path.
      if (p !== p.toLowerCase()) return redirect(p.toLowerCase());
      target = find(rel + '.html');
    } else if (find(rel + '/index.html')) return redirect(p + '/');
    if (!target) {
      for (const rule of rules) {
        const to = matchRule(rule, p);
        if (to && exists(to)) { target = to; status = rule.status; break; }
      }
    }
    if (!target) return res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    const body = await readFile(overrides.get(target) || path.join(ROOT, target));
    res.writeHead(status, { 'content-type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

// ---------------------------------------------------------------- rendering

// Runs inside the page, once its Vue instance has loaded the CMS data.
function renderInPage({ source, seedKeys }) {
  const vm = document.getElementById('home-page').__vue__;
  // The template Vue compiles today is the browser-parsed #home-page element.
  // Comments, <script> and <style> elements are dropped: Vue does not render
  // them, and they must not sit in a <script> (a page whose #home-page is not
  // closed in the source gets the trailing scripts inside it).
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const el = doc.getElementById('home-page');
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.remove());
  el.querySelectorAll('script, style').forEach((n) => n.remove());
  const template = el.outerHTML;

  // Published rows only; drop editor ids and file-storage details.
  const KEEP_FILE = ['id', 'title', 'description', 'filename_download', 'type', 'width', 'height'];
  const clean = (v) => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') {
      if ('filename_disk' in v && 'storage' in v) {
        const file = {};
        KEEP_FILE.forEach((k) => { if (k in v) file[k] = v[k]; });
        return file;
      }
      const out = {};
      Object.keys(v).forEach((k) => { if (k !== 'user_created' && k !== 'user_updated') out[k] = clean(v[k]); });
      return out;
    }
    return v;
  };
  const published = (rows) => rows.filter((r) => !(r && typeof r === 'object' && typeof r.status === 'string' && r.status !== 'published'));
  // Data only: DOM nodes and jQuery objects some pages keep in their data are left out.
  const json = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x === 'object' && (x.nodeType || x.jquery) ? undefined : x)));
  const state = {};
  Object.keys(vm.$data).forEach((k) => {
    try { state[k] = json(vm.$data[k]); } catch (e) { return; }
    state[k] = clean(Array.isArray(state[k]) ? published(state[k]) : state[k]);
  });

  const fresh = new Vue({
    template,
    data: () => JSON.parse(JSON.stringify(state)),
    methods: vm.$options.methods,
    computed: vm.$options.computed,
    filters: vm.$options.filters,
  });
  fresh.$mount();
  const seed = {};
  seedKeys.forEach((k) => { seed[k] = state[k]; });
  return { template, html: fresh.$el.outerHTML, seed, state };
}

async function snapshot(browser, url, page, source) {
  const tab = await browser.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (BLOCK.test(r.url()) ? r.abort() : r.continue()));
  await tab.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  try {
    await tab.waitForFunction((keys) => {
      const el = document.getElementById('home-page');
      const vm = el && el.__vue__;
      if (!vm) return false;
      return keys.every((k) => {
        const v = vm.$data[k];
        return Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : Boolean(v);
      });
    }, { timeout: 30000, polling: 200 }, page.ready || page.seed);
  } catch (e) {
    await tab.close();
    throw new Error(`${url}: the CMS data did not load (${errors.slice(0, 2).join(' | ') || e.message})`);
  }
  await new Promise((r) => setTimeout(r, 300));
  const result = await tab.evaluate(renderInPage, { source, seedKeys: page.seed });
  await tab.close();
  return result;
}

// Start and end offsets of the id="home-page" element (a <div> or <main>) in the source.
function homePageSpan(src) {
  const open = /<([a-z][a-z0-9]*)\b[^>]*\bid=["']home-page["'][^>]*>/i.exec(src);
  if (!open) throw new Error('no element with id="home-page" in template');
  const tag = open[1].toLowerCase();
  const tags = new RegExp(`<!--[\\s\\S]*?-->|<(\\/?)${tag}\\b[^>]*>`, 'gi');
  tags.lastIndex = open.index;
  let depth = 0;
  let m;
  while ((m = tags.exec(src))) {
    if (m[0].startsWith('<!--')) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return [open.index, m.index + m[0].length];
  }
  // Not closed in the source (some pages): the browser closes it at </body>.
  const body = src.toLowerCase().indexOf('</body>', open.index);
  return [open.index, body > 0 ? body : src.length];
}

function headTags(page, head, markdown) {
  const url = canonicalUrl(page.path);
  const tags = [
    `<title>${escapeText(head.title)}</title>`,
    `<meta name="description" content="${escapeAttr(head.description)}">`,
    `<link rel="canonical" href="${escapeAttr(url)}">`,
  ];
  if (markdown) tags.push(`<link rel="alternate" type="text/markdown" href="${escapeAttr(markdown.url)}">`);
  tags.push(
    `<meta property="og:type" content="${head.ogType || 'website'}">`,
    `<meta property="og:site_name" content="${escapeAttr(config.siteName)}">`,
    `<meta property="og:title" content="${escapeAttr(head.title)}">`,
    `<meta property="og:description" content="${escapeAttr(head.description)}">`,
    `<meta property="og:url" content="${escapeAttr(url)}">`,
  );
  if (head.image) tags.push(`<meta property="og:image" content="${escapeAttr(head.image)}">`);
  tags.push(`<meta name="twitter:card" content="${head.image ? 'summary_large_image' : 'summary'}">`);
  if (config.twitterSite) tags.push(`<meta name="twitter:site" content="${escapeAttr(config.twitterSite)}">`);
  tags.push(`<meta name="twitter:title" content="${escapeAttr(head.title)}">`);
  tags.push(`<meta name="twitter:description" content="${escapeAttr(head.description)}">`);
  if (head.image) tags.push(`<meta name="twitter:image" content="${escapeAttr(head.image)}">`);
  if (head.jsonld) tags.push(`<script type="application/ld+json">\n${scriptJson(head.jsonld, 2)}\n  </script>`);
  return tags;
}

// Replaces the title and the description, canonical, Open Graph and Twitter tags.
function rewriteHead(src, page, head, markdown) {
  const end = src.search(/<\/head>/i);
  if (end < 0) throw new Error('no </head>');
  let headPart = src.slice(0, end)
    .replace(/[ \t]*<!--\s*<meta\b[^>]*>\s*-->[ \t]*\r?\n?/gi, '')
    .replace(/[ \t]*<meta\s+(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*>[ \t]*\r?\n?/gi, '')
    .replace(/[ \t]*<link\s+rel=["'](?:canonical|alternate)["'][^>]*>[ \t]*\r?\n?/gi, '');
  const title = /([ \t]*)<title>[\s\S]*?<\/title>/i.exec(headPart);
  if (!title) throw new Error('no <title>');
  const indent = title[1] || '  ';
  const block = `${indent}<!-- head tags written by scripts/prerender.mjs -->\n${headTags(page, head, markdown).map((t) => indent + t).join('\n')}`;
  headPart = headPart.slice(0, title.index) + block + headPart.slice(title.index + title[0].length);
  return headPart + src.slice(end);
}

function buildPage(source, page, rendered, head, markdown) {
  let out = rewriteHead(source, page, head, markdown);
  if (!rendered) return out;
  if (/<\/script/i.test(rendered.template)) throw new Error(`${page.path}: template contains </script>`);
  const [start, end] = homePageSpan(out);
  const inline = [
    '<!-- #home-page below is pre-rendered by scripts/prerender.mjs; the page JS re-renders it from the template and data that follow -->',
    rendered.html,
    `<script type="text/x-template" id="home-page-tpl">${rendered.template}</script>`,
    `<script type="application/json" id="prerender-data">${scriptJson({ data: rendered.seed })}</script>`,
  ].join('\n');
  out = out.slice(0, start) + inline + out.slice(end);
  return out;
}

// ---------------------------------------------------------------- site-wide files

function sitemap(pages) {
  const urls = pages.filter((p) => p.sitemap !== false).map((p) => {
    const lastmod = p.lastmod ? `<lastmod>${String(p.lastmod).slice(0, 10)}</lastmod>` : '';
    return `  <url><loc>${escapeText(canonicalUrl(p.path))}</loc>${lastmod}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function llmsTxt(docs) {
  const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  return [
    `# ${config.siteName}`,
    '',
    `> ${oneLine(config.llmsIntro)}`,
    '',
    '## Pages',
    '',
    ...docs.map((d) => `- [${oneLine(d.title)}](${d.url})${d.summary ? `: ${oneLine(d.summary)}` : ''}`),
    '',
  ].join('\n');
}

function headersFile(docs) {
  const lines = [
    '# Written by scripts/prerender.mjs: content types for the Markdown copies of the pages',
    '# and llms.txt, and a canonical Link header pointing each copy at its HTML page.',
    '/llms.txt',
    '  Content-Type: text/plain; charset=utf-8',
    '/llms-full.txt',
    '  Content-Type: text/markdown; charset=utf-8',
  ];
  docs.forEach((d) => {
    // Lower-case, the address the copy is published at; Netlify matches header
    // paths without regard to case (see the note at sitePath()).
    lines.push(sitePath('/' + d.file), '  Content-Type: text/markdown; charset=utf-8', `  Link: <${d.canonical}>; rel="canonical"`);
  });
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- render

async function render() {
  const pages = await config.pages({ directus, htmlToText, summary, canonicalUrl, md, mdFrom });
  pagePaths = new Set(pages.map((p) => p.path.toLowerCase()));
  const previous = await readManifest();
  // While rendering, earlier output must not be served: detail URLs fall
  // through to their template, single pages are served from the pristine copy.
  const hide = new Set(previous.pages.filter((p) => !p.inPlace).map((p) => p.file));
  pages.filter((p) => !p.inPlace).forEach((p) => hide.add(p.file));
  const overrides = new Map();
  for (const p of pages.filter((p) => p.inPlace)) {
    const copy = path.join(TEMPLATES, p.file + '.tpl');
    if (!existsSync(copy)) {
      await mkdir(path.dirname(copy), { recursive: true });
      await writeFile(copy, await readFile(path.join(ROOT, p.file)));
      console.log(`saved pristine template scripts/templates/${p.file}.tpl`);
    }
    overrides.set(p.file, copy);
  }
  const docs = [];
  const { server, base } = await startServer({ hide, overrides });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
  try {
    for (const page of pages) {
      const templatePath = page.inPlace ? overrides.get(page.file) : path.join(ROOT, page.template);
      let source = await readFile(templatePath, 'utf8');
      if (page.transformSource) source = page.transformSource(source);
      let rendered = null;
      let state = page.state || {};
      if (page.seed) {
        // renderUrl: where the page's own JS can load this page's data (see the config).
        rendered = await snapshot(browser, base + (page.renderUrl || encodeURI(page.path)), page, source);
        state = rendered.state;
        // Optional: drop data the template does not use (--verify checks the result).
        if (page.pruneSeed) rendered.seed = page.pruneSeed(rendered.seed);
        // Optional: adjust the static markup, e.g. hide what a script hides on load.
        if (page.postRender) rendered.html = page.postRender(rendered.html);
      }
      let markdown = null;
      if (page.markdown) {
        markdownBase = canonicalUrl(page.path);
        markdown = markdownPage(page, page.markdown(state, { html: rendered && rendered.html }));
        markdown.canonical = canonicalUrl(page.path);
        await mkdir(path.dirname(path.join(ROOT, markdown.file)), { recursive: true });
        await writeFile(path.join(ROOT, markdown.file), markdown.text);
        docs.push(markdown);
      }
      const html = buildPage(source, page, rendered, page.head(state, { html: rendered && rendered.html }), markdown);
      await mkdir(path.dirname(path.join(ROOT, page.file)), { recursive: true });
      await writeFile(path.join(ROOT, page.file), html);
      if (page.lastmodFrom) page.lastmod = page.lastmodFrom(state);
      page.markdownFile = markdown && markdown.file;
      console.log(`wrote ${page.file}  (${Math.round(html.length / 1024)} KB)${markdown ? `  + ${markdown.file} (${words(markdown.text)} words)` : ''}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  // Remove detail pages (and their Markdown) that are no longer published.
  const current = new Set(pages.map((p) => p.file));
  const currentMd = new Set(docs.map((d) => d.file));
  for (const old of previous.pages) {
    if (!old.inPlace && !current.has(old.file)) {
      await unlink(path.join(ROOT, old.file)).catch(() => {});
      console.log(`removed ${old.file}`);
    }
    if (old.markdown && !currentMd.has(old.markdown)) {
      await unlink(path.join(ROOT, old.markdown)).catch(() => {});
      console.log(`removed ${old.markdown}`);
    }
  }
  await writeFile(path.join(ROOT, 'sitemap.xml'), sitemap(pages));
  await writeFile(path.join(ROOT, 'llms.txt'), llmsTxt(docs));
  await writeFile(path.join(ROOT, 'llms-full.txt'), docs.map((d) => d.text).join('\n\n'));
  await writeFile(path.join(ROOT, '_headers'), headersFile(docs));
  const manifest = {
    note: 'Written by scripts/prerender.mjs. inPlace pages are rendered from scripts/templates/<file>.tpl.',
    pages: pages.map((p) => ({
      path: p.path, file: p.file, inPlace: Boolean(p.inPlace), prerendered: Boolean(p.seed), markdown: p.markdownFile || undefined,
      markupNotCompared: p.markupNotCompared || undefined,
    })),
  };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote sitemap.xml (${pages.filter((p) => p.sitemap !== false).length} URLs), llms.txt, llms-full.txt (${docs.length} pages), _headers, scripts/prerendered.json`);
  console.log(`removed from the Markdown: ${redactions.emails} email address(es), ${redactions.phones} phone number(s)`);
}

// ---------------------------------------------------------------- verify

async function verify() {
  const { pages } = await readManifest();
  const { server, base } = await startServer();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
  const api = new URL(config.directus).host;
  let failures = 0;
  try {
    for (const page of pages) {
      const html = await readFile(path.join(ROOT, page.file), 'utf8');
      const types = [];
      for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        const data = JSON.parse(m[1]);
        (data['@graph'] || [data]).forEach((n) => types.push(n['@type']));
      }
      let mdWords = '-';
      if (page.markdown) {
        const text = await readFile(path.join(ROOT, page.markdown), 'utf8');
        mdWords = words(text.replace(/^---\n[\s\S]*?\n---\n/, ''));
      }
      if (!page.prerendered) {
        console.log(`ok    ${page.path}  head only; JSON-LD ${types.join(', ')}`);
        continue;
      }
      const url = base + encodeURI(page.path);
      const read = async (js) => {
        const tab = await browser.newPage();
        await tab.setJavaScriptEnabled(js);
        await tab.setRequestInterception(true);
        let apiCalls = 0;
        const errors = [];
        tab.on('pageerror', (e) => errors.push(e.message));
        tab.on('request', (r) => {
          const u = new URL(r.url());
          if (u.host === api && u.pathname.startsWith('/items/')) apiCalls += 1;
          return BLOCK.test(r.url()) ? r.abort() : r.continue();
        });
        await tab.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
        await new Promise((r) => setTimeout(r, 500));
        // Raw markup, and the markup after one more pass through the HTML parser:
        // CMS HTML such as a <p> inside a <p> can exist in a live DOM but is split
        // when the same markup is parsed from the page source.
        const dom = await tab.evaluate(() => {
          const el = document.getElementById('home-page');
          if (!el) return { raw: '', parsed: '' };
          const doc = new DOMParser().parseFromString(`<body>${el.outerHTML}</body>`, 'text/html');
          return { raw: el.outerHTML, parsed: doc.body.innerHTML };
        });
        const count = await tab.evaluate(() => (document.body.innerText || '').split(/\s+/).filter(Boolean).length);
        await tab.close();
        return { dom, apiCalls, errors, words: count };
      };
      if (page.markupNotCompared) {
        const live = await read(true);
        if (live.apiCalls) failures += 1;
        console.log(`${live.apiCalls ? 'FAIL ' : 'ok   '} ${page.path}  markup not compared (${page.markupNotCompared}); ` +
          `${live.apiCalls} CMS data requests; words: ${live.words} in Chrome, ${mdWords} in Markdown; JSON-LD ${types.join(', ')}`);
        continue;
      }
      const plain = await read(false);
      const live = await read(true);
      const identical = plain.dom.raw.length > 0 && plain.dom.raw === live.dom.raw;
      const same = identical || (plain.dom.parsed.length > 0 && plain.dom.parsed === live.dom.parsed);
      if (!same || live.apiCalls) failures += 1;
      const markup = identical ? 'same markup' : same ? 'same markup after HTML parsing' : 'MARKUP DIFFERS';
      console.log(`${same && !live.apiCalls ? 'ok   ' : 'FAIL '} ${page.path}  ${markup} with JS on; ` +
        `${live.apiCalls} CMS data requests; words: ${plain.words} without JS, ${live.words} in Chrome, ${mdWords} in Markdown; ` +
        `JSON-LD ${types.join(', ')}` + (live.errors.length ? `; page errors: ${live.errors.slice(0, 2).join(' | ')}` : ''));
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) {
    console.error(`${failures} page(s) failed`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
if (args[0] === '--serve') {
  const { base } = await startServer({ port: parseInt(args[1] || '8080', 10) });
  console.log(`serving ${ROOT} at ${base}`);
} else if (args[0] === '--verify') {
  await verify();
} else {
  await render();
}
