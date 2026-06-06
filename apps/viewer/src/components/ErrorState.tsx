type Props = { title: string; message: string };

export function ErrorState({ title, message }: Props) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black p-6 text-center text-white">
      <div className="max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
        <h1 className="mb-2 text-lg font-semibold">{title}</h1>
        <p className="text-sm text-white/60">{message}</p>
      </div>
    </div>
  );
}
