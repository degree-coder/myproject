/**
 * Section Component
 *
 * 수직 여백을 담당하는 레이아웃 컴포넌트입니다.
 * 페이지 내 섹션 간 일관된 간격을 유지합니다.
 *
 * @example
 * <Section>
 *   <YourContent />
 * </Section>
 *
 * @example
 * <Section spacing="lg" className="bg-muted">
 *   <YourContent />
 * </Section>
 */
import * as React from "react";

import { cn } from "~/core/lib/utils";

type SectionSpacing = "none" | "sm" | "md" | "lg" | "xl";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** 섹션 수직 여백 크기 */
  spacing?: SectionSpacing;
  /** HTML 시맨틱 태그 사용 여부 (기본: section) */
  as?: "section" | "div" | "article" | "aside" | "header" | "footer" | "main";
}

const spacingClasses: Record<SectionSpacing, string> = {
  none: "",
  sm: "py-4 sm:py-6",
  md: "py-8 sm:py-12",
  lg: "py-12 sm:py-16 lg:py-20",
  xl: "py-16 sm:py-20 lg:py-24",
};

function Section({
  className,
  spacing = "md",
  as: Component = "section",
  children,
  ...props
}: SectionProps) {
  return (
    <Component className={cn(spacingClasses[spacing], className)} {...props}>
      {children}
    </Component>
  );
}

Section.displayName = "Section";

export { Section, type SectionProps, type SectionSpacing };
