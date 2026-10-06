import React from "react";
const cache = {};
export const motion = new Proxy(
  {},
  {
    get(_, tag) {
      return (cache[tag] ||= React.forwardRef(
        (
          {
            initial,
            animate,
            exit,
            transition,
            layout,
            whileHover,
            whileTap,
            ...props
          },
          ref,
        ) => React.createElement(tag, { ...props, ref }),
      ));
    },
  },
);
export const AnimatePresence = ({ children }) => children;
