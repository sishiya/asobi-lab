// 見た目。2026-10-16 にユーザーが案2（図鑑の銅版画と標本室）に決め、ほかの案は消した（v003〜v005 の versions に残っている）
import museum from './museum.js?v=8';

export const look = () => museum;
export const kindName = (kind) => museum.kindNames[kind];
export const kindColor = (kind) => museum.kindColors[kind];
