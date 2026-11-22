export function createStore() {
  const notes = [];
  let nextId = 1;

  return {
    list() {
      return [...notes];
    },
    add(text) {
      const note = { id: nextId++, text, createdAt: new Date().toISOString() };
      notes.push(note);
      return note;
    },
    remove(id) {
      const index = notes.findIndex((note) => note.id === id);
      if (index === -1) return false;
      notes.splice(index, 1);
      return true;
    },
  };
}
