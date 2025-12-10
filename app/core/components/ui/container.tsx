/**
 * Container Component
 *
 * 최대 너비를 제한하고 중앙 정렬을 담당하는 레이아웃 컴포넌트입니다.
 * 반복되는 레이아웃 코드를 줄이고 일관성을 유지합니다.
 *
 * @example
 * <Container>
 *   <YourContent />
 * </Container>
 *
 * @example
 * <Container size="lg" className="py-8">
 *   <YourContent />
 * </Container>
 */
import * as React from "react";

import { cn } from "~/core/lib/utils";

type ContainerSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 컨테이너 최대 너비 사이즈 */
  size?: ContainerSize;
  /** 자식 요소에 컨테이너 역할을 위임 */
  asChild?: boolean;
}

const sizeClasses: Record<ContainerSize, string> = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size = "xl", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "mx-auto w-full px-4 sm:px-6 lg:px-8",
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Container.displayName = "Container";

export { Container, type ContainerProps, type ContainerSize };
