import { greet } from "./greeting.ts";

const [name = "world"] = process.argv.slice(2);
console.log(greet(name).text);
