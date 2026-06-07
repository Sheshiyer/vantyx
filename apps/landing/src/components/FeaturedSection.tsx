import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const TOUR_URL = "https://marina-one-ka.tryvantyx.space";
const POSTER = "/landing/media/featured.png";
const VIDEO = "/landing/media/featured.mp4"; // Grok-animated; the poster still shows until it's added

export function FeaturedSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="overflow-hidden bg-black px-6 pb-20 pt-6 md:pb-32 md:pt-10">
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.9 }}
        className="relative mx-auto aspect-video max-w-6xl overflow-hidden rounded-3xl"
      >
        <video
          className="h-full w-full object-cover"
          src={VIDEO}
          poster={POSTER}
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-end md:p-10">
          <div className="liquid-glass max-w-md rounded-2xl p-6 md:p-8">
            <p className="mb-3 text-xs uppercase tracking-widest text-white/50">Our approach</p>
            <p className="text-sm leading-relaxed text-white md:text-base">
              Capture the real view, publish it from the browser, and keep it current as the building
              rises. Non-destructive and zero-downtime — the live tour never goes dark, and your team
              runs it, not engineers.
            </p>
          </div>
          <motion.a
            href={TOUR_URL}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="liquid-glass rounded-full px-8 py-3 text-sm font-medium text-white"
          >
            See it live
          </motion.a>
        </div>
      </motion.div>
    </section>
  );
}
