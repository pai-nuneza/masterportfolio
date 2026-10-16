import { SearchDoc } from './hire-assistant.data';

export interface SearchHit {
  doc: SearchDoc;
  score: number;
}

/** Words too common in questions to say anything about what's being asked. */
const STOPWORDS = new Set(
  (
    'a an the and or but of to in on at for with from by as is are was were be been being do does did done can could ' +
    'would should will shall may might must have has had i me my we our you your he him his she her they them their it ' +
    'its this that these those there here what which how why tell show give let know about any some also just like ' +
    'please pai pais pai\'s ramer pailou nuneza nuñeza much many more most very really get got want need into than then ' +
    'so if not no yes ok okay hey hi hello thanks thank'
  ).split(' '),
);
/** Words that look like stopwords but matter as questions. */
const KEEP = new Set(['who', 'where', 'when', 'know']);
/** How much more a title, keyword or skill counts than ordinary text. */
const STRONG_WEIGHT = 3;
const K1 = 1.2;
const B = 0.75;

/**
 * Finds the documents that best answer a question (BM25 ranking over plain words), entirely in the browser.
 * Synonyms are folded into one spelling first, so "front-end", "front end" and "frontend" all match.
 */
export class KnowledgeSearch {
  private readonly synonyms: [RegExp, string][];
  private readonly index: { doc: SearchDoc; counts: Map<string, number>; strong: Set<string>; length: number }[];
  private readonly docFrequency = new Map<string, number>();
  private readonly averageLength: number;

  constructor(docs: SearchDoc[], synonyms: Record<string, string[]>) {
    this.synonyms = Object.entries(synonyms).flatMap(([word, variants]) =>
      variants.map(variant => [new RegExp(`(?<![a-z0-9.])${escape(variant.toLowerCase())}(?![a-z0-9])`, 'g'), word] as [RegExp, string]),
    );
    this.index = docs.map(doc => {
      const strong = this.words(doc.strong);
      const tokens = [...Array(STRONG_WEIGHT).fill(strong).flat(), ...this.words(doc.body)];
      const counts = new Map<string, number>();
      tokens.forEach(token => counts.set(token, (counts.get(token) ?? 0) + 1));
      counts.forEach((_, token) => this.docFrequency.set(token, (this.docFrequency.get(token) ?? 0) + 1));
      return { doc, counts, strong: new Set(strong), length: tokens.length };
    });
    this.averageLength = this.index.reduce((sum, entry) => sum + entry.length, 0) / (this.index.length || 1);
  }

  /**
   * The documents that match the question, best first. A document only counts if the question hits one of its
   * titles, keywords or skills, so a stray word in a long description doesn't pass for an answer.
   */
  search(question: string): SearchHit[] {
    const terms = [...new Set(this.words(question))];
    const total = this.index.length;
    return this.index
      .filter(({ strong }) => terms.some(term => strong.has(term)))
      .map(({ doc, counts, length }) => {
        let score = 0;
        for (const term of terms) {
          const count = counts.get(term);
          if (count) {
            const df = this.docFrequency.get(term) ?? 0;
            const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
            score += (idf * count * (K1 + 1)) / (count + K1 * (1 - B + (B * length) / this.averageLength));
          }
        }
        return { doc, score };
      })
      .filter(hit => hit.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /** Lower-cased, with synonyms folded into one spelling ("front-end" → "frontend"). */
  fold(text: string): string {
    let normal = text.toLowerCase();
    for (const [pattern, word] of this.synonyms) {
      normal = normal.replace(pattern, word);
    }
    return normal;
  }

  /** Lower-cased words, synonyms folded, stopwords dropped, simple plurals made singular. */
  words(text: string): string[] {
    return this.fold(text)
      .replace(/[^a-z0-9#.+]+/g, ' ')
      .split(' ')
      .map(word => (word === '.net' ? word : word.replace(/^\.+|\.+$/g, '')))
      .filter(word => word && (KEEP.has(word) || !STOPWORDS.has(word)))
      .map(singular);
  }
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  }
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) {
    return word.slice(0, -1);
  }
  return word;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
