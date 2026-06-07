import { motion } from "framer-motion";

export function ProblemSolution() {
  return (
    <section className="bg-black px-6 py-28 md:py-36">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <p className="mb-4 text-xs uppercase tracking-widest text-white/40">The problem</p>
          <h3 className="serif mb-5 text-3xl text-white/90 md:text-4xl">A render is a promise that ages.</h3>
          <p className="text-base leading-relaxed text-white/55 md:text-lg">
            A one-off 360° shoot is true for a day — then the crane moves and the view becomes a lie.
            Keeping it current means rebuilding the tour every time, so it just doesn't happen. Buyers
            end up touring a past that no longer exists.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="liquid-glass rounded-3xl p-8 md:p-10"
        >
          <p className="mb-4 text-xs uppercase tracking-widest text-indigo-300/80">With Vantyx</p>
          <h3 className="serif mb-5 text-3xl text-white md:text-4xl">A living tour, true to today.</h3>
          <p className="text-base leading-relaxed text-white/70 md:text-lg">
            Re-capture and publish the view yourself — non-destructive, zero-downtime, instant
            rollback. The 360° a buyer steps into is the one they'll actually get from that floor, at
            that hour, as the tower stands right now.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
