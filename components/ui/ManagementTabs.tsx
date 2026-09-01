type ManagementTab<T extends string> = {
  id: T;
  label: string;
  disabled?: boolean;
};

type ManagementTabsProps<T extends string> = {
  tabs: ManagementTab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  ariaLabel: string;
};

export function ManagementTabs<T extends string>({ tabs, activeTab, onChange, ariaLabel }: ManagementTabsProps<T>) {
  return (
    <nav className="management-tabs" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          disabled={tab.disabled}
          aria-current={activeTab === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
          className="management-tab"
          data-active={activeTab === tab.id ? "true" : "false"}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
