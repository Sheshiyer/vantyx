import { motion } from "framer-motion";

export function Pricing({ onBookDemo }: { onBookDemo: () => void }) {
  return (
    <section className="bg-black px-6 py-28 md:py-36">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7 }}
        className="liquid-glass mx-auto max-w-3xl rounded-3xl p-10 text-center md:p-14"
      >
        <p className="mb-4 text-xs uppercase tracking-widest text-white/40">Pricing</p>
        <h2 className="serif mb-5 text-4xl text-white md:text-5xl">Priced to the building.</h2>
        <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
          Every Vantyx tour is a branded, living experience scoped to your development — its floors,
          its views, its update cadence. Pricing is per project. Tell us about yours and we'll quote it.
        </p>
        <button
          type="button"
          onClick={onBookDemo}
          className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition-transform active:scale-95"
        >
          Book a demo
        </button>
      </motion.div>
    </section>
  );
}
