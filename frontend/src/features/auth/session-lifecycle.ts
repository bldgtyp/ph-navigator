const AUTHENTICATED_TAB_KEY = "phn.authenticated";

function withSessionStorage(action: (storage: Storage) => boolean): boolean {
  try {
    return action(window.sessionStorage);
  } catch {
    return false;
  }
}

export function markSessionAuthenticated(): void {
  withSessionStorage((storage) => {
    storage.setItem(AUTHENTICATED_TAB_KEY, "1");
    return true;
  });
}

export function clearSessionAuthentication(): void {
  withSessionStorage((storage) => {
    storage.removeItem(AUTHENTICATED_TAB_KEY);
    return true;
  });
}

export function wasSessionAuthenticated(): boolean {
  return withSessionStorage((storage) => storage.getItem(AUTHENTICATED_TAB_KEY) === "1");
}
