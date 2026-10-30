import type { Metadata } from "next";
import { BrandSplash } from "../brand";
import SharePayCore from "../share-paycore";

export const metadata: Metadata = { title: "Welcome to PayCore" };

export default function Welcome() {
  return <main><BrandSplash preview /><section className="welcome-sharing"><SharePayCore /><a href="/brand">Explore PayCore’s brand assets</a></section></main>;
}
