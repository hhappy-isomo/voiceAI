import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Ijwi",
  description: "Your English speaking partner.",
};

// Runs before paint to set the saved theme — avoids day/night flash on reload.
const themeInit = `(function(){try{var t=localStorage.getItem('ijwi.theme');if(t==='day'||t==='night')document.documentElement.setAttribute('data-theme',t);else document.documentElement.setAttribute('data-theme','night');}catch(e){document.documentElement.setAttribute('data-theme','night');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
