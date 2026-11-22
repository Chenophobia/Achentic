type Greeting = { readonly name: string; readonly text: string };

export function greet(name: string): Greeting {
  const trimmed = name.trim();
  if (trimmed === "") throw new RangeError("name is required");
  return { name: trimmed, text: `Hello, ${trimmed}` };
}
