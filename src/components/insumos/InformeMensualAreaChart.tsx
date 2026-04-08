import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type MesUsoPrestamo = {
  mes: string
  usos: number
  prestamos: number
}

type InformeMensualAreaChartProps = {
  year: number
  data: MesUsoPrestamo[]
}

export function InformeMensualAreaChart({ year, data }: InformeMensualAreaChartProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
      <p className="mb-1 text-sm font-medium text-zinc-200">Usos y préstamos por mes</p>
      <p className="mb-4 text-xs text-zinc-500">Año calendario {year} (conteo por fecha de registro).</p>
      <div className="h-64 w-full min-h-[16rem]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="informeColorUsos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="informeColorPrest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: '#a1a1aa', fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={56} />
            <YAxis allowDecimals={false} tick={{ fill: '#a1a1aa', fontSize: 11 }} width={36} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e4e4e7',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
              formatter={(value) => <span className="text-zinc-300">{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="usos"
              name="Usos"
              stroke="#34d399"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#informeColorUsos)"
            />
            <Area
              type="monotone"
              dataKey="prestamos"
              name="Préstamos"
              stroke="#38bdf8"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#informeColorPrest)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
