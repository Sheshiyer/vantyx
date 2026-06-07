import { motion } from "framer-motion";

export function Testimonial() {
  return (
    <section className="bg-black px-6 py-28 md:py-36">
      <motion.figure
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7 }}
        className="mx-auto max-w-4xl text-center"
      >
        <blockquote className="serif text-3xl leading-snug text-white/90 md:text-5xl">
          “Buyers stopped asking <em className="italic text-indigo-400">what will I see</em> — they just look.”
        </blockquote>
        {/* PLACEHOLDER — replace with a real, attributed client quote before any public push. */}
        <figcaption className="mt-8 text-sm text-white/50">
          Sales &amp; marketing lead, launch partner
          <span className="ml-2 text-white/30">(placeholder — add a real quote)</span>
        </figcaption>
      </motion.figure>
    </section>
  );
}
