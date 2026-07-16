import * as Popover from "@radix-ui/react-popover";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

/**
 * Named hover-open delay tiers (ms) for the {@link Tooltip} `hoverDelay` prop.
 * Use these instead of ad-hoc numbers so hover latency stays consistent across
 * the app. `medium` suits element-name hints; `long` suits row-action buttons
 * and other controls that should only reveal on a deliberate hover (they
 * otherwise flicker as the pointer sweeps across a dense list).
 */
export const TOOLTIP_HOVER_DELAY = {
  medium: 500,
  long: 900,
} as const;

type TooltipTriggerProps = {
  "aria-describedby"?: string;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  ref?: Ref<HTMLElement>;
};

export type TooltipProps = {
  children: ReactElement<TooltipTriggerProps>;
  content: ReactNode;
  hoverDelay?: number;
  offset?: number;
  placement?: TooltipPlacement;
  viewportPadding?: number;
};

export function Tooltip({
  children,
  content,
  hoverDelay = 0,
  offset = 8,
  placement = "top",
  viewportPadding = 8,
}: TooltipProps) {
  const reactId = useId();
  const tooltipId = `app-tooltip-${reactId.replace(/:/g, "")}`;
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = focused || hovered;

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current === null) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }, []);

  const hide = useCallback(() => {
    clearHoverTimer();
    setFocused(false);
    setHovered(false);
  }, [clearHoverTimer]);

  useEffect(() => clearHoverTimer, [clearHoverTimer]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [hide, open]);

  const hasValidTrigger = isValidElement<TooltipTriggerProps>(children);
  const childRef = hasValidTrigger ? children.props.ref : undefined;
  const setTriggerRef = useCallback(
    (node: HTMLElement | null) => {
      assignRef(childRef, node);
    },
    [childRef],
  );

  if (!content || !hasValidTrigger) return children;

  const trigger = cloneElement(children, {
    "aria-describedby": describedBy(children.props["aria-describedby"], tooltipId, open),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      children.props.onBlur?.(event);
      setFocused(false);
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      children.props.onFocus?.(event);
      clearHoverTimer();
      setFocused(true);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      children.props.onKeyDown?.(event);
      if (event.key === "Escape") hide();
    },
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      children.props.onMouseEnter?.(event);
      clearHoverTimer();
      if (hoverDelay <= 0) {
        setHovered(true);
      } else {
        hoverTimer.current = setTimeout(() => {
          hoverTimer.current = null;
          setHovered(true);
        }, hoverDelay);
      }
    },
    onMouseLeave: (event: MouseEvent<HTMLElement>) => {
      children.props.onMouseLeave?.(event);
      clearHoverTimer();
      setHovered(false);
    },
    ref: setTriggerRef,
  });

  return (
    <Popover.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? hide() : undefined)}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          id={tooltipId}
          className="app-tooltip"
          role="tooltip"
          side={placement}
          sideOffset={offset}
          collisionPadding={viewportPadding}
          onClick={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
          // Radix restores focus to the trigger when the popover closes; that
          // programmatic focus would fire our onFocus and immediately re-open
          // the tooltip (it "lingers" after the pointer leaves). Suppress it so
          // a hover-opened tooltip closes cleanly on mouse-leave.
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {content}
          <Popover.Arrow className="app-tooltip__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function describedBy(
  existing: string | undefined,
  tooltipId: string,
  open: boolean,
): string | undefined {
  if (!open) return existing;
  if (!existing) return tooltipId;
  const ids = new Set(existing.split(/\s+/).filter(Boolean));
  ids.add(tooltipId);
  return Array.from(ids).join(" ");
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  ref.current = value;
}
