/**
 * DNS Smart GUI — DOM Manipulation Utilities
 */
export const $ = (selector, parent = document) => {
    return parent.querySelector(selector);
};
export const $$ = (selector, parent = document) => {
    return Array.from(parent.querySelectorAll(selector));
};
export const createElement = (tag, classes = [], attributes = {}) => {
    const el = document.createElement(tag);
    classes.forEach(c => el.classList.add(c));
    Object.entries(attributes).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
};
export const on = (element, event, handler, options) => {
    element.addEventListener(event, handler, options);
    return () => element.removeEventListener(event, handler, options);
};
export const delegate = (parent, selector, event, handler) => {
    return on(parent, event, (e) => {
        const target = e.target.closest(selector);
        if (target && parent.contains(target)) {
            handler(e, target);
        }
    });
};
