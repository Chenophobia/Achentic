export async function beat(url, message) {
  if (url === undefined || url === "") return false;
  const target = new URL(url);
  target.searchParams.set("status", "up");
  target.searchParams.set("msg", message);
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(10_000) });
    return response.ok;
  } catch {
    return false;
  }
}
