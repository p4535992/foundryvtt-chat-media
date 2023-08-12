export const create = (html) => $(html);
export const before = (referenceNode, newNode) => referenceNode.before(newNode);
export const after = (referenceNode, newNode) => referenceNode.after(newNode);
export const find = (selector, parentNode = undefined) => (parentNode ? parentNode.find(selector) : $(selector));
export const append = (parentNode, newNode) => parentNode.append(newNode);
export const on = (parentNode, eventType, eventFunction) => parentNode.on(eventType, eventFunction);
export const trigger = (parentNode, eventType) => parentNode.trigger(eventType);
export const removeClass = (parentNode, classString) => parentNode.removeClass(classString);
export const addClass = (parentNode, classString) => parentNode.addClass(classString);
export const remove = (node) => node.remove();
export const attr = (node, attrId, attrValue = undefined) =>
  attrValue ? node.attr(attrId, attrValue) : node.attr(attrId);
export const removeAttr = (node, attrId) => node.removeAttr(attrId);
export const focus = (node) => node.focus();
export const scrollBottom = (node) => node.animate({ scrollTop: node.height() });

export const each = (node, handler) => node.each(handler);
