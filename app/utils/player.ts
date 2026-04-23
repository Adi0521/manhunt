export function getPlayerName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mh_name");
}

export function setPlayerName(name: string) {
  localStorage.setItem("mh_name", name);
}

export function getIsAdmin(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("mh_is_admin") === "true";
}

export function setIsAdmin(v: boolean) {
  localStorage.setItem("mh_is_admin", String(v));
}

export function getGameCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mh_game_code");
}

export function setGameCode(code: string) {
  localStorage.setItem("mh_game_code", code);
}

export function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
