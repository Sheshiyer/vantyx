import { motion } from "framer-motion";

const STATS = [
  { v: "100+", l: "viewpoints per tour", s: "every floor × 3 views × 4 times of day" },
  { v: "0", l: "downtime on updates", s: "non-destructive, atomic publish" },
  { v: "No app", l: "runs in any browser", s: "share a link, step inside" },
  { v: "Days", l: "to launch, not weeks", s: "one command provisions a project" },
];

export function Metrics() {
  return (
    <section className="border-y border-white/10 bg-black px-6 py-16 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((st, i) => (
          <motion.div
            key={st.l}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          >
            <div className="serif text-5xl text-white md:text-6xl">{st.v}</div>
            <div className="mt-2 text-sm font-medium text-white/80">{st.l}</div>
            <div className="mt-1 text-xs leading-relaxed text-white/40">{st.s}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
