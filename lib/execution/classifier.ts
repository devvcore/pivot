/**
 * Naive Bayes Text Classifier
 *
 * Zero-dependency classifier for routing agent requests.
 * Ported from BetterBot's classifier.js to TypeScript.
 *
 * Features:
 *  - Unigram + bigram tokenization
 *  - Laplace smoothing
 *  - Multiple classifier heads (tools, context, history)
 *  - Serializable to/from JSON for persistence
 *  - Self-training: log LLM decisions as training data
 */

import type { ClassifierPrediction, TrainingExample } from './types';

// ── Stop words ───────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
  'or', 'if', 'while', 'about', 'up', 'it', 'its', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they',
  'them', 'their', 'this', 'that', 'these', 'those', 'what', 'which',
  'who', 'whom',
]);

// ── Tokenization ─────────────────────────────────────────────────────────────────

/**
 * Tokenize text into unigrams and bigrams after lowering, cleaning, and stemming.
 */
function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem);

  const tokens: string[] = [...words];

  // Add bigrams
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]}_${words[i + 1]}`);
  }

  return tokens;
}

/**
 * Porter-ish stemmer: handles common English suffixes.
 */
function stem(word: string): string {
  if (word.length < 4) return word;

  // Order matters: longer suffixes first
  const suffixes: Array<[string, string]> = [
    ['ational', 'ate'],
    ['tional', 'tion'],
    ['ization', 'ize'],
    ['fulness', 'ful'],
    ['ousness', 'ous'],
    ['iveness', 'ive'],
    ['lessly', 'less'],
    ['ement', ''],
    ['ment', ''],
    ['ness', ''],
    ['able', ''],
    ['ible', ''],
    ['tion', 't'],
    ['sion', 's'],
    ['ling', 'l'],
    ['ally', 'al'],
    ['ful', ''],
    ['ing', ''],
    ['ies', 'i'],
    ['ous', ''],
    ['ive', ''],
    ['ess', ''],
    ['ed', ''],
    ['ly', ''],
    ['er', ''],
    ['es', ''],
    ['s', ''],
  ];

  for (const [suffix, replacement] of suffixes) {
    if (word.endsWith(suffix) && word.length - suffix.length + replacement.length >= 3) {
      return word.slice(0, -suffix.length) + replacement;
    }
  }

  return word;
}

// ── Classifier Internal State ────────────────────────────────────────────────────

interface ClassifierState {
  labelCounts: Record<string, number>;
  featureCounts: Record<string, Record<string, number>>;
  totalDocs: number;
  vocabulary: Set<string>;
}

interface SerializedState {
  labelCounts: Record<string, number>;
  featureCounts: Record<string, Record<string, number>>;
  totalDocs: number;
  vocabulary: string[];
}

// ── Naive Bayes Classifier ───────────────────────────────────────────────────────

export class NaiveBayesClassifier {
  private state: ClassifierState;

  constructor() {
    this.state = {
      labelCounts: {},
      featureCounts: {},
      totalDocs: 0,
      vocabulary: new Set(),
    };
  }

  /**
   * Train the classifier on a batch of labeled examples.
   */
  train(examples: TrainingExample[]): void {
    for (const example of examples) {
      const tokens = tokenize(example.text);
      const label = example.label;

      this.state.labelCounts[label] = (this.state.labelCounts[label] ?? 0) + 1;
      this.state.totalDocs++;

      if (!this.state.featureCounts[label]) {
        this.state.featureCounts[label] = {};
      }

      for (const token of tokens) {
        this.state.vocabulary.add(token);
        this.state.featureCounts[label][token] =
          (this.state.featureCounts[label][token] ?? 0) + 1;
      }
    }
  }

  /**
   * Add a single training example (for self-training from LLM decisions).
   */
  trainOne(text: string, label: string): void {
    this.train([{ text, label }]);
  }

  /**
   * Classify a text input, returning the best label and confidence.
   */
  classify(text: string): ClassifierPrediction {
    if (this.state.totalDocs === 0) {
      return { label: 'unknown', confidence: 0, scores: {} };
    }

    const tokens = tokenize(text);
    const labels = Object.keys(this.state.labelCounts);
    const vocabSize = this.state.vocabulary.size;
    const scores: Record<string, number> = {};

    for (const label of labels) {
      const labelCount = this.state.labelCounts[label];
      const features = this.state.featureCounts[label] ?? {};

      // Total feature count for this label (for denominator)
      let totalFeatures = 0;
      for (const count of Object.values(features)) {
        totalFeatures += count;
      }

      // Log prior
      let logProb = Math.log(labelCount / this.state.totalDocs);

      // Log likelihood with Laplace smoothing
      for (const token of tokens) {
        const tokenCount = features[token] ?? 0;
        logProb += Math.log((tokenCount + 1) / (totalFeatures + vocabSize));
      }

      scores[label] = logProb;
    }

    // Find best label
    let bestLabel = labels[0];
    let bestScore = scores[labels[0]];

    for (const label of labels) {
      if (scores[label] > bestScore) {
        bestScore = scores[label];
        bestLabel = label;
      }
    }

    // Convert log scores to probabilities (softmax-style normalization)
    const maxScore = bestScore;
    let sumExp = 0;
    for (const label of labels) {
      sumExp += Math.exp(scores[label] - maxScore);
    }

    const confidence = 1 / sumExp; // P(best) after normalization

    // Normalize all scores for output
    const normalizedScores: Record<string, number> = {};
    for (const label of labels) {
      normalizedScores[label] =
        Math.round((Math.exp(scores[label] - maxScore) / sumExp) * 10000) / 10000;
    }

    return {
      label: bestLabel,
      confidence: Math.round(confidence * 10000) / 10000,
      scores: normalizedScores,
    };
  }

  /**
   * Check if the classifier has been trained with any data.
   */
  isTrained(): boolean {
    return this.state.totalDocs > 0;
  }

  /**
   * Get the number of training examples.
   */
  get exampleCount(): number {
    return this.state.totalDocs;
  }

  /**
   * Get the list of known labels.
   */
  get labels(): string[] {
    return Object.keys(this.state.labelCounts);
  }

  /**
   * Serialize classifier state to JSON string.
   */
  toJSON(): string {
    const serialized: SerializedState = {
      labelCounts: this.state.labelCounts,
      featureCounts: this.state.featureCounts,
      totalDocs: this.state.totalDocs,
      vocabulary: Array.from(this.state.vocabulary),
    };
    return JSON.stringify(serialized);
  }

  /**
   * Restore a classifier from a JSON string.
   */
  static fromJSON(json: string): NaiveBayesClassifier {
    const data = JSON.parse(json) as SerializedState;
    const classifier = new NaiveBayesClassifier();
    classifier.state = {
      labelCounts: data.labelCounts,
      featureCounts: data.featureCounts,
      totalDocs: data.totalDocs,
      vocabulary: new Set(data.vocabulary),
    };
    return classifier;
  }
}

// ── Multi-Head Classifier ────────────────────────────────────────────────────────

/**
 * A collection of NaiveBayesClassifiers, one per "head" (e.g., tools, context, history).
 * This lets the router predict multiple dimensions of a routing decision independently.
 */
export class MultiHeadClassifier {
  private heads: Record<string, NaiveBayesClassifier> = {};

  constructor(headNames: string[] = ['tools', 'context', 'history']) {
    for (const name of headNames) {
      this.heads[name] = new NaiveBayesClassifier();
    }
  }

  /**
   * Train a specific head.
   */
  trainHead(headName: string, examples: TrainingExample[]): void {
    if (!this.heads[headName]) {
      this.heads[headName] = new NaiveBayesClassifier();
    }
    this.heads[headName].train(examples);
  }

  /**
   * Train a single example on a specific head (for self-training).
   */
  trainOneOnHead(headName: string, text: string, label: string): void {
    if (!this.heads[headName]) {
      this.heads[headName] = new NaiveBayesClassifier();
    }
    this.heads[headName].trainOne(text, label);
  }

  /**
   * Classify on all heads, returning per-head predictions.
   */
  classifyAll(text: string): Record<string, ClassifierPrediction> {
    const results: Record<string, ClassifierPrediction> = {};
    for (const [name, classifier] of Object.entries(this.heads)) {
      results[name] = classifier.classify(text);
    }
    return results;
  }

  /**
   * Classify on a specific head.
   */
  classifyHead(headName: string, text: string): ClassifierPrediction {
    const head = this.heads[headName];
    if (!head) {
      return { label: 'unknown', confidence: 0, scores: {} };
    }
    return head.classify(text);
  }

  /**
   * Check if all heads are trained.
   */
  isFullyTrained(): boolean {
    return Object.values(this.heads).every((h) => h.isTrained());
  }

  /**
   * Minimum confidence across all heads.
   */
  minConfidence(text: string): number {
    const results = this.classifyAll(text);
    let min = 1;
    for (const r of Object.values(results)) {
      if (r.confidence < min) min = r.confidence;
    }
    return min;
  }

  /**
   * Serialize all heads.
   */
  toJSON(): string {
    const data: Record<string, string> = {};
    for (const [name, classifier] of Object.entries(this.heads)) {
      data[name] = classifier.toJSON();
    }
    return JSON.stringify(data);
  }

  /**
   * Restore from serialized JSON.
   */
  static fromJSON(json: string): MultiHeadClassifier {
    const data = JSON.parse(json) as Record<string, string>;
    const mhc = new MultiHeadClassifier([]);
    for (const [name, classifierJson] of Object.entries(data)) {
      mhc.heads[name] = NaiveBayesClassifier.fromJSON(classifierJson);
    }
    return mhc;
  }
}

export { tokenize, stem };
