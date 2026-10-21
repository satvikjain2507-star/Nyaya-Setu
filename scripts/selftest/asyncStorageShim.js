const mem = new Map();
export default {
  getItem: async (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: async (k, v) => void mem.set(k, v),
  removeItem: async (k) => void mem.delete(k),
};
