const API_URL = "https://api.takasumibot.com/v3/stock/";

const responseView = document.getElementById("responseView");
const historyList = document.getElementById("history");
const refreshButton = document.getElementById("refreshButton");
const intervalInput = document.getElementById("intervalInput");
const applyIntervalButton = document.getElementById("applyIntervalButton");
const canvas = document.getElementById("stockCanvas");
const ctx = canvas.getContext("2d");

const stockHistory = [];
let intervalId = null;

function formatDate(d) {
  return d.toLocaleTimeString("ja-JP", { hour12: false });
}

function drawChart() {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (stockHistory.length === 0) {
    ctx.fillStyle = "#333";
    ctx.font = "16px sans-serif";
    ctx.fillText("データがありません", 20, 40);
    return;
  }

  const values = stockHistory.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  ctx.strokeStyle = "#d0d0d0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const gridValue = max - (range * i) / 4;
    ctx.fillStyle = "#222";
    ctx.font = "12px sans-serif";
    ctx.fillText(gridValue.toFixed(2), 8, y + 4);
  }

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.beginPath();

  stockHistory.forEach((item, index) => {
    const x =
      padding.left +
      (stockHistory.length === 1 ? 0 : (chartW * index) / (stockHistory.length - 1));
    const y = padding.top + ((max - item.value) / range) * chartH;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  ctx.fillStyle = "#ef4444";
  stockHistory.forEach((item, index) => {
    const x =
      padding.left +
      (stockHistory.length === 1 ? 0 : (chartW * index) / (stockHistory.length - 1));
    const y = padding.top + ((max - item.value) / range) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  const first = stockHistory[0];
  const last = stockHistory[stockHistory.length - 1];
  ctx.fillStyle = "#111";
  ctx.font = "12px sans-serif";
  ctx.fillText(first.label, padding.left, height - 8);
  ctx.fillText(last.label, width - padding.right - 70, height - 8);
}

function updateHistoryView() {
  historyList.innerHTML = "";
  [...stockHistory].reverse().forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = `${entry.label}: ${entry.value}`;
    historyList.appendChild(li);
  });
}

function extractStockValue(data) {
  const value = data?.stock;
  if (typeof value !== "number") {
    throw new Error("レスポンスに数値の stock がありません。");
  }
  return value;
}

async function fetchStock() {
  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    responseView.textContent = JSON.stringify(data, null, 2);

    const stock = extractStockValue(data);
    const nowLabel = formatDate(new Date());

    stockHistory.push({ label: nowLabel, value: stock });
    if (stockHistory.length > 40) {
      stockHistory.shift();
    }

    updateHistoryView();
    drawChart();
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
