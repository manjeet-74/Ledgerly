import type { Variants } from 'framer-motion';

/**
 * Centralized motion variants -- every animated page/list in the app
 * reuses these instead of each component inventing its own
 * timing, so the whole product feels like one consistent system rather
 * than a pile of unrelated animations.
 */
export const pageFadeRise: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export const cardHover = {
  whileHover: { y: -3, transition: { duration: 0.18 } },
  whileTap: { scale: 0.97 },
};
