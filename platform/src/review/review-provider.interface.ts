export interface ReviewProvider {
  review(prompt: string): Promise<string>;
}

export const REVIEW_PROVIDER = Symbol('REVIEW_PROVIDER');
