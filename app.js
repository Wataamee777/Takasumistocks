const API_URL = "https://api.takasumibot.com/v3/stock/";

const responseView = document.getElementById("responseView");
const historyList = document.getElementById("history");
const refreshButton = document.getElementById("refreshButton");
const intervalInput = document.getElementById("intervalInput");
const applyIntervalButton = document.getElementById("applyIntervalButton");
const canvas = document.getElementById("stockCanvas");
const ctx = canvas.getContext("2d");
const insightCards = document.getElementById("insightCards");
const buyCandidates = document.getElementById("buyCandidates");
const sellCandidates = document.getElementById("sellCandidates");

const pointHistory = new Map();
let leadSymbol = "stock";
let intervalId = null;

function formatDate(d) {
  return d.toLocaleTimeString("ja-JP", { hour12: false });
}

function formatNum(value) {
  return Number(value).toFixed(2);
}

function addPricePoint(symbol, value) {
  if (!pointHistory.has(symbol)) {
    pointHistory.set(symbol, []);
  }
  const points = pointHistory.get(symbol);
  points.push({ label: formatDate(new Date()), value });
  if (points.length > 40) {
    points.shift();
  }
}

function extractEntries(data) {
  if (typeof data?.stock === "number") {
    return [{ name: "stock", value: data.stock }];
  }

  const source = Array.isArray(data)
    ? data
    : Array.isArray(data?.stocks)
      ? data.stocks
      : Array.isArray(data?.data)
        ? data.data
        : null;

  if (source) {
    return source
      .map((item, index) => {
        const value = [item.stock, item.price, item.value].find((v) => typeof v === "number");
        if (typeof value !== "number") {
          return null;
        }
        const name = item.name || item.symbol || item.code || `stock-${index + 1}`;
        return { name, value };
      })
      .filter(Boolean);
  }

  if (data && typeof data === "object") {
    const numericProps = Object.entries(data).filter(([, v]) => typeof v === "number");
    if (numericProps.length > 0) {
      return numericProps.map(([key, value]) => ({ name: key, value }));
    }
  }

  throw new Error("銘柄データを解析できませんでした。");
}

function drawChart(symbol) {
  const points = pointHistory.get(symbol) || [];
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (points.length === 0) {
    ctx.fillStyle = "#333";
    ctx.font = "16px sans-serif";
    ctx.fillText("データがありません", 20, 40);
    return;
  }

  const values = points.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  ctx.strokeStyle = "#d0d0d0";
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = "#222";
    ctx.font = "12px sans-serif";
    ctx.fillText(formatNum(max - (range * i) / 4), 8, y + 4);
  }

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, i) => {
    const x = padding.left + (points.length === 1 ? 0 : (chartW * i) / (points.length - 1));
    const y = padding.top + ((max - point.value) / range) * chartH;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  ctx.fillStyle = "#111";
  ctx.font = "12px sans-serif";
  ctx.fillText(symbol, padding.left, 14);
}

function calcInsight() {
  const latest = [...pointHistory.entries()]
    .map(([name, points]) => ({ name, price: points[points.length - 1]?.value, points }))
    .filter((row) => typeof row.price === "number");

  if (latest.length === 0) {
    return null;
  }

  const cheapest = latest.reduce((a, b) => (a.price < b.price ? a : b));
  const highest = latest.reduce((a, b) => (a.price > b.price ? a : b));

  const buys = latest
    .map((row) => {
      const max = Math.max(...row.points.map((p) => p.value));
      const dropRate = (max - row.price) / max;
      return { ...row, max, dropRate };
    })
    .filter((row) => row.dropRate >= 0.1)
    .sort((a, b) => b.dropRate - a.dropRate)
    .slice(0, 5);

  const sells = latest
    .map((row) => {
      const min = Math.min(...row.points.map((p) => p.value));
      const riseRate = (row.price - min) / min;
      return { ...row, min, riseRate };
    })
    .filter((row) => row.riseRate >= 0.1)
    .sort((a, b) => b.riseRate - a.riseRate)
    .slice(0, 5);

  return { cheapest, highest, buys, sells };
}

function renderInsights() {
  const insight = calcInsight();
  insightCards.innerHTML = "";
  buyCandidates.innerHTML = "";
  sellCandidates.innerHTML = "";

  if (!insight) {
    return;
  }

  const cards = [
    { label: "現在最安値", value: `${insight.cheapest.name}: ${formatNum(insight.cheapest.price)}` },
    { label: "現在最高値", value: `${insight.highest.name}: ${formatNum(insight.highest.price)}` },
  ];

  cards.forEach((card) => {
    const div = document.createElement("div");
    div.className = "insight-card";
    div.innerHTML = `<div class="label">${card.label}</div><div class="value">${card.value}</div>`;
    insightCards.appendChild(div);
  });

  if (insight.buys.length === 0) {
    buyCandidates.innerHTML = "<li>該当なし</li>";
  } else {
    insight.buys.forEach((row) => {
      const li = document.createElement("li");
      li.textContent = `${row.name}: 現在 ${formatNum(row.price)} (最高値 ${formatNum(row.max)} から ${(row.dropRate * 100).toFixed(1)}% 下落)`;
      buyCandidates.appendChild(li);
    });
  }

  if (insight.sells.length === 0) {
    sellCandidates.innerHTML = "<li>該当なし</li>";
  } else {
    insight.sells.forEach((row) => {
      const li = document.createElement("li");
      li.textContent = `${row.name}: 現在 ${formatNum(row.price)} (最安値 ${formatNum(row.min)} から ${(row.riseRate * 100).toFixed(1)}% 上昇)`;
      sellCandidates.appendChild(li);
    });
  }
}

function updateHistoryView() {
  historyList.innerHTML = "";
  [...pointHistory.entries()].forEach(([name, points]) => {
    const last = points[points.length - 1];
    if (!last) {
      return;
    }
    const li = document.createElement("li");
    li.textContent = `${name}: ${formatNum(last.value)} (${last.label})`;
    historyList.appendChild(li);
  });
}

async function fetchStock() {
  try {
    const response = await fetch(API_URL, { method: "GET", headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    responseView.textContent = JSON.stringify(data, null, 2);

    const entries = extractEntries(data);
    if (entries.length === 0) {
      throw new Error("数値の stock 情報が見つかりませんでした。");
    }

    entries.forEach((entry) => addPricePoint(entry.name, entry.value));
    leadSymbol = entries[0].name;
    updateHistoryView();
    renderInsights();
    drawChart(leadSymbol);
  } catch (error) {
    responseView.textContent = `取得に失敗しました: ${error.message}`;
  }
}

function startAutoRefresh() {
  if (intervalId) {
    clearInterval(intervalId);
  }
  const seconds = Math.max(2, Number(intervalInput.value) || 5);
  intervalId = setInterval(fetchStock, seconds * 1000);
}

refreshButton.addEventListener("click", fetchStock);
applyIntervalButton.addEventListener("click", startAutoRefresh);

fetchStock();
startAutoRefresh();
