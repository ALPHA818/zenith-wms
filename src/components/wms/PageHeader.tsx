import React from "react";
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="mt-4 md:mt-0 flex-shrink-0">{children}</div>}
    </div>
  );
}