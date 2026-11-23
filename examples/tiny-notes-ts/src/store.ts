export type Note = { readonly id: number; readonly text: string; readonly createdAt: string };

export type Store = {
  list(): Note[];
  add(text: string): Note;
  remove(id: number): boolean;
};

export function createStore(): Store {
  const notes: Note[] = [];
  let nextId = 1;

  return {
    list() {
      return [...notes];
    },
    add(text) {
      const note: Note = { id: nextId++, text, createdAt: new Date().toISOString() };
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
