/**
 * Where Undefeated lives online. Constants rather than settings: these change
 * about as often as the building does, and a typo here should fail review, not
 * silently break a footer link in production.
 */
export const BRAND_LINKS = {
  facebook: 'https://www.facebook.com/undefeated.fitnesscenter',
  instagram: 'https://www.instagram.com/undefeatedfitnesscenter/',
  tiktok: 'https://www.tiktok.com/@undefeatedfitnesscenter',
  /** Google Business Profile share link ("Find us"). */
  google: 'https://share.google/KYChIMmH1493cUl0A',
  /** Google Maps directions to the gym, by name. */
  directions:
    'https://www.google.com/maps/dir/?api=1&destination=Undefeated+Fitness+Center',
} as const
