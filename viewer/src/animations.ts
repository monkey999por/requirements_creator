export const staggerContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export const sidebarContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.02 } },
};

export const sidebarItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.15, ease: "easeOut" } },
};
