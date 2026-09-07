import { useEffect, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  RiArrowRightLine as ArrowRight,
  RiBox3Line as Box,
  RiStackLine as Component,
  RiGithubFill as Github,
  RiLayoutGridLine as LayoutGrid,
  RiSparklingLine as Sparkles,
} from '@remixicon/react'
import { loadGoogleFontFamily } from '@/lib/google-fonts'
interface PairingCard {
  id: string
  title: string
  headingFont: string
  bodyFont: string
  heading: string
  subtitle: string
  body: string
}

const PAIRING_CARDS: PairingCard[] = [
  {
    id: 'editorial-modern',
    title: 'Editorial + Product',
    headingFont: 'Playfair Display',
    bodyFont: 'Inter',
    heading: 'Design with clear contrast',
    subtitle: 'Elegant headlines with practical UI copy',
    body: 'Playfair Display gives the heading personality while Inter keeps body text clean and readable across screen sizes.',
  },
  {
    id: 'tech-human',
    title: 'Tech + Human',
    headingFont: 'Space Grotesk',
    bodyFont: 'Source Sans 3',
    heading: 'Readable by default',
    subtitle: 'Balanced system for dashboards and docs',
    body: 'Space Grotesk adds modern structure. Source Sans 3 handles paragraphs and labels without visual fatigue.',
  },
  {
    id: 'brand-bold',
    title: 'Brand + Marketing',
    headingFont: 'Bebas Neue',
    bodyFont: 'Manrope',
    heading: 'Bold campaigns, calm details',
    subtitle: 'High-impact hero text with stable supporting copy',
    body: 'Bebas Neue creates loud, focused headlines while Manrope keeps supporting content smooth and clear.',
  },
  {
    id: 'classic-docs',
    title: 'Classic + Docs',
    headingFont: 'DM Serif Display',
    bodyFont: 'Merriweather',
    heading: 'Documentation that feels crafted',
    subtitle: 'Traditional tone for long-form product writing',
    body: 'DM Serif Display introduces character and Merriweather keeps extended reading comfortable for guides and specs.',
  },
]

const PAIRING_PAGE_PATHS = new Set(['/pairing', '/pairing/'])
const PAIRING_PAGE_HASH = '#/pairing'
function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function normalizeHash(hash: string) {
  const withoutTrailing = hash.toLowerCase().replace(/\/+$/, '')
  return withoutTrailing
}

function isPairingRoute(pathname: string, hash: string) {
  const normalizedPath = normalizePathname(pathname)
  const normalizedHash = normalizeHash(hash)
  return (
    PAIRING_PAGE_PATHS.has(normalizedPath) ||
    normalizedHash === PAIRING_PAGE_HASH ||
    normalizedHash.startsWith(`${PAIRING_PAGE_HASH}?`)
  )
}

function useRateLimitedPairingFonts() {
  useEffect(() => {
    const families = [
      ...new Set(PAIRING_CARDS.flatMap((card) => [card.headingFont, card.bodyFont])),
    ]
    let disposed = false

    const loadFonts = async () => {
      for (const family of families) {
        if (disposed) return
        await loadGoogleFontFamily(family, { weights: [400, 500, 600, 700] })
      }
    }

    void loadFonts()
    return () => {
      disposed = true
    }
  }, [])
}

function FontPairingCardsSection() {
  return (
    <section className="relative px-6 py-24 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-serif text-4xl leading-tight font-light md:text-6xl">
            <span className="font-sans font-bold tracking-tight">Font Pairing,</span>{' '}
            <span className="tracking-tight text-zinc-300 italic">preview cards.</span>
          </h2>
          <p className="mx-auto max-w-3xl text-sm leading-relaxed tracking-wide text-zinc-400 uppercase">
            Google Fonts only. Simple visual pairings for headings and body text.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {PAIRING_CARDS.map((card) => (
            <article
              key={card.id}
              className="rounded-3xl border border-white/10 bg-zinc-950/80 p-7 transition-colors hover:bg-zinc-900/80"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] tracking-widest text-zinc-400 uppercase">
                  <Sparkles className="size-3.5" />
                  {card.title}
                </span>
                <span className="text-[10px] tracking-widest text-zinc-500 uppercase">
                  {card.headingFont} + {card.bodyFont}
                </span>
              </div>

              <h3
                className="mb-3 text-4xl leading-[1.1] text-white md:text-[2.7rem]"
                style={{ fontFamily: `"${card.headingFont}", serif` }}
              >
                {card.heading}
              </h3>
              <p
                className="mb-3 text-lg text-zinc-200"
                style={{ fontFamily: `"${card.bodyFont}", sans-serif` }}
              >
                {card.subtitle}
              </p>
              <p
                className="text-base leading-relaxed text-zinc-400"
                style={{ fontFamily: `"${card.bodyFont}", sans-serif` }}
              >
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function PairingPage() {
  useRateLimitedPairingFonts()

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white antialiased selection:bg-purple-500/30">
      <header className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between border-b border-white/5 bg-black/60 px-6 py-4 backdrop-blur-md md:px-12">
        <a href="/" className="flex items-center gap-3">
          <img src="/logo.svg" alt="Evergarden Logo" className="h-14 object-contain" />
        </a>
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="rounded-full border border-white/15 px-5 py-2.5 font-mono text-xs font-semibold tracking-wider text-white uppercase transition-colors hover:bg-white/10"
          >
            Home
          </a>
          <a
            href="https://github.com/thevioletto/evergarden-font-manager/releases/latest/download/Evergarden.Font.Manager.exe"
            className="rounded-full bg-white px-5 py-2.5 font-mono text-xs font-semibold tracking-wider text-black uppercase transition-colors hover:bg-zinc-200"
          >
            Download
          </a>
        </div>
      </header>

      <main className="border-t border-white/5 pt-24">
        <div className="border-b border-white/5 bg-zinc-950/70 px-6 py-12 text-center md:px-12">
          <p className="font-mono text-xs tracking-widest text-zinc-500 uppercase">
            Google Fonts requests are queued with rate limiting
          </p>
        </div>
        <FontPairingCardsSection />
      </main>
    </div>
  )
}

// Header/Nav
function Header() {
  return (
    <header className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between border-b border-white/5 bg-black/40 px-6 py-4 backdrop-blur-md md:px-12">
      <div className="flex items-center gap-3">
        <img src="/logo.svg" alt="Evergarden Logo" className="h-14 object-contain" />
      </div>
      <nav className="hidden items-center gap-8 font-mono text-xs font-medium tracking-widest text-zinc-400 uppercase md:flex">
        <a href="#features" className="transition-colors hover:text-white">
          Features
        </a>
        <a href="#preview" className="transition-colors hover:text-white">
          Preview
        </a>
        <a href="#/pairing" className="transition-colors hover:text-white">
          Pairing
        </a>
        <a
          href="https://github.com/thevioletto/evergarden-font-manager"
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-2 transition-colors hover:text-white"
        >
          <Github className="size-4" />
          <span>GitHub</span>
        </a>
      </nav>
      <a
        href="https://github.com/thevioletto/evergarden-font-manager/releases/latest/download/Evergarden.Font.Manager.exe"
        className="rounded-full bg-white px-5 py-2.5 font-mono text-xs font-semibold tracking-wider text-black uppercase transition-colors hover:bg-zinc-200"
      >
        Download
      </a>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Background glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/20 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 max-w-4xl"
      >
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-xs font-semibold tracking-wider text-zinc-300 uppercase backdrop-blur-sm">
          <Sparkles className="size-4 text-purple-400" />
          <span>Local-first desktop font manager</span>
        </div>

        <h1 className="mb-6 bg-linear-to-b from-white to-white/50 bg-clip-text p-2 text-5xl leading-[1.1] font-bold text-transparent md:text-7xl lg:text-8xl">
          <span className="font-sans font-bold tracking-tight">Manage your fonts</span> <br />
          <span className="font-serif font-light tracking-tight italic">with elegance.</span>
        </h1>

        <p className="mx-auto mb-12 max-w-2xl text-xl leading-relaxed font-light tracking-wide text-zinc-400 md:text-2xl">
          A high-performance typography studio for Windows powered by Tauri v2 and Rust. Offline
          SQLite indexing, deep OpenType inspection, live specimens, and instant pairing.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://github.com/thevioletto/evergarden-font-manager/releases/latest/download/Evergarden.Font.Manager.exe"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-8 font-mono text-sm font-semibold tracking-widest text-black transition-all hover:bg-zinc-200 sm:w-auto"
          >
            Download for Windows (.exe)
            <ArrowRight className="size-5" />
          </a>
          <a
            href="https://github.com/thevioletto/evergarden-font-manager/releases/latest"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 font-mono text-sm font-semibold tracking-widest text-white transition-all hover:bg-white/10 sm:w-auto"
          >
            All Releases
          </a>
        </div>
      </motion.div>
    </section>
  )
}

function Preview() {
  const { scrollYProgress } = useScroll()
  const y1 = useTransform(scrollYProgress, [0, 1], [100, -100])
  const y2 = useTransform(scrollYProgress, [0, 1], [200, -50])

  return (
    <section id="preview" className="relative px-6 py-24 md:px-12">
      <div className="relative mx-auto h-[800px] max-w-7xl md:h-[900px]">
        {/* Abstract shapes behind the images */}
        <div className="absolute inset-0 rounded-3xl bg-linear-to-tr from-indigo-500/10 to-purple-500/10 blur-[80px]" />

        {/* Main Interface Screenshot */}
        <motion.div
          style={{ y: y1 }}
          className="absolute top-[10%] left-0 z-20 w-full overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl shadow-purple-500/20 lg:left-[5%] lg:w-[70%]"
        >
          <div className="group relative aspect-16/10 overflow-hidden bg-zinc-900">
            <img
              src="/images/evergarden-font-manager.webp"
              alt="Evergarden Font Home Interface"
              className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                target.parentElement!.innerHTML =
                  '<div class="absolute inset-0 flex items-center justify-center text-zinc-500 text-lg">Replace with /font-home.png</div>'
              }}
            />
          </div>
        </motion.div>

        {/* Font Preview Screenshot */}
        <motion.div
          style={{ y: y2 }}
          className="absolute top-[40%] right-0 z-30 hidden w-full overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl shadow-indigo-500/20 md:block lg:right-[5%] lg:w-[60%]"
        >
          <div className="group relative aspect-16/10 overflow-hidden bg-zinc-800">
            <img
              src="/images/evergarden-font-preview.webp"
              alt="Evergarden Font Preview Interface"
              className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                target.parentElement!.innerHTML =
                  '<div class="absolute inset-0 flex items-center justify-center text-zinc-500 text-lg">Replace with /font-preview.png</div>'
              }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Features() {
  const features = [
    {
      icon: <LayoutGrid className="size-6 text-indigo-400" />,
      title: 'Virtualized Font Grid',
      description:
        'Lightning-fast virtualized masonry grid effortlessly rendering thousands of system fonts without frame drops.',
    },
    {
      icon: <Component className="size-6 text-purple-400" />,
      title: 'Deep OpenType Inspection',
      description:
        'Inspect font metadata, explore glyph tables, and toggle Stylistic Sets and Character Variants in real-time.',
    },
    {
      icon: <Sparkles className="size-6 text-pink-400" />,
      title: 'Font Pairing Studio',
      description:
        'Explore typographic combinations and test heading and body pairings seamlessly across layout cards.',
    },
    {
      icon: <Box className="size-6 text-emerald-400" />,
      title: 'Tauri v2 & SQLite Core',
      description:
        'Built on Rust and local SQLite for near-zero idle RAM consumption, ~11.9MB binary footprint, and offline speed.',
    },
  ]

  return (
    <section
      id="features"
      className="relative z-10 border-t border-white/5 bg-zinc-950/50 px-6 py-24 md:px-12"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 text-center">
          <h2 className="mb-6 font-serif text-4xl leading-tight font-light md:text-6xl">
            <span className="font-sans font-bold tracking-tight">Everything you need.</span>{' '}
            <br className="hidden md:block" />
            <span className="tracking-tight text-zinc-400 italic">Nothing you don't.</span>
          </h2>
          <p className="mx-auto max-w-2xl font-mono text-sm tracking-widest text-zinc-500 uppercase">
            Engineered meticulously for typography enthusiasts and designers.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true, margin: '-100px' }}
              key={i}
              className="group rounded-3xl border border-white/5 bg-white/5 p-8 transition-all hover:border-white/10 hover:bg-white/10"
            >
              <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-white/5 transition-transform group-hover:scale-110 group-hover:bg-white/10">
                {feature.icon}
              </div>
              <h3 className="mb-3 font-serif text-2xl font-medium text-white">{feature.title}</h3>
              <p className="leading-relaxed font-light text-zinc-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="relative overflow-hidden px-6 py-32 text-center">
      <div className="absolute inset-0 bg-linear-to-b from-transparent to-indigo-900/20" />
      <div className="relative z-10 mx-auto max-w-3xl">
        <h2 className="mb-10 font-serif text-5xl leading-tight font-light md:text-7xl">
          <span className="font-sans font-bold tracking-tighter">Ready to</span> <br />
          <span className="text-indigo-300 italic">transform your workflow?</span>
        </h2>
        <a
          href="https://github.com/thevioletto/evergarden-font-manager/releases/latest/download/Evergarden.Font.Manager.exe"
          className="inline-flex h-14 items-center justify-center rounded-full bg-white px-10 font-mono text-sm font-semibold tracking-widest text-black uppercase shadow-[0_0_40px_-5px_rgba(255,255,255,0.3)] transition-all hover:scale-105 hover:bg-zinc-200"
        >
          Download for Windows (.exe)
        </a>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black px-6 pt-16 pb-8 md:px-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="mb-4 flex items-center gap-3 md:mb-0">
          <img src="/logo.svg" alt="Evergarden Logo" className="h-12 object-contain" />
        </div>

        <p className="font-mono text-xs tracking-wider text-zinc-500 uppercase">
          © {new Date().getFullYear()} Evergarden. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black font-sans text-white antialiased selection:bg-purple-500/30">
      <Header />
      <main>
        <Hero />
        <Preview />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}

function App() {
  const [locationState, setLocationState] = useState(() => ({
    pathname: typeof window === 'undefined' ? '/' : window.location.pathname,
    hash: typeof window === 'undefined' ? '' : window.location.hash,
  }))

  useEffect(() => {
    const syncRouteState = () => {
      setLocationState({
        pathname: window.location.pathname,
        hash: window.location.hash,
      })
    }

    window.addEventListener('hashchange', syncRouteState)
    window.addEventListener('popstate', syncRouteState)

    return () => {
      window.removeEventListener('hashchange', syncRouteState)
      window.removeEventListener('popstate', syncRouteState)
    }
  }, [])

  if (isPairingRoute(locationState.pathname, locationState.hash)) return <PairingPage />
  return <HomePage />
}

export default App
