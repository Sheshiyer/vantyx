import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/";
// Placeholder media — swap for real Vantyx 360°/skyline captures.
const CARDS = [
  {
    tag: "Experience",
    title: "Step into the view",
    body: "A premium, branded 360° tour per project — every floor, every view direction, every time of day, in the browser. No app, no download.",
    video: `${BASE}hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4`,
    href: "https://marina-one-ka.tryvantyx.space",
  },
  {
    tag: "Platform",
    title: "You're in control",
    body: "Upload, preview, publish — your team keeps every view current. Non-destructive and zero-downtime, on Cloudflare's global edge. No engineers in the loop.",
    video: `${BASE}hf_20260324_151826_c7218672-6e92-402c-9e45-f1e0f454bdc4.mp4`,
    href: "https://admin.tryvantyx.space",
  },
];

export function ServicesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative overflow-hidden bg-black px-6 py-28 md:py-40">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.04)_0%,_transparent_60%)]" />
      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mb-12 flex items-end justify-between md:mb-16"
        >
          <h2 className="text-3xl tracking-tight text-white md:text-5xl">What Vantyx does</h2>
          <span className="hidden text-sm text-white/40 md:block">Two halves of the same product</span>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          {CARDS.map((card, i) => (
            <motion.a
              key={card.title}
              href={card.href}
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: i * 0.15 }}
              className="liquid-glass group block overflow-hidden rounded-3xl"
            >
              <div className="relative aspect-video overflow-hidden">
                <video
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src={card.video}
                  muted
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              <div className="p-6 md:p-8">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-white/40">{card.tag}</span>
                  <span className="liquid-glass rounded-full p-2 text-white">
                    <ArrowUpRight size={16} strokeWidth={2} />
                  </span>
                </div>
                <h3 className="mb-3 text-xl tracking-tight text-white md:text-2xl">{card.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{card.body}</p>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
