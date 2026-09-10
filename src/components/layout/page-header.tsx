export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header>
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.035em] text-foreground sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
    </header>
  );
}
