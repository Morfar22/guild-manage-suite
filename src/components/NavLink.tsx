import { Link, LinkProps } from "@tanstack/react-router";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends LinkProps {
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, ...props }, ref) => {
    return (
      <Link
        ref={ref}
        className={cn(className)}
        activeProps={{ className: activeClassName }}
        inactiveProps={{ className: pendingClassName }}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
