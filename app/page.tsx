import { redirect } from "next/navigation";

/**
 * Root entry. Send everyone toward the dashboard; the middleware redirects
 * unauthenticated visitors on to /login.
 */
export default function Home() {
  redirect("/dashboard");
}
