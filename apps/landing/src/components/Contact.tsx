import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/50">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-indigo-400/60"
      />
    </label>
  );
}

export function Contact() {
  const [form, setForm] = useState({ name: "", company: "", email: "", project: "" });
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.email.includes("@")) return;
    try {
      void fetch("/api/telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ type: "event", event: "demo_request", props: { ...form, source: "landing-contact" }, id: "landing" }),
      });
    } catch {
      /* never block the UI */
    }
    setSent(true);
  }

  return (
    <section id="demo" className="bg-black px-6 py-28 md:py-40">
      <div className="mx-auto max-w-3xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="serif text-5xl text-white md:text-7xl"
        >
          Sell the <em className="italic text-indigo-400">view</em>.
        </motion.h2>
        <p className="mx-auto mt-5 max-w-lg text-base text-white/60 md:text-lg">
          Book a demo — see Vantyx on your own project, and how your team keeps every view true as it rises.
        </p>

        {sent ? (
          <p className="mt-10 text-base text-indigo-300">
            Thanks{form.name ? `, ${form.name.split(" ")[0]}` : ""} — we'll be in touch within a day.
          </p>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-10 max-w-xl space-y-4 text-left">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" value={form.name} onChange={set("name")} />
              <Field label="Company" value={form.company} onChange={set("company")} />
            </div>
            <Field label="Work email" type="email" value={form.email} onChange={set("email")} required />
            <Field label="Project / location (optional)" value={form.project} onChange={set("project")} />
            <button
              type="submit"
              className="w-full rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black transition-transform active:scale-95"
            >
              Book a demo
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
