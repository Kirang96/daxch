import { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function Card({ title, children, className = "", action }: Props) {
  return (
    <section className={`glass rounded-sm p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="font-serif text-base font-semibold text-foreground">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

