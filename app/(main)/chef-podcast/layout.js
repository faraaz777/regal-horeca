/**
 * Chef Podcast layout
 *
 * Full-bleed dark canvas for the editorial registration form.
 * Keeps the route inside (main) without changing site navigation.
 */

export default function ChefPodcastLayout({ children }) {
  return <div className="-mx-[max(0px,calc((100vw-100%)/2))] bg-black">{children}</div>;
}
