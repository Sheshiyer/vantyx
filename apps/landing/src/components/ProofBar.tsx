import { motion } from "framer-motion";

const TOUR_URL = "https://marina-one-ka.tryvantyx.space";

export function ProofBar() {
  return (
    <section className="border-y border-white/10 bg-black px-6 py-5">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/50"
      >
        <span>
          Built with <span className="text-white/80">Ashwin Sheth Group</span>
        </span>
        <span className="hidden h-3 w-px bg-white/15 sm:block" />
        <span>
          First live for <span className="text-white/80">Marina One, Bengaluru</span>
        </span>
        <span className="hidden h-3 w-px bg-white/15 sm:block" />
        <a href={TOUR_URL} className="text-indigo-300 transition-colors hover:text-indigo-200">
          Explore the live tour →
        </a>
      </motion.div>
    </section>
  );
}
