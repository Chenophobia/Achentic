import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

function today() {
  return new Date().toLocaleDateString("sv-SE");
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function openState(dir) {
  mkdirSync(join(dir, "logs"), { recursive: true });
  const file = join(dir, "state.json");
  const lock = join(dir, "lock");
  const pidFile = join(lock, "pid");
  const data = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { tickets: {}, days: {} };
  const save = () => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

  const takeLock = () => {
    mkdirSync(lock);
    writeFileSync(pidFile, String(process.pid));
    return true;
  };

  return {
    dir,
    tickets: data.tickets,
    lock() {
      try {
        return takeLock();
      } catch {
        const holder = existsSync(pidFile) ? Number(readFileSync(pidFile, "utf8")) : 0;
        if (holder > 0 && alive(holder)) return false;
        rmSync(lock, { recursive: true, force: true });
        return takeLock();
      }
    },
    unlock() {
      rmSync(lock, { recursive: true, force: true });
    },
    startedToday() {
      return data.days[today()] ?? 0;
    },
    countStart() {
      data.days[today()] = (data.days[today()] ?? 0) + 1;
      save();
    },
    setTicket(id, entry) {
      data.tickets[id] = { ...entry, updatedAt: new Date().toISOString() };
      save();
    },
    forgetTicket(id) {
      delete data.tickets[id];
      save();
    },
    log(message) {
      const line = `${new Date().toISOString()} ${message}`;
      console.log(line);
      appendFileSync(join(dir, "orchestrator.log"), `${line}\n`);
    },
    recordRun(run) {
      appendFileSync(
        join(dir, "runs.jsonl"),
        `${JSON.stringify({ at: new Date().toISOString(), ...run })}\n`,
      );
    },
    saveOutput(name, text) {
      writeFileSync(join(dir, "logs", name), text);
    },
  };
}
