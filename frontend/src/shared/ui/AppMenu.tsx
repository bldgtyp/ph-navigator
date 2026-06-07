import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { MoreVertical, type LucideIcon } from "lucide-react";
import { useOutsidePointerDown } from "./useOutsidePointerDown";

type AppMenuContextValue = {
  close: () => void;
};

const AppMenuContext = createContext<AppMenuContextValue | null>(null);

function useAppMenuClose() {
  return useContext(AppMenuContext)?.close ?? (() => undefined);
}

export function AppMenu({
  label,
  title = label,
  children,
  className,
  defaultOpen = false,
  triggerIcon: TriggerIcon = MoreVertical,
}: {
  label: string;
  title?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  triggerIcon?: LucideIcon;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const close = useCallback(() => setOpen(false), []);

  useOutsidePointerDown(rootRef, open, close);

  return (
    <AppMenuContext.Provider value={{ close }}>
      <div
        ref={rootRef}
        className={["app-menu", className].filter(Boolean).join(" ")}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) close();
        }}
      >
        <button
          type="button"
          className="app-menu__trigger"
          aria-label={label}
          aria-expanded={open}
          title={title}
          onClick={() => setOpen((current) => !current)}
        >
          <TriggerIcon size={18} aria-hidden="true" />
        </button>
        {open ? (
          <div className="app-menu__panel" role="menu">
            {children}
          </div>
        ) : null}
      </div>
    </AppMenuContext.Provider>
  );
}

type AppMenuItemProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  icon?: LucideIcon;
  children: ReactNode;
  closeOnSelect?: boolean;
  danger?: boolean;
};

export function AppMenuItem({
  icon: Icon,
  children,
  closeOnSelect = true,
  danger = false,
  onClick,
  ...buttonProps
}: AppMenuItemProps) {
  const close = useAppMenuClose();
  return (
    <button
      {...buttonProps}
      type={buttonProps.type ?? "button"}
      className="app-menu__item"
      role={buttonProps.role ?? "menuitem"}
      data-danger={danger ? "true" : undefined}
      onClick={(event) => {
        if (closeOnSelect) close();
        onClick?.(event);
      }}
    >
      <AppMenuIcon icon={Icon} />
      <span className="app-menu__item-label">{children}</span>
    </button>
  );
}

type AppMenuLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & {
  icon?: LucideIcon;
  children: ReactNode;
  closeOnSelect?: boolean;
};

export function AppMenuLink({
  icon: Icon,
  children,
  closeOnSelect = true,
  onClick,
  ...anchorProps
}: AppMenuLinkProps) {
  const close = useAppMenuClose();
  return (
    <a
      {...anchorProps}
      className="app-menu__item"
      role={anchorProps.role ?? "menuitem"}
      onClick={(event) => {
        if (closeOnSelect) close();
        onClick?.(event);
      }}
    >
      <AppMenuIcon icon={Icon} />
      <span className="app-menu__item-label">{children}</span>
    </a>
  );
}

export function AppMenuIcon({ icon: Icon }: { icon?: LucideIcon }) {
  return (
    <span className="app-menu__item-icon" aria-hidden="true">
      {Icon ? <Icon size={13} strokeWidth={1.9} /> : null}
    </span>
  );
}

export function AppMenuItemValue({ children }: { children: ReactNode }) {
  return <span className="app-menu__item-value">{children}</span>;
}

export function AppMenuSubmenu({
  label,
  value,
  icon,
  children,
  testId,
}: {
  label: string;
  value?: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <details className="app-menu__submenu" data-testid={testId}>
      <summary className="app-menu__item app-menu__submenu-trigger">
        <AppMenuIcon icon={icon} />
        <span className="app-menu__item-label">{label}</span>
        {value ? <AppMenuItemValue>{value}</AppMenuItemValue> : null}
      </summary>
      <div className="app-menu__submenu-panel" role="menu" aria-label={label}>
        {children}
      </div>
    </details>
  );
}

export function AppMenuRadioItem({
  checked,
  children,
  onClick,
}: Pick<HTMLAttributes<HTMLButtonElement>, "onClick"> & {
  checked: boolean;
  children: ReactNode;
}) {
  const close = useAppMenuClose();
  return (
    <button
      type="button"
      className="app-menu__item app-menu__radio-item"
      role="menuitemradio"
      aria-checked={checked}
      onClick={(event) => {
        close();
        onClick?.(event);
      }}
    >
      <span className="app-menu__item-icon" aria-hidden="true">
        <span className="app-menu__radio-mark" />
      </span>
      <span className="app-menu__item-label">{children}</span>
    </button>
  );
}
