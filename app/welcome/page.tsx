import type { Metadata } from "next";
import { BrandSplash } from "../brand";

export const metadata: Metadata = { title: "Welcome to PayCore" };

export default function Welcome() {
  return <main><BrandSplash preview /></main>;
}
