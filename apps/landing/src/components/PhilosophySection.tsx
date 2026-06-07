import { useRef } from "react";
import { motion, useInView } from "framer-motion";

// Placeholder media — swap for a real Vantyx 360°/skyline capture.
const VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4";

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
            <video className="h-full w-full object-cover" src={VIDEO} muted autoPlay loop playsInline preload="auto" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div>
              <p className="mb-4 text-xs uppercase tracking-widest text-white/40">Step into the view</p>
              <p className="text-base leading-relaxed text-white/70 md:text-lg">
                Buyers explore the real 360° from any floor, at any time of day — instantly, in the
                browser, no app. The pitch becomes an experience they can stand inside, long before
                the floor is finished.
              </p>
            </div>
            <div className="my-10 h-px w-full bg-white/10" />
            <div>
              <p className="mb-4 text-xs uppercase tracking-widest text-white/40">Always true to today</p>
              <p className="text-base leading-relaxed text-white/70 md:text-lg">
                As the tower rises, your team re-captures and republishes — non-destructive,
                zero-downtime, with instant rollback. A two-year-old view is a lie; current is the
                whole point.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
