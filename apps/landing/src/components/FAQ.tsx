import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const QA = [
  {
    q: "Do we need a developer or our IT team?",
    a: "No. Your marketing team uploads, previews, and publishes from the browser. If it needed a manual, we'd have failed.",
  },
  {
    q: "How long does it take to launch a tour?",
    a: "Days, not weeks. Once you have the 360° captures, provisioning a branded tour on your own subdomain is a single step.",
  },
  {
    q: "What happens when the building changes?",
    a: "Re-capture the affected floors and publish. Updates are non-destructive and zero-downtime, with instant rollback — the live tour never goes dark.",
  },
  {
    q: "What about our existing renders or 360 shoots?",
    a: "They're a fine starting point. Vantyx is the living layer on top — the part that stays true to the building as it rises.",
  },
  {
    q: "Is it reliable enough for a live sales tool?",
    a: "It runs on Cloudflare's global edge and publishes atomically, so the tour stays up worldwide even mid-edit.",
  },
  {
    q: "How much does it cost?",
    a: "Pricing is per project, scoped to your development. Book a demo and we'll quote yours.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-black px-6 py-28 md:py-36">
      <div className="mx-auto max-w-3xl">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-12 text-4xl tracking-tight text-white md:text-6xl"
        >
          Questions, <em className="serif italic text-indigo-400">answered</em>.
        </motion.h2>

        <div className="divide-y divide-white/10 border-y border-white/10">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-base text-white/90 md:text-lg">{item.q}</span>
                  <span className="shrink-0 text-white/50">
                    {isOpen ? <Minus size={18} strokeWidth={2} /> : <Plus size={18} strokeWidth={2} />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-sm leading-relaxed text-white/55 md:text-base">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
