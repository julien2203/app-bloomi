export type CguBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'clause'; text: string }
  | { type: 'clauseBullet'; text: string }
  | { type: 'articleTitle'; text: string };

export type CguContent = {
  pageTitle: string;
  effectiveDate: string;
  blocks: CguBlock[];
  footer: string;
};
