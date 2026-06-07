import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const POSTER = "/landing/media/philosophy.png";
const VIDEO = "/landing/media/philosophy.mp4"; // Grok-animated; the poster still shows until it's added

export function PhilosophySection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="overflow-hidden bg-black px-6 py-28 md:py-40">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-16 text-5xl tracking-tight text-white md:mb-24 md:text-7xl lg:text-8xl"
        >
          Living <em className="serif italic text-indigo-400">×</em> Vantage
        </motion.h2>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="aspect-[4/3] overflow-hidden rounded-3xl"
          >
            <video className="h-full w-full object-cover" src={VIDEO} poster={POSTER} muted autoPlay loop playsInline preload="auto" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div>
              <p className="mb-4 text-xs uppercase tracking-widest text-white/40">The view is the product</p>
              <p className="text-base leading-relaxed text-white/70 md:text-lg">
                A tower's best asset is what you see from it. We treat the view as the thing being
                sold — and build everything around its fidelity: the real outlook, from the real
                floor, at the real hour.
              </p>
            </div>
            <div className="my-10 h-px w-full bg-white/10" />
            <div>
              <p className="mb-4 text-xs uppercase tracking-widest text-white/40">Never go dark</p>
              <p className="text-base leading-relaxed text-white/70 md:text-lg">
                A live sales tool can't break. Updates are non-destructive and atomic, with instant
                rollback — so the tour stays up while the building, and its views, keep changing. A
                two-year-old view is a lie; current is the whole point.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
