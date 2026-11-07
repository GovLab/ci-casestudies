// Site settings for scripts/prerender.mjs: which pages to pre-render, which Vue
// data each one is seeded with, its head tags and JSON-LD, and its Markdown copy.
const ORIGIN = 'https://collective-intelligence.thegovlab.org';
const SITE = 'Collective Intelligence Case Studies';
const ASSETS = 'https://burnes-center.directus.app/assets/';
const SITE_IMAGE = `${ORIGIN}/case/images/ss.png`;
const INTRO = 'More and more institutions have come to recognize that in the 21st century their in-house capacity and knowledge are too limited when compared to the speed, scale and complexity of many public problems. Instead, they look to networks of people inside and outside of government to make decisions and take action more effectively and, because those decisions involve the community, more legitimately. We studied examples from around the world in order to identify what is involved in using and institutionalising this “collective intelligence” successfully.';
const SHORT_INTRO = 'Case studies from around the world on how institutions use and institutionalise collective intelligence: networks of people inside and outside government who help make decisions and solve public problems.';

const publisher = { '@type': 'Organization', '@id': 'https://thegovlab.org/#organization', name: 'The GovLab', url: 'https://thegovlab.org' };
const nesta = { '@type': 'Organization', '@id': 'https://www.nesta.org.uk/#organization', name: 'Nesta', url: 'https://www.nesta.org.uk' };
const website = { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: SITE, url: `${ORIGIN}/`, publisher: { '@id': publisher['@id'] }, inLanguage: 'en' };
const graph = (...nodes) => ({ '@context': 'https://schema.org', '@graph': [website, publisher, ...nodes] });
const crumbs = (...items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});
// The case pages label each case with one of these (case/index.html).
const ASPECTS = {
  problem_solved: 'Problem Solved', 'how-to': 'CI How-to', task: 'Task Performed',
  collaborative: 'Kind of Collaboration', level: 'Level of Institutionalization',
};
// "11/29/2022" -> "2022-11-29"; "March 2021" -> "2021-03"; anything else -> undefined
const isoDate = (text) => {
  const s = String(text || '').trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = /^([A-Za-z]+) (\d{4})$/.exec(s);
  if (m) {
    const month = new Date(`${m[1]} 1, 2000`).getMonth();
    if (!Number.isNaN(month)) return `${m[2]}-${String(month + 1).padStart(2, '0')}`;
  }
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
};
const fullDate = (iso) => (iso && iso.length === 10 ? iso : undefined);
const section = (heading, body) => (body ? `## ${heading}\n\n${body}` : '');
const join = (...parts) => parts.filter(Boolean).join('\n\n');
const levels = (c) => (Array.isArray(c.implementation_level) ? c.implementation_level : [c.implementation_level]).filter(Boolean);

export default {
  origin: ORIGIN,
  siteName: SITE,
  siteId: 'collective-intelligence',
  source: 'The GovLab (collective-intelligence.thegovlab.org)',
  licence: 'Creative Commons Attribution-ShareAlike 4.0 International License (http://creativecommons.org/licenses/by-sa/4.0/)',
  llmsIntro: `${SHORT_INTRO} Published by The GovLab with Nesta's Centre for Collective Intelligence Design, alongside the report "Using Collective Intelligence to Solve Public Problems" and a literature review. Text licensed CC BY-SA 4.0.`,
  twitterSite: '@thegovlab',
  directus: 'https://burnes-center.directus.app/',

  async pages({ directus, htmlToText, summary, canonicalUrl, md }) {
    // Published case studies only. The home page list is left as it is today
    // (rendered in the browser); only its head tags and JSON-LD are written.
    const cases = await directus('ci_case_studies', {
      'filter[status][_eq]': 'published', fields: 'slug,title,headline,location', limit: '-1', sort: 'id',
    });

    const home = {
      path: '/', file: 'index.html', inPlace: true, state: { cases },
      head: (s) => ({
        title: SITE,
        description: SHORT_INTRO,
        image: SITE_IMAGE,
        jsonld: graph({
          '@type': 'CollectionPage', '@id': `${ORIGIN}/#page`, name: SITE, url: `${ORIGIN}/`, description: INTRO,
          isPartOf: { '@id': website['@id'] }, publisher: { '@id': publisher['@id'] },
          mainEntity: {
            '@type': 'ItemList', name: 'Case studies',
            itemListElement: s.cases.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: canonicalUrl(`/case/${c.slug}`), name: c.title })),
          },
        }),
      }),
    };

    const report = {
      path: '/report', file: 'report.html', inPlace: true, seed: ['reportData'],
      head: (s) => {
        const r = s.reportData[0];
        return {
          title: `${r.report.title} | ${SITE}`,
          description: summary(r.description),
          image: SITE_IMAGE,
          jsonld: graph(nesta, {
            '@type': 'Report', name: r.report.title, url: ASSETS + r.report.id, encodingFormat: 'application/pdf',
            description: summary(r.description, 300), inLanguage: 'en',
            author: [{ '@id': nesta['@id'] }, { '@id': publisher['@id'] }], publisher: { '@id': nesta['@id'] },
            mainEntityOfPage: canonicalUrl('/report'),
          }, {
            '@type': 'CreativeWork', name: r.guide.title, url: ASSETS + r.guide.id, encodingFormat: 'application/pdf',
            author: [{ '@id': nesta['@id'] }, { '@id': publisher['@id'] }], inLanguage: 'en',
          }, crumbs([SITE, `${ORIGIN}/`], ['Report', canonicalUrl('/report')])),
        };
      },
      markdown: (s) => {
        const r = s.reportData[0];
        return {
          type: 'GovLab report page',
          title: r.report.title,
          authors: ['Nesta Centre for Collective Intelligence Design', 'The GovLab'],
          summary: summary(r.description, 300),
          body: join(
            [`- [Download the report: ${r.report.title} (PDF)](${ASSETS + r.report.id})`, `- [Download the guide: ${r.guide.title} (PDF)](${ASSETS + r.guide.id})`].join('\n'),
            md(r.description),
          ),
        };
      },
    };

    const review = {
      path: '/literature-review/', file: 'literature-review/index.html', inPlace: true, seed: ['indexData'],
      head: (s) => ({
        title: `Literature Review | ${SITE} | The GovLab`,
        description: summary(s.indexData[0].text_body),
        image: SITE_IMAGE,
        ogType: 'article',
        jsonld: graph({
          '@type': 'ScholarlyArticle', headline: 'Collective Intelligence: Literature Review', url: canonicalUrl('/literature-review/'),
          description: summary(s.indexData[0].text_body, 300), datePublished: isoDate(s.indexData[0].date), inLanguage: 'en',
          author: { '@id': publisher['@id'] }, publisher: { '@id': publisher['@id'] }, isPartOf: { '@id': website['@id'] },
        }, crumbs([SITE, `${ORIGIN}/`], ['Literature Review', canonicalUrl('/literature-review/')])),
      }),
      markdown: (s) => ({
        type: 'GovLab literature review',
        title: 'Collective Intelligence: Literature Review',
        date: isoDate(s.indexData[0].date),
        summary: summary(s.indexData[0].text_body, 300),
        body: join(md(s.indexData[0].text_body), section('Bibliography', md(s.indexData[0].bibliography)), section('End notes', md(s.indexData[0].end_notes))),
      }),
    };

    const detail = cases.map(({ slug }) => ({
      path: `/case/${slug}`, file: `case/${slug}.html`, template: 'case/index.html', seed: ['indexData'],
      lastmodFrom: (s) => fullDate(isoDate(s.indexData[0].updated_date)),
      head: (s) => {
        const c = s.indexData[0];
        const url = canonicalUrl(`/case/${slug}`);
        const image = c.featured_image ? ASSETS + c.featured_image.id : SITE_IMAGE;
        return {
          title: `${c.title} | ${SITE} | The GovLab`,
          description: c.headline ? summary(`${c.title}: ${c.headline}`) : summary(c.case_study_body),
          image,
          ogType: 'article',
          jsonld: graph({
            '@type': 'Article', '@id': `${url}#article`, headline: c.title, alternativeHeadline: c.headline || undefined,
            description: summary(c.case_study_body, 300), url, mainEntityOfPage: url, image, inLanguage: 'en',
            articleSection: 'Case study', keywords: [c.topic, ASPECTS[c.ci_aspect]].filter(Boolean).join(', ') || undefined,
            dateModified: fullDate(isoDate(c.updated_date)),
            spatialCoverage: c.location ? { '@type': 'Place', name: c.location } : undefined,
            about: { '@type': 'Thing', name: c.title, url: c.link_to_platform || undefined },
            author: { '@id': publisher['@id'] }, publisher: { '@id': publisher['@id'] }, isPartOf: { '@id': website['@id'] },
          }, crumbs([SITE, `${ORIGIN}/`], [c.title, url])),
        };
      },
      // Contact names, titles, emails and other contact details are left out.
      markdown: (s) => {
        const c = s.indexData[0];
        return {
          type: 'GovLab case study',
          title: c.title,
          date: isoDate(c.updated_date),
          summary: c.headline,
          body: join(
            c.headline ? `**${c.headline}**` : '',
            [
              ASPECTS[c.ci_aspect] && `- Category: ${ASPECTS[c.ci_aspect]}`,
              c.topic && `- Topic: ${c.topic}`,
              c.location && `- Location: ${c.location}`,
              levels(c).length && `- Implementation level: ${levels(c).join(', ')}`,
              c.owner && `- Owner: ${htmlToText(c.owner)}`,
              c.years_in_operation && `- Years in operation: ${c.years_in_operation}`,
              c.platform && `- Platforms: ${c.platform}`,
              c.link_to_platform && `- Project website: ${c.link_to_platform}`,
              c.updated_date && `- Case study last updated: ${c.updated_date}`,
              `- Part of: [${SITE}](${ORIGIN}/)`,
            ].filter(Boolean).join('\n'),
            md(c.case_study_body),
            section('End notes', md(c.end_notes)),
          ),
        };
      },
    }));

    return [home, review, report, ...detail];
  },
};
