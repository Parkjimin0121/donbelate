import { createUser } from "@/lib/api";

const STORAGE_KEY = "dontbelate-demo-user-id";

export async function getOrCreateDemoUserId() {
  const savedId = window.localStorage.getItem(STORAGE_KEY);
  if (savedId) return savedId;

  const user = await createUser({ name: "게스트" });
  window.localStorage.setItem(STORAGE_KEY, user.id);
  return user.id;
}
