'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useState } from 'react';
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, AlertTriangle, Boxes, Info } from 'lucide-react';
import { weekdayLabel } from '@/lib/shared/ledgerCalendar';

const COLORS = {
  opening: '#64748B',
  add: '#047857',
  minus: '#D97706',
  transfer: '#2563EB',
  sold: '#DC2626',
};

const CATEGORY_ORDER = ['opening', 'add', 'minus', 'transfer', 'sold'];

function trendSentence(series, bucket) {
  const busiest = [...(series || [])].sort((a, b) => (b.total || 0) - (a.total || 0))[0];
  if (!busiest?.total) return 'Nothing in this range.';
  const name = bucket === 'day' ? (weekdayLabel(busiest.date) || busiest.label) : busiest.label;
  return `${name} had the most movement events (${busiest.total.toLocaleString()}).`;
}

function ChartInfo({ what, why, when }) {
  return (
    <div className="relative shrink-0 group/info">
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]"
        aria-label="What this chart shows"
      >
        <Info size={16} />
      </button>
      <div
        role="tooltip"
        className="invisible absolute right-0 top-full z-30 mt-1.5 w-80 rounded-lg border border-[#E2E8F0] bg-white p-3 text-left text-xs leading-5 text-[#334155] opacity-0 shadow-lg transition-opacity group-hover/info:visible group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:opacity-100"
      >
        <p><span className="font-semibold text-[#0F172A]">What. </span>{what}</p>
        <p className="mt-2"><span className="font-semibold text-[#0F172A]">Why. </span>{why}</p>
        <p className="mt-2"><span className="font-semibold text-[#0F172A]">When. </span>{when}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, measure, info, children, sentence, action }) {
  return (
    <section className="relative z-0 bg-white border border-[#E2E8F0] rounded-[12px] p-4 shadow-sm hover:z-30 focus-within:z-30">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
        {info ? <ChartInfo {...info} /> : null}
      </div>
      <p className="text-sm text-[#64748B] mt-1">{measure}</p>
      <div className="mt-4">{children}</div>
      <p className="text-sm text-[#0F172A] mt-3">{sentence}</p>
      {action}
    </section>
  );
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[#0F172A] mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-[#334155]">
          {entry.name}: {Number(entry.value || 0).toLocaleString()} events
        </p>
      ))}
    </div>
  );
}

function Kpi({ kpi, icon: Icon }) {
  const change = kpi.changePct;
  return (
    <article className="bg-white border border-[#E2E8F0] rounded-[12px] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#64748B]">{kpi.title}</p>
        {Icon ? <Icon size={16} className="text-[#047857]" aria-hidden /> : null}
      </div>
      <p className="text-2xl font-semibold text-[#0F172A] mt-1">{Number(kpi.value || 0).toLocaleString()}</p>
      <p className="text-[11px] text-[#64748B] mt-1">{kpi.meaning}</p>
      {kpi.compare === false ? null : change == null ? (
        <p className="text-[11px] text-[#64748B] mt-1">No earlier period to compare</p>
      ) : (
        <p className="text-[11px] text-[#0F172A] mt-1">
          {change > 0 ? '+' : ''}{change}% vs the previous period of the same length
        </p>
      )}
    </article>
  );
}

export default function InsightsDashboard({
  data,
  onDrill,
  onBranch,
  onUnit,
  onCalendarMonth,
  onAging,
}) {
  const [bucketChoice, setBucketChoice] = useState(null);
  if (!data) return null;
  const bucketOptions = data.bucketOptions || [];
  const bucket = bucketOptions.includes(bucketChoice) ? bucketChoice : data.bucket;
  const trend = data.trends?.[bucket] || data.trend || [];
  const icons = [Boxes, ArrowUpRight, ArrowDownRight, ArrowLeftRight, AlertTriangle, AlertTriangle];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#64748B]">
        {data.range?.label}. Counts of movement events. Quantities are not added across different units.
        {data.legacyCount ? ` ${data.legacyCount.toLocaleString()} older record types are excluded from these totals.` : ''}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {(data.kpis || []).map((kpi, index) => (
          <Kpi key={kpi.id} kpi={kpi} icon={icons[index]} />
        ))}
      </div>

      <ChartCard
        title="When is stock moving the most?"
        measure="Event counts by day, week, or month. Opening is separate from later receipts."
        info={{
          what: 'Each stack is how many stock events happened in that period. The colors are opening, add, minus, transfer, and sold. A transfer is counted once.',
          why: 'It shows the busiest stretch, so you can see a rush without reading every ledger row.',
          when: 'It uses the dates selected above. A short range is daily. After 31 days it can be weekly, and after 90 days it can be monthly. Click a stack to open those movements.',
        }}
        sentence={trendSentence(trend, bucket)}
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {bucketOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBucketChoice(option)}
              className={`px-2.5 py-1 text-xs rounded-full border ${bucket === option ? 'border-[#047857] text-[#047857] bg-emerald-50' : 'border-[#E2E8F0] text-[#64748B]'}`}
            >
              {option === 'day' ? 'Daily' : option === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip content={<Tip />} />
              <Legend />
              {CATEGORY_ORDER.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key === 'add' ? 'Add' : key === 'opening' ? 'Opening' : key[0].toUpperCase() + key.slice(1)}
                  stackId="events"
                  fill={COLORS[key]}
                  onClick={(row) => onDrill({ type: key, dateFrom: row.date, dateTo: row.dateTo || row.date })}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Why is inventory moving?"
          measure="Share of movement events by category. The legend shows the count and percent."
          info={{
            what: 'The same five event types as the trend, shown as a share of the total. The list under the ring gives the count and the percent.',
            why: 'It shows whether the activity is mostly new stock, sales, reductions, or transfers.',
            when: 'It uses the same dates as the rest of this page. Click a slice, or a line in the list, to open only that type in Movements.',
          }}
          sentence={data.sentences?.distribution}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(data.distribution || []).filter((row) => row.count > 0)}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={58}
                  outerRadius={84}
                  onClick={(row) => onDrill({ type: row.id })}
                >
                  {(data.distribution || []).filter((row) => row.count > 0).map((row) => (
                    <Cell key={row.id} fill={COLORS[row.id]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="text-sm text-[#334155] space-y-1">
            {(data.distribution || []).map((row) => (
              <li key={row.id}>
                <button type="button" className="hover:underline" onClick={() => onDrill({ type: row.id })}>
                  {row.label}: {row.count.toLocaleString()} events ({row.pct}%)
                </button>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          title="Which products have the highest stock dispatch activity?"
          measure={data.products?.metric === 'qty'
            ? `Outbound quantity for ${data.products.unit} only. This is not sales value.`
            : 'Outbound events: minus, sold, and transfer out. Units are not mixed.'}
          info={{
            what: 'The products with the most stock leaving a rack: minus, sold, and transfer out. Bars count events. Pieces, kilograms, and cartons stay separate.',
            why: 'It shows which products are being dispatched the most.',
            when: 'Pick one unit to switch the bars to quantity for that unit only. Search still limits this chart with the rest of the page. Click a bar to open that product.',
          }}
          sentence={data.sentences?.products}
        >
          <label className="text-xs text-[#64748B] block mb-2">
            Quantity by one unit
            <select
              className="ml-2 border border-[#E2E8F0] rounded-lg px-2 py-1 text-sm text-[#0F172A]"
              value={data.products?.unit || ''}
              onChange={(event) => onUnit(event.target.value)}
            >
              <option value="">Event count</option>
              {(data.products?.units || []).map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </label>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.products?.items || []} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis type="category" dataKey="sku" width={88} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Bar
                  dataKey={data.products?.metric === 'qty' ? 'qty' : 'count'}
                  fill="#047857"
                  name={data.products?.metric === 'qty' ? data.products.unit : 'Events'}
                  onClick={(row) => onDrill({ productId: row.productId, type: '' })}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Which branches have the highest inventory activity?"
          measure="Inbound adds, outbound minus and sold, transfer outs, and manual adjustments. There is no separate warehouse level."
          info={{
            what: 'Each branch shows adds, stock going out, transfer outs, and manual adjustments. Locations are branch, floor, and rack.',
            why: 'It shows which branch is busiest.',
            when: 'It uses the dates selected above. Click a branch to apply that branch to every chart on this page.',
          }}
          sentence={data.sentences?.branches}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.branches || []}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip content={<Tip />} />
                <Legend />
                <Bar dataKey="add" name="In" fill={COLORS.add} onClick={(row) => onBranch(row.branchId)} />
                <Bar dataKey="out" name="Out" fill={COLORS.sold} onClick={(row) => onBranch(row.branchId)} />
                <Bar dataKey="transfer" name="Transfer" fill={COLORS.transfer} onClick={(row) => onBranch(row.branchId)} />
                <Bar dataKey="manual" name="Adjustment" fill={COLORS.minus} onClick={(row) => onBranch(row.branchId)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Why is stock being manually reduced or corrected?"
          measure="Only the reason stored on the row. Remarks are not guessed into categories."
          info={{
            what: 'The reason saved on add and minus rows, plus the products, branch, and people with the most of those rows. The remark is left as a note.',
            why: 'It shows why stock was corrected, and who recorded the most corrections.',
            when: 'Only inside the selected dates. Click a product or a person to open those movements.',
          }}
          sentence={data.sentences?.adjustments}
        >
          <ul className="text-sm space-y-1 text-[#334155]">
            {(data.adjustments?.reasons || []).length === 0 ? <li>No adjustment rows in this range.</li> : null}
            {(data.adjustments?.reasons || []).map((row) => (
              <li key={row.reason}>{row.label}: {row.count.toLocaleString()}</li>
            ))}
          </ul>
          <p className="text-xs text-[#64748B] mt-3">Highest adjustment activity</p>
          <ul className="text-sm mt-1 space-y-1">
            {(data.adjustments?.products || []).map((row) => (
              <li key={row.productId}>
                <button type="button" className="hover:underline text-left" onClick={() => onDrill({ productId: row.productId })}>
                  {row.title} {row.sku ? `(${row.sku})` : ''} · {row.count.toLocaleString()}
                </button>
              </li>
            ))}
          </ul>
          {data.adjustments?.topBranch?.manual ? (
            <p className="text-sm mt-2">{data.adjustments.topBranch.name} recorded the most manual adjustments ({data.adjustments.topBranch.manual.toLocaleString()}).</p>
          ) : null}
          <ul className="text-sm mt-2 space-y-1">
            {(data.adjustments?.operators || []).map((row) => (
              <li key={row.userId}>
                <button type="button" className="hover:underline" onClick={() => onDrill({ userId: row.userId })}>
                  {row.name}: {row.count.toLocaleString()}
                </button>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="On which days is inventory activity unusually high or low?"
          measure="Color intensity is the event count. A blank day inside the range had zero events. Days outside the range are not treated as missing records."
          info={{
            what: 'One square per day. A darker green means more events that day. A day inside the range with no rows is zero.',
            why: 'A quiet day or a spike is easier to see here than in a list.',
            when: 'The month on the card, inside the dates selected above. Days outside that range stay blank. Click a day to open that day’s movements.',
          }}
          sentence={data.sentences?.calendar}
          action={
            <div className="flex gap-2 mt-2">
              <button type="button" className="text-sm text-[#047857]" onClick={() => onCalendarMonth(-1)}>Previous month</button>
              <button type="button" className="text-sm text-[#047857]" onClick={() => onCalendarMonth(1)}>Next month</button>
            </div>
          }
        >
          <p className="text-sm font-medium text-[#0F172A] mb-2">{data.calendar?.label}</p>
          <div className="grid grid-cols-7 gap-1">
            {(data.calendar?.days || []).map((day) => {
              const max = Math.max(1, ...(data.calendar?.days || []).map((item) => item.count || 0));
              const strength = day.inRange ? (day.count || 0) / max : 0;
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={!day.inRange}
                  title={day.inRange ? `${day.label}: ${day.count} events` : `${day.label}: outside the selected range`}
                  onClick={() => onDrill({ dateFrom: day.date, dateTo: day.date, type: '' })}
                  className="h-9 rounded text-[10px] border border-[#E2E8F0] disabled:opacity-40"
                  style={{ background: day.inRange ? `rgba(4, 120, 87, ${0.08 + strength * 0.85})` : '#F8FAFC', color: strength > 0.6 ? '#fff' : '#0F172A' }}
                >
                  {Number(day.date.slice(-2))}
                  <span className="sr-only">{day.inRange ? `${day.count} events` : 'outside range'}</span>
                </button>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard
          title="Where is inventory being transferred?"
          measure="Source branch to destination branch. Each transfer is one move, not a company-level loss. Quantity is shown only when the route uses one unit."
          info={{
            what: 'Each line is stock moved from one branch to another. A transfer is one move. Quantity appears only when every product on that route uses the same unit.',
            why: 'It shows where stock is moving inside the company.',
            when: 'It uses the selected dates. A transfer out with no matching destination is listed on its own, with no destination filled in. Click a route to open those transfers.',
          }}
          sentence={data.sentences?.transfers}
          action={
            <button type="button" className="mt-2 text-sm text-[#047857] hover:underline" onClick={() => onDrill({ type: 'transfer' })}>
              Open transfer history
            </button>
          }
        >
          <ul className="text-sm space-y-2">
            {(data.transfers?.routes || []).length === 0 ? <li className="text-[#64748B]">No paired transfers in this range.</li> : null}
            {(data.transfers?.routes || []).map((route) => (
              <li key={`${route.source}-${route.destination}`}>
                <button
                  type="button"
                  className="text-left hover:underline"
                  onClick={() => onDrill({ type: 'transfer', refs: (route.refs || []).join(',') })}
                >
                  {route.source} → {route.destination}: {route.count.toLocaleString()} transfers
                  {route.qty != null ? ` · ${route.qty.toLocaleString()} ${route.unit}` : ''}
                </button>
              </li>
            ))}
          </ul>
          {data.transfers?.unpaired ? (
            <p className="text-sm text-[#92400E] mt-2">{data.transfers.unpaired.toLocaleString()} transfer outs have no matching destination.</p>
          ) : null}
        </ChartCard>
      </div>

      <ChartCard
        title="Which products have not moved recently?"
        measure="Sellable stock only. A qualifying movement is any ledger row except opening. No stock is not dead stock. A missing date is Unknown."
        info={{
          what: 'Current sellable stock, grouped by how many days have passed since the last movement after the opening balance. A missing date stays Unknown. Stock that is not on the shelf is left out.',
          why: 'It shows products that are still in stock and have gone quiet.',
          when: 'This is today’s stock, not the date range of the other charts. “View 45+ days” keeps only stock that has been quiet for more than 45 days. This is separate from the dead-stock tag.',
        }}
        sentence={data.sentences?.aging}
        action={
          <button type="button" className="mt-2 text-sm text-[#047857] hover:underline" onClick={() => onAging(data.aging?.filter === '45' ? '' : '45')}>
            {data.aging?.filter === '45' ? 'Show every age' : 'View 45+ days'}
          </button>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs mb-3">
          {Object.entries(data.aging?.counts || {}).map(([key, count]) => (
            <span key={key} className="px-2 py-1 rounded-full border border-[#E2E8F0] text-[#334155]">
              {key}: {Number(count).toLocaleString()}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#64748B]">
                <th className="py-1 pr-3">Product</th>
                <th className="py-1 pr-3">Qty</th>
                <th className="py-1 pr-3">Last movement</th>
                <th className="py-1 pr-3">Days</th>
                <th className="py-1">Branch</th>
              </tr>
            </thead>
            <tbody>
              {(data.aging?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-[#64748B]">No sellable stock in this view.</td>
                </tr>
              ) : null}
              {(data.aging?.items || []).map((row) => (
                <tr key={`${row.productId}-${row.locationId || row.branch}`} className="border-t border-[#E2E8F0]">
                  <td className="py-2 pr-3">
                    <button type="button" className="text-left hover:underline" onClick={() => onDrill({ productId: row.productId })}>
                      {row.title}
                      <span className="block text-xs text-[#64748B] font-mono">{row.sku || '—'}</span>
                    </button>
                  </td>
                  <td className="py-2 pr-3">{row.qty.toLocaleString()} {row.unit}</td>
                  <td className="py-2 pr-3">{row.lastLabel || 'Unknown'}</td>
                  <td className="py-2 pr-3">{row.days == null ? 'Unknown' : row.days}</td>
                  <td className="py-2">{row.branch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.aging?.truncated ? (
          <p className="text-xs text-[#64748B] mt-2">Showing the first matching stock rows. Narrow the branch or product to see the rest.</p>
        ) : null}
      </ChartCard>

      <section className="bg-white border border-[#E2E8F0] rounded-[12px] p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Unavailable from this ledger</h3>
        <ul className="mt-2 space-y-1 text-sm text-[#64748B]">
          {(data.unavailable || []).map((item) => (
            <li key={item.id}>{item.title}: {item.reason}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
