import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "hotgeng-meme-archive.gamesheep.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "Chinese Meme Archive — 中文网络热梗档案馆",
    description: "Chinese internet memes explained with their original wording, cultural context, usage notes, and verifiable Chinese sources.",
    openGraph: { title: "Chinese Meme Archive", description: "Original Chinese · Meaning · Cultural context · When to use it" },
    twitter: { card: "summary", title: "Chinese Meme Archive", description: "Chinese memes, explained in context." }
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
