// IMPORTANT: Replace with your own domain address - it's used for SEO in meta tags and schema
const baseURL = "https://demo.once-ui.com";

// Import and set font for each variant
import { Urbanist } from "next/font/google";
import { Fira_Mono } from "next/font/google";

const heading = Urbanist({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const body = Urbanist({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const label = Urbanist({
  variable: "--font-label",
  subsets: ["latin"],
  display: "swap",
});

const code = Fira_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

const fonts = {
  heading: heading,
  body: body,
  label: label,
  code: code,
};

// default customization applied to the HTML in the main layout.tsx
const style = {
  theme: "system", // dark | light | system
  neutral: "gray", // sand | gray | slate
  brand: "blue", // blue | indigo | violet | magenta | pink | red | orange | yellow | moss | green | emerald | aqua | cyan
  accent: "indigo", // blue | indigo | violet | magenta | pink | red | orange | yellow | moss | green | emerald | aqua | cyan
  solid: "contrast", // color | contrast | inverse
  solidStyle: "flat", // flat | plastic
  border: "playful", // rounded | playful | conservative
  surface: "filled", // filled | translucent
  transition: "all", // all | micro | macro
  scaling: "100", // 90 | 95 | 100 | 105 | 110
};

const dataStyle = {
  variant: "gradient", // flat | gradient | outline
  mode: "categorical", // categorical | divergent | sequential
  height: 24, // default chart height
  axis: {
    stroke: "var(--neutral-alpha-weak)",
  },
  tick: {
    fill: "var(--neutral-on-background-weak)",
    fontSize: 11,
    line: false
  },
};

// metadata for pages
const meta = {
  home: {
    path: "/",
    title: "Frequencii World",
    description: "Unstoppable, serverless messaging powered by Solana. Chat freely, pay instantly.",
    image: "/images/og/home.jpg",
    canonical: "https://frequencii.world",
    robots: "index,follow",
    alternates: [{ href: "https://frequencii.world", hrefLang: "en" }],
  },
  // add more routes and reference them in page.tsx
};

// default schema data
const schema = {
  logo: "",
  type: "Organization",
  name: "Frequencii World",
  description: meta.home.description,
  email: "bri@frequencii.world",
};

// social links
const social = {
  twitter: "https://www.twitter.com/frequencii",
  linkedin: "https://www.linkedin.com/company/frequencii/",
};

export { baseURL, fonts, style, meta, schema, social, dataStyle };
