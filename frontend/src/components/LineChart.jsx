import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// Eixo X por rótulos já formatados (hora local) em vez de uma escala de tempo real:
// evita depender de chartjs-adapter-date-fns só para um gráfico de linha simples,
// e o volume de pontos exibido de cada vez é sempre pequeno o bastante (a API pagina
// e filtra por período) para não precisar de uma escala temporal contínua.
export default function LineChart({ labels, data, label, color, unit, min, max }) {
  const chartData = {
    labels,
    datasets: [
      {
        label,
        data,
        borderColor: color,
        backgroundColor: color,
        tension: 0.3,
        pointRadius: labels.length > 40 ? 0 : 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${label}: ${ctx.parsed.y}${unit ?? ''}`,
        },
      },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 8, autoSkip: true } },
      y: { suggestedMin: min, suggestedMax: max },
    },
  };

  return (
    <div className="h-64">
      <Line data={chartData} options={options} />
    </div>
  );
}
