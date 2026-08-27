import Link from "next/link";
import type { DashboardData } from "@/lib/platform/dashboard";
import { formatMoney } from "@/lib/finance/format";

function Panel({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-card-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {href ? (
          <Link
            href={href}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}

export function OperationsDashboard({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Operations Command Center
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Live view across logistics, finance, warehouse, and commercial activity
        </p>
      </div>

      {data.error ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Some dashboard widgets could not load: {data.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-card-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Monthly Revenue</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatMoney(data.monthlyRevenue)}
          </p>
        </div>
        <div className="rounded-lg border border-card-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Cash Position</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatMoney(data.cashPosition)}
          </p>
        </div>
        <div className="rounded-lg border border-card-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Overdue Invoices</p>
          <p className="mt-2 text-2xl font-semibold">
            {data.overdueInvoices.length}
          </p>
        </div>
        <div className="rounded-lg border border-card-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Warehouse Alerts</p>
          <p className="mt-2 text-2xl font-semibold">
            {data.warehouseAlerts.length}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Today's Shipments" href="/logistics">
          {!data.todaysShipments.length ? (
            <Empty label="No ETD today." />
          ) : (
            <ul className="space-y-2">
              {data.todaysShipments.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/logistics/${item.id}`}
                    className="text-sm hover:underline"
                  >
                    {item.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming ETA" href="/logistics">
          {!data.upcomingEta.length ? (
            <Empty label="No arrivals in the next 7 days." />
          ) : (
            <ul className="space-y-2">
              {data.upcomingEta.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/logistics/${item.id}`}
                    className="text-sm hover:underline"
                  >
                    {item.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ETA {item.eta}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Overdue Invoices" href="/finance/invoices">
          {!data.overdueInvoices.length ? (
            <Empty label="No overdue invoices." />
          ) : (
            <ul className="space-y-2">
              {data.overdueInvoices.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/finance/invoices/${item.id}`}
                    className="text-sm hover:underline"
                  >
                    {item.invoice_number}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatMoney(item.outstanding, item.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Pending Payments" href="/finance/payments">
          {!data.pendingPayments.length ? (
            <Empty label="No pending balances." />
          ) : (
            <ul className="space-y-2">
              {data.pendingPayments.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/finance/invoices/${item.id}`}
                    className="text-sm hover:underline"
                  >
                    {item.invoice_number}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatMoney(item.outstanding, item.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent Contracts" href="/contracts">
          {!data.recentContracts.length ? (
            <Empty label="No contracts yet." />
          ) : (
            <ul className="space-y-2">
              {data.recentContracts.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/contracts/${item.id}`}
                    className="text-sm hover:underline"
                  >
                    {item.contract_number}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Warehouse Alerts" href="/warehouse">
          {!data.warehouseAlerts.length ? (
            <Empty label="No low-stock alerts." />
          ) : (
            <ul className="space-y-2">
              {data.warehouseAlerts.map((item) => (
                <li key={item.id} className="text-sm">
                  {item.label}
                  <span className="ml-2 text-xs text-amber-300">
                    avail {item.available}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Top Customers" href="/counterparties">
          {!data.topCustomers.length ? (
            <Empty label="No customer revenue yet." />
          ) : (
            <ul className="space-y-2">
              {data.topCustomers.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/counterparties/${item.id}`}
                    className="text-sm hover:underline"
                  >
                    {item.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatMoney(item.revenue)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
