import { motion } from "framer-motion";
import { Camera, UploadCloud, Compass, RefreshCw } from "lucide-react";

const STEPS = [
  { icon: Camera, n: "01", title: "Capture", body: "Shoot equirectangular 360°s for each floor, view direction, and time of day." },
  { icon: UploadCloud, n: "02", title: "Publish", body: "Your team uploads and publishes from the browser — atomic and non-destructive. The live tour never blinks." },
  { icon: Compass, n: "03", title: "Explore", body: "Buyers step onto any floor, at any hour, on any device — branded to your project, no app to install." },
  { icon: RefreshCw, n: "04", title: "Update", body: "As the building rises, re-capture and republish. Got it wrong? Roll back to any version instantly." },
];

export function HowItWorks() {
  return (
    <section className="bg-black px-6 py-28 md:py-36">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-14 text-4xl tracking-tight text-white md:mb-20 md:text-6xl"
        >
          From capture to <em className="serif italic text-indigo-400">always-true</em>, in four steps.
        </motion.h2>

        <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="bg-black p-8 md:p-10"
            >
              <div className="mb-5 flex items-center justify-between">
                <s.icon size={22} className="text-indigo-300" strokeWidth={1.75} />
                <span className="serif text-3xl text-white/20">{s.n}</span>
              </div>
              <h3 className="mb-2 text-xl text-white md:text-2xl">{s.title}</h3>
              <p className="text-sm leading-relaxed text-white/55">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
