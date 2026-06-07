import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Aperture, ArrowRight, Play, LayoutDashboard, Globe } from "lucide-react";
import { AboutSection } from "./components/AboutSection";
import { ProofBar } from "./components/ProofBar";
import { ProblemSolution } from "./components/ProblemSolution";
import { HowItWorks } from "./components/HowItWorks";
import { FeaturedSection } from "./components/FeaturedSection";
import { PhilosophySection } from "./components/PhilosophySection";
import { ServicesSection } from "./components/ServicesSection";
import { Metrics } from "./components/Metrics";
import { Testimonial } from "./components/Testimonial";
import { FAQ } from "./components/FAQ";
import { Pricing } from "./components/Pricing";
import { Contact } from "./components/Contact";

const TOUR_URL = "https://marina-one-ka.tryvantyx.space";
const CONSOLE_URL = "https://admin.tryvantyx.space";
const THOUGHTSEED_URL = "https://www.thoughtseed.space";
const HERO_POSTER = "/landing/media/hero.png";
// Drop a Grok-animated hero.mp4 here; until then the poster still shows (the <video> simply stays hidden).
const HERO_VIDEO = "/landing/media/hero.mp4";

function scrollToDemo() {
  document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
}

/** rAF opacity tween (transform/opacity only — hardware-accelerated). */
function fadeOpacity(el: HTMLElement, from: number, to: number, ms: number, onDone?: () => void) {
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    el.style.opacity = String(from + (to - from) * t);
    if (t < 1) requestAnimationFrame(tick);
    else onDone?.();
  };
  requestAnimationFrame(tick);
}

function useHeroVideoCrossfade() {
  const ref = useRef<HTMLVideoElement>(null);
  const fadingOut = useRef(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onCanPlay = () => {
      void v.play().catch(() => {});
      fadeOpacity(v, 0, 1, 500);
    };
    const onTimeUpdate = () => {
      if (!fadingOut.current && v.duration && v.duration - v.currentTime <= 0.55) {
        fadingOut.current = true;
        fadeOpacity(v, Number(v.style.opacity || 1), 0, 500);
      }
    };
    const onEnded = () => {
      v.style.opacity = "0";
      window.setTimeout(() => {
        v.currentTime = 0;
        void v.play().catch(() => {});
        fadingOut.current = false;
        fadeOpacity(v, 0, 1, 500);
      }, 100);
    };
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
  }, []);
  return ref;
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-sm font-medium text-white/80 transition-colors hover:text-white">
      {children}
    </a>
  );
}

function Hero() {
  const videoRef = useHeroVideoCrossfade();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function submitDemo(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    const body = JSON.stringify({
      type: "event",
      event: "demo_request",
      props: { email, source: "landing-hero" },
      id: "landing",
    });
    try {
      void fetch("/api/telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      });
    } catch {
      /* never block the UI */
    }
    setEmail("");
    setSent(true);
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <img
        src={HERO_POSTER}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-bottom"
      />
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover object-bottom"
        style={{ opacity: 0 }}
        src={HERO_VIDEO}
        poster={HERO_POSTER}
        muted
        autoPlay
        playsInline
        preload="auto"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />

      {/* Navbar */}
      <nav className="relative z-20 px-6 py-6">
        <div className="liquid-glass mx-auto flex max-w-5xl items-center justify-between rounded-full px-6 py-3">
          <div className="flex items-center">
            <Aperture size={22} className="text-indigo-400" strokeWidth={1.75} />
            <span className="ml-2 text-lg font-semibold text-white">Vantyx</span>
            <div className="ml-8 hidden gap-8 md:flex">
              <NavLink href="#how">How it works</NavLink>
              <NavLink href="#faq">FAQ</NavLink>
              <NavLink href={TOUR_URL}>See it live</NavLink>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={CONSOLE_URL}
              className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:block"
            >
              Console
            </a>
            <button
              type="button"
              onClick={scrollToDemo}
              className="liquid-glass rounded-full px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5"
            >
              Book a demo
            </button>
          </div>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 flex flex-1 -translate-y-[12%] flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="serif whitespace-nowrap text-7xl tracking-tight text-white md:text-8xl lg:text-9xl">
          Sell the <em className="italic text-indigo-400">view</em>.
        </h1>

        <p className="mt-6 max-w-xl px-4 text-sm leading-relaxed text-white/80 md:text-base">
          The living 360° tour for view-led real estate. Buyers step onto any floor, at any hour —
          and your team keeps every view true as the building rises.
        </p>

        {sent ? (
          <p className="mt-8 text-sm text-indigo-300">Thanks — we'll reach out about a tour for your project.</p>
        ) : (
          <form onSubmit={submitDemo} className="mt-8 w-full max-w-xl">
            <div className="liquid-glass flex items-center gap-3 rounded-full py-2 pl-6 pr-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your work email — book a demo"
                aria-label="Your work email"
                className="flex-1 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Request a demo"
                className="rounded-full bg-white p-3 text-black transition-transform active:scale-95"
              >
                <ArrowRight size={20} strokeWidth={2} />
              </button>
            </div>
          </form>
        )}

        <a
          href={TOUR_URL}
          className="liquid-glass mt-6 rounded-full px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
        >
          See a live tour →
        </a>
      </div>

      {/* Quick links footer */}
      <div className="relative z-10 flex justify-center gap-4 pb-12">
        <a href={TOUR_URL} aria-label="Live tour" className="liquid-glass rounded-full p-4 text-white/80 transition-all hover:bg-white/5 hover:text-white">
          <Play size={20} strokeWidth={1.75} />
        </a>
        <a href={CONSOLE_URL} aria-label="Operator console" className="liquid-glass rounded-full p-4 text-white/80 transition-all hover:bg-white/5 hover:text-white">
          <LayoutDashboard size={20} strokeWidth={1.75} />
        </a>
        <a href={THOUGHTSEED_URL} aria-label="Thoughtseed Labs" className="liquid-glass rounded-full p-4 text-white/80 transition-all hover:bg-white/5 hover:text-white">
          <Globe size={20} strokeWidth={1.75} />
        </a>
      </div>
    </div>
  );
}

export function App() {
  return (
    <main className="bg-black">
      <Hero />
      <ProofBar />
      <AboutSection />
      <ProblemSolution />
      <div id="how">
        <HowItWorks />
      </div>
      <FeaturedSection />
      <PhilosophySection />
      <ServicesSection />
      <Metrics />
      <Testimonial />
      <div id="faq">
        <FAQ />
      </div>
      <Pricing onBookDemo={scrollToDemo} />
      <Contact />
      <footer className="bg-black px-6 pb-16 pt-8 text-center">
        <p className="serif text-2xl text-white">
          Vantyx — <em className="italic text-indigo-400">Sell the view.</em>
        </p>
        <p className="mt-3 text-sm text-white/40">
          A{" "}
          <a href={THOUGHTSEED_URL} className="text-white/70 underline-offset-4 hover:underline">
            Thoughtseed Labs
          </a>{" "}
          product. © Vantyx. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
